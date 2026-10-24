import { action, state, subscribe } from '../../core/api.js';
import { h, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge } from '../../core/kinds.js';

// Módulo Capas (fase 31): las tres capas que quedan encima de todo lo que se proyecte, también con «Negro» y «Solo
// fondo», hasta que se quiten. Arriba la 3, que va encima de todo; abajo la 1, la más cerca de lo que está al aire.
// Lo de cada módulo se pone en una capa con su botón «Capa» (core/capas.js) o aquí, con «Poner aquí».

// Lo que puede ir en una capa, por módulo: { kind, data, title, group }.
const SOURCES = [
  () => (state.web?.pages || []).filter((p) => p.framable).map((p) => ({ kind: 'web', data: { id: p.id }, title: p.name, group: 'Páginas web' })),
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
      toast('Aún no hay nada que pueda ir en una capa. Agrega una página en Páginas web.');
      return;
    }
    menu(anchor, options.map((it) => ({
      label: it.title, icon: 'globe', note: it.group,
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
      return h('div', { class: `layer-row${shown ? ' shown' : ''}`, dataset: { n } },
        h('span', { class: 'layer-n' }, n),
        kindBadge(slot.kind),
        h('span', { class: 'item-text' }, h('strong', {}, slot.title), h('small', {}, `Capa ${n} · ${stateText(slot)}`)),
        h('button', {
          class: 'icon-btn layer-eye', 'aria-pressed': slot.visible,
          'aria-label': slot.visible ? `Ocultar la capa ${n}` : `Mostrar la capa ${n}`, title: slot.visible ? 'Ocultar' : 'Mostrar',
          onclick: guard(() => action('layers.visible', { n, visible: !slot.visible })),
        }, icon(slot.visible ? 'eye' : 'eye-slash', 18)),
        h('button', {
          class: 'icon-btn sm', 'aria-label': `Opciones de la capa ${n}`,
          onclick: (e) => menu(e.currentTarget, [
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
  return { onShow: render };
}

export default { id: 'capas', name: 'Capas', icon: 'stack', mount };
