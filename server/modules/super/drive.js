import crypto from 'node:crypto';
import { HttpError } from '../../core/router.js';

// Las copias en Google Drive (fase 38): cada noche, desde el sitio del superadministrador, la copia de cada iglesia
// (/api/nube/super/copia, modules/church) va a «Manna Iglesia / <iglesia> / AAAA-MM-DD.json» del Drive que conectó el
// dueño. Con el permiso `drive.file`, Manna solo ve lo que crea él. Se quedan las de los últimos 30 días y la primera de
// cada mes durante un año (expired). La aplicación de Google va en el entorno (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
// lo que da Google al conectar (el refresh token), en data/drive.json, nunca en el estado.
// MANNA_GOOGLE_PRUEBA: un Google de mentira (scripts/lib/google-falso.mjs), para las pruebas.
const DAY = 86_400_000;
const NIGHT_HOUR = 8; // en UTC: las 3 de la madrugada en Colombia
const FOLDER = 'application/vnd.google-apps.folder';
const urls = () => {
  const fake = process.env.MANNA_GOOGLE_PRUEBA;
  return fake ? { auth: `${fake}/auth`, token: `${fake}/token`, api: `${fake}/drive/v3/files`, upload: `${fake}/upload/drive/v3/files` }
    : { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
      api: 'https://www.googleapis.com/drive/v3/files', upload: 'https://www.googleapis.com/upload/drive/v3/files' };
};
const client = () => ({ id: process.env.GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '' });

// Qué copias sobran (por su nombre, AAAA-MM-DD.json): todas menos las de los últimos 30 días y la primera de cada mes del
// último año. Lo que no tiene ese nombre no se toca.
export function expired(names, today) {
  const dated = names.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  const firsts = new Set();
  const months = new Set();
  for (const n of dated) if (!months.has(n.slice(0, 7))) { months.add(n.slice(0, 7)); firsts.add(n); }
  return dated.filter((n) => {
    const age = (Date.parse(today) - Date.parse(n.slice(0, 10))) / DAY;
    return !(age < 30 || (age < 366 && firsts.has(n)));
  });
}

// ask(host, ruta, cuerpo): la petición a una iglesia (modules/super); hosts(): las del panel; changed(): volver a publicar.
export function setupDrive(app, { ask, hosts, changed }) {
  const saved = app.storage('drive', { refresh: null, since: null, night: null, last: {} });
  let access = null; // { token, until }
  const waiting = new Map(); // state de una conexión a medias -> hasta cuándo vale

  const view = () => ({ ready: Boolean(client().id && client().secret), connected: Boolean(saved.data.refresh), since: saved.data.since,
    night: saved.data.night, last: saved.data.last });

  async function post(form) {
    const res = await fetch(urls().token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: client().id, client_secret: client().secret, ...form }), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const out = await res?.json().catch(() => ({}));
    if (!res?.ok) throw new HttpError(502, `Google no dio acceso${out?.error ? ` (${out.error})` : ''}.`);
    return out;
  }
  async function token() {
    if (access && access.until > Date.now() + 60_000) return access.token;
    if (!saved.data.refresh) throw new HttpError(409, 'Google Drive no está conectado.');
    const out = await post({ grant_type: 'refresh_token', refresh_token: saved.data.refresh }).catch((err) => {
      // Google retiró el permiso (o se quitó en la cuenta): el panel vuelve a ofrecer «Conectar».
      if (err.message.includes('invalid_grant')) {
        saved.data.refresh = null;
        saved.save();
        changed();
      }
      throw err;
    });
    access = { token: out.access_token, until: Date.now() + (out.expires_in || 3600) * 1000 };
    return access.token;
  }
  async function google(method, url, { body, type } = {}) {
    const res = await fetch(url, { method, body, signal: AbortSignal.timeout(120_000),
      headers: { authorization: `Bearer ${await token()}`, ...(type && { 'content-type': type }) } }).catch(() => null);
    if (!res) throw new HttpError(502, 'No se pudo llegar a Google Drive.');
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      throw new HttpError(502, `Google Drive: ${out.error?.message || `respondió ${res.status}`}`);
    }
    return res.status === 204 ? null : res;
  }
  const quote = (text) => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  async function find(query, fields = 'id,name') {
    const res = await google('GET', `${urls().api}?q=${encodeURIComponent(`${query} and trashed = false`)}&fields=files(${fields})&pageSize=1000`);
    return (await res.json()).files || [];
  }
  async function folder(name, parent = null) {
    const [found] = await find(`name = '${quote(name)}' and mimeType = '${FOLDER}'${parent ? ` and '${parent}' in parents` : ''}`);
    if (found) return found.id;
    const res = await google('POST', urls().api, { type: 'application/json', body: JSON.stringify({ name, mimeType: FOLDER, ...(parent && { parents: [parent] }) }) });
    return (await res.json()).id;
  }
  const churchFolder = async (host) => folder(host, await folder('Manna Iglesia'));
  const copies = async (parent) => (await find(`'${parent}' in parents and mimeType != '${FOLDER}'`, 'id,name,size,createdTime'))
    .sort((a, b) => b.name.localeCompare(a.name));

  // La copia de hoy de una iglesia (sustituye a la de hoy si ya había) y, de paso, se borran las que sobran.
  async function backup(host) {
    try {
      const copy = await ask(host, 'copia');
      const today = new Date().toISOString().slice(0, 10);
      const parent = await churchFolder(host);
      const before = await copies(parent);
      const boundary = crypto.randomBytes(12).toString('hex');
      const body = [`--${boundary}`, 'content-type: application/json; charset=UTF-8', '', JSON.stringify({ name: `${today}.json`, parents: [parent] }),
        `--${boundary}`, 'content-type: application/json', '', JSON.stringify(copy), `--${boundary}--`].join('\r\n');
      const made = await (await google('POST', `${urls().upload}?uploadType=multipart&fields=id,name`, { type: `multipart/related; boundary=${boundary}`, body })).json();
      const old = expired([...before.map((f) => f.name), made.name], today);
      for (const f of before) if (f.name === made.name || old.includes(f.name)) await google('DELETE', `${urls().api}/${f.id}`);
      saved.data.last[host] = { at: Date.now(), ok: true, name: made.name, size: Buffer.byteLength(body) };
    } catch (err) {
      saved.data.last[host] = { ...saved.data.last[host], at: Date.now(), ok: false, error: err.message };
    }
    saved.save();
    changed();
    return saved.data.last[host];
  }
  const all = async () => {
    for (const host of hosts()) await backup(host);
  };

  // Cada noche, una vez, con Drive conectado.
  const nightly = setInterval(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!saved.data.refresh || saved.data.night === today || new Date().getUTCHours() < NIGHT_HOUR) return;
    saved.data.night = today;
    all().catch((err) => console.error('Las copias de esta noche fallaron:', err.message));
  }, 10 * 60_000);
  nightly.unref();
  app.onClose(() => clearInterval(nightly));

  // ---- Conectar la cuenta (una vez, desde el panel): Google pregunta y vuelve aquí con un código ----
  const back = (ctx) => {
    const host = String(ctx.req.headers.host || '');
    return `${/^((.+\.)?localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https'}://${host}/api/super/drive/vuelta`;
  };
  app.route('GET', '/api/super/drive/conectar', (ctx) => {
    ctx.require('super.manage');
    if (!view().ready) throw new HttpError(409, 'Falta la aplicación de Google en las variables del sitio (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).');
    const state = crypto.randomBytes(16).toString('hex');
    waiting.set(state, Date.now() + 10 * 60_000);
    const query = new URLSearchParams({ client_id: client().id, redirect_uri: back(ctx), response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline', prompt: 'consent', state });
    ctx.res.writeHead(302, { Location: `${urls().auth}?${query}`, 'Cache-Control': 'no-store' });
    ctx.res.end();
  });
  app.route('GET', '/api/super/drive/vuelta', async (ctx) => {
    ctx.require('super.manage');
    const state = ctx.query.get('state') || '';
    const valid = waiting.get(state) > Date.now();
    waiting.delete(state);
    let result = 'conectado';
    if (!valid || !ctx.query.get('code')) result = 'cancelado';
    else {
      try {
        const out = await post({ grant_type: 'authorization_code', code: ctx.query.get('code'), redirect_uri: back(ctx) });
        if (!out.refresh_token) throw new Error('sin refresh token');
        Object.assign(saved.data, { refresh: out.refresh_token, since: Date.now() });
        access = { token: out.access_token, until: Date.now() + (out.expires_in || 3600) * 1000 };
        saved.save();
        changed();
      } catch { result = 'fallo'; }
    }
    ctx.res.writeHead(302, { Location: `/superadmin?drive=${result}#copias`, 'Cache-Control': 'no-store' });
    ctx.res.end();
  });

  // ---- Las órdenes del panel ----
  const known = (host) => {
    if (!hosts().includes(host)) throw new HttpError(404, 'Esa iglesia no está en el panel.');
    return host;
  };
  // Una iglesia, o todas sin `host`.
  app.action('super.backup', { permission: 'super.manage' }, async ({ host } = {}) => {
    await token();
    if (host) return backup(known(host));
    await all();
    return null;
  });
  app.action('super.backups', { permission: 'super.manage' }, async ({ host } = {}) =>
    (await copies(await churchFolder(known(host)))).map(({ id, name, size, createdTime }) => ({ id, name, size: Number(size) || 0, at: Date.parse(createdTime) || null })));
  // Volver a una copia. Antes, la copia de hoy guarda lo de ahora (por si hay que deshacerlo).
  app.action('super.restore', { permission: 'super.manage' }, async ({ host, id } = {}) => {
    known(host);
    if (typeof id !== 'string' || !/^[\w-]{1,200}$/.test(id)) throw new HttpError(400, 'Elige una copia.');
    const parent = await churchFolder(host);
    if (!(await copies(parent)).some((f) => f.id === id)) throw new HttpError(404, 'Esa copia ya no está.');
    const copy = await (await google('GET', `${urls().api}/${id}?alt=media`)).json().catch(() => null);
    if (!copy) throw new HttpError(502, 'Esa copia no se pudo leer.');
    const now = await backup(host);
    if (!now.ok) throw new HttpError(502, `Antes de volver a la copia no se pudo guardar lo de ahora: ${now.error}`);
    await ask(host, 'restaurar', copy);
  });

  return { view };
}
