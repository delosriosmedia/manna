import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { chooseLayer } from '../../core/capas.js';
import { registerKind } from '../../core/kinds.js';
import { can } from '../../core/session.js';
import { mando, mandoVacio, stepCells, wholeCell } from '../projection/slot.js';
import { applyTextStyles, fitText } from '../projection/text.js';
import { createBibleBar } from './onair.js';

// La ranura de «En vivo»: los versículos del pasaje al aire (la que sale, la que sigue) y lo que se hace con él.
const verseCount = (item) => { const { verseStart, verseEnd } = item.source.data.ref; return verseEnd - verseStart + 1; };
const verseCells = (count) => stepCells(count, {
  total: verseCount,
  now: (item) => (verseCount(item) === 1 ? 0 : item.source.step),
  name: (k, item) => `v. ${item.source.data.ref.verseStart + k}`,
});
// «Encima»: el pasaje en una capa, sobre lo que se proyecte. Una comparación va con su primera versión.
const verseLayer = (getItem) => can('layers.edit') && mando({ label: 'Encima', glyph: 'stack', title: 'Ponerlo en una capa, encima de lo que se proyecte', onclick: (e) => {
  const item = getItem();
  const { ref, versionId, versions } = item.source.data;
  chooseLayer(e.currentTarget, { kind: 'verses', data: { versionId: versionId ?? versions[0], ref }, title: item.reference });
} });

// Tipo de contenido "pasaje bíblico": el texto de los versículos y la cita.
registerKind('verses', {
  icon: 'book-open-text',
  label: 'Biblia',
  unit: ['versículo', 'versículos'],
  wholeUpTo: 6, // un pasaje de hasta seis versículos también se puede proyectar entero
  stepLabel: (item, k) => `v. ${item.source.data.ref.verseStart + k}`,
  title: (item) => (item.version ? `${item.reference} (${item.version})` : item.reference),
  key: (item) => `${item.versionId}|${item.reference}`,
  cover: true, // en una capa, con su fondo: tapa un momento la presentación que está al aire

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

  // Versión, comparar y otro versículo (onair.js). No tiene mandos en el servidor: todo va por órdenes de la proyección.
  controls(host) {
    const bar = createBibleBar();
    host.replaceChildren(bar.el);
    return { update: (_mandos, item) => bar.update(item), destroy: bar.destroy };
  },

  slot(host, api) {
    let item = null;
    const bar = createBibleBar({ compact: true });
    const cells = verseCells(3);
    const whole = wholeCell();
    host.replaceChildren(bar.el, verseLayer(() => item) || mandoVacio(), ...cells.els, whole.el, api.more());
    return {
      update(_mandos, next) {
        item = next;
        bar.update(item);
        cells.update(item);
        whole.update(item);
        // Hasta seis versículos también se ven juntos, en el sitio de la tercera casilla.
        const offered = verseCount(item) > 1 && verseCount(item) <= 6;
        whole.el.hidden = !offered;
        cells.els[2].hidden = offered;
      },
      destroy: bar.destroy,
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
  stepLabel: (item, k) => `v. ${item.source.data.ref.verseStart + k}`,
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
    const bar = createBibleBar();
    const buttons = LAYOUTS.map(([id, glyph, label]) => h('button', { class: 'btn grow', dataset: { layout: id }, 'aria-label': label, title: label, onclick: () => send({ layout: id }) }, icon(glyph, 16), h('span', { class: 'lbl' }, label)));
    host.replaceChildren(bar.el, h('div', { class: 'transport t2' }, ...buttons));
    return {
      update(state, item) {
        const layout = state?.layout || item.layout;
        buttons.forEach((b) => b.classList.toggle('on', b.dataset.layout === layout));
        bar.update(item);
      },
      destroy: bar.destroy,
    };
  },

  slot(host, { send }) {
    let item = null;
    const bar = createBibleBar({ compact: true });
    const cells = verseCells(2);
    const layouts = [['columns', 'Lado', 'Lado a lado'], ['rows', 'Arriba', 'Una sobre otra']].map(([id, label, title]) => mando({ label, glyph: id, title, onclick: () => send({ layout: id }) }));
    host.replaceChildren(bar.el, verseLayer(() => item) || mandoVacio(), ...cells.els, ...layouts);
    return {
      update(state, next) {
        item = next;
        bar.update(item);
        cells.update(item);
        const layout = state?.layout || item.layout;
        layouts[0].classList.toggle('sel', layout !== 'rows');
        layouts[1].classList.toggle('sel', layout === 'rows');
      },
      destroy: bar.destroy,
    };
  },
});
