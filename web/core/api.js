// Comunicación con el servidor: peticiones, acciones y estado en tiempo real.

const OFFLINE_MESSAGE = 'Sin conexión con el equipo principal. Inténtalo de nuevo en unos segundos.';

// timeout en ms (0 = sin límite). Sin él, un botón pulsado sin red se quedaría esperando sin avisar.
export async function api(path, { timeout = 10_000, ...options } = {}) {
  let res;
  try {
    const signal = timeout && AbortSignal.timeout ? AbortSignal.timeout(timeout) : undefined;
    res = await fetch(path, { ...options, signal });
  } catch {
    const err = new Error(OFFLINE_MESSAGE);
    err.status = 0;
    throw err;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'No se pudo completar la operación.');
    err.status = res.status;
    throw err;
  }
  return body;
}

const postJson = (path, data) => api(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// Sube un archivo mostrando el avance. body: un File o Blob; onProgress(0..1).
// Va por XMLHttpRequest porque fetch no informa de cuánto lleva enviado.
export function upload(path, body, { headers = {}, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const fail = (message, status) => reject(Object.assign(new Error(message), { status }));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onerror = () => fail(OFFLINE_MESSAGE, 0);
    xhr.onabort = () => fail('La subida se canceló.', 0);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* respuesta sin cuerpo */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else fail(data.error || 'No se pudo subir el archivo.', xhr.status);
    };
    xhr.send(body);
  });
}

// Ejecuta una acción de un módulo, p. ej. action('projection.show', { versionId, ref }).
export async function action(type, payload = {}) {
  return (await postJson('/api/action', { type, payload })).result;
}

export const session = {
  get: () => api('/api/session'),
  open: (role, pin) => postJson('/api/session', { role, pin }),
};

// Estado compartido: una copia local de lo que tiene el servidor, por módulo.
export const state = {};
const listeners = new Map(); // ns -> Set<fn>
const statusListeners = new Set();
let online = false;

// subscribe('projection', fn): llama a fn(estado) ahora (si ya hay datos) y en cada cambio.
// Devuelve la función que cancela la suscripción.
export function subscribe(ns, fn) {
  if (!listeners.has(ns)) listeners.set(ns, new Set());
  listeners.get(ns).add(fn);
  if (state[ns]) fn(state[ns]);
  return () => listeners.get(ns).delete(fn);
}

// Hora del servidor, en milisegundos. Cada dispositivo tiene su reloj un poco distinto; con esto
// todos calculan lo mismo (por ejemplo, en qué segundo va un video). Ver core/playback.js.
// El servidor manda su hora en cada latido; la diferencia real es la mayor de las medidas
// recientes, porque el retraso de la red solo puede hacerla parecer menor.
let offsets = [];
export const serverNow = () => Date.now() + (offsets.length ? Math.max(...offsets) : 0);
function syncClock(serverTime) {
  if (!Number.isFinite(serverTime)) return;
  offsets = [...offsets.slice(-5), serverTime - Date.now()];
}

export function onConnection(fn) {
  statusListeners.add(fn);
  fn(online);
}

function emit(ns) {
  listeners.get(ns)?.forEach((fn) => fn(state[ns]));
}

function setOnline(value) {
  if (online === value) return;
  online = value;
  statusListeners.forEach((fn) => fn(online));
}

// Qué hacer cuando el servidor vuelve con otro código (Manna se actualizó y se reinició): la
// página que hay abierta es la de antes y debe cargarse de nuevo. Las páginas de control lo
// cambian para no pedir la confirmación de "salir del sitio".
let whenUpdated = () => location.reload();
export const onServerUpdate = (fn) => { whenUpdated = fn; };
let knownBuild; // huella del servidor al que se conectó esta página (undefined = aún no se sabe)

// Quién es esta conexión para el servidor. Sirve para saber si esta pantalla es la que suena
// (state.conexiones.sonido): ver server/core/realtime.js.
let clientId = null;
export const connectionId = () => clientId;

// El servidor envía un latido cada 10 s. Si pasan 25 s sin recibir nada, la conexión
// está "muerta aunque abierta" (wifi caída, router reiniciado, equipo dormido) y se rehace.
const STALE_MS = 25_000;
let reopen = () => {};
let stop = () => {};

// Fuerza un intento de reconexión ahora (botón "Reintentar").
export const reconnect = () => reopen();

// Corta la conexión y deja de reintentar (al apagar Manna desde esta página).
export const disconnect = () => stop();

// Abre el canal en tiempo real y lo mantiene vivo: reconecta tras cualquier corte
// y, al volver, recibe el estado completo, así que nunca queda desfasado.
export function connect(role) {
  let source = null;
  let lastSeen = Date.now();
  let retry = null;
  const seen = () => { lastSeen = Date.now(); };

  function open() {
    clearTimeout(retry);
    source?.close();
    seen();
    source = new EventSource(`/api/events?rol=${encodeURIComponent(role)}`);
    source.addEventListener('hello', (e) => {
      seen();
      try { clientId = JSON.parse(e.data).id; } catch { clientId = null; }
    });
    source.addEventListener('state', (e) => {
      seen();
      Object.assign(state, JSON.parse(e.data));
      const build = state.system?.build ?? null;
      if (knownBuild === undefined) knownBuild = build;
      else if (build !== knownBuild) {
        whenUpdated();
        return;
      }
      setOnline(true);
      Object.keys(state).forEach(emit);
    });
    source.addEventListener('patch', (e) => {
      seen();
      const { ns, state: next } = JSON.parse(e.data);
      state[ns] = next;
      emit(ns);
    });
    source.addEventListener('ping', (e) => {
      seen();
      try { syncClock(JSON.parse(e.data).t); } catch { /* latido sin hora */ }
    });
    source.onerror = () => {
      setOnline(false);
      // El navegador reintenta solo, salvo cuando da la conexión por cerrada.
      if (source.readyState === EventSource.CLOSED) retry = setTimeout(open, 2000);
    };
  }
  reopen = open;

  const isStale = () => Date.now() - lastSeen > STALE_MS;
  const watchdog = setInterval(() => {
    if (!isStale()) return;
    setOnline(false);
    open();
  }, 5000);

  let stopped = false;
  stop = () => {
    stopped = true;
    clearInterval(watchdog);
    clearTimeout(retry);
    source?.close();
  };

  // Al volver del segundo plano (celular) o recuperar la red, no esperar al siguiente reintento.
  const wake = () => { if (!stopped && (!online || isStale())) open(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', (e) => { if (e.persisted && !stopped) open(); });
  // Al salir de la página se suelta la conexión. Si no, el navegador puede dejar la página
  // "congelada" con la conexión abierta, y tras unas cuantas navegaciones agota las seis que
  // permite por servidor: la app dejaría de cargar.
  window.addEventListener('pagehide', () => { clearTimeout(retry); source?.close(); });

  open();
}
