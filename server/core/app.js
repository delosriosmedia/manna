import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Store } from './store.js';
import { createStorage } from './storage.js';
import { createRouter, HttpError } from './router.js';
import { createSessions } from './sessions.js';
import { createRealtime } from './realtime.js';
import { createJobs } from './jobs.js';
import { setupTools } from './tools.js';
import { loadCertificate } from './cert.js';
import { createListener } from './listener.js';
import { codeSignature } from './build.js';
import { ROLES } from '../roles.js';

// Puertos a intentar, en orden. Sin puerto fijado se prefiere el 80, que permite entrar sin
// escribir ":8000" en la dirección; si no está disponible, del 8000 en adelante.
export function portCandidates(fixed) {
  const first = fixed || 8000;
  const rest = Array.from({ length: 11 }, (_, i) => first + i);
  return fixed ? rest : [80, ...rest];
}

// Hay navegadores, sobre todo en televisores, que no abren una dirección sin puerto: la convierten
// en una búsqueda o en una página segura (https). Por eso, cuando Manna atiende en el puerto 80,
// atiende también en este, que se puede escribir a mano ("192.168.1.14:8000"), y en el de https,
// que es al que va el navegador cuando convierte la dirección por su cuenta.
const ALT_PORT = 8000;
const SECURE_PORT = 443;

// Nombre con el que Manna se anuncia en la red ("manna" -> manna.local).
export const networkName = () => (process.env.MANNA_NAME || 'manna').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'manna';

const LOOPBACK = new Set(['127.0.0.1', '::1']);
const MAX_ARRIVALS = 200;

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
    // Huella del código con el que arrancó este servidor (ver core/build.js).
    build: process.env.MANNA_HUELLA || codeSignature(rootDir),
    port: null,
    altPort: null, // segundo puerto en el que también atiende, o null (ver ALT_PORT)
    secure: false, // ¿atiende también por https? (todos sus puertos sirven para las dos formas)
    securePort: null, // puerto propio de https (443), o null
    // Quién ha llegado desde la red y cómo: ip -> { at, secure, error, errorAt }. Con ello un módulo
    // puede explicar por qué un equipo no logra entrar (p. ej. un televisor que rechaza el certificado).
    arrivals: new Map(),
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
    restart: null,  // lo asigna server/app.js: cierra y vuelve a abrir con el código que haya en disco
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
    if (!def) throw new HttpError(404, `Manna no reconoce la orden «${String(type).slice(0, 60)}». Si acabas de actualizarlo, reinícialo desde Ajustes.`);
    ctx.require(def.permission);
    return { result: (await def.handler(payload || {}, ctx)) ?? null };
  });

  router.route('GET', '/api/state', () => store.snapshot());

  let server;
  const extraServers = [];
  const host = () => process.env.MANNA_HOST || '0.0.0.0';

  function noteArrival({ ip, secure, error }) {
    if (LOOPBACK.has(ip)) return;
    const previous = app.arrivals.get(ip);
    const now = Date.now();
    app.arrivals.delete(ip); // al volver a entrar queda como el más reciente
    app.arrivals.set(ip, error
      ? { ...previous, at: previous?.at || now, secure: true, error, errorAt: now }
      : { at: now, secure, error: previous?.error || null, errorAt: previous?.errorAt || 0 });
    if (app.arrivals.size > MAX_ARRIVALS) app.arrivals.delete(app.arrivals.keys().next().value);
    store.emit('arrival', ip);
  }

  // El certificado se crea la primera vez y se guarda con los datos. Si no se puede, Manna sigue
  // solo con http: nada de esto debe impedir el arranque.
  async function certificate() {
    if (process.env.MANNA_SIN_HTTPS) return null;
    try {
      const ips = Object.values(os.networkInterfaces()).flat().filter((n) => n?.family === 'IPv4').map((n) => n.address);
      return await loadCertificate(path.join(dataDir, 'certificado'), { names: ['localhost', `${networkName()}.local`], ips });
    } catch (err) {
      console.error('No se pudo preparar la conexión segura (https):', err?.message || err);
      return null;
    }
  }

  // Si no se puede (otro programa usa ese puerto), Manna sigue con el principal.
  function listenAlso(port, secure) {
    return new Promise((resolve) => {
      const extra = createListener(router.handle, secure, { onArrival: noteArrival });
      extra.once('error', () => resolve(false));
      extra.listen(port, host(), () => {
        extraServers.push(extra);
        resolve(true);
      });
    });
  }

  async function listen() {
    const ports = portCandidates(Number(process.env.PORT) || settings.data.port);
    const secure = await certificate();
    return new Promise((resolve, reject) => {
      const attempt = (i) => {
        server = createListener(router.handle, secure, { onArrival: noteArrival });
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
          app.secure = Boolean(secure);
          if (app.port === 80) {
            if (await listenAlso(ALT_PORT, secure)) app.altPort = ALT_PORT;
            if (secure && await listenAlso(SECURE_PORT, secure)) app.securePort = SECURE_PORT;
          }
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
    for (const extra of extraServers) extra.close();
    if (app.port) emptyTmp();
  }

  return app;
}
