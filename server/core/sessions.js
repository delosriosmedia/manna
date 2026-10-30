import crypto from 'node:crypto';
import { HttpError } from './router.js';
import { cleanName } from './names.js';
import { createUsers, matches, sealed, validPin } from './users.js';

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
// La contraseña del superadministrador (fase 39, decisión 64): él sí la lleva, no un PIN.
const PASSWORD_MIN = 10;

export function createSessions({ storage, roles: all, cloud = false, superMode = false }) {
  // En la nube, solo sus funciones; en el equipo de la iglesia, solo las suyas (fase 36); en el sitio del
  // superadministrador, solo la suya (fase 39).
  const roles = all.filter((r) => Boolean(r.nube) === cloud && Boolean(r.super) === superMode);
  // El superadministrador: una sola cuenta, con su nombre y su contraseña.
  const account = superMode ? storage('superadmin', { name: '', password: null }) : null;
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
    // Una función que ya no existe (Control del orden): hay que entrar de nuevo.
    if (!s || !roleById.has(s.role)) return null;
    const user = s.user ? users.get(s.user) : null;
    // Un usuario que se quitó ya no tiene sesión.
    if (s.user && !user) {
      delete store.data.list[m[1]];
      store.save();
      return null;
    }
    return { id: m[1], role: s.role, created: s.created, user, admin: Boolean(user?.admin) };
  }

  // Lo que puede una sesión, para que la interfaz no ofrezca lo que aquí se rechazaría.
  const permissions = (session) => roleById.get(session?.role)?.permissions || [];

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

  // Cinco fallos bloquean esa IP y esa cuenta (key) un rato.
  function checkSecret(key, ip, ok, wrong) {
    const failIp = locked(`ip:${ip}`, LOCK_MS);
    const failKey = locked(key, USER_LOCK_MS);
    if (ok()) {
      fails.delete(`ip:${ip}`);
      fails.delete(key);
      return;
    }
    failIp();
    failKey();
    throw new HttpError(401, wrong);
  }
  const checkPin = (user, pin, ip) => checkSecret(`u:${user.id}`, ip, () => users.check(user.id, typeof pin === 'string' ? pin : ''), 'PIN incorrecto.');

  // La clave de alta (decisión 62): en la nube, la que el dueño puso en `MANNA_CLAVE_ALTA` deja crear el primer
  // administrador, con su nombre y su PIN (decisión 64); en el sitio del superadministrador, su cuenta, con su
  // contraseña. Sirve una sola vez. Para recuperar el acceso de una iglesia, el superadministrador puede darle otra,
  // que dura una semana (newAlta).
  const altaSecret = process.env.MANNA_CLAVE_ALTA || '';
  const envKey = () => (cloud && !(superMode ? account.data.password : users.claimed()) ? altaSecret : '');
  const recovery = () => (!superMode && store.data.recovery?.until > Date.now() ? store.data.recovery : null);
  const same = (a, b) => Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function alta(ctx, { clave, name, pin, password }) {
    if (!envKey() && !recovery()) throw new HttpError(409, superMode ? 'El superadministrador ya existe: entra con tu contraseña.' : 'Esta iglesia ya tiene administrador: entra con tu nombre y tu PIN.');
    const fail = locked(`ip:${ctx.ip}`, USER_LOCK_MS);
    const given = typeof clave === 'string' ? clave.trim() : '';
    if (!((envKey() && same(given, envKey())) || (recovery() && matches(given, recovery())))) {
      fail();
      throw new HttpError(401, 'La clave de alta no es esa.');
    }
    // Todo se comprueba antes de cambiar nada: a medias, la clave ya no serviría.
    if (superMode) {
      if (!cleanName(name)) throw new HttpError(400, 'Escribe tu nombre.');
      if (typeof password !== 'string' || password.length < PASSWORD_MIN) throw new HttpError(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
      account.data.name = cleanName(name);
      account.data.password = sealed(password);
      account.save();
      return open(ctx, { role: 'superadmin', password });
    }
    if (!validPin(String(pin ?? ''))) throw new HttpError(400, 'El PIN debe tener 4 números.');
    const admin = users.firstAdmin();
    users.update(admin.id, { name });
    users.setPin(admin.id, String(pin));
    users.claim();
    delete store.data.recovery;
    closeUser(admin.id);
    return open(ctx, { role: 'administrar', user: admin.id, pin: String(pin) });
  }
  function newAlta() {
    const clave = crypto.randomBytes(5).toString('hex');
    store.data.recovery = { ...sealed(clave), until: Date.now() + 7 * 86_400_000 };
    store.save();
    return clave;
  }

  function open(ctx, { role: roleId, user: userId, pin, password }) {
    const role = roleById.get(roleId);
    if (!role) throw new HttpError(400, 'Manna no reconoce esa función. Si acabas de actualizarlo, ciérralo y vuelve a abrirlo.');
    let user = null;
    if (role.super) checkSecret('super', ctx.ip, () => matches(password, account.data.password), 'Contraseña incorrecta.');
    else if (ctx.isLocal) user = users.firstAdmin();
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
    return { role: roleId, permissions: role.permissions, user: user ? { id: user.id, name: user.name, admin: user.admin } : null };
  }

  // Cambiar el PIN de alguien (o quitarlo) cierra sus sesiones, menos la de quien lo cambia (keep).
  function closeUser(userId, keep = null) {
    for (const [id, s] of Object.entries(store.data.list)) if (s.user === userId && id !== keep) delete store.data.list[id];
    store.save();
  }

  // Cuándo entró alguien por última vez (para el superadministrador).
  const lastUse = () => Math.max(0, ...Object.values(store.data.list).map((s) => s.created || 0));
  return { roles, users, fromRequest, can, permissions, open, closeUser, alta, newAlta, lastUse, altaPending: () => Boolean(envKey() || recovery()), superName: () => account?.data.name || null };
}
