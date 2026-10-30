import { action, api, state } from '../../core/api.js';
import { guard, h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';

// La hoja «Versículo» de los dos oradores (fase 46, tableros T9 y T10): un pasaje encima de lo que está al aire, escrito con el
// teclado de números propio, porque en estos tamaños el del celular tapa casi toda la pantalla. Como toda hoja de teclado, no
// se cierra al tocar fuera: solo con su × o con Esc, sin perder lo escrito.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ':', '0', '–'];

export const versionNow = () => {
  const versions = state.bible?.versions || [];
  return versions.find((v) => v.id === prefs.get('version')) || versions[0] || null;
};

// Los capítulos, pedidos una vez por versión.
const chapters = new Map();
export function chapterOf(versionId, book, chapter) {
  const key = `${versionId}|${book}|${chapter}`;
  if (!chapters.has(key)) chapters.set(key, api(`/api/bible/${versionId}/chapter/${book}/${chapter}`).catch(() => null));
  return chapters.get(key);
}
const bookLists = new Map();
const booksOf = (versionId) => {
  if (!bookLists.has(versionId)) bookLists.set(versionId, api(`/api/bible/${versionId}/books`).then((r) => r.books));
  return bookLists.get(versionId);
};

// "3:16", "3:16–17": capítulo y versículos. Sin versículo todavía, null.
export function parseTyped(typed) {
  const m = /^(\d+):(\d+)(?:–(\d*))?$/.exec(typed);
  if (!m) return null;
  const start = Number(m[2]);
  const end = m[3] ? Number(m[3]) : start;
  return end >= start ? { chapter: Number(m[1]), verseStart: start, verseEnd: end } : null;
}

// message(): los pasajes del mensaje, para no escribirlos: [{ title, book, bookName, typed }].
// under(): qué tapa («de la 5»), para decirlo; keeps(): lo mismo con todas sus letras, acostado, bajo la vista.
export function createVerseSheet({ message, under, keeps, onOpen = () => {}, onClose = () => {} }) {
  let book = null; // { n, name }
  let typed = '';
  let ready = null; // el pasaje, si se encontró en esta versión
  let choosing = false; // escogiendo el libro
  let token = 0;

  const title = h('b', {});
  const preview = h('small', {});
  const version = h('small', { class: 'ev-sheet-version' });
  const cursor = h('i', {});
  const shown = h('span', { class: 'ev-sheet-typed' });
  const books = h('div', { class: 'ev-sheet-books' });
  const all = h('div', { class: 'ev-sheet-all', hidden: true });
  const key = (k) => h('button', { class: 'ev-key', onclick: () => press(k) }, k);
  const keys = h('div', { class: 'ev-keys' }, ...KEYS.map(key));
  const putLabel = h('span', {});
  const put = h('button', { class: 'ev-sheet-put', disabled: true, onclick: guard(async () => {
    if (!ready) return;
    await action('projection.over', { data: ready });
    close();
  }) }, icon('stack', 15), putLabel);
  // Los pasajes del mensaje: de pie, dentro de la hoja; acostado, bajo la vista (CSS enseña uno de los dos).
  const inside = h('div', { class: 'ev-sheet-msgs' });
  const shortcuts = h('div', { class: 'ev-sheet-msgs ev-sheet-under', hidden: true });
  const note = h('small', { class: 'ev-sheet-note', hidden: true });
  const el = h('section', { class: 'ev-sheet', role: 'dialog', 'aria-label': 'Poner un versículo encima', hidden: true },
    h('div', { class: 'ev-sheet-head' }, h('div', { class: 'ev-sheet-text' }, title, preview),
      h('button', { class: 'ev-sheet-close', 'aria-label': 'Cerrar', onclick: () => close() }, icon('x', 14))),
    inside,
    h('div', { class: 'ev-sheet-display' }, h('div', { class: 'ev-sheet-field' }, shown, cursor, version),
      h('button', { class: 'ev-sheet-erase', 'aria-label': 'Borrar', onclick: () => erase() }, icon('arrow-left', 15))),
    books, all, keys, put);

  function press(k) {
    if (k === ':' && (typed.includes(':') || !typed)) return;
    if (k === '–' && (typed.includes('–') || !/:\d/.test(typed))) return;
    if (/\d/.test(k) && typed.replace(/.*[:–]/, '').length >= 3) return;
    typed += k;
    paint();
  }
  function erase() {
    typed = typed.slice(0, -1);
    paint();
  }
  function pickBook(next) {
    book = next;
    typed = '';
    choosing = false;
    paint();
  }
  async function chooseOther() {
    choosing = true;
    paint();
    const list = await booksOf(versionNow().id);
    if (!choosing) return;
    all.replaceChildren(...list.map((b) => h('button', { class: 'ev-sheet-book', onclick: () => pickBook({ n: b.n, name: b.name }) }, b.name)));
  }

  function paintBooks() {
    const own = [];
    for (const m of message()) if (!own.some((b) => b.n === m.book)) own.push({ n: m.book, name: m.bookName });
    books.replaceChildren(...own.slice(0, 4).map((b) => h('button', { class: `ev-sheet-book${book?.n === b.n ? ' on' : ''}`, onclick: () => pickBook(b) }, b.name)),
      h('button', { class: `ev-sheet-book${choosing || (book && !own.some((b) => b.n === book.n)) ? ' on' : ''}`, onclick: () => chooseOther() }, 'Otro'));
    const shortcut = (m) => h('button', { class: 'ev-sheet-msg', onclick: () => {
      book = { n: m.book, name: m.bookName };
      typed = m.typed;
      choosing = false;
      paint();
    } }, m.title);
    const mine = message().slice(0, 2);
    inside.replaceChildren(...mine.map(shortcut));
    shortcuts.replaceChildren(...mine.map(shortcut));
  }

  function paint() {
    const v = versionNow();
    version.textContent = v?.abbr || v?.name || '';
    title.textContent = `Versículo encima${under() ? ` ${under()}` : ''}`;
    note.textContent = keeps();
    shown.textContent = book ? `${book.name} ${typed}`.trim() : 'Elige un libro';
    keys.hidden = choosing;
    all.hidden = !choosing;
    paintBooks();
    for (const k of keys.children) k.disabled = !book;
    const ask = book && parseTyped(typed);
    ready = null;
    put.disabled = true;
    putLabel.textContent = `Poner${book && typed ? ` ${book.name} ${typed}` : ' encima'}${under() && book && typed ? ' encima' : ''}`;
    preview.textContent = '';
    if (!ask || !v) return;
    const mine = ++token;
    chapterOf(v.id, book.n, ask.chapter).then((data) => {
      if (mine !== token) return;
      const found = data?.verses?.filter((x) => x.n >= ask.verseStart && x.n <= ask.verseEnd) || [];
      if (!found.length) {
        preview.textContent = `No está en ${v.abbr || v.name}`;
        return;
      }
      preview.textContent = `${ask.chapter}:${ask.verseStart} ${found[0].text}`;
      ready = { versionId: v.id, ref: { book: book.n, chapter: ask.chapter, verseStart: ask.verseStart, verseEnd: found[found.length - 1].n } };
      put.disabled = false;
    });
  }

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  function open() {
    el.hidden = false;
    shortcuts.hidden = false;
    note.hidden = false;
    paint();
    onOpen();
    document.addEventListener('keydown', onKey, true);
  }
  function close() {
    el.hidden = true;
    shortcuts.hidden = true;
    note.hidden = true;
    onClose();
    document.removeEventListener('keydown', onKey, true);
  }
  return { el, shortcuts, note, open, close, isOpen: () => !el.hidden };
}
