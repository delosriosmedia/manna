import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

// Previsualizar lo elegido en Medios (una imagen, un video): elegir no cambia la lista, y lo que se ve en grande se pide
// aquí. Va donde las diapositivas de una presentación: al lado de la lista o, en un cajón estrecho, encima de ella.
//   back: a qué vuelve («Imágenes»); what: qué se previsualiza; list: la lista; refresh: vuelve a dibujar el grupo.
export function createPreview({ back, what, list, refresh }) {
  const title = h('strong', {});
  const body = h('div', { class: 'media-preview' });
  const toggle = (on) => {
    preview.open = on;
    refresh();
    if (!on) return;
    // Al lado, la lista se estrecha y se reacomoda: lo elegido sigue a la vista. Encima, la lista no se toca.
    const card = list.querySelector('.media-card.selected');
    if (card && getComputedStyle(card).visibility === 'visible') card.scrollIntoView({ block: 'nearest' });
  };
  const side = h('aside', { class: 'deck-side', hidden: true, 'aria-label': `Previsualizar ${what}` },
    h('div', { class: 'deck-side-head' },
      h('button', { class: 'btn deck-back', onclick: () => toggle(false) }, icon('caret-left', 16), back),
      title,
      h('button', { class: 'icon-btn deck-close', 'aria-label': 'Cerrar la vista previa', title: 'Cerrar', onclick: () => toggle(false) }, icon('x', 16))),
    body);
  const see = h('button', { class: 'btn deck-see', onclick: () => toggle(!preview.open) }, icon('eye', 16), h('span', {}));
  const preview = {
    side, see, body, open: false,
    paint(item) {
      side.hidden = !(item && preview.open);
      if (item) title.textContent = item.name;
      see.lastChild.textContent = see.title = preview.open ? 'Ocultar la vista previa' : `Previsualizar ${what}`;
      see.setAttribute('aria-label', see.title);
    },
  };
  return preview;
}
