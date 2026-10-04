import { action, connect, session, subscribe } from '../core/api.js';
import { $, h, guard, toast } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { jobRow } from '../core/jobs.js';

// Revisión del equipo: lo que el equipo principal necesita para que todo funcione, qué falta
// y cómo instalarlo. Manna se abre aquí en vez de en el control mientras falte algo.
// La lista la publica el servidor (server/core/tools.js) y se actualiza sola.
const me = await session.get();
// En el equipo principal no hace falta PIN: se toma el control para poder instalar y comprobar.
if (me.isLocal && me.role !== 'control') await session.open('control').catch(() => {});
const canAct = me.isLocal || me.role === 'control';

const LEVELS = { required: 'Imprescindible', feature: 'Necesario para algunas funciones', optional: 'Opcional' };
const cards = new Map(); // id -> { el, update(tool), job(job) }
let jobs = [];

// El portapapeles solo está disponible en el propio equipo; en los demás, el texto se selecciona a mano.
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado');
  } catch {
    toast('Selecciona el texto y cópialo.', 'error');
  }
}

function createCard(id) {
  const mark = h('span', { class: 'req-mark' });
  const title = h('h2', {});
  const purpose = h('p', {});
  const status = h('span', { class: 'req-state' });
  const fix = h('div', { class: 'req-fix' });
  const progress = h('div', { class: 'req-job', hidden: true });
  const el = h('section', { class: 'req', dataset: { id } },
    h('div', { class: 'req-head' }, mark, h('div', { class: 'item-text' }, title, purpose), status), progress, fix);
  let last = '';

  return {
    el,
    update(tool) {
      const signature = JSON.stringify(tool);
      if (signature === last) return;
      last = signature;
      el.classList.toggle('missing', !tool.found);
      el.classList.toggle('optional', tool.level === 'optional');
      mark.replaceChildren(icon(tool.found ? 'check-circle' : 'warning-circle', 20));
      title.replaceChildren(tool.name, h('small', {}, tool.found
        ? [tool.detail !== tool.name && tool.detail, tool.version && `versión ${tool.version}`].filter(Boolean).join(' · ')
        : LEVELS[tool.level]));
      purpose.textContent = tool.purpose;
      status.textContent = tool.found ? 'Listo' : tool.level === 'optional' ? 'No está' : 'Falta';
      fix.hidden = tool.found;
      if (tool.found) return;
      const manual = tool.manual;
      fix.replaceChildren(...[
        h('div', { class: 'row' },
          tool.installable && me.isLocal && h('button', { class: 'btn primary', disabled: tool.installing, onclick: guard(() => action('tools.install', { id })) },
            icon('download-simple', 16), tool.installing ? 'Instalando…' : `Instalar por mí${tool.downloadSize ? ` (${tool.downloadSize})` : ''}`),
          h('a', { class: 'btn', href: tool.link, target: '_blank', rel: 'noopener' }, icon('arrow-square-out', 16), 'Página de descarga')),
        tool.installable && !me.isLocal && h('p', { class: 'muted' }, 'Se instala desde el equipo principal.'),
        manual && h('details', { open: !tool.installable },
          h('summary', {}, tool.installable ? 'Prefiero instalarlo a mano' : 'Cómo instalarlo'),
          h('ol', {}, ...manual.steps.map((step, i) => h('li', {}, step,
            manual.command && i === 1 && h('div', { class: 'command' }, h('code', {}, manual.command),
              h('button', { class: 'icon-btn', 'aria-label': 'Copiar la orden', title: 'Copiar', onclick: () => copy(manual.command) }, icon('copy', 16))))))),
      ].filter(Boolean));
    },
    job(job) {
      progress.replaceChildren(...(job ? [jobRow(job, { canDismiss: canAct })] : []));
      progress.hidden = !job;
    },
  };
}

const list = $('#list');
const lead = $('#lead');
const footer = $('#footer');

function paintJobs() {
  for (const [id, card] of cards) card.job(jobs.filter((j) => j.owner === 'tools' && j.ref === id).at(-1) || null);
}

subscribe('tools', ({ list: tools, blocked, pending, checked }) => {
  if (!checked) return;
  for (const tool of tools) {
    if (!cards.has(tool.id)) {
      cards.set(tool.id, createCard(tool.id));
      list.append(cards.get(tool.id).el);
    }
    cards.get(tool.id).update(tool);
  }
  paintJobs();

  lead.textContent = blocked ? 'A este equipo le falta un programa imprescindible. Manna no puede abrirse hasta instalarlo.'
    : pending ? 'Manna puede abrirse, pero algunas funciones no estarán disponibles hasta instalar lo que falta.'
      : 'Este equipo tiene todo lo necesario.';
  const recheck = canAct && h('button', { class: 'btn big', onclick: guard(async () => {
    await action('tools.scan');
    toast('Equipo revisado');
  }) }, icon('arrow-clockwise', 16), 'Volver a comprobar');
  const open = !blocked && h('a', { class: `btn big${pending ? '' : ' primary'}`, href: '/control' }, pending ? 'Continuar sin instalarlo' : 'Abrir Manna');
  footer.replaceChildren(...[
    h('div', { class: 'row' }, ...[open, recheck].filter(Boolean)),
    pending > 0 && !blocked && h('p', {}, 'Esta revisión aparecerá cada vez que se abra Manna hasta que el equipo esté completo. También está en Ajustes.'),
    !canAct && h('p', {}, 'Esto se resuelve en el equipo principal, el que tiene conectado el proyector.'),
  ].filter(Boolean));
});

subscribe('jobs', ({ list: all }) => {
  jobs = all;
  paintJobs();
});

connect('requisitos');
