import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Store } from './store.js';
import { createStorage } from './storage.js';
import { createRouter, HttpError } from './router.js';
import { createSessions } from './sessions.js';
import { createRealtime } from './realtime.js';
import { ROLES } from '../roles.js';

// Puertos a intentar, en orden. Sin puerto fijado se prefiere el 80, que permite entrar sin
// escribir ":8000" en la dirección; si no está disponible, del 8000 en adelante.
export function portCandidates(fixed) {
  const first = fixed || 8000;
  const rest = Array.from({ length: 11 }, (_, i) => first + i);
  return fixed ? rest : [80, ...rest];
}

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
  const router = createRouter({ webDir: path.join(rootDir, 'web'), mediaDir: path.join(dataDir, 'media'), sessions });
  const realtime = createRealtime({ store, router });
  const actions = new Map();
  const kinds = new Map();
  const closers = [];

  const app = {
    rootDir, dataDir, biblesDir,
    store, storage, settings, sessions, realtime,
    services: {},
    port: null,
    route: router.route,
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
    // Tipos de contenido proyectable ('verses', y en el futuro 'song', 'image', 'video', 'slides').
    // Cada módulo registra el suyo: { label, describe(data), resolve(data, step), neighbor?(data, step, delta) }.
    //   describe  -> { title, subtitle, steps, data } para la lista del orden del culto, o null si no existe
    //   resolve   -> lo que se proyecta. step null = el elemento entero; 0..n-1 = uno de sus pasos
    //   neighbor  -> qué sigue al avanzar fuera del orden del culto (p. ej. el versículo siguiente)
    kinds,
    kind(name, def) { kinds.set(name, def); },
    shutdown: null, // lo asigna server/app.js: apagado ordenado de todo el programa
    listen,
    close,
  };

  router.route('POST', '/api/action', async (ctx) => {
    const { type, payload } = await ctx.json();
    const def = actions.get(type);
    if (!def) throw new HttpError(404, `Acción desconocida: ${type}`);
    ctx.require(def.permission);
    return { result: (await def.handler(payload || {}, ctx)) ?? null };
  });

  router.route('GET', '/api/state', () => store.snapshot());

  let server;
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
        server.listen(ports[i], process.env.MANNA_HOST || '0.0.0.0', () => {
          app.port = ports[i];
          store.emit('listening', app.port);
          resolve(app.port);
        });
      };
      attempt(0);
    });
  }

  async function close() {
    for (const fn of closers) await fn();
    storage.flushAll();
    realtime.close();
    server?.close();
  }

  return app;
}
