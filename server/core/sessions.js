import crypto from 'node:crypto';
import { HttpError } from './router.js';

const COOKIE = 'manna_sid';
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

// Sesiones por dispositivo: cada una guarda la función (rol) elegida. Los roles con PIN
// lo piden una vez; el equipo servidor (localhost) nunca necesita PIN.
export function createSessions({ storage, roles }) {
  const store = storage('sesiones', { pin: null, list: {} });
  if (!store.data.pin) {
    store.data.pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    store.save();
  }
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const fails = new Map(); // ip -> { count, until }

  function fromRequest(req) {
    const m = /(?:^|;\s*)manna_sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
    const s = m && store.data.list[m[1]];
    return s ? { id: m[1], ...s } : null;
  }

  function can(session, permission) {
    const role = session && roleById.get(session.role);
    return Boolean(role && (role.permissions.includes('*') || role.permissions.includes(permission)));
  }

  function checkPin(pin, ip) {
    const f = fails.get(ip);
    if (f && f.until > Date.now()) {
      throw new HttpError(429, `Demasiados intentos. Espera ${Math.ceil((f.until - Date.now()) / 1000)} segundos.`);
    }
    const ok = typeof pin === 'string' && pin.length === store.data.pin.length
      && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(store.data.pin));
    if (ok) {
      fails.delete(ip);
      return;
    }
    const count = (f?.count || 0) + 1;
    fails.set(ip, count >= MAX_FAILS ? { count: 0, until: Date.now() + LOCK_MS } : { count, until: 0 });
    throw new HttpError(401, 'PIN incorrecto.');
  }

  function open(ctx, { role: roleId, pin }) {
    const role = roleById.get(roleId);
    if (!role) throw new HttpError(400, 'Función desconocida.');
    const sameRole = ctx.session?.role === roleId;
    if (role.requiresPin && !ctx.isLocal && !sameRole) checkPin(pin, ctx.ip);
    if (ctx.session) delete store.data.list[ctx.session.id];
    const id = crypto.randomBytes(24).toString('hex');
    store.data.list[id] = { role: roleId, local: ctx.isLocal, created: Date.now() };
    store.save();
    ctx.res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
    return { role: roleId };
  }

  function setPin(pin) {
    if (!/^\d{4,8}$/.test(pin || '')) throw new HttpError(400, 'El PIN debe tener entre 4 y 8 números.');
    store.data.pin = pin;
    // Los dispositivos remotos deben volver a escribir el PIN nuevo.
    for (const [id, s] of Object.entries(store.data.list)) if (!s.local) delete store.data.list[id];
    store.save();
  }

  return {
    roles,
    fromRequest,
    can,
    open,
    setPin,
    get pin() { return store.data.pin; },
  };
}
