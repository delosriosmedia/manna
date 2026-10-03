import os from 'node:os';
import { HttpError } from '../../core/router.js';

function lanAddresses(port) {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) urls.push(`http://${net.address}:${port}`);
    }
  }
  return urls;
}

// Módulo de sistema: funciones (roles), sesiones, PIN y direcciones de red.
export default function setup(app) {
  const { store, sessions } = app;

  store.register('system', { name: 'Manna', addresses: [], port: null });
  const refreshAddresses = () => store.set('system', { addresses: lanAddresses(app.port), port: app.port });
  store.on('listening', refreshAddresses);
  // La IP puede cambiar si el equipo cambia de red.
  const timer = setInterval(() => {
    const next = lanAddresses(app.port);
    if (next.join() !== store.get('system').addresses.join()) refreshAddresses();
  }, 15_000);
  timer.unref();

  const publicRoles = () => sessions.roles.map(({ id, name, description, path, requiresPin }) => ({ id, name, description, path, requiresPin }));

  app.route('GET', '/api/session', (ctx) => ({
    role: ctx.session?.role || null,
    isLocal: ctx.isLocal,
    roles: publicRoles(),
  }));

  app.route('POST', '/api/session', async (ctx) => sessions.open(ctx, await ctx.json()));

  // El PIN solo se puede ver desde el propio equipo servidor.
  app.route('GET', '/api/system/pin', (ctx) => {
    if (!ctx.isLocal) throw new HttpError(403, 'El PIN solo se muestra en el equipo principal.');
    return { pin: sessions.pin };
  });

  app.action('system.setPin', { permission: 'system.admin' }, ({ pin }) => {
    sessions.setPin(String(pin ?? ''));
  });
}
