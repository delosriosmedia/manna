import { action } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

// Medios en «Preparar el culto» (fase 36, en la nube): un video de YouTube por su enlace va al orden y lo descarga el
// equipo de la iglesia (fase 37 o 38), porque YouTube no deja descargar desde un servidor. La biblioteca de la iglesia
// (imágenes, videos, presentaciones) llega aquí con la sincronización (fase 37).
function mount(el) {
  const link = h('input', { type: 'text', inputMode: 'url', autocomplete: 'off', placeholder: 'Pega el enlace de un video de YouTube', 'aria-label': 'Enlace de YouTube' });
  const add = guard(async () => {
    const item = await action('order.add', { kind: 'ytlink', data: { link: link.value } });
    link.value = '';
    toast(`«${item.title}» añadido al orden del culto. Se descargará en la iglesia.`);
  });
  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Medios')),
    h('div', { class: 'media-links' },
      h('form', { class: 'yt-add', onsubmit: (e) => { e.preventDefault(); add(); } },
        h('label', { class: 'search' }, icon('youtube-logo', 16), link),
        h('button', { class: 'btn primary', type: 'submit' }, icon('plus', 16), h('span', {}, 'Añadir al orden'))),
      h('p', { class: 'muted' }, 'El video se descarga en el equipo de la iglesia antes del culto. Si escribes algo antes del enlace («Canto de entrada: …»), ese será su nombre en el orden.'),
      h('p', { class: 'muted' }, 'Las imágenes, los videos y las presentaciones de la iglesia aparecerán aquí cuando la nube se conecte con el equipo de la iglesia.')));
}

export default { id: 'medios', name: 'Medios', icon: 'image', mount };
