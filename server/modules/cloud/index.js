import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';
import { mergeSets, setVersion } from '../../core/sync.js';
import { createContent } from './contenido.js';

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
const INSTALL_MS = 24 * 3600_000; // lo que dura el código del instalador emparejado (decisión 64)
const INSTALLERS = { windows: 'Instalar-Manna-Windows.exe', mac: 'Instalar-Manna-Mac.pkg' };
export const HYMNALS = ['nube', 'completo'];
// Lo que el equipo oficial puede bajar de R2: las biblias y el himnario, nada más.
export const contentKey = (key) => typeof key === 'string' && /^(Biblias|Himnario\/(videos|letras|diapositivas))\//.test(key) && !key.split('/').some((p) => !p || p === '.' || p === '..');
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
  const saved = app.storage('equipos', { official: null, former: [], code: null, installs: [] });
  saved.data.installs ||= [];
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

  // El instalador emparejado (decisión 64): el de la última versión publicada, con la dirección de esta nube y un código
  // de un solo uso (dura un día) en su nombre. El instalador se lo deja al equipo, que se empareja con él al abrirse,
  // sin preguntar por el equipo oficial anterior: el administrador ya vio el aviso al bajarlo.
  const fetched = new Map(); // sistema → { at, body }: lo traído de GitHub, durante una hora
  async function installer(so) {
    const got = fetched.get(so);
    if (got && Date.now() - got.at < 3600_000) return got.body;
    const base = process.env.MANNA_INSTALADORES_URL || 'https://github.com/delosriosmedia/manna/releases/latest/download';
    const res = await fetch(`${base}/${INSTALLERS[so]}`, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (!res?.ok) throw new HttpError(502, 'No se pudo traer el instalador de Manna. Vuelve a intentarlo en un momento.');
    const body = Buffer.from(await res.arrayBuffer());
    fetched.set(so, { at: Date.now(), body });
    return body;
  }
  app.route('GET', '/api/nube/instalador', async (ctx) => {
    ctx.require('users.manage');
    const so = ctx.query.get('so');
    const hymnal = ctx.query.get('himnario');
    const id = String(ctx.query.get('id') || '');
    if (!INSTALLERS[so] || !HYMNALS.includes(hymnal) || !/^[a-f0-9]{16,64}$/.test(id)) throw new HttpError(400, 'Falta elegir el sistema o el himnario.');
    const body = await installer(so);
    const code = crypto.randomBytes(6).toString('hex');
    saved.data.installs = [...saved.data.installs.filter((i) => i.until > Date.now() && i.id !== id), { id, hash: hash(code), until: Date.now() + INSTALL_MS, hymnal }].slice(-20);
    saved.save();
    ctx.res.writeHead(200, {
      'Content-Type': 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="Instalar-Manna-${host(ctx).replace(/[^a-z0-9.-]/gi, '')}-${code}${path.extname(INSTALLERS[so])}"`,
    });
    ctx.res.end(body);
  });
  // ¿Se instaló con el instalador que bajó ese navegador, y ese equipo sigue siendo el oficial? (La portada.)
  app.route('GET', '/api/nube/instalado', (ctx) => ({ installed: Boolean(saved.data.official?.install) && saved.data.official.install === ctx.query.get('id') }));

  // Lo pide el equipo, sin sesión: lo autoriza el código (o el del instalador). Con otro equipo ya oficial, primero
  // pregunta (conflict).
  app.route('POST', '/api/nube/emparejar', async (ctx) => {
    const { code, install, id, name, version, confirm } = await ctx.json();
    let installed = null;
    if (install != null) {
      installed = saved.data.installs.find((i) => i.until > Date.now() && same(hash(String(install).trim()), i.hash));
      if (!installed) throw new HttpError(410, 'Ese instalador ya se usó o caducó: baja otro desde la nube de tu iglesia.');
    } else {
      const pending = saved.data.code;
      if (!pending || pending.until < Date.now()) throw new HttpError(410, 'Ese código ya no sirve: pide otro en «Administrar la iglesia» → Equipo.');
      if (!same(hash(String(code ?? '').trim()), pending.hash)) {
        pending.fails += 1;
        if (pending.fails >= CODE_TRIES) saved.data.code = null;
        saved.save();
        publish();
        throw new HttpError(401, 'Ese no es el código que da «Administrar la iglesia».');
      }
    }
    if (typeof id !== 'string' || !/^[a-f0-9]{8,64}$/.test(id)) throw new HttpError(400, 'Falta el identificador del equipo.');
    const current = saved.data.official;
    if (current && current.id !== id && confirm !== true && !installed) return { conflict: { name: current.name, paired: current.paired } };
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const label = cleanName(name, 60) || 'Equipo de la iglesia';
    if (current && current.id !== id) saved.data.former.push({ id: current.id, name: current.name, tokenHash: current.tokenHash, replaced: now, by: label });
    saved.data.former = saved.data.former.filter((f) => f.id !== id).slice(-20);
    saved.data.official = { id, name: label, tokenHash: hash(token), paired: now, lastSeen: now, version: String(version ?? '').slice(0, 20), install: installed?.id };
    if (installed) saved.data.installs = saved.data.installs.filter((i) => i !== installed);
    else saved.data.code = null;
    saved.save();
    publish();
    return { token, church: host(ctx), hymnal: installed?.hymnal || null };
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

  // El himnario y las biblias para el equipo oficial (decisión 64): la lista de R2 (se guarda una hora: listar tarda
  // unos 20 s) y enlaces que caducan para bajarlos.
  let listing = null;
  app.route('GET', '/api/nube/contenido', async (ctx) => {
    official(ctx);
    if (!app.r2) throw new HttpError(404, 'Esta nube no tiene el himnario.');
    if (!listing || Date.now() - listing.at > 3600_000) {
      listing = { at: Date.now(), files: app.r2.list().then((all) => all.filter(({ key }) => contentKey(key)).map(({ key, size }) => ({ key, size }))) };
      listing.files.catch(() => { listing = null; });
    }
    return { files: await listing.files };
  });
  app.route('POST', '/api/nube/enlaces', async (ctx) => {
    official(ctx);
    if (!app.r2) throw new HttpError(404, 'Esta nube no tiene el himnario.');
    const { keys } = await ctx.json();
    if (!Array.isArray(keys) || keys.length > 100 || !keys.every(contentKey)) throw new HttpError(400, 'Esos archivos no son del himnario ni de las biblias.');
    return { links: Object.fromEntries(keys.map((key) => [key, app.r2.link(key)])) };
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
  const saved = app.storage('nube', { url: '', token: '', church: '', paired: 0, replaced: null, usersUp: false, users: '', syncedAt: 0, synced: '', cloudData: '', hymnal: null });
  // status: off (sin emparejar), on, offline (sin conexión con la nube), unknown (la nube no lo reconoce), replaced.
  // hymnal: cómo tiene el himnario (nube o completo, decisión 64); content: lo que está bajando ({ done, total, failed }).
  store.register('cloud', { church: saved.data.token ? saved.data.church : '', url: saved.data.token ? saved.data.url : '', paired: saved.data.token ? saved.data.paired : 0,
    status: saved.data.replaced ? 'replaced' : saved.data.token ? 'offline' : 'off', lastSeen: null, error: null, hymnal: saved.data.hymnal, content: null });
  const set = (patch) => store.set('cloud', patch);
  // Bloqueado porque otro equipo pasó a ser el oficial (lo lee server/app.js al arrancar).
  const blocked = () => saved.data.replaced && { replaced: true, church: saved.data.church, by: saved.data.replaced.by, at: saved.data.replaced.at };

  // Arranca de nuevo para que lo bloqueado (o lo desbloqueado) valga entero: proyección, nombre en la red, túnel.
  const restartAs = (state) => {
    if (app.restart) setTimeout(() => app.restart(), 300);
    else app.services.network?.publishBlocked(state);
  };

  const ask = (method, route, body, ms = 20_000) => fetch(`${saved.data.url}${route}`, {
    method, headers: { authorization: `Bearer ${saved.data.token}`, 'x-manna-version': version, ...(body && { 'content-type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(ms),
  }).then(async (res) => {
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `La nube respondió ${res.status}.`);
    return out;
  });
  // El himnario y las biblias de la nube (decisión 64, cloud/contenido.js).
  const link = async (key) => (await ask('POST', '/api/nube/enlaces', { keys: [key] })).links[key];
  const content = createContent(app, { ask, link, mode: () => saved.data.hymnal, onProgress: (progress) => set({ content: progress }) });
  let filled = 0; // cuándo se puso al día por última vez (cada media hora, o en cuanto algo lo pide)
  const fillSoon = () => { filled = 0; };
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
      fillSoon();
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
    await pairFromInstaller();
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
      if (Date.now() - filled > 30 * 60_000) {
        filled = Date.now();
        content.fill().catch((err) => console.error('No se pudo bajar el himnario de la nube:', err.message));
      }
    } catch {
      set({ status: 'offline', error: null });
    }
  }
  // Emparejado (y no sustituido), los usuarios se cambian en la nube (decisión 63).
  const managedBy = () => (saved.data.token && !saved.data.replaced ? saved.data.church : null);
  // Para el himnario: lo que está en la nube y no en la carpeta, un enlace para verlo ya y bajarlo (decisión 64).
  app.services.cloud = { blocked, check, managedBy, sync: syncData, missing: () => (live() ? content.missing() : []), link, fetch: content.fetch };
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

  // Emparejar con el código que da «Administrar la iglesia» (code) o con el del instalador emparejado (install, decisión
  // 64). Si ya hay otro equipo oficial, la nube devuelve { conflict } para preguntarlo (con install no pregunta).
  async function pair({ base, code, install, confirm }) {
    const res = await fetch(`${base}/api/nube/emparejar`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, install, id: app.settings.data.id, name: os.hostname(), version, confirm: confirm === true }),
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
    if (HYMNALS.includes(body.hymnal)) saved.data.hymnal = body.hymnal;
    saved.save();
    saved.flush();
    set({ church: saved.data.church, url: base, paired: saved.data.paired, status: 'on', lastSeen: Date.now(), error: null, hymnal: saved.data.hymnal });
    await syncUsers().catch((err) => console.error('No se pudieron traer los usuarios de la nube:', err.message));
    fillSoon();
    if (wasBlocked) restartAs(null);
    return { church: saved.data.church };
  }

  // Emparejar (también «Volver a ser el equipo oficial», desde la pantalla de bloqueado): con la dirección y el código
  // que da «Administrar la iglesia».
  app.action('cloud.pair', { permission: 'system.admin' }, async ({ url, code, confirm } = {}) => {
    const base = cleanUrl(url || saved.data.url);
    if (!/^\d{6}$/.test(String(code ?? '').trim())) throw new HttpError(400, 'El código tiene 6 números: lo da «Administrar la iglesia» → Equipo.');
    return pair({ base, code: String(code).trim(), confirm });
  });

  // El instalador que se bajó de la nube de una iglesia deja su dirección y su código en datos/emparejar.json
  // (instalacion/ordenar.mjs): al abrirse, Manna se empareja con ellos, una vez. Sin internet, lo vuelve a intentar.
  const pending = path.join(app.dataDir, 'emparejar.json');
  async function pairFromInstaller() {
    let job;
    try { job = JSON.parse(fs.readFileSync(pending, 'utf8')); } catch { return; }
    try {
      await pair({ base: cleanUrl(job.url), install: String(job.code || '') });
      console.log(`Emparejado con ${saved.data.church}, como se pidió al bajar el instalador.`);
    } catch (err) {
      if (err.status === 502) return;
      set({ error: `No se pudo emparejar con ${job.url} como se pidió al instalar: ${err.message}` });
    }
    fs.rmSync(pending, { force: true });
  }

  // Cómo tiene el himnario este equipo (decisión 64): desde la nube (los himnos del orden se bajan antes del culto; los
  // demás, al usarlos) o completo (todo, en segundo plano).
  app.action('cloud.hymnal', { permission: 'system.admin' }, ({ mode } = {}) => {
    if (!HYMNALS.includes(mode)) throw new HttpError(400, 'Elige «Desde la nube» o «Completo en este equipo».');
    saved.data.hymnal = mode;
    saved.save();
    set({ hymnal: mode });
    if (live()) {
      filled = Date.now();
      content.fill().catch((err) => console.error('No se pudo bajar el himnario de la nube:', err.message));
    }
  });
}
