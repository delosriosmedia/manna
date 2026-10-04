import { state, subscribe } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { mountPassages } from './passages.js';

const LAYOUTS = [['columns', 'columns', 'Lado a lado'], ['rows', 'rows', 'Una sobre otra']];

// Pantalla Comparador: el mismo pasaje en dos versiones, lado a lado o una sobre otra.
// Se elige igual que en Biblia; junto a cada versículo se lee también el de la segunda versión.
function mount(el, ctx) {
  let layout = LAYOUTS.some(([id]) => id === prefs.get('comparar.disposicion')) ? prefs.get('comparar.disposicion') : 'columns';
  const options = (versions) => versions.map((v) => h('option', { value: v.id }, v.abbr ? `${v.name} (${v.abbr})` : v.name));
  const abbr = (id) => {
    const v = state.bible?.versions.find((x) => x.id === id);
    return v?.abbr || v?.name || '';
  };

  // Las dos versiones no pueden ser la misma: elegir en un lado la que está en el otro las intercambia.
  const first = h('select', { class: 'select', 'aria-label': 'Primera versión', onchange: () => {
    if (first.value === second.value) setSecond(browser.versionId());
    browser.setVersion(first.value);
  } });
  const second = h('select', { class: 'select', 'aria-label': 'Segunda versión', onchange: () => {
    if (second.value === first.value) {
      const was = prefs.get('comparar.con');
      setSecond(second.value);
      browser.setVersion(was);
    } else {
      setSecond(second.value);
      browser.refresh();
    }
  } });
  function setSecond(id) {
    second.value = id;
    prefs.set('comparar.con', id);
  }

  const layoutButtons = LAYOUTS.map(([id, glyph, label]) => h('button', {
    class: 'icon-btn', title: label, 'aria-label': label, dataset: { layout: id },
    onclick: () => {
      layout = id;
      prefs.set('comparar.disposicion', id);
      paintLayout();
      browser.updatePreview();
    },
  }, icon(glyph, 18)));
  const paintLayout = () => layoutButtons.forEach((b) => b.classList.toggle('on', b.dataset.layout === layout));
  paintLayout();

  const browser = mountPassages(el, ctx, {
    title: 'Comparador',
    controls: [
      h('div', { class: 'cmp-pick' }, first, h('span', { class: 'muted' }, 'con'), second),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Disposición en pantalla' }, ...layoutButtons),
    ],
    second: () => second.value || null,
    toItem: (p) => ({
      kind: 'compare',
      data: { versions: [p.versionId, second.value], ref: p.ref, layout },
      preview: {
        kind: 'compare', reference: p.reference, ref: p.ref, layout,
        sides: [
          { versionId: p.versionId, version: abbr(p.versionId), verses: p.verses },
          { versionId: second.value, version: abbr(second.value), verses: p.others },
        ],
      },
    }),
    liveRef: (item) => (item.kind === 'compare' && item.sides[0].versionId === browser.versionId() && item.sides[1].versionId === second.value ? item.ref : null),
    onVersion(id) {
      first.value = id;
      prefs.set('version', id);
    },
  });

  subscribe('bible', ({ versions }) => {
    first.replaceChildren(...options(versions));
    second.replaceChildren(...options(versions));
    if (versions.length < 2) {
      browser.empty('Hacen falta dos versiones', 'Para comparar, copia al menos dos biblias en la carpeta "Contenido/Biblias" del equipo principal.');
      return;
    }
    // Se conserva lo elegido si sigue instalado; si no, la versión de Biblia y la primera distinta.
    const has = (id) => versions.some((v) => v.id === id);
    const a = [browser.versionId(), prefs.get('version')].find(has) || versions[0].id;
    // De entrada se propone otra traducción, no otra copia de la misma (dos archivos con la misma sigla).
    const sigla = (id) => versions.find((v) => v.id === id)?.abbr || id;
    const other = versions.find((v) => v.id !== a && sigla(v.id) !== sigla(a)) || versions.find((v) => v.id !== a);
    const b = has(prefs.get('comparar.con')) && prefs.get('comparar.con') !== a ? prefs.get('comparar.con') : other.id;
    first.value = a;
    setSecond(b);
    if (a !== browser.versionId()) browser.setVersion(a);
    else browser.refresh();
  });

  return browser.api;
}

export default { id: 'comparador', name: 'Comparador', icon: 'columns', mount };
