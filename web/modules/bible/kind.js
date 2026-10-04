import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { applyTextStyles, fitText } from '../projection/text.js';

// Tipo de contenido "pasaje bíblico": el texto de los versículos y la cita.
registerKind('verses', {
  icon: 'book-open-text',
  label: 'Biblia',
  unit: ['versículo', 'versículos'],
  wholeUpTo: 6, // un pasaje de hasta seis versículos también se puede proyectar entero
  title: (item) => (item.version ? `${item.reference} (${item.version})` : item.reference),
  key: (item) => `${item.versionId}|${item.reference}`,

  draw(host, { stage }) {
    const text = h('div', { class: 'stage-text' });
    const ref = h('div', { class: 'stage-ref' });
    const inner = h('div', { class: 'stage-inner' }, text, ref);
    host.replaceChildren(inner);
    const fit = () => fitText(stage, host, inner);
    const observer = new ResizeObserver(fit);
    observer.observe(stage);

    return {
      update(item, { styles }) {
        applyTextStyles(inner, styles);
        text.style.color = styles.textColor;
        ref.style.color = styles.refColor;
        const many = item.verses.length > 1;
        text.replaceChildren(...item.verses.flatMap((v) => [
          many ? h('sup', { class: 'stage-vn' }, String(v.n)) : null,
          `${v.text} `,
        ]).filter(Boolean));
        ref.textContent = item.version ? `${item.reference} (${item.version})` : item.reference;
        fit();
      },
      destroy() {
        observer.disconnect();
        stage.style.removeProperty('--fit');
      },
    };
  },
});

const LAYOUTS = [['columns', 'columns', 'Lado a lado'], ['rows', 'rows', 'Una sobre otra']];

// Texto de un pasaje al comparar: cada versículo con su número delante, también cuando es uno
// solo, porque es lo que permite seguir con la vista el mismo versículo en las dos versiones.
function verseNodes(verses) {
  return verses.flatMap((v) => [h('sup', { class: 'stage-vn' }, String(v.n)), `${v.text} `]);
}

// Tipo de contenido "comparación": el mismo pasaje en dos versiones, cada una con su sigla,
// separadas por una línea. La disposición (lado a lado o una sobre otra) se cambia al aire.
registerKind('compare', {
  icon: 'columns',
  label: 'Comparador',
  unit: ['versículo', 'versículos'],
  wholeUpTo: 3,
  title: (item) => `${item.reference} (${item.sides.map((side) => side.version).join(' · ')})`,
  key: (item) => `${item.sides.map((side) => side.versionId).join('+')}|${item.reference}`,

  draw(host, { stage }) {
    const sides = [0, 1].map(() => {
      const text = h('div', { class: 'stage-text' });
      const label = h('div', { class: 'cmp-label' });
      return { text, label, el: h('div', { class: 'cmp-side' }, text, label) };
    });
    const line = h('div', { class: 'cmp-line' });
    const ref = h('div', { class: 'stage-ref' });
    const inner = h('div', { class: 'stage-inner cmp' }, h('div', { class: 'cmp-sides' }, sides[0].el, line, sides[1].el), ref);
    host.replaceChildren(inner);
    const fit = () => fitText(stage, host, inner);
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    let own = 'columns'; // la disposición con la que se guardó el elemento

    return {
      update(item, { styles }) {
        applyTextStyles(inner, styles);
        ref.style.color = styles.refColor;
        line.style.background = styles.refColor;
        item.sides.forEach((side, i) => {
          sides[i].text.style.color = styles.textColor;
          sides[i].label.style.color = styles.refColor;
          sides[i].label.textContent = side.version;
          sides[i].text.classList.toggle('cmp-absent', !side.verses.length);
          sides[i].text.replaceChildren(...(side.verses.length ? verseNodes(side.verses) : [`Este pasaje no está en ${side.version}`]));
        });
        ref.textContent = item.reference;
        own = item.layout === 'rows' ? 'rows' : 'columns';
        inner.dataset.layout = own;
        fit();
      },
      // Al aire, manda la disposición elegida con el mando; en una miniatura, la del elemento.
      live(state) {
        inner.dataset.layout = state?.layout || own;
        fit();
      },
      destroy() {
        observer.disconnect();
        stage.style.removeProperty('--fit');
      },
    };
  },

  controls(host, { send }) {
    const buttons = LAYOUTS.map(([id, glyph, label]) => h('button', { class: 'btn grow', dataset: { layout: id }, onclick: () => send({ layout: id }) }, icon(glyph, 16), label));
    host.replaceChildren(h('div', { class: 'transport' }, ...buttons));
    return {
      update(state, item) {
        const layout = state?.layout || item.layout;
        buttons.forEach((b) => b.classList.toggle('on', b.dataset.layout === layout));
      },
    };
  },
});
