import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { restoreSet } from '../../core/sync.js';

// Lo que el superadministrador de Manna Iglesia deja a cada iglesia (fase 39, decisión 64): si está activa, qué módulos
// puede usar, en qué orden salen en cada función, si su gente sube archivos desde casa y cuánto espacio tiene, y su
// máximo de órdenes. Vive en la nube de cada iglesia (data/iglesia.json): el superadministrador lo pide y lo cambia
// por /api/nube/super/, con la clave que el dueño pone en `MANNA_CLAVE_SUPER` de cada sitio (y del suyo). El equipo
// oficial lo recibe con lo demás (/api/nube/estado) y lo guarda, así vale también sin internet; suspender la iglesia
// solo cierra su nube: el culto en su equipo sigue.

// Los módulos que se pueden apagar, con lo que hacen en el servidor (el Orden no se apaga: ahí confluye todo).
export const SWITCHABLE = { biblia: ['bible.'], himnario: ['hymns.'], medios: ['media.', 'slides.'], textos: ['texts.'], tiempo: ['time.'], paginas: ['web.'], capas: ['layers.'] };
// Las funciones cuyo orden de módulos se puede cambiar, y los módulos que se pueden ordenar.
export const LAYOUT_ROLES = ['control', 'alabanza', 'preparacion'];
const ORDERABLE = ['orden', ...Object.keys(SWITCHABLE)];
const GB = 1024 ** 3;
const DEFAULTS = { active: true, off: [], layout: {}, uploads: true, space: 5 * GB };

// Lo que llega del superadministrador, con la forma que debe tener (lo que falta o no vale, como estaba).
export function cleanSettings(input, base = DEFAULTS) {
  const out = { ...DEFAULTS, ...base };
  if (typeof input?.active === 'boolean') out.active = input.active;
  if (Array.isArray(input?.off)) out.off = Object.keys(SWITCHABLE).filter((id) => input.off.includes(id));
  if (input?.layout && typeof input.layout === 'object') {
    out.layout = {};
    for (const role of LAYOUT_ROLES) {
      const list = input.layout[role];
      if (Array.isArray(list)) out.layout[role] = [...new Set(list.filter((id) => ORDERABLE.includes(id)))];
    }
  }
  if (typeof input?.uploads === 'boolean') out.uploads = input.uploads;
  if (Number.isFinite(input?.space) && input.space >= 0 && input.space <= 1024 * GB) out.space = Math.round(input.space);
  return out;
}

// Cuánto ocupa una carpeta, en bytes.
function sizeOf(dir) {
  let total = 0;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) total += sizeOf(full);
    else try { total += fs.statSync(full).size; } catch { /* desapareció */ }
  }
  return total;
}

export default function setup(app) {
  const { store } = app;
  const saved = app.storage('iglesia', { ...DEFAULTS });
  Object.assign(saved.data, cleanSettings(saved.data));
  const view = () => ({ active: saved.data.active, off: saved.data.off, layout: saved.data.layout, uploads: saved.data.uploads, space: saved.data.space });
  store.register('church', view());
  // En la nube, una iglesia suspendida no deja entrar ni cambiar nada (core/app.js).
  const suspend = () => { app.suspended = app.cloud && !saved.data.active; };
  suspend();
  // Lo de aquí, con el máximo de órdenes (que guarda el Orden).
  const settings = () => ({ ...view(), limit: app.services.order?.limit() ?? null });
  function apply(input) {
    const next = cleanSettings(input, saved.data);
    const limit = Number.isInteger(input?.limit) && input.limit !== app.services.order?.limit();
    if (JSON.stringify(next) === JSON.stringify(cleanSettings(saved.data)) && !limit) return;
    Object.assign(saved.data, next);
    saved.save();
    if (Number.isInteger(input?.limit)) app.services.order?.setLimit(input.limit);
    suspend();
    store.set('church', view());
  }
  // ¿Cabe lo que se sube desde casa (decisión 64)? Lo de la nube que aún no llegó a la iglesia más esto, dentro del espacio.
  let pending = null; // { at, bytes }: se mide como mucho cada medio minuto
  const sent = () => {
    if (!pending || Date.now() - pending.at > 30_000) pending = { at: Date.now(), bytes: sizeOf(app.uploadsDir) + sizeOf(path.join(app.dataDir, 'presentaciones')) };
    return pending.bytes;
  };
  function room(bytes) {
    if (!saved.data.uploads) throw new HttpError(403, 'Esta iglesia no sube archivos desde casa: lo activa quien administra Manna Iglesia.');
    const free = saved.data.space - sent();
    if (bytes > free) throw new HttpError(413, `No cabe: a esta iglesia le quedan ${Math.max(0, free / 1024 ** 3).toFixed(1).replace('.', ',')} GB para subir desde casa. Lo que ya llegó a la iglesia deja de contar.`);
    pending.bytes += bytes;
  }
  app.services.church = {
    view,
    settings,
    room,
    // El equipo oficial guarda lo que le llega de su nube, salvo suspender: el culto sigue.
    apply: (input) => apply({ ...input, active: true }),
    // ¿Esta orden es de un módulo apagado? Devuelve por qué, o null.
    refuses(type) {
      const off = saved.data.off.find((id) => SWITCHABLE[id].some((prefix) => String(type).startsWith(prefix)));
      return off ? 'Esta iglesia no tiene ese módulo: lo enciende quien administra Manna Iglesia.' : null;
    },
  };
  if (!app.cloud || app.super) return;

  // ---- Lo que pide el superadministrador, con la clave del sitio ----
  const authorize = (ctx) => {
    const key = process.env.MANNA_CLAVE_SUPER || '';
    const given = /^Bearer (.+)$/.exec(ctx.req.headers.authorization || '')?.[1] || '';
    const a = crypto.createHash('sha256').update(given).digest();
    if (!key || !crypto.timingSafeEqual(a, crypto.createHash('sha256').update(key).digest())) throw new HttpError(401, 'Esa no es la clave del superadministrador.');
  };
  let used = null; // { at, bytes }: medir la carpeta de datos cuesta, se guarda 10 minutos
  const state = (ctx) => {
    if (!used || Date.now() - used.at > 600_000) used = { at: Date.now(), bytes: sizeOf(app.dataDir) };
    return {
      church: String(ctx.req.headers.host || '').slice(0, 100),
      version: store.get('system')?.version || null,
      settings: settings(),
      metrics: {
        users: app.sessions.users.list().length,
        orders: app.services.order?.sync?.export().records.length ?? 0,
        used: used.bytes,
        lastUse: app.sessions.lastUse() || null,
        official: store.get('cloud')?.official || null,
      },
    };
  };
  app.route('GET', '/api/nube/super/estado', (ctx) => {
    authorize(ctx);
    return state(ctx);
  });
  app.route('POST', '/api/nube/super/ajustes', async (ctx) => {
    authorize(ctx);
    apply(await ctx.json());
    return state(ctx);
  });
  // Recuperar el acceso: una clave de alta nueva, que dura una semana, para que el administrador vuelva a entrar.
  app.route('POST', '/api/nube/super/acceso', (ctx) => {
    authorize(ctx);
    return { clave: app.sessions.newAlta() };
  });

  // ---- La copia de seguridad (fase 38) ----
  // Lo que la iglesia hace y no se puede volver a sacar de otro sitio: usuarios (con la huella del PIN), órdenes, textos,
  // favoritos y ajustes; la lista de la biblioteca va solo para saber qué había (los archivos están en su equipo).
  const SETS = { orders: () => app.services.order?.sync, texts: () => app.services.texts?.sync, favorites: () => app.services.hymns?.sync };
  app.route('GET', '/api/nube/super/copia', (ctx) => {
    authorize(ctx);
    return {
      manna: 1, at: Date.now(), version: store.get('system')?.version || null,
      users: app.sessions.users.records(),
      sets: Object.fromEntries(Object.entries(SETS).map(([name, sync]) => [name, sync()?.export() ?? null])),
      settings: settings(),
      library: { items: [...(app.services.media?.transfer?.summary() || []), ...(app.services.slides?.transfer?.summary() || [])], categories: app.services.media?.categories?.export() || [] },
    };
  });
  // Volver a una copia: lo de la copia queda como recién cambiado, para que el equipo de la iglesia no lo deshaga al
  // sincronizarse (restoreSet). Primero se comprueba todo; los usuarios, los primeros (sin un administrador no se hace).
  app.route('POST', '/api/nube/super/restaurar', async (ctx) => {
    authorize(ctx);
    let copy;
    try { copy = JSON.parse((await ctx.raw(32 * 1024 * 1024)).toString('utf8')); } catch { throw new HttpError(400, 'Esa copia no se puede leer.'); }
    if (copy?.manna !== 1 || !Array.isArray(copy.users) || !copy.sets || typeof copy.sets !== 'object') throw new HttpError(400, 'Eso no es una copia de Manna.');
    app.sessions.users.replace(copy.users);
    app.services.users?.publish();
    for (const [name, sync] of Object.entries(SETS)) {
      const set = copy.sets[name];
      if (sync() && Array.isArray(set?.records)) sync().apply(restoreSet(sync().export(), set));
    }
    if (copy.settings) apply(copy.settings);
    return state(ctx);
  });
}
