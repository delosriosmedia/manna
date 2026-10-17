import { HttpError } from '../../core/router.js';

// Módulo Conexión por internet: un túnel de Cloudflare (cloudflared) trae a Manna lo que llega desde
// internet, para entrar desde fuera de la iglesia. Lo abre y lo cierra el propio Manna (se enciende en
// Ajustes y se recuerda), así que basta el icono de Manna. Lo que llega por el túnel no es el equipo
// principal y todo pide PIN, también la pantalla de proyección (core/router.js y core/sessions.js).
//   - Con la clave de un túnel propio (de un dominio de la iglesia en Cloudflare): `tunnel run`.
//   - Sin ella, un túnel rápido de prueba (trycloudflare.com), con una dirección nueva cada vez.
// La clave vive solo en data/tunel.json: nunca en el estado ni en el registro.
// cloudflared vive solo mientras viva Manna (tools.spawn con `tied`), y Manna comprueba cada poco, entrando
// por su dirección de internet como lo haría un celular de fuera, que quien contesta es él mismo.
// Un solo Manna por dominio propio (fase 21): antes de conectarse mira quién contesta en su dirección y, si es
// otro Manna, no se conecta (`busy`) y vuelve a mirar cada minuto; si lo nota ya conectado, se aparta él.

const RETRY_MS = [5_000, 15_000, 60_000];
const QUICK = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const FAILS = 4; // comprobaciones fallidas seguidas antes de darla por caída y rehacerla
// Cada cuánto se comprueba: cada 10 s hasta que funciona o mientras falla; funcionando, cada minuto.
const every = () => Number(process.env.MANNA_TUNEL_COMPROBAR_MS) || 10_000;

// Por qué se cerró, para quien usa Manna, a partir de lo último que escribió cloudflared.
export function explain(log) {
  if (/unauthorized|invalid (tunnel|token)|token.*(invalid|malformed)|tunnel credentials/i.test(log)) return 'La clave del túnel no es válida. Vuelve a copiarla desde el panel de Cloudflare.';
  if (/no such host|dial tcp|i\/o timeout|network is unreachable|failed to (dial|connect)|connection refused/i.test(log)) return 'No se pudo llegar a Cloudflare. Comprueba que el equipo principal tiene internet: Manna lo vuelve a intentar solo.';
  return 'La conexión por internet se cerró. Manna lo vuelve a intentar solo.';
}

// Qué dice la comprobación desde internet ({ ok, status, id } de GET <dirección>/api/ping, o { error }),
// para quien usa Manna. null: contesta este mismo Manna.
export function diagnose(reply, { me, own, port }) {
  if (reply.error) return 'No se pudo abrir la dirección de internet desde este equipo. Comprueba que tiene internet: Manna lo vuelve a intentar solo.';
  if (reply.ok && reply.id === me) return null;
  if (reply.ok && reply.id) return 'Esa dirección la contesta otro equipo con Manna: el mismo túnel está abierto en otro equipo. Apaga allí la conexión por internet.';
  return `Cloudflare está conectado, pero no llega a Manna (responde ${reply.status}). ${own
    ? `En el panel de Cloudflare, el servicio de este túnel debe ser http://localhost:${port}.`
    : 'Manna lo vuelve a intentar solo.'}`;
}

async function ask(base) {
  try {
    const res = await fetch(`${base}/api/ping?comprobar=${Date.now()}`, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Manna (comprobacion del tunel)' } });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: body?.id, version: body?.version };
  } catch {
    return { error: true };
  }
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
  store.register('internet', { on: Boolean(saved.data.on), status: 'off', url: null, own: Boolean(saved.data.token), error: null, busy: null });
  let child = null;
  let tries = 0;
  let timer = null;
  let checkTimer = null;
  let fails = 0;
  let round = 0; // cada start() y stop() empieza otra vuelta: lo que llegue de una anterior no cuenta

  function stop() {
    round += 1;
    clearTimeout(timer);
    clearTimeout(checkTimer);
    timer = null;
    const old = child;
    child = null;
    old?.kill();
  }

  // Lo contesta otro Manna (no este): su versión, o '' si no la dice.
  const other = (reply) => (reply.ok && reply.id && reply.id !== app.settings.data.id ? reply.version || '' : null);
  // Otro equipo usa ya el dominio: este no se conecta y vuelve a mirar en un minuto y pico. Lo que se espere
  // de más es al azar, para que dos que se apartan a la vez no vuelvan a chocar.
  function yieldTo(version) {
    stop();
    set({ status: 'busy', busy: version, url: null, error: null });
    timer = setTimeout(start, every() * (6 + 3 * Math.random()));
    timer.unref();
  }

  async function start() {
    stop();
    const { on, token, address } = saved.data;
    set({ on: Boolean(on), own: Boolean(token) });
    if (!on || app.blocked) return set({ status: 'off', url: null, error: null, busy: null });
    if (!app.tools.has('cloudflared')) return set({ status: 'error', url: null, error: 'Falta cloudflared, el programa de Cloudflare. Instálalo en Ajustes → Revisar el equipo.' });
    // El túnel rápido tiene una dirección nueva cada vez: no puede chocar. El propio, sí.
    const where = token && (process.env.MANNA_TUNEL_PRUEBA || address);
    if (where) {
      const mine = round;
      // Mientras pregunta, «ocupada» sigue a la vista: no salta a «Conectando…» en cada vuelta.
      if (store.get('internet').status !== 'busy') set({ status: 'starting', url: address || null, error: tries ? store.get('internet').error : null });
      const version = other(await ask(where));
      if (mine !== round) return; // se apagó o se cambió mientras tanto
      if (version !== null) return yieldTo(version);
    }
    set({ busy: null });
    launch(token, address);
  }

  function launch(token, address) {
    const args = token ? ['tunnel', '--no-autoupdate', 'run'] : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${app.port}`];
    // Al reintentar, el último problema sigue a la vista hasta que funcione.
    set({ status: 'starting', url: token ? address || null : null, error: tries ? store.get('internet').error : null });
    // La clave va por el entorno: en la orden la vería cualquier programa que liste los procesos.
    const mine = app.tools.spawn('cloudflared', args, { tied: true, env: { ...process.env, ...(token ? { TUNNEL_TOKEN: token } : {}) } });
    child = mine;
    let log = '';
    const read = (chunk) => {
      const text = String(chunk);
      log = (log + text).slice(-4000);
      const quick = !token && QUICK.exec(text)?.[0];
      if (quick) set({ url: quick });
      // Cloudflare la acepta (lo dice una vez por cada una de sus conexiones): falta ver que se llega a Manna.
      if (/Registered tunnel connection/i.test(text) && store.get('internet').status === 'starting') {
        fails = 0;
        if (target()) {
          set({ status: 'checking' });
          watch(mine, every());
        } else {
          tries = 0;
          set({ status: 'unchecked' }); // dominio propio guardado sin su dirección
        }
      }
    };
    mine.stdout.on('data', read);
    mine.stderr.on('data', read);
    mine.on('error', () => {});
    mine.on('exit', () => {
      if (child !== mine) return; // se cerró a propósito
      clearTimeout(checkTimer);
      child = null;
      set({ status: 'error', url: null, error: explain(log) });
      retry();
    });
  }

  function retry() {
    timer = setTimeout(start, RETRY_MS[Math.min(tries, RETRY_MS.length - 1)]);
    timer.unref();
    tries += 1;
  }

  // Dónde se comprueba: la dirección del túnel (MANNA_TUNEL_PRUEBA, en las pruebas: nada sale a internet).
  const target = () => process.env.MANNA_TUNEL_PRUEBA || store.get('internet').url;
  function watch(mine, delay) {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => check(mine), delay);
    checkTimer.unref();
  }
  async function check(mine) {
    const reply = await ask(target());
    if (child !== mine) return; // se apagó o se rehízo mientras tanto
    // Con dominio propio, otro Manna conectado al mismo túnel (se encendieron casi a la vez): este se aparta.
    if (saved.data.token && other(reply) !== null) return yieldTo(other(reply));
    const problem = diagnose(reply, { me: app.settings.data.id, own: Boolean(saved.data.token), port: app.port });
    if (!problem) {
      fails = 0;
      tries = 0;
      set({ status: 'on', error: null });
      watch(mine, every() * 6);
      return;
    }
    fails += 1;
    if (fails < FAILS) {
      watch(mine, every());
      return;
    }
    // Caída de verdad, aunque cloudflared siga abierto: se rehace, y el motivo queda a la vista.
    stop();
    set({ status: 'error', error: problem });
    retry();
  }

  // No se cierra al abrir ningún otro cloudflared del equipo: el servicio de Cloudflare de Windows, que puede llevar
  // el dominio propio aparte de Manna, también se llama así (lo cerraba la 1.24.0). Lo de Manna ya lo cierra el vigilante.
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
