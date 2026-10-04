import crypto from 'node:crypto';

// Tareas largas del servidor (convertir un video, descargar algo). Corren en segundo plano y
// publican su avance en el espacio "jobs" del estado: cualquier pantalla puede mostrar cuánto
// lleva y cuánto falta sin que la interfaz se detenga.
//
//   { id, title, detail, owner, ref, state: 'running' | 'done' | 'error', progress, eta, error }
//   progress  de 0 a 1, o null si no se puede saber
//   eta       segundos que faltan, o null
//   owner     módulo que la lanzó;  ref  a qué elemento suyo pertenece (para mostrarla junto a él)

const PUBLISH_MS = 250;      // como mucho cuatro avisos por segundo
const WINDOW_MS = 12_000;    // el ritmo se mide sobre los últimos segundos
const KEEP_DONE_MS = 4000;   // una tarea terminada se ve un momento y desaparece
const MAX_LISTED = 30;

// Segundos que faltan, a partir de muestras { t (ms), p (0..1) } recientes. null si aún no se sabe.
export function estimate(samples) {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || last.t - first.t < 1500 || last.p <= first.p) return null;
  const rate = (last.p - first.p) / (last.t - first.t);
  return Math.max(0, Math.round((1 - last.p) / rate / 1000));
}

export function createJobs({ store, now = Date.now }) {
  const jobs = new Map(); // id -> { view, samples }
  let timer = null;
  let closed = false;
  store.register('jobs', { list: [] });

  const publishNow = () => {
    clearTimeout(timer);
    timer = null;
    if (!closed) store.set('jobs', { list: [...jobs.values()].map((j) => j.view) });
  };
  const publish = () => {
    if (!timer) timer = setTimeout(publishNow, PUBLISH_MS);
  };

  function start({ title, detail = '', owner = null, ref = null }) {
    const id = crypto.randomUUID();
    const job = { view: { id, title, detail, owner, ref, state: 'running', progress: null, eta: null, error: null }, samples: [] };
    jobs.set(id, job);
    // Las tareas con error se quedan hasta que alguien las descarta; se limita cuántas se guardan.
    for (const [old, j] of jobs) {
      if (jobs.size <= MAX_LISTED) break;
      if (j.view.state !== 'running') jobs.delete(old);
    }
    publishNow();

    const change = (patch) => { job.view = { ...job.view, ...patch }; };
    return {
      id,
      get state() { return job.view.state; },
      // update({ progress, detail }): cualquiera de los dos.
      update({ progress, detail: text } = {}) {
        if (job.view.state !== 'running') return;
        if (text !== undefined) change({ detail: text });
        if (Number.isFinite(progress)) {
          const p = Math.min(1, Math.max(0, progress));
          const t = now();
          job.samples.push({ t, p });
          while (job.samples.length > 2 && t - job.samples[0].t > WINDOW_MS) job.samples.shift();
          change({ progress: p, eta: estimate(job.samples) });
        }
        publish();
      },
      done(text) {
        if (job.view.state !== 'running') return;
        change({ state: 'done', progress: 1, eta: 0, ...(text !== undefined && { detail: text }) });
        publishNow();
        setTimeout(() => { if (jobs.delete(id)) publishNow(); }, KEEP_DONE_MS).unref();
      },
      fail(message) {
        if (job.view.state !== 'running') return;
        change({ state: 'error', eta: null, error: String(message || 'No se pudo completar.') });
        publishNow();
      },
    };
  }

  return {
    start,
    // Quita de la lista una tarea que ya terminó (bien o con error).
    dismiss(id) {
      if (jobs.get(id)?.view.state === 'running') return;
      if (jobs.delete(id)) publishNow();
    },
    list: () => [...jobs.values()].map((j) => j.view),
    close() {
      closed = true;
      clearTimeout(timer);
    },
  };
}
