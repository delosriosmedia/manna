import { action, api, state, subscribe } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';

const MAX_RECENT = 8;
const SEARCH_PAUSE_MS = 150; // al escribir, se busca cuando los dedos paran un instante
const SEARCH_LIMIT = 40;     // resultados por nivel; "ver más" lo amplía
const SEARCH_MAX = 400;

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

// Módulo Biblia: elegir un pasaje y proyectarlo o añadirlo al orden del culto.
// Los pasajes se identifican por posición (libro, capítulo, versículo), así que cambiar
// de versión mantiene el mismo pasaje.
function mount(el, ctx) {
  const view = { versionId: null, books: [], book: 1, chapter: 1, verses: [], name: '', sel: null, live: null };

  // ---- Estructura ----
  const versionSelect = h('select', { class: 'select', 'aria-label': 'Versión de la Biblia', onchange: () => setVersion(versionSelect.value) });
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

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Biblia'), versionSelect,
      h('label', { class: 'search' }, icon('magnifying-glass', 16), searchInput, h('kbd', {}, '/'))),
    results, recents, crumbs, picker, bar);

  const currentBook = () => view.books.find((b) => b.n === view.book);
  const setStep = (step) => { picker.dataset.step = step; renderCrumbs(); };

  // ---- Datos ----
  const setVersion = guard(async (id) => {
    const { books } = await api(`/api/bible/${id}/books`);
    view.versionId = id;
    view.books = books;
    versionSelect.value = id;
    prefs.set('version', id);
    if (!currentBook()) view.book = books[0].n;
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
    colVerses.scrollTop = 0;
    select(sel?.start ?? data.verses[0].n, sel?.end, 'center');
  }

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
    colVerses.replaceChildren(
      h('p', { class: 'col-label' }, h('b', {}, `${view.name} ${view.chapter}`), `${view.verses.length} versículos`),
      ...view.verses.map((v) => h('div', {
        class: 'verse', dataset: { n: v.n },
        onclick: (e) => (e.shiftKey && view.sel ? select(view.sel.anchor, v.n) : select(v.n)),
        ondblclick: () => { select(v.n); project(); },
      }, h('span', { class: 'vn' }, String(v.n)), h('span', {}, v.text))));
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
    const liveHere = live && live.versionId === view.versionId && live.ref.book === view.book && live.ref.chapter === view.chapter;
    colVerses.querySelectorAll('.verse').forEach((node) => {
      const n = Number(node.dataset.n);
      node.classList.toggle('sel', Boolean(sel) && n >= sel.start && n <= sel.end);
      node.classList.toggle('live', Boolean(liveHere) && n >= live.ref.verseStart && n <= live.ref.verseEnd);
    });
  }

  function renderRecents() {
    const list = prefs.get('recientes', []);
    recents.hidden = !list.length;
    recents.replaceChildren(icon('clock-counter-clockwise', 15), h('span', {}, 'Recientes'),
      ...list.map((r) => h('button', { class: 'chip', onclick: () => goTo(r.ref) }, r.reference)));
  }

  // ---- Selección ----
  function selection() {
    if (!view.sel) return null;
    const { start, end } = view.sel;
    return {
      kind: 'verses',
      versionId: view.versionId,
      ref: { book: view.book, chapter: view.chapter, verseStart: start, verseEnd: end },
      reference: `${view.name} ${view.chapter}:${start}${end > start ? `-${end}` : ''}`,
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
      colVerses.querySelector(`.verse[data-n="${target}"]`)?.scrollIntoView({ block: reveal });
    }
    const s = selection();
    const count = s.verses.length;
    selRef.textContent = s.reference;
    selHint.textContent = count > 1 ? `${count} versículos seleccionados` : 'Mayús + clic para seleccionar varios';
    ctx.setPreview(s);
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
    await action('projection.show', { kind: 'verses', data: { versionId: s.versionId, ref: s.ref } });
    const list = prefs.get('recientes', []).filter((r) => r.reference !== s.reference);
    prefs.set('recientes', [{ reference: s.reference, ref: s.ref }, ...list].slice(0, MAX_RECENT));
    renderRecents();
  });

  const addToOrder = guard(async () => {
    const s = selection();
    if (!s) return;
    await action('order.add', { kind: 'verses', data: { versionId: s.versionId, ref: s.ref } });
    toast(`Añadido al orden: ${s.reference}`);
  });

  // ---- Búsqueda ----
  // Se busca mientras se escribe. Una cita ("jn 3 16") ofrece ir al pasaje; un texto se busca en
  // todas las versiones y sale por niveles: frase exacta, todas las palabras, parecidas.
  const found = { timer: null, request: 0, rows: [], active: -1, limit: SEARCH_LIMIT };

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
      res = await api(`/api/bible/${view.versionId}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
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

  // Va al versículo de un resultado. Si el texto que coincidió es de otra versión, se pasa a ella:
  // lo que se va a proyectar es lo que se leyó en el resultado.
  const openResult = guard(async (hit) => {
    closeResults();
    searchInput.blur();
    if (hit.versionId !== view.versionId) {
      await setVersion(hit.versionId);
      toast(`Versión: ${state.bible?.versions.find((v) => v.id === hit.versionId)?.name || hit.version}`);
    }
    await goTo({ book: hit.book, chapter: hit.chapter, verseStart: hit.verse, verseEnd: hit.verse });
  });

  function renderResults(q, res) {
    const scroll = results.scrollTop;
    const close = h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar resultados', onclick: closeResults }, icon('x', 14));
    found.rows = [];
    results.hidden = false;

    if (res.type === 'ref') {
      const row = h('button', { class: 'search-item go', onclick: () => found.rows[0].open() },
        icon('caret-right', 14), h('span', {}, 'Ir a ', h('b', {}, res.reference)), h('kbd', {}, '↵'));
      found.rows.push({ el: row, open: () => { closeResults(); searchInput.value = ''; searchInput.blur(); goTo(res.ref); } });
      results.replaceChildren(h('div', { class: 'search-count' }, 'Cita', close), row);
      setActive(0, false);
      return;
    }

    // Mientras el equipo principal prepara las demás versiones, se busca en las que ya están.
    const scope = res.searched < res.versions ? `en ${res.searched} de ${res.versions} versiones (las demás se están preparando)`
      : res.versions > 1 ? `en ${res.versions} versiones` : '';
    if (!res.total) {
      results.replaceChildren(h('div', { class: 'search-count' }, `Sin resultados para "${q}" ${scope}`.trim(), close));
      return;
    }
    const children = [h('div', { class: 'search-count' }, `${res.total} ${res.total === 1 ? 'resultado' : 'resultados'} ${scope}`.trim(), close)];
    for (const level of res.levels) {
      children.push(h('div', { class: 'search-level' }, h('span', {}, level.label), h('small', {}, String(level.total))));
      for (const hit of level.results) {
        const elsewhere = hit.versionId !== view.versionId;
        const el = h('button', { class: 'search-item', dataset: { level: level.id }, onclick: () => openResult(hit) },
          h('strong', {}, hit.reference,
            elsewhere && h('em', { title: 'El texto que coincide es de esta versión' }, hit.version),
            hit.others.length > 0 && h('small', { title: `También en: ${hit.others.join(', ')}` }, `+${hit.others.length}`)),
          h('span', {}, ...highlighted(hit.text, hit.marks)));
        found.rows.push({ el, open: () => openResult(hit) });
        children.push(el);
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

  // ---- Estado compartido ----
  subscribe('bible', ({ versions }) => {
    versionSelect.replaceChildren(...versions.map((v) => h('option', { value: v.id }, v.abbr ? `${v.name} (${v.abbr})` : v.name)));
    if (!versions.length) {
      colVerses.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'No hay biblias instaladas'),
        'Copia archivos .xmm o .xml en la carpeta "Biblias" del equipo principal. Aparecerán aquí solos.'));
      return;
    }
    const keep = versions.find((v) => v.id === view.versionId) || versions.find((v) => v.id === prefs.get('version')) || versions[0];
    if (keep.id !== view.versionId) setVersion(keep.id);
    else versionSelect.value = keep.id;
  });

  subscribe('projection', ({ item, mode }) => {
    const live = mode === 'live' && item?.kind === 'verses' ? item : null;
    const previous = view.live;
    view.live = live;
    // Si la selección iba "montada" sobre lo que estaba al aire, sigue al nuevo versículo.
    const riding = previous && view.sel && previous.versionId === view.versionId && previous.ref.book === view.book
      && previous.ref.chapter === view.chapter && previous.ref.verseStart === view.sel.start && previous.ref.verseEnd === view.sel.end;
    if (live && riding && live.versionId === view.versionId && (live.ref.verseStart !== view.sel.start || live.ref.chapter !== view.chapter || live.ref.book !== view.book)) goTo(live.ref);
    else paint();
  });

  renderRecents();

  return {
    onShow() { if (view.sel) ctx.setPreview(selection()); },
    keys(e) {
      if (e.key === 'Enter') project();
      else if (e.key === 'ArrowDown') move(1);
      else if (e.key === 'ArrowUp') move(-1);
      else if (e.key === '/') { searchInput.focus(); searchInput.select(); }
      else return false;
      return true;
    },
  };
}

export default { id: 'biblia', name: 'Biblia', icon: 'book-open-text', mount };
