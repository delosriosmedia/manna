import { action, api, state, subscribe } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';

const MAX_RECENT = 8;
const SEARCH_PAUSE_MS = 150; // al escribir, se busca cuando los dedos paran un instante
const SEARCH_LIMIT = 40;     // resultados por nivel; "ver más" lo amplía
const SEARCH_MAX = 400;
// Dónde se busca un texto. Se recuerda en este dispositivo.
const SCOPES = [['all', 'Toda la Biblia'], ['ot', 'Antiguo Testamento'], ['nt', 'Nuevo Testamento']];

// Un texto con lo encontrado resaltado. marks: tramos [inicio, fin) que da el servidor.
function highlighted(text, marks) {
  const out = [];
  let at = 0;
  for (const [start, end] of marks) {
    if (end <= at) continue;
    const from = Math.max(start, at);
    if (from > at) out.push(text.slice(at, from));
    out.push(h('mark', {}, text.slice(from, end)));
    at = end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

// Elegir un pasaje de la Biblia: buscador, recientes, libros, capítulos y versículos, con la
// selección y la barra para proyectarla o añadirla al orden. Lo usan las dos pantallas de este
// módulo, Biblia y Comparador; cada una decide qué se hace con el pasaje elegido.
//
// Los pasajes se identifican por posición (libro, capítulo, versículo), así que cambiar de
// versión mantiene el mismo pasaje.
//
// options:
//   title        título de la pantalla
//   controls     nodos de la cabecera, entre el título y el buscador (selectores de versión…)
//   second()     id de una segunda versión cuyo texto se muestra junto a cada versículo, o null
//   toItem(p)    qué se hace con el pasaje p = { versionId, ref, reference, verses, others }:
//                devuelve { kind, data, preview }. `others` son los versículos de second()
//   liveRef(it)  si lo que está al aire (it) es de esta pantalla y de sus versiones, su ref; si no, null
//   onVersion(id) la versión principal cambió
//
// Devuelve { api, versionId(), setVersion(id), refresh(), updatePreview(), empty(mensaje) }.
// `api` es lo que la pantalla devuelve a la estructura de la app ({ onShow, keys }).
export function mountPassages(el, ctx, { title, controls = [], second = () => null, toItem, liveRef, onVersion = () => {} }) {
  const view = { versionId: null, books: [], book: 1, chapter: 1, verses: [], others: new Map(), secondId: null, name: '', sel: null, live: null };

  // ---- Estructura ----
  const searchInput = h('input', {
    type: 'search', placeholder: 'Juan 3:16-18, sal 23, o unas palabras', autocomplete: 'off', 'aria-label': 'Buscar una cita o un texto',
    onkeydown: (e) => searchKey(e),
    oninput: () => searchSoon(),
    onfocus: () => { if (results.hidden && searchInput.value.trim().length >= 2) searchNow(); },
  });
  const results = h('div', { class: 'search-pop', hidden: true });
  const recents = h('div', { class: 'chips' });
  const crumbs = h('div', { class: 'crumbs' });
  const colBooks = h('div', { class: 'col col-books' });
  const colChapters = h('div', { class: 'col col-chapters' });
  const colVerses = h('div', { class: 'col col-verses' });
  // En celular solo cabe una columna: se avanza libro -> capítulo -> versículos.
  const picker = h('div', { class: 'picker', dataset: { step: 'versiculos' } }, colBooks, colChapters, colVerses);
  const selRef = h('strong', { class: 'sel-ref' });
  const selHint = h('span', { class: 'hint' });
  const bar = h('div', { class: 'abar' },
    h('button', { class: 'icon-btn sm', title: 'Quitar el último versículo de la selección', 'aria-label': 'Quitar un versículo', onclick: () => extend(-1) }, icon('minus', 16)),
    selRef,
    h('button', { class: 'icon-btn sm', title: 'Añadir el versículo siguiente a la selección', 'aria-label': 'Añadir un versículo', onclick: () => extend(1) }, icon('plus', 16)),
    selHint,
    ctx.canEdit && h('button', { class: 'btn', onclick: () => addToOrder() }, icon('plus', 15), 'Añadir al orden'),
    h('button', { class: 'btn primary', onclick: () => project() }, 'Proyectar', h('kbd', {}, '↵')));

  const head = h('div', { class: 'ws-head' }, h('h1', {}, title), ...controls,
    h('label', { class: 'search' }, icon('magnifying-glass', 16), searchInput, h('kbd', {}, '/')));
  el.replaceChildren(head, results, recents, crumbs, picker, bar);

  const currentBook = () => view.books.find((b) => b.n === view.book);
  const setStep = (step) => { picker.dataset.step = step; renderCrumbs(); };
  const abbrOf = (id) => state.bible?.versions.find((v) => v.id === id)?.abbr || state.bible?.versions.find((v) => v.id === id)?.name || '';

  // ---- Datos ----
  const setVersion = guard(async (id) => {
    const { books } = await api(`/api/bible/${id}/books`);
    view.versionId = id;
    view.books = books;
    onVersion(id);
    if (!currentBook()) view.book = books[0].n;
    await loadChapter(view.book, view.chapter, view.sel);
  });

  async function loadChapter(book, chapter, sel = null) {
    const b = view.books.find((x) => x.n === book) || view.books[0];
    const ch = b.chapters.includes(chapter) ? chapter : b.chapters[0];
    const secondId = second();
    const [data, other] = await Promise.all([
      api(`/api/bible/${view.versionId}/chapter/${b.n}/${ch}`),
      // La segunda versión puede no tener ese capítulo: entonces sus versículos faltan, sin más.
      secondId ? api(`/api/bible/${secondId}/chapter/${b.n}/${ch}`).catch(() => ({ verses: [] })) : null,
    ]);
    Object.assign(view, {
      book: b.n, chapter: ch, verses: data.verses, name: data.name, secondId,
      others: new Map((other?.verses || []).map((v) => [v.n, v.text])),
    });
    renderBooks();
    renderChapters();
    renderVerses();
    colVerses.scrollTop = 0;
    select(sel?.start ?? data.verses[0].n, sel?.end, 'center');
  }

  // Vuelve a cargar el capítulo que se ve (por ejemplo, al cambiar la segunda versión).
  const refresh = guard(async () => {
    if (view.versionId) await loadChapter(view.book, view.chapter, view.sel);
  });

  // ---- Dibujo ----
  function renderBooks() {
    const tiles = (list) => h('div', { class: 'grid g6' }, ...list.map((b) => h('button', {
      class: `tile${b.n === view.book ? ' on' : ''}`, title: b.name, 'aria-label': b.name,
      onclick: guard(async () => { await loadChapter(b.n, 1); setStep('capitulos'); }),
    }, b.abbr)));
    const at = view.books.filter((b) => b.n <= 39);
    const nt = view.books.filter((b) => b.n > 39);
    colBooks.replaceChildren(...[
      at.length && h('p', { class: 'col-label' }, 'Antiguo Testamento'), at.length && tiles(at),
      nt.length && h('p', { class: 'col-label' }, 'Nuevo Testamento'), nt.length && tiles(nt),
    ].filter(Boolean));
  }

  function renderChapters() {
    const chapters = currentBook()?.chapters || [];
    colChapters.replaceChildren(
      h('p', { class: 'col-label' }, h('b', {}, view.name), `${chapters.length} ${chapters.length === 1 ? 'capítulo' : 'capítulos'}`),
      h('div', { class: 'grid g5' }, ...chapters.map((c) => h('button', {
        class: `tile${c === view.chapter ? ' on' : ''}`,
        onclick: guard(async () => { await loadChapter(view.book, c); setStep('versiculos'); }),
      }, String(c)))));
  }

  function renderVerses() {
    const two = Boolean(view.secondId);
    colVerses.replaceChildren(...[
      h('p', { class: 'col-label' }, h('b', {}, `${view.name} ${view.chapter}`), `${view.verses.length} versículos`),
      // Con dos versiones, cada una en su columna, con su sigla arriba.
      two && h('div', { class: 'verse-heads' }, h('span', {}), h('b', {}, abbrOf(view.versionId)), h('b', {}, abbrOf(view.secondId))),
      ...view.verses.map((v) => h('div', {
        class: `verse${two ? ' two' : ''}`, dataset: { n: v.n },
        onclick: (e) => (e.shiftKey && view.sel ? select(view.sel.anchor, v.n) : select(v.n)),
        ondblclick: () => { select(v.n); project(); },
      }, h('span', { class: 'vn' }, String(v.n)), h('span', {}, v.text),
      two && (view.others.has(v.n) ? h('span', {}, view.others.get(v.n)) : h('span', { class: 'absent' }, 'No está en esta versión')))),
    ].filter(Boolean));
    renderCrumbs();
    paint();
  }

  function renderCrumbs() {
    const step = picker.dataset.step;
    crumbs.replaceChildren(...[
      h('button', { class: step === 'libros' ? 'on' : '', onclick: () => setStep('libros') }, 'Libros'),
      icon('caret-right', 12),
      h('button', { class: step === 'capitulos' ? 'on' : '', onclick: () => setStep('capitulos') }, view.name || 'Libro'),
      icon('caret-right', 12),
      h('button', { class: step === 'versiculos' ? 'on' : '', onclick: () => setStep('versiculos') }, `Capítulo ${view.chapter}`),
    ]);
  }

  // Marca lo seleccionado y lo que está al aire sin redibujar la lista.
  function paint() {
    const { sel, live } = view;
    const liveHere = live && live.book === view.book && live.chapter === view.chapter;
    colVerses.querySelectorAll('.verse').forEach((node) => {
      const n = Number(node.dataset.n);
      node.classList.toggle('sel', Boolean(sel) && n >= sel.start && n <= sel.end);
      node.classList.toggle('live', Boolean(liveHere) && n >= live.verseStart && n <= live.verseEnd);
    });
  }

  function renderRecents() {
    const list = prefs.get('recientes', []);
    recents.hidden = !list.length;
    recents.replaceChildren(icon('clock-counter-clockwise', 15), h('span', {}, 'Recientes'),
      ...list.map((r) => h('button', { class: 'chip', onclick: () => goTo(r.ref) }, r.reference)));
  }

  // ---- Selección ----
  // El pasaje elegido y lo que la pantalla quiere hacer con él ({ kind, data, preview }).
  function selection() {
    if (!view.sel) return null;
    const { start, end } = view.sel;
    const inRange = (n) => n >= start && n <= end;
    const passage = {
      versionId: view.versionId,
      ref: { book: view.book, chapter: view.chapter, verseStart: start, verseEnd: end },
      reference: `${view.name} ${view.chapter}:${start}${end > start ? `-${end}` : ''}`,
      verses: view.verses.filter((v) => inRange(v.n)),
      others: [...view.others].filter(([n]) => inRange(n)).map(([n, text]) => ({ n, text })),
    };
    return { passage, ...toItem(passage) };
  }

  const updatePreview = () => { if (view.sel) ctx.setPreview(selection().preview); };

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
      colVerses.querySelector(`.verse[data-n="${target}"]`)?.scrollIntoView({ block: reveal });
    }
    const s = selection();
    const count = s.passage.verses.length;
    selRef.textContent = s.passage.reference;
    selHint.textContent = count > 1 ? `${count} versículos seleccionados` : 'Mayús + clic para seleccionar varios';
    ctx.setPreview(s.preview);
  }

  // Amplía o reduce la selección por el final (en celular no hay Mayús + clic).
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
    // Si el capítulo ya está en pantalla, no se recarga.
    if (sel && ref.book === view.book && ref.chapter === view.chapter) select(sel.start, sel.end, 'nearest');
    else await loadChapter(ref.book, ref.chapter, sel);
    setStep('versiculos');
  });

  // ---- Acciones ----
  const project = guard(async () => {
    const s = selection();
    if (!s) return;
    await action('projection.show', { kind: s.kind, data: s.data });
    const { reference, ref } = s.passage;
    const list = prefs.get('recientes', []).filter((r) => r.reference !== reference);
    prefs.set('recientes', [{ reference, ref }, ...list].slice(0, MAX_RECENT));
    renderRecents();
  });

  const addToOrder = guard(async () => {
    const s = selection();
    if (!s) return;
    await action('order.add', { kind: s.kind, data: s.data });
    toast(`Añadido al orden: ${s.passage.reference}`);
  });

  // ---- Búsqueda ----
  // Se busca mientras se escribe. Una cita ("jn 3 16") ofrece ir al pasaje. Un texto se busca en
  // la Reina-Valera 1960 (o en la versión elegida, si no está instalada) y sale por niveles:
  // frase exacta, todas las palabras, parecidas. Al elegir un resultado se va a ese versículo
  // en la versión que esté elegida.
  const found = { timer: null, request: 0, rows: [], active: -1, limit: SEARCH_LIMIT };
  const scopeNow = () => (SCOPES.some(([id]) => id === prefs.get('buscar.en')) ? prefs.get('buscar.en') : 'all');

  function closeResults() {
    clearTimeout(found.timer);
    found.request += 1; // una respuesta que aún esté en camino ya no se muestra
    found.rows = [];
    found.active = -1;
    results.hidden = true;
  }

  function searchSoon() {
    clearTimeout(found.timer);
    if (searchInput.value.trim().length < 2) return closeResults();
    found.timer = setTimeout(searchNow, SEARCH_PAUSE_MS);
    return undefined;
  }

  // Busca lo que hay escrito. Devuelve la respuesta, o null si ya se pidió otra búsqueda después.
  async function searchNow(limit = SEARCH_LIMIT) {
    clearTimeout(found.timer);
    const q = searchInput.value.trim();
    if (q.length < 2 || !view.versionId) return null;
    found.request += 1;
    const mine = found.request;
    let res;
    try {
      res = await api(`/api/bible/${view.versionId}/search?q=${encodeURIComponent(q)}&limit=${limit}&en=${scopeNow()}`);
    } catch (err) {
      if (mine === found.request) toast(err.message, 'error');
      return null;
    }
    if (mine !== found.request) return null;
    found.limit = limit;
    renderResults(q, res);
    return res;
  }

  function setActive(index, reveal = true) {
    found.active = Math.max(-1, Math.min(index, found.rows.length - 1));
    found.rows.forEach((row, i) => row.el.classList.toggle('active', i === found.active));
    if (reveal) found.rows[found.active]?.el.scrollIntoView({ block: 'nearest' });
  }

  function searchKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.hidden || !found.rows.length) return;
      e.preventDefault();
      setActive(found.active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (found.active >= 0 && !results.hidden) found.rows[found.active].open();
      // Sin nada elegido: se busca ya. Una cita lleva directo al pasaje; con un texto queda
      // señalado el primer resultado, para ir a él con un segundo Enter.
      else {
        searchNow().then((res) => {
          if (res?.type === 'ref') found.rows[0].open();
          else if (res) setActive(0);
        });
      }
    } else if (e.key === 'Escape') {
      closeResults();
    }
  }

  function openResult(hit) {
    closeResults();
    searchInput.blur();
    goTo({ book: hit.book, chapter: hit.chapter, verseStart: hit.verse, verseEnd: hit.verse });
  }

  function renderResults(q, res) {
    const scroll = results.scrollTop;
    const close = h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar resultados', onclick: closeResults }, icon('x', 14));
    found.rows = [];
    results.hidden = false;
    // Justo bajo la cabecera, mida lo que mida (en pantallas estrechas ocupa varias filas).
    results.style.top = `${head.offsetHeight + 6}px`;

    if (res.type === 'ref') {
      const row = h('button', { class: 'search-item go', onclick: () => found.rows[0].open() },
        icon('caret-right', 14), h('span', {}, 'Ir a ', h('b', {}, res.reference)), h('kbd', {}, '↵'));
      found.rows.push({ el: row, open: () => { closeResults(); searchInput.value = ''; searchInput.blur(); goTo(res.ref); } });
      results.replaceChildren(h('div', { class: 'search-count' }, 'Cita', close), row);
      setActive(0, false);
      return;
    }

    const where = `en ${res.version.name}`;
    // Toda la Biblia, o solo un testamento. Al cambiarlo se vuelve a buscar lo mismo.
    const scopes = h('div', { class: 'search-scope', role: 'group', 'aria-label': 'Dónde buscar' }, ...SCOPES.map(([id, label]) => h('button', {
      class: `chip${id === res.scope ? ' on' : ''}`, dataset: { scope: id },
      onclick: () => { prefs.set('buscar.en', id); searchNow(); searchInput.focus(); },
    }, label)));
    if (!res.total) {
      results.replaceChildren(h('div', { class: 'search-count' }, `Sin resultados para "${q}" ${where}`, close), scopes);
      return;
    }
    const children = [h('div', { class: 'search-count' }, `${res.total} ${res.total === 1 ? 'resultado' : 'resultados'} ${where}`, close), scopes];
    for (const level of res.levels) {
      children.push(h('div', { class: 'search-level' }, h('span', {}, level.label), h('small', {}, String(level.total))));
      for (const hit of level.results) {
        const row = h('button', { class: 'search-item', dataset: { level: level.id }, onclick: () => openResult(hit) },
          h('strong', {}, hit.reference), h('span', {}, ...highlighted(hit.text, hit.marks)));
        found.rows.push({ el: row, open: () => openResult(hit) });
        children.push(row);
      }
      if (level.total > level.results.length && found.limit < SEARCH_MAX) {
        children.push(h('button', { class: 'search-more', onclick: () => searchNow(Math.min(found.limit * 4, SEARCH_MAX)) },
          `Ver más (${level.total - level.results.length} más)`));
      }
    }
    results.replaceChildren(...children);
    results.scrollTop = found.limit > SEARCH_LIMIT ? scroll : 0;
    setActive(-1, false);
  }

  // ---- Lo que está al aire ----
  subscribe('projection', ({ item, mode }) => {
    const live = mode === 'live' && item ? liveRef(item) : null;
    const previous = view.live;
    view.live = live;
    // Si la selección iba "montada" sobre lo que estaba al aire, sigue al nuevo versículo.
    const riding = previous && view.sel && previous.book === view.book && previous.chapter === view.chapter
      && previous.verseStart === view.sel.start && previous.verseEnd === view.sel.end;
    if (live && riding && (live.verseStart !== view.sel.start || live.chapter !== view.chapter || live.book !== view.book)) goTo(live);
    else paint();
  });

  renderRecents();

  return {
    versionId: () => view.versionId,
    setVersion,
    refresh,
    updatePreview,
    // Sin biblias (o sin las suficientes): un mensaje en el sitio de los versículos.
    empty(heading, text) {
      view.versionId = null;
      colVerses.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, heading), text));
    },
    api: {
      onShow() { updatePreview(); },
      keys(e) {
        if (e.key === 'Enter') project();
        else if (e.key === 'ArrowDown') move(1);
        else if (e.key === 'ArrowUp') move(-1);
        else if (e.key === '/') { searchInput.focus(); searchInput.select(); }
        else return false;
        return true;
      },
    },
  };
}
