import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Store } from './store.js';
import { createStorage } from './storage.js';
import { createRouter, HttpError } from './router.js';
import { createSessions } from './sessions.js';
import { createRealtime } from './realtime.js';
import { createJobs } from './jobs.js';
import { setupTools } from './tools.js';
import { ROLES } from '../roles.js';

// Puertos a intentar, en orden. Sin puerto fijado se prefiere el 80, que permite entrar sin
// escribir ":8000" en la dirección; si no está disponible, del 8000 en adelante.
export function portCandidates(fixed) {
  const first = fixed || 8000;
  const rest = Array.from({ length: 11 }, (_, i) => first + i);
  return fixed ? rest : [80, ...rest];
}

// Hay navegadores, sobre todo en televisores, que no abren una dirección sin puerto: la convierten
// en una búsqueda o en una página segura (https) que Manna no ofrece. Por eso, cuando Manna atiende
// en el puerto 80, atiende también en este, que se puede escribir a mano: "192.168.1.14:8000".
const ALT_PORT = 8000;

// El "app" es lo que recibe cada módulo: estado compartido, rutas, acciones y almacenamiento.
export function createApp({ rootDir, dataDir, biblesDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(biblesDir, { recursive: true });

  const storage = createStorage(dataDir);
  const settings = storage('ajustes', {});
  // Identifica esta instalación (estos datos). Sirve para saber si un Manna que responde en la red
  // es este mismo: al pulsar el icono dos veces, o al comprobar la dirección "manna.local".
  if (!settings.data.id) {
    settings.data.id = crypto.randomBytes(8).toString('hex');
    settings.save();
    settings.flush();
  }
  const store = new Store();
  const sessions = createSessions({ storage, roles: ROLES });
  const router = createRouter({ webDir: path.join(rootDir, 'web'), sessions });
  const realtime = createRealtime({ store, router });
  const jobs = createJobs({ store });
  const actions = new Map();
  const kinds = new Map();
  const closers = [];

  // Lo que se sube desde la app (fondos, imágenes, medios) se guarda aquí y se sirve por /media/.
  const uploadsDir = path.join(dataDir, 'media');
  // Archivos de paso (descargas, conversiones al vuelo). Se vacía al abrir y al cerrar Manna.
  const tmpDir = path.join(dataDir, 'tmp');
  const emptyTmp = () => fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
  fs.mkdirSync(uploadsDir, { recursive: true });
  router.mount('/media/', uploadsDir);

  const app = {
    rootDir, dataDir, biblesDir, uploadsDir, tmpDir,
    store, storage, settings, sessions, realtime, jobs,
    services: {},
    port: null,
    altPort: null, // segundo puerto en el que también atiende, o null (ver ALT_PORT)
    route: router.route,
    // mount('/himnario/', carpeta): sirve una carpeta de contenido (con saltos, para video y audio).
    mount: router.mount,
    action(type, { permission }, handler) {
      actions.set(type, { permission, handler });
    },
    // Permite que un módulo ejecute la acción de otro sin pasar por HTTP.
    run(type, payload = {}) {
      const def = actions.get(type);
      if (!def) throw new HttpError(404, `Acción desconocida: ${type}`);
      return def.handler(payload);
    },
    onClose(fn) { closers.push(fn); },
    // Tipos de contenido proyectable ('verses', 'testcard', y los que añada cada módulo).
    // Cada módulo registra el suyo:
    //   label     nombre del tipo
    //   describe(data)            -> { title, subtitle, steps, data } para el orden del culto, o null si ya no existe
    //   resolve(data, step)       -> lo que se proyecta. step null = el elemento entero; 0..n-1 = uno de sus pasos
    //   neighbor?(data, step, d)  -> qué sigue al avanzar fuera del orden del culto (p. ej. el versículo siguiente)
    //   live?(content, previous)  -> estado inicial de sus mandos en vivo (zoom, reproducción), o null si no tiene.
    //                                previous = { state, at } cuando se recupera tras un reinicio del servidor
    //   control?(state, patch, { content, now }) -> estado nuevo tras una orden; valida el patch
    kinds,
    kind(name, def) { kinds.set(name, def); },
    shutdown: null, // lo asigna server/app.js: apagado ordenado de todo el programa
    // Atiende una petición HTTP. Lo usa listen(); las pruebas lo montan en su propio servidor.
    handle: router.handle,
    listen,
    close,
  };
  app.tools = setupTools(app);

  app.action('jobs.dismiss', { permission: 'jobs.manage' }, ({ id }) => jobs.dismiss(String(id)));

  router.route('POST', '/api/action', async (ctx) => {
    const { type, payload } = await ctx.json();
    const def = actions.get(type);
    if (!def) throw new HttpError(404, `Acción desconocida: ${type}`);
    ctx.require(def.permission);
    return { result: (await def.handler(payload || {}, ctx)) ?? null };
  });

  router.route('GET', '/api/state', () => store.snapshot());

  let server;
  let altServer = null;
  const host = () => process.env.MANNA_HOST || '0.0.0.0';

  // Si no se puede (otro programa usa ese puerto), Manna sigue con el principal.
  function listenAlso(port) {
    return new Promise((resolve) => {
      const extra = http.createServer(router.handle);
      extra.once('error', () => resolve());
      extra.listen(port, host(), () => {
        altServer = extra;
        app.altPort = port;
        resolve();
      });
    });
  }

  function listen() {
    const ports = portCandidates(Number(process.env.PORT) || settings.data.port);
    return new Promise((resolve, reject) => {
      const attempt = (i) => {
        server = http.createServer(router.handle);
        server.once('error', (err) => {
          // Ocupado por otro programa, o el sistema no deja usarlo: se prueba el siguiente.
          if (['EADDRINUSE', 'EACCES'].includes(err.code) && i + 1 < ports.length) attempt(i + 1);
          else reject(err);
        });
        server.listen(ports[i], host(), async () => {
          // Hasta aquí no se toca la carpeta temporal: podría ser de otro Manna ya abierto con estos datos.
          emptyTmp();
          fs.mkdirSync(tmpDir, { recursive: true });
          app.port = ports[i];
          if (app.port === 80) await listenAlso(ALT_PORT);
          store.emit('listening', app.port);
          resolve(app.port);
        });
      };
      attempt(0);
    });
  }

  async function close() {
    for (const fn of closers) await fn();
    jobs.close();
    storage.flushAll();
    realtime.close();
    server?.close();
    altServer?.close();
    if (app.port) emptyTmp();
  }

  return app;
}
