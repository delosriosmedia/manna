import { action, state, subscribe } from '../../core/api.js';
import { h, guard } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createJobsList } from '../../core/jobs.js';
import { keyOf, kindBadge } from '../../core/kinds.js';
import { createStage } from './stage.js';
import { createLiveControls } from './live.js';
import { describeDisplay, describeLive, toggleMode } from './controls.js';

// Panel "Al aire": lo que está en pantalla y los mandos para gobernarlo, visible desde cualquier módulo.
// En pantallas estrechas se reduce a una barra compacta que se despliega al tocarla.
export function createDock(container, ctx) {
  const step = (delta) => guard(() => action('projection.step', { delta }));

  // ---- Desplegado ----
  const tally = h('span', { class: 'tally' });
  const label = h('strong', {});
  const display = h('span', { class: 'status' });
  const program = h('div', { class: 'monitor' });
  const ref = h('div', { class: 'dock-ref' });
  const black = h('button', { class: 'btn grow', title: 'Pantalla en negro', onclick: () => toggleMode('black') }, 'Negro', h('kbd', {}, 'B'));
  const clear = h('button', { class: 'btn grow', title: 'Ocultar el texto y dejar el fondo', onclick: () => toggleMode('clear') }, 'Solo fondo', h('kbd', {}, 'C'));
  const liveControls = h('div', {});
  const jobs = h('div', {});
  const previewMonitor = h('div', { class: 'monitor' });
  const previewBlock = h('div', { hidden: true },
    h('div', { class: 'dock-label', style: 'margin-bottom: 10px;' }, 'Vista previa', h('span', {}, 'lo que se proyectará')),
    previewMonitor);
  const nextList = h('div', { style: 'display: grid; gap: 6px;' });
  const nextBlock = h('div', {},
    h('div', { class: 'dock-label', style: 'margin-bottom: 10px;' }, 'A continuación',
      h('button', { class: 'link', onclick: () => ctx.go('orden') }, 'Abrir orden')),
    nextList);

  const body = h('div', { class: 'dock-body' },
    h('div', { class: 'dock-head' }, tally, label, h('span', { class: 'spacer' }), display,
      h('button', { class: 'icon-btn dock-close', 'aria-label': 'Cerrar', onclick: () => container.classList.remove('open') }, icon('caret-down', 20))),
    program,
    ref,
    h('div', { class: 'transport' },
      h('button', { class: 'btn', title: 'Anterior', 'aria-label': 'Anterior', onclick: step(-1) }, icon('caret-left', 16)),
      h('button', { class: 'btn grow', onclick: step(1) }, 'Siguiente', icon('caret-right', 16), h('kbd', {}, '→'))),
    h('div', { class: 'transport' }, black, clear),
    liveControls,
    jobs,
    previewBlock,
    nextBlock);

  // ---- Barra compacta (celular) ----
  const miniTally = h('span', { class: 'tally' });
  const miniTitle = h('strong', {});
  const miniSub = h('small', {});
  const mini = h('div', { class: 'dock-mini' },
    h('button', { class: 'dock-mini-main', 'aria-label': 'Abrir el panel Al aire', onclick: () => container.classList.add('open') },
      miniTally, h('span', { class: 'dock-mini-text' }, miniTitle, miniSub), icon('caret-up', 18)),
    h('button', { class: 'icon-btn', 'aria-label': 'Anterior', onclick: step(-1) }, icon('caret-left', 20)),
    h('button', { class: 'icon-btn', 'aria-label': 'Siguiente', onclick: step(1) }, icon('caret-right', 20)));

  container.replaceChildren(mini, body);

  const programStage = createStage(program);
  const previewStage = createStage(previewMonitor);
  createLiveControls(liveControls);
  // Lo que el equipo principal está preparando (conversiones, descargas), con su avance.
  createJobsList(jobs, { canDismiss: ctx.canEdit });
  let preview = null;

  function renderPreview() {
    const p = state.projection;
    // Si lo seleccionado ya es lo que está al aire, la vista previa sobra.
    const show = Boolean(p && preview && !(p.mode === 'live' && keyOf(preview) === keyOf(p.item)));
    previewBlock.hidden = !show;
    if (show) previewStage.render({ mode: 'live', item: preview, styles: p.styles });
  }

  // Lo que viene después de lo que está al aire en el orden del culto (o el principio, si no hay nada).
  function renderNext() {
    const items = (state.order?.items || []).filter((i) => i.kind !== 'section');
    const liveId = state.projection?.item?.source?.orderId;
    const from = items.findIndex((i) => i.id === liveId) + 1;
    const upcoming = items.slice(from, from + 3);
    nextList.replaceChildren(...(upcoming.length
      ? upcoming.map((item) => h('button', { class: 'next-item', title: item.title, onclick: guard(() => action('order.show', { id: item.id })) },
        kindBadge(item.kind), h('span', { class: 'item-text' }, h('strong', {}, item.title), h('small', {}, item.subtitle))))
      : [h('p', { class: 'muted' }, items.length ? 'No queda nada más en el orden.' : 'El orden del culto está vacío.')]));
  }

  subscribe('projection', (p) => {
    const live = describeLive(p);
    const on = live.state === 'live';
    programStage.render(p);
    program.classList.toggle('on-air', on);
    tally.classList.toggle('on', on);
    miniTally.classList.toggle('on', on);
    label.textContent = live.label;
    ref.textContent = live.text;
    miniTitle.textContent = live.text || live.label;
    miniSub.textContent = live.text ? live.label : 'Toca para ver los mandos';
    black.classList.toggle('on', p.mode === 'black');
    clear.classList.toggle('on', p.mode === 'clear' && Boolean(p.item));
    const d = describeDisplay(p.display);
    display.replaceChildren(icon(d.warn ? 'warning' : 'monitor', 14), d.text);
    display.classList.toggle('warn', d.warn);
    renderPreview();
    renderNext();
  });
  subscribe('order', renderNext);
  subscribe('live', (live) => programStage.setLive(live));

  return {
    toggleMode,
    // Lo que el módulo activo tiene seleccionado y se proyectaría (o null).
    setPreview(item) {
      preview = item;
      renderPreview();
    },
  };
}
