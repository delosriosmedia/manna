import { state, subscribe } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { mountPassages } from './passages.js';

const LAYOUTS = [['columns', 'columns', 'Lado a lado'], ['rows', 'rows', 'Una sobre otra']];

// Pantalla Biblia: elegir un pasaje y proyectarlo o añadirlo al orden del culto. Con «Comparar», el
// mismo pasaje en dos versiones (tipo `compare`), lado a lado o una sobre otra: junto a cada versículo
// se lee también el de la segunda versión.
function mount(el, ctx) {
  let comparing = prefs.get('biblia.comparar', false);
  let layout = LAYOUTS.some(([id]) => id === prefs.get('comparar.disposicion')) ? prefs.get('comparar.disposicion') : 'columns';
  const versions = () => state.bible?.versions || [];
  const abbr = (id) => {
    const v = versions().find((x) => x.id === id);
    return v?.abbr || v?.name || '';
  };
  const options = (list) => list.map((v) => h('option', { value: v.id }, v.abbr ? `${v.name} (${v.abbr})` : v.name));

  // Las dos versiones no pueden ser la misma: elegir en un lado la que está en el otro las intercambia.
  const first = h('select', { class: 'select', 'aria-label': 'Versión de la Biblia', onchange: () => {
    if (comparing && first.value === second.value) setSecond(browser.versionId());
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
      paintCompare();
      browser.updatePreview();
    },
  }, icon(glyph, 18)));
  const compareBtn = h('button', { class: 'btn', 'aria-pressed': 'false', title: 'El mismo pasaje en dos versiones', 'aria-label': 'Comparar', onclick: () => setComparing(!comparing) }, icon('columns', 16), h('span', {}, 'Comparar'));
  const cmpBar = h('div', { class: 'cmp-bar' }, h('span', { class: 'muted' }, 'Comparar con'), second,
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Disposición en pantalla' }, ...layoutButtons));

  function paintCompare() {
    const can = versions().length > 1;
    compareBtn.disabled = !can;
    compareBtn.title = can ? 'El mismo pasaje en dos versiones' : 'Para comparar hacen falta dos biblias en «Contenido/Biblias»';
    compareBtn.classList.toggle('on', comparing && can);
    compareBtn.setAttribute('aria-pressed', String(comparing && can));
    cmpBar.hidden = !(comparing && can);
    el.classList.toggle('comparing', comparing && can);
    layoutButtons.forEach((b) => {
      b.classList.toggle('on', b.dataset.layout === layout);
      b.setAttribute('aria-pressed', String(b.dataset.layout === layout));
    });
  }
  function setComparing(on) {
    comparing = on;
    prefs.set('biblia.comparar', on);
    paintCompare();
    browser.refresh();
  }
  const isComparing = () => comparing && versions().length > 1 && Boolean(second.value);

  const browser = mountPassages(el, ctx, {
    title: 'Biblia',
    controls: [first, compareBtn],
    second: () => (isComparing() ? second.value : null),
    toItem: (p) => (isComparing()
      ? {
        kind: 'compare',
        data: { versions: [p.versionId, second.value], ref: p.ref, layout },
        preview: {
          kind: 'compare', reference: p.reference, ref: p.ref, layout,
          sides: [
            { versionId: p.versionId, version: abbr(p.versionId), verses: p.verses },
            { versionId: second.value, version: abbr(second.value), verses: p.others },
          ],
        },
      }
      : {
        kind: 'verses',
        data: { versionId: p.versionId, ref: p.ref },
        preview: { kind: 'verses', versionId: p.versionId, ref: p.ref, reference: p.reference, version: abbr(p.versionId), verses: p.verses },
      }),
    // versionId llega de passages.js: aquí `browser` aún no existe mientras se monta.
    liveRef: (item, versionId) => {
      if (item.kind === 'verses' && !isComparing()) return item.versionId === versionId ? item.ref : null;
      if (item.kind === 'compare' && isComparing()) return item.sides[0].versionId === versionId && item.sides[1].versionId === second.value ? item.ref : null;
      return null;
    },
    onVersion(id) {
      first.value = id;
      prefs.set('version', id);
    },
  });
  el.querySelector('.ws-head').after(cmpBar);
  paintCompare();

  subscribe('bible', ({ versions: list }) => {
    first.replaceChildren(...options(list));
    second.replaceChildren(...options(list));
    paintCompare();
    if (!list.length) {
      browser.empty('No hay biblias instaladas', 'Copia archivos .xmm o .xml en la carpeta "Contenido/Biblias" del equipo principal. Aparecerán aquí solos.');
      return;
    }
    const has = (id) => list.some((v) => v.id === id);
    const a = [browser.versionId(), prefs.get('version')].find(has) || list[0].id;
    // De entrada se compara con otra traducción, no con otra copia de la misma (dos archivos con la misma sigla).
    const sigla = (id) => list.find((v) => v.id === id)?.abbr || id;
    const other = list.find((v) => v.id !== a && sigla(v.id) !== sigla(a)) || list.find((v) => v.id !== a);
    if (other) setSecond(has(prefs.get('comparar.con')) && prefs.get('comparar.con') !== a ? prefs.get('comparar.con') : other.id);
    first.value = a;
    if (a !== browser.versionId()) browser.setVersion(a);
    else browser.refresh();
  });

  return browser.api;
}

export default { id: 'biblia', name: 'Biblia', icon: 'book-open-text', mount };
