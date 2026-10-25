import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';
import { mergeSets, setVersion } from '../../core/sync.js';

// El equipo oficial y su nube (fase 37, partes 1 y 2; decisión 63). El mismo módulo en los dos lados:
// - en la nube (app.cloud), «Administrar la iglesia» da un código de 6 cifras que dura 10 minutos; con él, un equipo
//   se empareja y recibe una clave propia (de la que la nube guarda solo la huella). Emparejar otro equipo lo hace el
//   oficial, y el anterior queda bloqueado;
// - en el equipo de la iglesia, Ajustes → Nube empareja, guarda la clave en data/nube.json (nunca en el estado) y
//   pregunta cada minuto si sigue siendo el oficial. Si ya no lo es, arranca de nuevo bloqueado, como cuando hay otro
//   Manna en la red (fase 21), hasta que se vuelva a emparejar. Sin internet no se entera y sigue funcionando.
// Los usuarios (parte 3, decisión 63) viven en la nube: al emparejarse por primera vez, el equipo sube los suyos (los
// que tengan el nombre de uno de la nube pasan a ser ese, con sus órdenes); después el equipo guarda una copia (para
// dejar entrar sin internet) y la trae cuando cambia, y ahí ya no se cambian.
// Los órdenes, los textos y los favoritos del himnario (parte 4, core/sync.js) van en los dos sentidos: el equipo manda
// lo suyo, la nube lo junta con lo suyo (de cada uno gana el último cambio) y le devuelve el resultado. Con los dos
// encendidos, un cambio llega al otro lado en segundos: el del equipo, a los 2 s; el de la nube, porque el equipo le
// deja hecha una pregunta («avísame si algo cambia») que ella contesta en cuanto cambia.
// El equipo llama siempre a la nube (está detrás del router de la iglesia); la nube nunca lo llama a él.

const CODE_MS = 10 * 60_000;
const CODE_TRIES = 10; // fallos con un mismo código antes de anularlo
const ONLINE_MS = 150_000; // sin noticias del equipo en 2,5 minutos, se da por apagado
const WAIT_MS = 25_000; // lo que la nube espera, como mucho, a que algo cambie antes de contestar
const PUSH_MS = 2000; // un cambio del equipo sale a los 2 s (si llegan varios seguidos, juntos)
// Lo que se sincroniza y el módulo que lo tiene (cada uno ofrece sync: { export, apply }).
const SETS = { orders: (app) => app.services.order?.sync, texts: (app) => app.services.texts?.sync, favorites: (app) => app.services.hymns?.sync };
const exportAll = (app) => Object.fromEntries(Object.entries(SETS).map(([name, of]) => [name, of(app)?.export()]).filter(([, set]) => set));
const CHECK_MS = 60_000;
const hash = (text) => crypto.createHash('sha256').update(String(text)).digest('hex');
// La huella de la lista de usuarios: si cambia, el equipo trae la lista.
const versionOf = (records) => hash(JSON.stringify(records)).slice(0, 16);
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export default function setup(app) {
  if (app.cloud) cloudSide(app);
  else churchSide(app);
}

// ---- En la nube ----
function cloudSide(app) {
  const { store } = app;
  const saved = app.storage('equipos', { official: null, former: [], code: null });
  const view = () => {
    const o = saved.data.official;
    return {
      official: o && { name: o.name, paired: o.paired, lastSeen: o.lastSeen, version: o.version, online: Date.now() - o.lastSeen < ONLINE_MS },
      codeUntil: saved.data.code?.until > Date.now() ? saved.data.code.until : null,
    };
  };
  store.register('cloud', view());
  const publish = () => store.set('cloud', view());
  // «Conectado» depende del reloj: se vuelve a mirar cada minuto.
  const timer = setInterval(publish, 60_000);
  timer.unref();
  app.onClose(() => clearInterval(timer));
  const host = (ctx) => String(ctx.req.headers.host || '').trim().slice(0, 100);

  app.action('cloud.code', { permission: 'users.manage' }, () => {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    saved.data.code = { hash: hash(code), until: Date.now() + CODE_MS, fails: 0 };
    saved.save();
    publish();
    return { code, until: saved.data.code.until };
  });

  // Lo pide el equipo, sin sesión: lo autoriza el código. Con otro equipo ya oficial, primero pregunta (conflict).
  app.route('POST', '/api/nube/emparejar', async (ctx) => {
    const { code, id, name, version, confirm } = await ctx.json();
    const pending = saved.data.code;
    if (!pending || pending.until < Date.now()) throw new HttpError(410, 'Ese código ya no sirve: pide otro en «Administrar la iglesia» → Equipo.');
    if (!same(hash(String(code ?? '').trim()), pending.hash)) {
      pending.fails += 1;
      if (pending.fails >= CODE_TRIES) saved.data.code = null;
      saved.save();
      publish();
      throw new HttpError(401, 'Ese no es el código que da «Administrar la iglesia».');
    }
    if (typeof id !== 'string' || !/^[a-f0-9]{8,64}$/.test(id)) throw new HttpError(400, 'Falta el identificador del equipo.');
    const current = saved.data.official;
    if (current && current.id !== id && confirm !== true) return { conflict: { name: current.name, paired: current.paired } };
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const label = cleanName(name, 60) || 'Equipo de la iglesia';
    if (current && current.id !== id) saved.data.former.push({ id: current.id, name: current.name, tokenHash: current.tokenHash, replaced: now, by: label });
    saved.data.former = saved.data.former.filter((f) => f.id !== id).slice(-20);
    saved.data.official = { id, name: label, tokenHash: hash(token), paired: now, lastSeen: now, version: String(version ?? '').slice(0, 20) };
    saved.data.code = null;
    saved.save();
    publish();
    return { token, church: host(ctx) };
  });

  // ¿Lo pide el equipo oficial? Por su clave.
  const keyOf = (ctx) => {
    const key = /^Bearer ([a-f0-9]{64})$/.exec(ctx.req.headers.authorization || '')?.[1];
    return key ? hash(key) : '';
  };
  const official = (ctx) => {
    const o = saved.data.official;
    if (!o || !same(keyOf(ctx), o.tokenHash)) throw new HttpError(401, 'La nube no reconoce este equipo: vuelve a emparejarlo.');
    return o;
  };
  const users = app.sessions.users;

  // Lo pregunta el equipo cada minuto, con su clave: ¿sigo siendo el oficial? Con la huella de los usuarios.
  app.route('GET', '/api/nube/estado', (ctx) => {
    const mine = keyOf(ctx);
    const o = saved.data.official;
    if (o && same(mine, o.tokenHash)) {
      o.lastSeen = Date.now();
      o.version = String(ctx.req.headers['x-manna-version'] || o.version).slice(0, 20);
      saved.save();
      publish();
      return { official: true, church: host(ctx), users: versionOf(users.records()), data: versionNow() };
    }
    const former = saved.data.former.find((f) => same(mine, f.tokenHash));
    if (former) return { official: false, replaced: { by: former.by, at: former.replaced }, church: host(ctx) };
    throw new HttpError(401, 'La nube no reconoce este equipo: vuelve a emparejarlo.');
  });

  // Lo que se sincroniza: el equipo manda lo suyo y la última vez que se pusieron de acuerdo; la nube lo junta con lo
  // suyo, se queda el resultado y se lo devuelve, con los conflictos (decisión 63, C).
  const versionNow = () => setVersion(exportAll(app));
  app.route('POST', '/api/nube/sincronizar', async (ctx) => {
    official(ctx);
    const { since, sets } = await ctx.json();
    const out = {};
    let conflicts = [];
    for (const [name, of] of Object.entries(SETS)) {
      const service = of(app);
      if (!service || !sets?.[name]) continue;
      const mine = service.export();
      const merged = mergeSets(mine, sets[name], { since: Number(since) || 0 });
      const found = name === 'orders' ? merged.conflicts.map((c) => ({ id: c.id, where: c.kept === 'mine' ? 'la nube' : 'la iglesia' })) : [];
      if (setVersion({ x: mine }) !== setVersion({ x: merged }) || found.length) service.apply({ records: merged.records, deleted: merged.deleted }, found);
      out[name] = { records: merged.records, deleted: merged.deleted };
      conflicts = conflicts.concat(found);
    }
    return { sets: out, conflicts, version: versionNow() };
  });
  // «Avísame si algo cambia»: contesta en cuanto lo sincronizado cambia, o a los 25 s con lo mismo.
  const waiting = new Set();
  app.route('GET', '/api/nube/esperar', async (ctx) => {
    official(ctx);
    const seen = String(ctx.query.get('v') || '');
    if (versionNow() !== seen) return { version: versionNow() };
    return new Promise((resolve) => {
      const done = () => { waiting.delete(done); clearTimeout(timer); resolve({ version: versionNow() }); };
      const timer = setTimeout(done, WAIT_MS);
      waiting.add(done);
      ctx.req.on('close', () => { waiting.delete(done); clearTimeout(timer); });
    });
  });
  let last = null;
  store.on('change', (ns) => {
    if (!['orders', 'texts', 'hymns'].includes(ns) || !waiting.size) return;
    const now = versionNow();
    if (now === last) return;
    last = now;
    for (const done of [...waiting]) done();
  });

  // Los usuarios: la copia del equipo, y los que sube el equipo la primera vez que se empareja.
  app.route('GET', '/api/nube/usuarios', (ctx) => {
    official(ctx);
    const list = users.records();
    return { version: versionOf(list), list };
  });
  app.route('POST', '/api/nube/usuarios', async (ctx) => {
    official(ctx);
    const { list } = await ctx.json();
    if (!Array.isArray(list) || list.length > 500) throw new HttpError(400, 'Falta la lista de usuarios.');
    const same = users.merge(list);
    app.services.users?.publish();
    return { same };
  });
}

// ---- En el equipo de la iglesia ----
function churchSide(app) {
  const { store } = app;
  const { version } = JSON.parse(fs.readFileSync(path.join(app.rootDir, 'package.json'), 'utf8'));
  const saved = app.storage('nube', { url: '', token: '', church: '', paired: 0, replaced: null, usersUp: false, users: '', syncedAt: 0, synced: '', cloudData: '' });
  // status: off (sin emparejar), on, offline (sin conexión con la nube), unknown (la nube no lo reconoce), replaced.
  store.register('cloud', { church: saved.data.token ? saved.data.church : '', url: saved.data.token ? saved.data.url : '', paired: saved.data.token ? saved.data.paired : 0,
    status: saved.data.replaced ? 'replaced' : saved.data.token ? 'offline' : 'off', lastSeen: null, error: null });
  const set = (patch) => store.set('cloud', patch);
  // Bloqueado porque otro equipo pasó a ser el oficial (lo lee server/app.js al arrancar).
  const blocked = () => saved.data.replaced && { replaced: true, church: saved.data.church, by: saved.data.replaced.by, at: saved.data.replaced.at };

  // Arranca de nuevo para que lo bloqueado (o lo desbloqueado) valga entero: proyección, nombre en la red, túnel.
  const restartAs = (state) => {
    if (app.restart) setTimeout(() => app.restart(), 300);
    else app.services.network?.publishBlocked(state);
  };

  const ask = (method, route, body) => fetch(`${saved.data.url}${route}`, {
    method, headers: { authorization: `Bearer ${saved.data.token}`, 'x-manna-version': version, ...(body && { 'content-type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000),
  }).then(async (res) => {
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `La nube respondió ${res.status}.`);
    return out;
  });
  const users = app.sessions.users;
  // La primera vez, los del equipo suben (el que ya está en la nube con su nombre se queda, y sus órdenes pasan a él);
  // luego, la lista de la nube pasa a ser la del equipo. Los órdenes de quien ya no está pasan al administrador.
  async function syncUsers() {
    if (!saved.data.usersUp) {
      const { same } = await ask('POST', '/api/nube/usuarios', { list: users.records() });
      for (const [from, to] of Object.entries(same || {})) app.services.order?.reassign(from, to);
      saved.data.usersUp = true;
      saved.save();
    }
    const { version: theirs, list } = await ask('GET', '/api/nube/usuarios');
    const gone = users.replace(list);
    for (const id of gone) app.services.order?.reassign(id, users.firstAdmin().id);
    saved.data.users = theirs;
    saved.save();
    app.services.users?.publish();
  }

  // Los órdenes, los textos y los favoritos: manda lo suyo, recibe lo juntado y lo vuelve a juntar con lo de aquí (por si
  // algo cambió mientras tanto). Una sincronización a la vez; si se pide otra durante, se hace al terminar.
  let syncing = null;
  let again = false;
  const live = () => Boolean(saved.data.token) && !saved.data.replaced;
  function syncData() {
    if (!live()) return Promise.resolve();
    if (syncing) { again = true; return syncing; }
    syncing = (async () => {
      const sentAt = Date.now();
      const res = await ask('POST', '/api/nube/sincronizar', { since: saved.data.syncedAt, sets: exportAll(app) });
      for (const [name, of] of Object.entries(SETS)) {
        const service = of(app);
        if (!service || !res.sets?.[name]) continue;
        const here = service.export();
        const merged = mergeSets(here, res.sets[name]);
        const found = name === 'orders' ? res.conflicts || [] : [];
        if (setVersion({ x: here }) !== setVersion({ x: merged }) || found.length) service.apply({ records: merged.records, deleted: merged.deleted }, found);
      }
      Object.assign(saved.data, { syncedAt: sentAt, synced: setVersion(exportAll(app)), cloudData: res.version });
      saved.save();
    })().finally(() => {
      syncing = null;
      if (again) { again = false; syncData().catch(() => {}); }
    });
    return syncing;
  }
  // Un cambio de aquí sale a los 2 s (si de verdad cambió algo desde la última vez).
  let pushTimer = null;
  store.on('change', (ns) => {
    if (!['orders', 'texts', 'hymns'].includes(ns) || !live()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (setVersion(exportAll(app)) !== saved.data.synced) syncData().catch(() => {});
    }, PUSH_MS);
    pushTimer.unref?.();
  });
  // Lo de la nube llega en cuanto cambia: el equipo le deja hecha la pregunta y la repite al recibir la respuesta.
  let waitingFor = null;
  async function waitLoop() {
    if (waitingFor) return;
    waitingFor = new AbortController();
    const { signal } = waitingFor;
    while (live() && !signal.aborted) {
      try {
        const res = await fetch(`${saved.data.url}/api/nube/esperar?v=${encodeURIComponent(saved.data.cloudData)}`, {
          headers: { authorization: `Bearer ${saved.data.token}`, 'x-manna-version': version }, signal: AbortSignal.any([signal, AbortSignal.timeout(WAIT_MS + 15_000)]),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || String(res.status));
        if (body.version && body.version !== saved.data.cloudData) await syncData();
      } catch {
        if (signal.aborted) break;
        await new Promise((resolve) => { setTimeout(resolve, 30_000).unref?.(); });
      }
    }
    waitingFor = null;
  }
  app.onClose(() => waitingFor?.abort());

  async function check() {
    if (!saved.data.token || saved.data.replaced) return;
    try {
      const res = await fetch(`${saved.data.url}/api/nube/estado`, { headers: { authorization: `Bearer ${saved.data.token}`, 'x-manna-version': version }, signal: AbortSignal.timeout(15_000) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return set({ status: 'unknown', error: body.error || 'La nube no reconoce este equipo: vuelve a emparejarlo.' });
      if (!res.ok) return set({ status: 'offline', error: body.error || `La nube respondió ${res.status}.` });
      if (body.replaced) {
        saved.data.replaced = { by: cleanName(body.replaced.by, 60), at: Number(body.replaced.at) || Date.now() };
        saved.save();
        saved.flush();
        console.log(`Otro equipo («${saved.data.replaced.by}») es ahora el oficial de ${saved.data.church}: este queda bloqueado hasta que se vuelva a emparejar.`);
        set({ status: 'replaced', error: null });
        return restartAs(blocked());
      }
      if (body.users && body.users !== saved.data.users) await syncUsers();
      // Por si se perdió un aviso: si la nube o el equipo tienen algo distinto de lo último que se juntó.
      if (body.data !== saved.data.cloudData || setVersion(exportAll(app)) !== saved.data.synced) await syncData();
      set({ status: 'on', lastSeen: Date.now(), error: null });
      waitLoop();
    } catch {
      set({ status: 'offline', error: null });
    }
  }
  // Emparejado (y no sustituido), los usuarios se cambian en la nube (decisión 63).
  const managedBy = () => (saved.data.token && !saved.data.replaced ? saved.data.church : null);
  app.services.cloud = { blocked, check, managedBy, sync: syncData };
  store.on('listening', () => {
    check();
    const timer = setInterval(check, Number(process.env.MANNA_NUBE_COMPROBAR_MS) || CHECK_MS);
    timer.unref();
    app.onClose(() => clearInterval(timer));
  });

  // La dirección de la nube: https siempre, salvo en este mismo equipo (las pruebas). Sin ruta ni credenciales.
  function cleanUrl(text) {
    const raw = String(text ?? '').trim();
    let url;
    try { url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { url = null; }
    const local = url && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!url || url.username || url.password || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))) {
      throw new HttpError(400, 'Escribe la dirección de la nube de tu iglesia, por ejemplo nv.manna-iglesia.es.');
    }
    return url.origin;
  }

  // Emparejar (también «Volver a ser el equipo oficial», desde la pantalla de bloqueado): con la dirección y el código
  // que da «Administrar la iglesia». Si ya hay otro equipo oficial, devuelve { conflict } para preguntarlo.
  app.action('cloud.pair', { permission: 'system.admin' }, async ({ url, code, confirm } = {}) => {
    const base = cleanUrl(url || saved.data.url);
    if (!/^\d{6}$/.test(String(code ?? '').trim())) throw new HttpError(400, 'El código tiene 6 números: lo da «Administrar la iglesia» → Equipo.');
    const res = await fetch(`${base}/api/nube/emparejar`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: String(code).trim(), id: app.settings.data.id, name: os.hostname(), version, confirm: confirm === true }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!res) throw new HttpError(502, 'No se pudo llegar a la nube: revisa la dirección y la conexión a internet.');
    const body = await res.json().catch(() => ({}));
    // 400 y no 401: un 401 haría volver a la pantalla de inicio, como si se hubiera perdido la sesión.
    if (!res.ok) throw new HttpError(res.status === 401 || res.status === 410 ? 400 : 502, body.error || `La nube respondió ${res.status}.`);
    if (body.conflict) return { conflict: { name: cleanName(body.conflict.name, 60), paired: Number(body.conflict.paired) || null } };
    if (!/^[a-f0-9]{64}$/.test(body.token || '')) throw new HttpError(502, 'La nube no dio una clave válida.');
    const wasBlocked = Boolean(saved.data.replaced);
    Object.assign(saved.data, { url: base, token: body.token, church: cleanName(body.church, 100) || new URL(base).host, paired: Date.now(), replaced: null });
    saved.save();
    saved.flush();
    set({ church: saved.data.church, url: base, paired: saved.data.paired, status: 'on', lastSeen: Date.now(), error: null });
    await syncUsers().catch((err) => console.error('No se pudieron traer los usuarios de la nube:', err.message));
    if (wasBlocked) restartAs(null);
    return { church: saved.data.church };
  });
}
