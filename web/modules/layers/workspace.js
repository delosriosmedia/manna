import { action, state, subscribe } from '../../core/api.js';
import { h, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge } from '../../core/kinds.js';

// Módulo Capas (fase 31): las cuatro capas que quedan encima de todo lo que se proyecte, también con «Negro» y «Solo
// fondo», hasta que se quiten. Arriba la 3, que va encima de todo; abajo la 1, la más cerca de lo que está al aire.
// Lo de cada módulo se pone en una capa con su botón «Capa» (core/capas.js) o aquí, con «Poner aquí».

// Lo que puede ir en una capa, por módulo: { kind, data, title, group }.
// La hora y los relojes van con su aspecto de siempre; con otro, se ponen desde Tiempo.
const SOURCES = [
  () => [{ kind: 'clock', data: { type: 'hora' }, title: 'Hora', group: 'Tiempo', icon: 'clock' },
    ...(state.time?.timers || []).map((t) => ({ kind: 'clock', data: { id: t.id }, title: t.title, group: 'Tiempo', icon: t.type === 'timer' ? 'hourglass-medium' : 'timer' }))],
  () => (state.web?.pages || []).filter((p) => p.framable).map((p) => ({ kind: 'web', data: { id: p.id }, title: p.name, group: 'Páginas web', icon: 'globe' })),
];

function mount(el) {
  const list = h('div', { class: 'layers-list' });
  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Capas')),
    list,
    h('p', { class: 'muted layers-note' }, 'Lo que está en una capa queda encima de todo lo que se proyecte, también con «Negro» y «Solo fondo», hasta que lo quites. La capa 3 va encima de la 2, y la 2 encima de la 1.'));

  const place = (anchor, n) => {
    const options = SOURCES.flatMap((source) => source());
    if (!options.length) {
      toast('Aún no hay nada que pueda ir en una capa.');
      return;
    }
    menu(anchor, options.map((it) => ({
      label: it.title, icon: it.icon, note: it.group,
      onclick: guard(() => action('layers.set', { n, kind: it.kind, data: it.data })),
    })));
  };

  const stateText = (slot) => {
    if (!slot.content) return 'Ya no está: quítala o pon otra cosa';
    if (!slot.ready) return 'Esperando a que la página conteste (¿hay internet?). Se mostrará sola';
    return slot.visible ? 'A la vista, encima de lo que se proyecta' : 'Oculta';
  };

  function render() {
    const slots = state.layers?.slots || [];
    list.replaceChildren(...[...slots].reverse().map((slot) => {
      const n = slot.n;
      if (!slot.kind) {
        return h('div', { class: 'layer-row empty-layer', dataset: { n } },
          h('span', { class: 'layer-n' }, n),
          h('span', { class: 'item-text' }, h('strong', {}, `Capa ${n}`), h('small', {}, 'Vacía')),
          h('button', { class: 'btn', onclick: (e) => place(e.currentTarget, n) }, icon('plus', 16), 'Poner aquí'));
      }
      const shown = slot.visible && slot.ready && Boolean(slot.content);
      // Un cronómetro o un temporizador se maneja también desde aquí (módulo Tiempo).
      const timer = slot.kind === 'clock' && slot.data?.id ? (state.time?.timers || []).find((t) => t.id === slot.data.id) : null;
      const send = (type, extra = {}) => guard(() => action(type, { id: timer.id, ...extra }));
      return h('div', { class: `layer-row${shown ? ' shown' : ''}`, dataset: { n } },
        h('span', { class: 'layer-n' }, n),
        kindBadge(slot.kind),
        h('span', { class: 'item-text' }, h('strong', {}, slot.title), h('small', {}, `Capa ${n} · ${stateText(slot)}`)),
        timer && h('button', {
          class: 'icon-btn layer-play', title: timer.clock.playing ? 'Pausar' : 'Empezar',
          'aria-label': `${timer.clock.playing ? 'Pausar' : 'Empezar'}: ${timer.title}`,
          onclick: send(timer.clock.playing ? 'time.pause' : 'time.start'),
        }, icon(timer.clock.playing ? 'pause' : 'play', 18)),
        h('button', {
          class: 'icon-btn layer-eye', 'aria-pressed': slot.visible,
          'aria-label': slot.visible ? `Ocultar la capa ${n}` : `Mostrar la capa ${n}`, title: slot.visible ? 'Ocultar' : 'Mostrar',
          onclick: guard(() => action('layers.visible', { n, visible: !slot.visible })),
        }, icon(slot.visible ? 'eye' : 'eye-slash', 18)),
        h('button', {
          class: 'icon-btn sm', 'aria-label': `Opciones de la capa ${n}`,
          onclick: (e) => menu(e.currentTarget, [
            ...(timer ? [
              { label: 'Volver al principio', icon: 'arrow-counter-clockwise', onclick: send('time.reset') },
              { label: 'Sumar un minuto', icon: 'plus', onclick: send('time.adjust', { minutes: 1 }) },
              { label: 'Restar un minuto', icon: 'minus', onclick: send('time.adjust', { minutes: -1 }) },
              '-',
            ] : []),
            { label: 'Recargar', icon: 'arrow-clockwise', note: 'la vuelve a cargar desde el principio', onclick: guard(() => action('layers.reload', { n })) },
            { label: 'Poner otra cosa', icon: 'plus', onclick: () => place(e.target.closest('.layer-row').querySelector('.layer-eye'), n) },
            '-',
            { label: 'Quitar', icon: 'trash', onclick: guard(() => action('layers.clear', { n })) },
          ]),
        }, icon('dots-three', 16)));
    }));
  }
  subscribe('layers', render);
  subscribe('web', render);
  subscribe('time', render);
  return { onShow: render };
}

export default { id: 'capas', name: 'Capas', icon: 'stack', mount };
