// Comunicación con el servidor: peticiones, acciones y estado en tiempo real.

export async function api(path, options = {}) {
  const res = await fetch(path, options);
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

// Abre el canal en tiempo real. El navegador reconecta solo si se cae la red.
export function connect(role) {
  const source = new EventSource(`/api/events?rol=${encodeURIComponent(role)}`);
  source.addEventListener('state', (e) => {
    Object.assign(state, JSON.parse(e.data));
    setOnline(true);
    Object.keys(state).forEach(emit);
  });
  source.addEventListener('patch', (e) => {
    const { ns, state: next } = JSON.parse(e.data);
    state[ns] = next;
    emit(ns);
  });
  source.onerror = () => setOnline(false);
  return source;
}
