import { HttpError } from '../../core/router.js';

// Módulo Conexión por internet: un túnel de Cloudflare (cloudflared) trae a Manna lo que llega desde
// internet, para entrar desde fuera de la iglesia. Lo abre y lo cierra el propio Manna (se enciende en
// Ajustes y se recuerda), así que basta el icono de Manna. Lo que llega por el túnel no es el equipo
// principal y todo pide PIN, también la pantalla de proyección (core/router.js y core/sessions.js).
//   - Con la clave de un túnel propio (de un dominio de la iglesia en Cloudflare): `tunnel run`.
//   - Sin ella, un túnel rápido de prueba (trycloudflare.com), con una dirección nueva cada vez.
// La clave vive solo en data/tunel.json: nunca en el estado ni en el registro.

const RETRY_MS = [5_000, 15_000, 60_000];
const QUICK = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

// Por qué se cerró, para quien usa Manna, a partir de lo último que escribió cloudflared.
export function explain(log) {
  if (/unauthorized|invalid (tunnel|token)|token.*(invalid|malformed)|tunnel credentials/i.test(log)) return 'La clave del túnel no es válida. Vuelve a copiarla desde el panel de Cloudflare.';
  if (/no such host|dial tcp|i\/o timeout|network is unreachable|failed to (dial|connect)|connection refused/i.test(log)) return 'No se pudo llegar a Cloudflare. Comprueba que el equipo principal tiene internet: Manna lo vuelve a intentar solo.';
  return 'La conexión por internet se cerró. Manna lo vuelve a intentar solo.';
}

// La clave del túnel tal como se pega: sola o dentro de la orden que muestra Cloudflare
// ("cloudflared service install eyJ…").
export function tokenFrom(text) {
  const clean = String(text ?? '').trim();
  if (!clean) return '';
  const token = /[A-Za-z0-9+/=_-]{40,}/.exec(clean)?.[0];
  if (!token) throw new HttpError(400, 'Eso no parece la clave de un túnel de Cloudflare. Cópiala entera desde su panel.');
  return token;
}

export default function setup(app) {
  const { store } = app;
  const saved = app.storage('tunel', { on: false, token: '', address: '' });
  const set = (patch) => store.set('internet', patch);
  store.register('internet', { on: Boolean(saved.data.on), status: 'off', url: null, own: Boolean(saved.data.token), error: null });
  let child = null;
  let tries = 0;
  let timer = null;

  function stop() {
    clearTimeout(timer);
    timer = null;
    const old = child;
    child = null;
    old?.kill();
  }

  function start() {
    stop();
    const { on, token, address } = saved.data;
    set({ on: Boolean(on), own: Boolean(token) });
    if (!on) return set({ status: 'off', url: null, error: null });
    if (!app.tools.has('cloudflared')) return set({ status: 'error', url: null, error: 'Falta cloudflared, el programa de Cloudflare. Instálalo en Ajustes → Revisar el equipo.' });
    const args = token ? ['tunnel', '--no-autoupdate', 'run'] : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${app.port}`];
    set({ status: 'starting', url: token ? address || null : null, error: null });
    // La clave va por el entorno: en la orden la vería cualquier programa que liste los procesos.
    const mine = app.tools.spawn('cloudflared', args, { env: { ...process.env, ...(token ? { TUNNEL_TOKEN: token } : {}) } });
    child = mine;
    let log = '';
    const read = (chunk) => {
      const text = String(chunk);
      log = (log + text).slice(-4000);
      const quick = !token && QUICK.exec(text)?.[0];
      if (quick) set({ url: quick });
      if (/Registered tunnel connection/i.test(text)) {
        tries = 0;
        set({ status: 'on', error: null });
      }
    };
    mine.stdout.on('data', read);
    mine.stderr.on('data', read);
    mine.on('error', () => {});
    mine.on('exit', () => {
      if (child !== mine) return; // se cerró a propósito
      child = null;
      set({ status: 'error', url: null, error: explain(log) });
      timer = setTimeout(start, RETRY_MS[Math.min(tries, RETRY_MS.length - 1)]);
      timer.unref();
      tries += 1;
    });
  }

  store.on('listening', start);
  // Encendida pero sin cloudflared: en cuanto se instala («Instalar por mí»), se abre sola.
  store.on('change', (ns) => {
    if (ns === 'tools' && saved.data.on && !child && !timer && app.tools.has('cloudflared')) start();
  });
  app.onClose(stop);

  // Solo desde el equipo principal: encenderla abre Manna a internet.
  const fromHere = (ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'La conexión por internet solo se cambia desde el equipo principal.');
  };
  app.action('internet.set', { permission: 'system.admin' }, ({ on }, ctx) => {
    fromHere(ctx);
    saved.data.on = Boolean(on);
    saved.save();
    tries = 0;
    start();
  });
  // Un túnel propio: su clave y, para mostrarla, la dirección que se le dio en Cloudflare. Sin clave, túnel rápido.
  app.action('internet.own', { permission: 'system.admin' }, ({ token, address }, ctx) => {
    fromHere(ctx);
    const clean = tokenFrom(token);
    let url = String(address ?? '').trim();
    if (clean && url) {
      try { url = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).origin; } catch { throw new HttpError(400, 'Escribe la dirección como https://manna.tuiglesia.org'); }
    }
    Object.assign(saved.data, { token: clean, address: clean ? url : '' });
    saved.save();
    tries = 0;
    start();
  });
}
