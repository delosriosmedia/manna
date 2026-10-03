import { api, state, subscribe } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';

const VERSION_KEY = 'manna.version';
const remember = {
  get: () => { try { return localStorage.getItem(VERSION_KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(VERSION_KEY, v); } catch { /* modo privado */ } },
};

// Navegador bíblico: versión, búsqueda, libros, capítulos y versículos.
// Los pasajes se identifican por posición (libro, capítulo, versículo), así que
// cambiar de versión mantiene el mismo pasaje en pantalla.
//   onSelect(seleccion | null)  cuando cambia lo seleccionado
//   onProject(seleccion)        con doble clic o Enter
export function createBibleBrowser({ navEl, versesEl, onSelect, onProject }) {
  const view = { versionId: null, books: [], book: 1, chapter: 1, verses: [], name: '', sel: null, testament: 'all', live: null };

  // ---- Estructura ----
  const versionSelect = h('select', { class: 'input', title: 'Versión de la Biblia', onchange: () => setVersion(versionSelect.value) });
  const searchInput = h('input', {
    class: 'input', type: 'search', placeholder: 'Juan 3:16-18, sal 23, o una palabra…', autocomplete: 'off',
    onkeydown: (e) => { if (e.key === 'Enter') search(searchInput.value.trim()); },
    oninput: () => { if (!searchInput.value) results.hidden = true; },
  });
  const results = h('div', { class: 'search-results', hidden: true });
  const tabs = h('div', { class: 'seg' }, ...[['all', 'Todos'], ['at', 'Antiguo T.'], ['nt', 'Nuevo T.']].map(([id, label]) =>
    h('button', { dataset: { t: id }, onclick: () => { view.testament = id; renderBooks(); } }, label)));
  const bookList = h('div', { class: 'book-list' });
  const chapterGrid = h('div', { class: 'chapter-grid' });
  navEl.replaceChildren(
    h('div', { class: 'nav-top' }, versionSelect, searchInput),
    results,
    tabs,
    h('div', { class: 'nav-cols' }, bookList, h('div', { class: 'chapter-col' }, h('div', { class: 'label' }, 'Capítulos'), chapterGrid)),
  );

  const title = h('h2', {});
  const list = h('div', { class: 'verse-list' });
  versesEl.replaceChildren(
    h('div', { class: 'verse-head' }, title, h('span', { class: 'muted hint-desktop' }, 'Clic: seleccionar · Mayús+clic: rango · Doble clic: proyectar')),
    list,
  );

  // ---- Datos ----
  const currentBook = () => view.books.find((b) => b.n === view.book);

  const setVersion = guard(async (id) => {
    const { books } = await api(`/api/bible/${id}/books`);
    view.versionId = id;
    view.books = books;
    versionSelect.value = id;
    remember.set(id);
    if (!currentBook()) view.book = books[0].n;
    renderBooks();
    await loadChapter(view.book, view.chapter, view.sel);
  });

  async function loadChapter(book, chapter, sel = null) {
    const b = view.books.find((x) => x.n === book) || view.books[0];
    const ch = b.chapters.includes(chapter) ? chapter : b.chapters[0];
    const data = await api(`/api/bible/${view.versionId}/chapter/${b.n}/${ch}`);
    Object.assign(view, { book: b.n, chapter: ch, verses: data.verses, name: data.name });
    renderBooks();
    renderChapters();
    renderVerses();
    list.scrollTop = 0;
    select(sel?.start ?? data.verses[0].n, sel?.end, 'center');
  }

  // ---- Dibujo ----
  function renderBooks() {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === view.testament));
    const visible = view.books.filter((b) => view.testament === 'all' || (view.testament === 'at' ? b.n <= 39 : b.n > 39));
    bookList.replaceChildren(...visible.map((b) => h('button', {
      class: b.n === view.book ? 'on' : '',
      onclick: guard(() => loadChapter(b.n, 1)),
    }, b.name)));
    bookList.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }

  function renderChapters() {
    chapterGrid.replaceChildren(...(currentBook()?.chapters || []).map((c) => h('button', {
      class: c === view.chapter ? 'on' : '',
      onclick: guard(() => loadChapter(view.book, c)),
    }, String(c))));
  }

  function renderVerses() {
    title.textContent = `${view.name} ${view.chapter}`;
    list.replaceChildren(...view.verses.map((v) => h('div', {
      class: 'verse', dataset: { n: v.n }, tabIndex: -1,
      onclick: (e) => (e.shiftKey && view.sel ? select(view.sel.anchor, v.n) : select(v.n)),
      ondblclick: () => { select(v.n); onProject(selection()); },
    }, h('span', { class: 'verse-n' }, String(v.n)), h('span', {}, v.text))));
    paint();
  }

  // Marca lo seleccionado y lo que está en vivo sin redibujar la lista.
  function paint() {
    const { sel, live } = view;
    const liveHere = live && live.versionId === view.versionId && live.ref.book === view.book && live.ref.chapter === view.chapter;
    list.querySelectorAll('.verse').forEach((el) => {
      const n = Number(el.dataset.n);
      el.classList.toggle('selected', Boolean(sel) && n >= sel.start && n <= sel.end);
      el.classList.toggle('live', Boolean(liveHere) && n >= live.ref.verseStart && n <= live.ref.verseEnd);
    });
  }

  // ---- Selección ----
  function selection() {
    if (!view.sel) return null;
    const { start, end } = view.sel;
    const range = end > start ? `-${end}` : '';
    return {
      versionId: view.versionId,
      ref: { book: view.book, chapter: view.chapter, verseStart: start, verseEnd: end },
      reference: `${view.name} ${view.chapter}:${start}${range}`,
      version: state.bible?.versions.find((v) => v.id === view.versionId)?.abbr || '',
      verses: view.verses.filter((v) => v.n >= start && v.n <= end),
    };
  }

  // reveal: cómo llevar la selección a la vista.
  //   'none'    no mover la lista. Es lo que usan los clics: si la lista se moviera, el segundo
  //             clic de un doble clic caería sobre otro versículo.
  //   'nearest' mover solo si no se ve (teclado, botones).
  //   'center'  centrar (al llegar desde una búsqueda o cambiar de capítulo).
  function select(a, b = a, reveal = 'none') {
    const first = view.verses[0]?.n;
    const last = view.verses.at(-1)?.n;
    if (first == null) return;
    const clamp = (n) => Math.min(Math.max(n, first), last);
    view.sel = { anchor: clamp(a), start: clamp(Math.min(a, b)), end: clamp(Math.max(a, b)) };
    paint();
    if (reveal !== 'none') {
      const target = reveal === 'nearest' && b > a ? view.sel.end : view.sel.start;
      list.querySelector(`.verse[data-n="${target}"]`)?.scrollIntoView({ block: reveal });
    }
    onSelect(selection());
  }

  // Amplía o reduce el rango por el final (útil en celular, donde no hay Mayús+clic).
  function extend(delta) {
    if (view.sel) select(view.sel.start, Math.max(view.sel.start, view.sel.end + delta), 'nearest');
  }

  // Mueve la selección un versículo, pasando de capítulo si hace falta.
  const move = guard(async (delta) => {
    if (!view.sel) return;
    const i = view.verses.findIndex((v) => v.n === (delta > 0 ? view.sel.end : view.sel.start)) + delta;
    if (view.verses[i]) return select(view.verses[i].n, undefined, 'nearest');
    const chapters = currentBook().chapters;
    const next = chapters[chapters.indexOf(view.chapter) + delta];
    if (next == null) return;
    await loadChapter(view.book, next);
    if (delta < 0) select(view.verses.at(-1).n, undefined, 'center');
  });

  const goTo = guard(async (ref) => {
    const sel = ref.verseStart ? { start: ref.verseStart, end: ref.verseEnd } : null;
    // Si el capítulo ya está en pantalla (p. ej. al avanzar con las flechas), no se recarga.
    if (sel && ref.book === view.book && ref.chapter === view.chapter) select(sel.start, sel.end, 'nearest');
    else await loadChapter(ref.book, ref.chapter, sel);
  });

  // ---- Búsqueda ----
  const search = guard(async (q) => {
    if (!q) return;
    const res = await api(`/api/bible/${view.versionId}/search?q=${encodeURIComponent(q)}`);
    if (res.type === 'ref') {
      results.hidden = true;
      searchInput.blur();
      await goTo(res.ref);
      return;
    }
    results.hidden = false;
    if (!res.total) {
      results.replaceChildren(h('div', { class: 'empty' }, `Sin resultados para "${q}".`));
      return;
    }
    results.replaceChildren(
      h('div', { class: 'search-count' },
        res.total > res.results.length ? `${res.total} resultados (se muestran ${res.results.length})` : `${res.total} resultados`,
        h('button', { class: 'icon-btn', onclick: () => { results.hidden = true; }, 'aria-label': 'Cerrar resultados' }, '×')),
      ...res.results.map((r) => h('button', {
        class: 'search-item',
        onclick: () => { results.hidden = true; goTo({ book: r.book, chapter: r.chapter, verseStart: r.verse, verseEnd: r.verse }); },
      }, h('strong', {}, r.reference), h('span', {}, r.text))),
    );
  });

  // ---- Versiones disponibles (llega por tiempo real; cambia si se copian biblias a la carpeta) ----
  subscribe('bible', ({ versions }) => {
    versionSelect.replaceChildren(...versions.map((v) => h('option', { value: v.id }, v.abbr ? `${v.name} (${v.abbr})` : v.name)));
    if (!versions.length) {
      list.replaceChildren(h('div', { class: 'empty' }, 'No hay biblias. Copia archivos .xmm o .xml en la carpeta "Biblias" del equipo principal.'));
      return;
    }
    const keep = versions.find((v) => v.id === view.versionId) || versions.find((v) => v.id === remember.get()) || versions[0];
    if (keep.id !== view.versionId) setVersion(keep.id);
    else versionSelect.value = keep.id;
  });

  return {
    selection,
    move,
    extend,
    goTo,
    get versionId() { return view.versionId; },
    setLive(item) { view.live = item; paint(); },
    focusSearch() { searchInput.focus(); toast('Escribe una cita o una palabra y pulsa Enter'); },
  };
}
