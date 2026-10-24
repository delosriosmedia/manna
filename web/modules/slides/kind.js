import { h } from '../../core/dom.js';
import { registerKind } from '../../core/kinds.js';
import { drawPicture, pictureControls } from '../projection/picture.js';

// Tipo de contenido "diapositivas": cada diapositiva es una imagen que ocupa la pantalla. Se
// dibuja y se encuadra como cualquier imagen (projection/picture.js); sus mandos añaden por dónde
// va la presentación y cuál es la diapositiva que viene.
registerKind('slides', {
  icon: 'presentation-chart',
  label: 'Diapositivas',
  unit: ['diapositiva', 'diapositivas'],
  title: (item) => `${item.title} · ${item.number} de ${item.pages}`,
  key: (item) => item.url,
  background: false,
  draw: drawPicture,

  controls(host, tools) {
    const where = h('strong', {});
    const left = h('small', { class: 't3' });
    const picture = h('img', { alt: '' });
    const label = h('span', {});
    const next = h('div', { class: 'slide-next t3' }, h('span', { class: 'slide-next-thumb' }, picture), h('span', { class: 'slide-next-text' }, h('small', {}, 'Sigue'), label));
    const info = h('div', { class: 'slide-info' }, h('div', { class: 'slide-count' }, where, left), next);
    // Los mandos del encuadre van debajo, tal cual; sin «Completa / Llenar»: una diapositiva va siempre entera.
    // Si la pasa PowerPoint, se dice debajo.
    const framing = h('div', { class: 'live-part slide-framing' });
    const ppt = h('p', { class: 'slide-ppt muted sec' }, 'La pasa PowerPoint en el proyector, con sus videos y animaciones: «Siguiente» avanza también las animaciones, y «Señalar» se ve encima. Al acercarla, PowerPoint se aparta hasta volver a la vista completa.');
    const covered = h('p', { class: 'slide-ppt muted sec' }, 'Hay una capa a la vista: PowerPoint la taparía, así que va como imágenes. Para pasarla con PowerPoint, oculta la capa en «Capas».');
    host.replaceChildren(info, framing, ppt, covered);
    const view = pictureControls(framing, tools, { fits: false });

    return {
      update(state, item) {
        const remaining = item.pages - item.number;
        where.replaceChildren(h('span', { class: 'lbl' }, 'Diapositiva '), `${item.number} de ${item.pages}`);
        left.textContent = remaining === 0 ? 'Es la última' : remaining === 1 ? 'Queda 1' : `Quedan ${remaining}`;
        next.classList.toggle('none', !item.next);
        if (item.next) {
          if (picture.getAttribute('src') !== item.next.thumb) picture.src = item.next.thumb;
          label.textContent = `Diapositiva ${item.next.number}`;
        } else {
          picture.removeAttribute('src');
          label.textContent = 'Fin de la presentación';
        }
        ppt.hidden = !item.powerpoint;
        covered.hidden = !item.covered;
        view.update(state, item);
      },
      destroy: () => view.destroy(),
    };
  },
});
