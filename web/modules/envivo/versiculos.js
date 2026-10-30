import { action, state } from '../../core/api.js';
import { guard, h, menu } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { mando } from '../projection/slot.js';
import { chapterOf, versionNow } from './versiculo.js';

// La lista de los versículos del mensaje: cada uno con su «Encima»; al tocarlo, su texto entero y «Proyectar». Lo leído, plegado.
// La usan el Orador completo en un móvil (orador.js) y en el computador (slides/presenter.js).

// Las partes del orden: los «versículos del mensaje» son los de la sección de lo que se está pasando; sin sección, todos.
export function messageItems(anchor) {
  const all = state.order?.items || [];
  const at = all.findIndex((i) => i.id === anchor);
  let from = 0;
  let to = all.length;
  if (at >= 0) {
    for (let i = at; i >= 0; i -= 1) if (all[i].kind === 'section') { from = i; break; }
    for (let i = at + 1; i < all.length; i += 1) if (all[i].kind === 'section') { to = i; break; }
  }
  return all.slice(from, to).filter((i) => i.kind === 'verses' || i.kind === 'compare');
}
export const refOf = (item) => item.data.ref;
const rangeText = (ref) => `${ref.chapter}:${ref.verseStart}${ref.verseEnd > ref.verseStart ? `–${ref.verseEnd}` : ''}`;
const bookFrom = (title) => title.replace(/\s+\d+:.*$/, '');

// Lo que la hoja «Versículo» necesita saber del mensaje y de lo que está al aire.
export const messageShortcuts = (anchor) => messageItems(anchor).map((i) => ({ title: i.title, book: refOf(i).book, bookName: bookFrom(i.title), typed: rangeText(refOf(i)) }));
const slideOnAir = () => (state.projection?.item?.kind === 'slides' ? state.projection.item.number : null);
export const sheetWords = {
  under: () => (slideOnAir() ? `de la ${slideOnAir()}` : ''),
  keeps: () => (slideOnAir() ? `Sigue al aire la diapositiva ${slideOnAir()}` : ''),
};

//   anchor()  por dónde va en el orden; onCite()  «Otra cita»
export function createVerseList({ anchor, onCite }) {
  const read = new Set();     // los pasajes ya leídos, en esta sesión
  const opened = new Set();   // los que se abrieron para ver su texto
  let showRead = false;
  const versionLabel = h('span', {});
  const versionBtn = mando({ cls: 'ev-version', onclick: () => menu(versionBtn, (state.bible?.versions || []).map((v) => ({ label: v.abbr ? `${v.name} (${v.abbr})` : v.name, note: v.id === versionNow()?.id ? 'ahora' : null, onclick: () => { prefs.set('version', v.id); paintVerses(); } }))) });
  versionBtn.append(versionLabel);
  const cite = h('button', { class: 'ev-cite', onclick: onCite }, icon('magnifying-glass', 13), h('span', {}, 'Otra cita'));
  const citeRow = h('div', { class: 'ev-cite-row' }, cite, versionBtn);
  const verseRows = h('div', { class: 'ev-vrows' });
  const texts = new Map(); // `versión|id` -> { text } | { missing: true }
  function verseRow(item, v) {
    const key = `${v?.id}|${item.id}`;
    const known = texts.get(key);
    const ref = refOf(item);
    if (!known && v) {
      chapterOf(v.id, ref.book, ref.chapter).then((data) => {
        const found = data?.verses?.filter((x) => x.n >= ref.verseStart && x.n <= ref.verseEnd) || [];
        texts.set(key, found.length ? { text: found.map((x) => x.text).join(' ') } : { missing: true });
        paintVerses();
      });
    }
    const open = opened.has(item.id);
    const data = { versionId: v?.id, ref };
    const encima = mando({ label: 'Encima', glyph: 'stack', title: 'Ponerlo encima de lo que está al aire, sin cambiarlo', onclick: guard(async () => {
      await action('projection.over', { data });
      read.add(item.id);
      paintVerses();
    }) });
    encima.disabled = Boolean(known?.missing);
    const sub = known?.missing ? `No está en ${v.abbr || v.name}${item.subtitle ? ` · Está en ${item.subtitle}` : ''}` : known?.text ?? '';
    return h('div', { class: `ev-vrow${known?.missing ? ' miss' : ''}${open ? ' open' : ''}` },
      h('div', { class: 'ev-vhead' },
        h('button', { class: 'ev-vmain', onclick: () => { if (open) opened.delete(item.id); else opened.add(item.id); paintVerses(); } }, h('b', {}, item.title), h('small', {}, sub)),
        encima),
      open && !known?.missing && h('div', { class: 'ev-vfull' }, h('p', {}, known?.text ?? ''), h('button', { class: 'ev-vput', onclick: guard(async () => {
        await action('order.show', { id: item.id, step: null });
        read.add(item.id);
        paintVerses();
      }) }, icon('play', 13), `Proyectar ${item.title}`)));
  }
  function paintVerses() {
    const v = versionNow();
    versionLabel.textContent = v?.abbr || v?.name || '';
    const items = messageItems(anchor());
    if (!items.length) {
      verseRows.replaceChildren(h('div', { class: 'ev-vacio' }, h('b', {}, 'Sin versículos en el orden'), h('small', {}, 'Con «Otra cita» se pone cualquiera encima.')));
      return;
    }
    const pending = items.filter((i) => !read.has(i.id));
    const done = items.filter((i) => read.has(i.id));
    verseRows.replaceChildren(...pending.map((i) => verseRow(i, v)),
      ...(done.length ? [h('button', { class: 'ev-read', 'aria-expanded': String(showRead), onclick: () => { showRead = !showRead; paintVerses(); } }, icon('check', 12), h('span', {}, `Ya leídos: ${done.map((i) => i.title).join(', ')}`), icon(showRead ? 'caret-up' : 'caret-down', 12))] : []),
      ...(showRead ? done.map((i) => verseRow(i, v)) : []));
  }
  return { citeRow, rows: verseRows, paint: paintVerses };
}
