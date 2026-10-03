import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Store } from './store.js';
import { createStorage } from './storage.js';
import { createRouter, HttpError } from './router.js';
import { createSessions } from './sessions.js';
import { createRealtime } from './realtime.js';
import { ROLES } from '../roles.js';

// El "app" es lo que recibe cada módulo: estado compartido, rutas, acciones y almacenamiento.
export function createApp({ rootDir, dataDir, biblesDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(biblesDir, { recursive: true });

  const storage = createStorage(dataDir);
  const settings = storage('ajustes', { port: 8000 });
  const store = new Store();
  const sessions = createSessions({ storage, roles: ROLES });
  const router = createRouter({ webDir: path.join(rootDir, 'web'), mediaDir: path.join(dataDir, 'media'), sessions });
  const realtime = createRealtime({ store, router });
  const actions = new Map();
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
    const first = Number(process.env.PORT) || settings.data.port || 8000;
    return new Promise((resolve, reject) => {
      const attempt = (port) => {
        server = http.createServer(router.handle);
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE' && port < first + 10) attempt(port + 1);
          else reject(err);
        });
        server.listen(port, '0.0.0.0', () => {
          app.port = port;
          store.emit('listening', port);
          resolve(port);
        });
      };
      attempt(first);
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
