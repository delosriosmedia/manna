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
export function subscribe(ns, fn) {
  if (!listeners.has(ns)) listeners.set(ns, new Set());
  listeners.get(ns).add(fn);
  if (state[ns]) fn(state[ns]);
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
    source.addEventListener('state', (e) => {
      seen();
      Object.assign(state, JSON.parse(e.data));
      setOnline(true);
      Object.keys(state).forEach(emit);
    });
    source.addEventListener('patch', (e) => {
      seen();
      const { ns, state: next } = JSON.parse(e.data);
      state[ns] = next;
      emit(ns);
    });
    source.addEventListener('ping', seen);
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

  open();
}
