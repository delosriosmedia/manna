import { HttpError } from '../../core/router.js';
import { setupDrive } from './drive.js';

// El superadministrador de Manna Iglesia (fase 39, decisión 64), en su propio sitio (admin.manna-iglesia.es, con
// `MANNA_SUPER=1`). Habla con cada iglesia por su dirección, con la clave que el dueño pone en `MANNA_CLAVE_SUPER` de
// cada sitio (modules/church): pide su estado y cambia lo que la iglesia puede usar. No escribe en sus datos.
// El espacio del plan del hosting lo escribe el dueño (lo dice el panel de Hostinger); se reparte entre las iglesias
// dejando un margen, y no se deja repartir más de lo que hay.
const GB = 1024 ** 3;

// La dirección de una iglesia: su nombre de sitio (https), o este mismo equipo con su puerto (las pruebas, por http).
export function churchUrl(text) {
  const raw = String(text ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (/^(localhost|127\.0\.0\.1):\d{2,5}$/.test(raw)) return `http://${raw}`;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw)) throw new HttpError(400, 'Escribe la dirección de la iglesia, por ejemplo nv.manna-iglesia.es.');
  return `https://${raw}`;
}
// Cuánto se puede repartir todavía: lo del plan, menos el margen, menos lo que ya tienen las demás (except: la que se cambia).
export function freeSpace({ total, margin }, churches, except = null) {
  const shared = churches.filter((c) => c.host !== except).reduce((sum, c) => sum + (c.settings?.space || 0), 0);
  return Math.max(0, Math.floor(total * (1 - margin)) - shared);
}

export default function setup(app) {
  if (!app.super) return;
  const { store } = app;
  const saved = app.storage('iglesias', { list: [], plan: { total: 0, margin: 0.15 } });
  const known = new Map(); // host → lo último que dijo
  // Las copias en Google Drive (fase 38).
  const drive = setupDrive(app, { ask, hosts: () => saved.data.list.map((c) => c.host), changed: () => publish() });
  const view = () => ({ plan: saved.data.plan, churches: saved.data.list.map(({ host }) => known.get(host) || { host, ok: null }), drive: drive.view() });
  store.register('super', view());
  const publish = () => store.set('super', view());

  async function ask(host, route, body) {
    const res = await fetch(`${churchUrl(host)}/api/nube/super/${route}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(20_000),
      headers: { authorization: `Bearer ${process.env.MANNA_CLAVE_SUPER || ''}`, ...(body && { 'content-type': 'application/json' }) },
      ...(body && { body: JSON.stringify(body) }),
    }).catch(() => null);
    if (!res) throw new HttpError(502, `No se pudo llegar a ${host}.`);
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(502, `${host}: ${out.error || `respondió ${res.status}`}`);
    return out;
  }
  const note = (host, out) => known.set(host, { host, ok: true, at: Date.now(), ...out });
  async function refresh(host) {
    try { note(host, await ask(host, 'estado')); } catch (err) { known.set(host, { ...known.get(host), host, ok: false, error: err.message, at: Date.now() }); }
  }
  const find = (host) => {
    const c = saved.data.list.find((x) => x.host === host);
    if (!c) throw new HttpError(404, 'Esa iglesia no está en el panel.');
    return c;
  };

  app.action('super.refresh', { permission: 'super.manage' }, async () => {
    await Promise.all(saved.data.list.map(({ host }) => refresh(host)));
    publish();
  });
  // Añadir una iglesia que ya tiene su sitio (crearlo es un paso de Hostinger): se comprueba que contesta con la clave.
  app.action('super.add', { permission: 'super.manage' }, async ({ host } = {}) => {
    const clean = new URL(churchUrl(host)).host;
    if (saved.data.list.some((c) => c.host === clean)) throw new HttpError(409, 'Esa iglesia ya está en el panel.');
    note(clean, await ask(clean, 'estado'));
    saved.data.list.push({ host: clean, added: Date.now() });
    saved.save();
    publish();
  });
  app.action('super.remove', { permission: 'super.manage' }, ({ host } = {}) => {
    find(host);
    saved.data.list = saved.data.list.filter((c) => c.host !== host);
    known.delete(host);
    saved.save();
    publish();
  });
  // Lo que puede usar una iglesia. El espacio no puede pasar de lo que queda libre en el plan.
  app.action('super.set', { permission: 'super.manage' }, async ({ host, settings } = {}) => {
    find(host);
    if (!settings || typeof settings !== 'object') throw new HttpError(400, 'Faltan los ajustes.');
    // Sin el espacio del plan escrito todavía, no se limita.
    if (Number.isFinite(settings.space) && saved.data.plan.total > 0) {
      const free = freeSpace(saved.data.plan, view().churches, host);
      if (settings.space > free) throw new HttpError(409, `No hay tanto espacio para repartir: quedan ${(free / GB).toFixed(1)} GB del plan (con su margen).`);
    }
    note(host, await ask(host, 'ajustes', settings));
    publish();
  });
  app.action('super.access', { permission: 'super.manage' }, async ({ host } = {}) => {
    find(host);
    return ask(host, 'acceso', {});
  });
  // El espacio del plan (lo dice el panel de Hostinger) y el margen que se deja sin repartir.
  app.action('super.plan', { permission: 'super.manage' }, ({ total, margin } = {}) => {
    if (!Number.isFinite(total) || total < 0 || total > 100_000 * GB) throw new HttpError(400, 'Escribe el espacio del plan en GB.');
    if (!Number.isFinite(margin) || margin < 0 || margin > 0.9) throw new HttpError(400, 'El margen va de 0 % a 90 %.');
    saved.data.plan = { total: Math.round(total), margin };
    saved.save();
    publish();
  });
}
