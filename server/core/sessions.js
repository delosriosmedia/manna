import crypto from 'node:crypto';
import { HttpError } from './router.js';
import { createUsers, validPin } from './users.js';

const COOKIE = 'manna_sid';
const MAX_FAILS = 5;
const LOCK_MS = 60_000;
// Por usuario (fase 35): tras 5 PIN equivocados, ese usuario espera 15 minutos, desde cualquier dispositivo.
const USER_LOCK_MS = 15 * 60_000;
// Cada dispositivo que entra deja una sesión (también cada pantalla de proyección): se guardan como mucho estas, y al
// pasarse se olvidan las más viejas (lo anotó la auditoría de la fase 9).
const MAX_SESSIONS = 500;
// Lo de Ajustes es solo del administrador de la iglesia, aunque la función lo permita (fase 35).
const ADMIN_ONLY = new Set(['system.admin', 'system.display', 'projection.style', 'users.manage']);

// Sesiones por dispositivo: cada una guarda la función (rol) elegida y quién entró (fase 35). Fuera del equipo
// principal, entrar en una función con PIN pide el nombre (de una lista) y el PIN de esa persona, una vez. El equipo
// principal entra sin PIN, como el administrador. La pantalla de proyección, sin nadie, salvo desde internet.
export function createSessions({ storage, roles: all, cloud = false }) {
  // En la nube, solo sus funciones; en el equipo de la iglesia, solo las suyas (fase 36).
  const roles = all.filter((r) => Boolean(r.nube) === cloud);
  const store = storage('sesiones', { list: {} });
  const users = createUsers({ storage, legacyPin: store.data.pin });
  // Al pasar del PIN único a los usuarios, las sesiones abiertas pasan a ser del administrador.
  if (users.created) for (const s of Object.values(store.data.list)) s.user = users.created.id;
  if ('pin' in store.data || users.created) {
    delete store.data.pin;
    store.save();
  }
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const fails = new Map(); // ip o usuario -> { count, until }

  function fromRequest(req) {
    const m = /(?:^|;\s*)manna_sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
    const s = m && store.data.list[m[1]];
    if (!s) return null;
    const user = s.user ? users.get(s.user) : null;
    // Un usuario que se quitó ya no tiene sesión.
    if (s.user && !user) {
      delete store.data.list[m[1]];
      store.save();
      return null;
    }
    return { id: m[1], role: s.role, created: s.created, user, admin: Boolean(user?.admin) };
  }

  function can(session, permission) {
    const role = session && roleById.get(session.role);
    if (!role || !(role.permissions.includes('*') || role.permissions.includes(permission))) return false;
    return !ADMIN_ONLY.has(permission) || session.admin;
  }

  function locked(key, ms) {
    const f = fails.get(key);
    if (f && f.until > Date.now()) throw new HttpError(429, `Demasiados intentos. Espera ${Math.ceil((f.until - Date.now()) / 1000) > 90 ? `${Math.ceil((f.until - Date.now()) / 60_000)} minutos` : `${Math.ceil((f.until - Date.now()) / 1000)} segundos`}.`);
    return () => {
      const count = (f?.count || 0) + 1;
      fails.set(key, count >= MAX_FAILS ? { count: 0, until: Date.now() + ms } : { count, until: 0 });
    };
  }

  function checkPin(user, pin, ip) {
    const failIp = locked(`ip:${ip}`, LOCK_MS);
    const failUser = locked(`u:${user.id}`, USER_LOCK_MS);
    if (users.check(user.id, typeof pin === 'string' ? pin : '')) {
      fails.delete(`ip:${ip}`);
      fails.delete(`u:${user.id}`);
      return;
    }
    failIp();
    failUser();
    throw new HttpError(401, 'PIN incorrecto.');
  }

  // La clave de alta (decisión 62): en la nube, la que el dueño puso en `MANNA_CLAVE_ALTA` deja crear el primer
  // administrador, con su nombre y su PIN (decisión 64). Sirve una sola vez.
  const altaSecret = process.env.MANNA_CLAVE_ALTA || '';
  const altaKey = () => (cloud && !users.claimed() ? altaSecret : '');
  function alta(ctx, { clave, name, pin }) {
    const key = altaKey();
    if (!key) throw new HttpError(409, 'Esta iglesia ya tiene administrador: entra con tu nombre y tu PIN.');
    const fail = locked(`ip:${ctx.ip}`, USER_LOCK_MS);
    const given = Buffer.from(typeof clave === 'string' ? clave : '');
    if (given.length !== Buffer.byteLength(key) || !crypto.timingSafeEqual(given, Buffer.from(key))) {
      fail();
      throw new HttpError(401, 'La clave de alta no es esa.');
    }
    // Todo se comprueba antes de cambiar nada: a medias, la clave ya no serviría.
    if (!validPin(String(pin ?? ''))) throw new HttpError(400, 'El PIN debe tener 4 números.');
    const admin = users.firstAdmin();
    users.update(admin.id, { name });
    users.setPin(admin.id, String(pin));
    users.claim();
    closeUser(admin.id);
    return open(ctx, { role: 'administrar', user: admin.id, pin: String(pin) });
  }

  function open(ctx, { role: roleId, user: userId, pin }) {
    const role = roleById.get(roleId);
    if (!role) throw new HttpError(400, 'Manna no reconoce esa función. Si acabas de actualizarlo, ciérralo y vuelve a abrirlo.');
    let user = null;
    if (ctx.isLocal) user = users.firstAdmin();
    else if (role.requiresPin || ctx.internet) {
      // Desde internet, también la pantalla de proyección.
      user = users.get(userId);
      if (!user) throw new HttpError(400, 'Elige tu nombre en la lista.');
      // Administrar, solo un administrador; preparar el culto, todos los usuarios de la iglesia.
      if (role.id === 'administrar' && !user.admin) throw new HttpError(403, `${user.name} no es administrador de la iglesia.`);
      if (!['proyeccion', 'preparacion', 'administrar'].includes(role.id) && !user.functions.includes(role.id)) {
        throw new HttpError(403, `${user.name} no puede usar «${role.name}». Se lo da el administrador, en Ajustes → Usuarios.`);
      }
      // Quien ya entró con su PIN cambia de función sin volver a escribirlo.
      if (ctx.session?.user?.id !== user.id) checkPin(user, pin, ctx.ip);
    }
    if (ctx.session) delete store.data.list[ctx.session.id];
    const id = crypto.randomBytes(24).toString('hex');
    store.data.list[id] = { role: roleId, user: user?.id || null, created: Date.now() };
    const ids = Object.keys(store.data.list);
    if (ids.length > MAX_SESSIONS) {
      ids.sort((a, b) => store.data.list[a].created - store.data.list[b].created);
      for (const old of ids.slice(0, ids.length - MAX_SESSIONS)) delete store.data.list[old];
    }
    store.save();
    // Por https (el túnel, el hosting de la nube), la cookie solo viaja cifrada.
    const secure = ctx.req?.socket.encrypted || ctx.req?.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    ctx.res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
    return { role: roleId, user: user ? { id: user.id, name: user.name, admin: user.admin } : null };
  }

  // Cambiar el PIN de alguien (o quitarlo) cierra sus sesiones, menos la de quien lo cambia (keep).
  function closeUser(userId, keep = null) {
    for (const [id, s] of Object.entries(store.data.list)) if (s.user === userId && id !== keep) delete store.data.list[id];
    store.save();
  }

  return { roles, users, fromRequest, can, open, closeUser, alta, altaPending: () => Boolean(altaKey()) };
}
