import { action, subscribe } from './api.js';
import { h, guard } from './dom.js';
import { icon } from './icons.js';
import { formatTime } from './playback.js';

// Tareas largas del equipo principal (convertir un video, descargar algo). Se ven con su avance
// y lo que falta, sin detener la interfaz. Las publica el servidor: ver server/core/jobs.js.

export function describeJob(job) {
  if (job.state === 'error') return job.error;
  if (job.state === 'done') return job.detail || 'Listo';
  const percent = job.progress == null ? 'Preparando…' : `${Math.round(job.progress * 100)} %`;
  const left = job.eta == null ? '' : job.eta < 5 ? 'casi listo' : `faltan ${formatTime(job.eta)}`;
  return [percent, left, job.detail].filter(Boolean).join(' · ');
}

export function jobRow(job, { canDismiss = true } = {}) {
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((job.progress || 0) * 100) },
    h('span', { style: `width: ${Math.round((job.progress || 0) * 100)}%;` }));
  if (job.progress == null && job.state === 'running') bar.classList.add('busy');
  return h('div', { class: `job ${job.state}`, dataset: { id: job.id } },
    h('div', { class: 'job-head' },
      h('strong', {}, job.title),
      job.state === 'error' && canDismiss && h('button', { class: 'icon-btn sm', 'aria-label': 'Quitar el aviso', onclick: guard(() => action('jobs.dismiss', { id: job.id })) }, icon('x', 14))),
    job.state !== 'error' && bar,
    h('small', {}, describeJob(job)));
}

// Lista viva de tareas dentro de container. filter(job) elige cuáles (por defecto, todas).
// El contenedor se oculta cuando no hay ninguna.
export function createJobsList(container, { filter = () => true, canDismiss = true } = {}) {
  container.classList.add('jobs');
  container.hidden = true;
  return subscribe('jobs', ({ list }) => {
    const mine = list.filter(filter);
    container.hidden = !mine.length;
    container.replaceChildren(...mine.map((job) => jobRow(job, { canDismiss })));
  });
}
