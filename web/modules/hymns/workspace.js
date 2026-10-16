import { action, api, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, marked, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatTime } from '../../core/playback.js';
import { prefs } from '../../core/prefs.js';
import { TRACKS, trackName } from './kind.js';
import { lyricsOf, openLyrics } from './lyrics.js';

const SEARCH_PAUSE_MS = 160; // al escribir, se busca cuando los dedos paran un instante
const VIEWS = [['grid', 'Todos', 'squares-four'], ['categories', 'Categorías', 'rows'], ['favorites', 'Favoritos', 'star']];

// Módulo Himnario: los himnos en video de la carpeta de la iglesia. Se llega a uno por su número,
// por su título o por un trozo de su letra; se elige si suena cantado o solo la pista, y se
// proyecta o se añade al orden del culto.
function mount(el, ctx) {
  let book = { version: -1, hymns: [], categories: [], report: null }; // lo que dice /api/hymns
  let selected = null;                                   // número del himno elegido
  let view = VIEWS.some(([id]) => id === prefs.get('himnario.vista')) ? prefs.get('himnario.vista') : 'grid';
  let track = prefs.get('himnario.sonido') === 'instrumental' ? 'instrumental' : 'vocal';
  let found = null;  // resultados de la búsqueda, o null si no se está buscando
  let rows = [];     // los himnos de los resultados, en el orden en que se ven
  let active = -1;   // resultado señalado con las flechas
  let drawn = '';    // qué hay dibujado en el cuerpo, para no rehacer 600 botones sin motivo
  const current = () => book.hymns.find((hymn) => hymn.number === selected) || null;
  const favorites = () => state.hymns?.favorites || [];
  const onAir = () => {
    const item = state.projection?.item;
    return state.projection?.mode === 'live' && item?.kind === 'song' ? item.number : null;
  };
  const hasFfmpeg = () => Boolean((state.tools?.list || []).find((t) => t.id === 'ffmpeg')?.found);
  // ¿Se puede usar la pista de este himno? Sin ffmpeg, no; y hay himnos que no la traen.
  const canPlayTrack = (hymn) => hasFfmpeg() && hymn?.instrumental !== false;
  const soundFor = (hymn) => (track === 'instrumental' && canPlayTrack(hymn) ? 'instrumental' : 'vocal');

  // ---- Cabecera: buscador, vistas y avisos ----
  const input = h('input', { type: 'search', placeholder: 'Número, título o letra', 'aria-label': 'Buscar un himno por número, título o letra', autocomplete: 'off', enterKeyHint: 'search' });
  const views = h('div', { class: 'hymn-views', role: 'tablist' }, ...VIEWS.map(([id, label, glyph]) =>
    h('button', { class: 'chip', role: 'tab', dataset: { view: id }, onclick: () => setView(id) }, icon(glyph, 14), label)));
  const notesCount = h('span', {});
  const notesButton = h('button', { class: 'btn hymn-notes', hidden: true, title: 'Lo que conviene revisar en la carpeta del himnario', onclick: () => showNotes() }, icon('warning-circle', 16), notesCount);
  const body = h('div', { class: 'hymns-body' });

  // ---- Barra de acciones ----
  const number = h('strong', { class: 'hymn-sel-n' });
  const name = h('span', { class: 'hint' });
  const sound = TRACKS.map(([id, label]) => h('button', { class: 'chip', dataset: { track: id }, onclick: () => setTrack(id) }, label));
  const lyricsButton = h('button', { class: 'btn hymn-lyrics-btn', onclick: () => showLyrics() }, icon('rows', 16), h('span', { class: 'hymn-long' }, 'Letra'));
  // Oírlo solo en este dispositivo antes de proyectarlo o añadirlo (no en el equipo principal: ctx.listen es null).
  const listenButton = ctx.listen && h('button', { class: 'btn hymn-listen', 'aria-label': 'Escuchar en este dispositivo', onclick: () => {
    const hymn = current();
    if (!hymn) return;
    const pista = soundFor(hymn) === 'instrumental' && hymn.instrumentalUrl;
    ctx.listen({ url: pista || hymn.url, title: `${hymn.number} · ${hymn.title}${pista ? ' (pista)' : ''}` });
  } }, icon('speaker-high', 16), h('span', { class: 'hymn-long' }, 'Escuchar'));
  // Favorito: lo comparten todos los dispositivos. Solo lo marca quien puede editar (Control y Alabanza).
  const favButton = ctx.canEdit && h('button', { class: 'chip hymn-fav-btn', onclick: guard(async () => {
    const hymn = current();
    if (hymn) await action('hymns.favorite', { number: hymn.number, on: !favorites().includes(hymn.number) });
  }) }, icon('star', 16), h('span', { class: 'hymn-long' }, 'Favorito'));
  const project = guard(async () => {
    const hymn = current();
    if (hymn) await action('projection.show', { kind: 'song', data: { number: hymn.number, track: soundFor(hymn) } });
  });
  const bar = h('div', { class: 'abar hymn-bar', hidden: true },
    h('span', { class: 'sel-ref' }, number), name,
    h('div', { class: 'hymn-sound', role: 'group', 'aria-label': 'Sonido' }, ...sound),
    lyricsButton, listenButton, favButton,
    h('button', { class: 'btn', onclick: guard(async () => {
      const hymn = current();
      await action('order.add', { kind: 'song', data: { number: hymn.number, track: soundFor(hymn) } });
      toast(`Himno ${hymn.number} añadido al orden del culto (${trackName(soundFor(hymn)).toLowerCase()}).`);
    }) }, icon('plus', 16), h('span', {}, 'Añadir', h('span', { class: 'hymn-long' }, ' al orden'))),
    h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵')));

  // ---- Ficha del elegido ----
  // Al lado de la rejilla, si el cajón deja sitio (hymns.css): número, título, categoría, duración y letra.
  // En un cajón estrecho no se ve, y la letra se abre con el botón «Letra» de la barra.
  const card = h('aside', { class: 'hymn-card', 'aria-label': 'Himno elegido' });
  let carded; // el número cuya ficha está dibujada
  const drawCard = guard(async (hymn) => {
    carded = hymn?.number ?? null;
    if (!hymn) return card.replaceChildren(h('p', { class: 'muted' }, 'Elige un himno para ver aquí su letra.'));
    const top = h('header', {}, h('strong', { class: 'hymn-card-n' }, String(hymn.number)),
      h('span', { class: 'item-text' }, h('strong', {}, hymn.title), h('small', {}, [book.categories[hymn.category], hymn.duration && formatTime(hymn.duration)].filter(Boolean).join(' · '))));
    if (!hymn.lyrics) return card.replaceChildren(top, h('p', { class: 'muted' }, 'Este himno no tiene letra en la carpeta del himnario.'));
    card.replaceChildren(top);
    const full = await api(`/api/hymns/${hymn.number}`);
    if (carded === hymn.number) card.replaceChildren(top, lyricsOf(full));
    return undefined;
  });

  el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Himnario'),
    h('label', { class: 'search' }, icon('magnifying-glass', 16), input), views, notesButton), h('div', { class: 'hymns-main' }, body, card), bar);

  // ---- Elegir ----
  function select(n, { reveal = false } = {}) {
    selected = n;
    paint();
    if (reveal) body.querySelector('.hymn.selected')?.scrollIntoView({ block: 'center' });
  }
  function setView(id) {
    view = id;
    prefs.set('himnario.vista', id);
    clearSearch();
    render();
    body.querySelector('.hymn.selected')?.scrollIntoView({ block: 'center' });
  }
  function setTrack(id) {
    track = id;
    prefs.set('himnario.sonido', id);
    paint();
  }

  // ---- Dibujo ----
  const tile = (hymn) => h('button', { class: 'hymn', dataset: { n: hymn.number }, title: hymn.title, onclick: () => select(hymn.number), ondblclick: () => { select(hymn.number); project(); } },
    h('span', { class: 'hymn-n' }, String(hymn.number)), h('span', { class: 'hymn-title' }, hymn.title));

  function drawLibrary() {
    if (!book.hymns.length) {
      return [h('div', { class: 'empty' }, h('strong', {}, state.hymns?.ready === false ? 'Leyendo el himnario…' : 'Aún no hay himnos'),
        'Copia los videos de los himnos a la carpeta Contenido/Himnario/videos del equipo principal, uno por himno y con su número delante: «001 Título.mp4». Aparecen aquí solos.')];
    }
    if (view === 'grid') return [h('div', { class: 'hymn-grid' }, ...book.hymns.map(tile))];
    if (view === 'favorites') {
      const chosen = book.hymns.filter((hymn) => favorites().includes(hymn.number));
      return chosen.length ? [h('div', { class: 'hymn-grid' }, ...chosen.map(tile))]
        : [h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay favoritos'), 'Elige un himno y toca «Favorito» en la barra de abajo: aquí quedan a mano los que más se cantan.')];
    }
    const groups = book.categories.map((title, at) => ({ title, hymns: book.hymns.filter((hymn) => hymn.category === at) }));
    const loose = book.hymns.filter((hymn) => hymn.category == null);
    if (loose.length) groups.push({ title: book.categories.length ? 'Sin categoría' : 'Todos los himnos', hymns: loose });
    // Todas plegadas: se abre la que se toca y se pliega la que estaba abierta.
    return groups.filter((group) => group.hymns.length).map((group) => {
      const grid = h('div', { class: 'hymn-grid', hidden: true }, ...group.hymns.map(tile));
      const head = h('button', { class: 'hymn-group-head', 'aria-expanded': 'false', onclick: () => {
        const open = head.getAttribute('aria-expanded') !== 'true';
        for (const other of body.querySelectorAll('.hymn-group-head[aria-expanded=true]')) {
          other.setAttribute('aria-expanded', 'false');
          other.nextElementSibling.hidden = true;
        }
        head.setAttribute('aria-expanded', String(open));
        grid.hidden = !open;
        if (open) head.scrollIntoView({ block: 'start' });
      } },
      h('h2', {}, group.title), h('small', {}, `${group.hymns[0].number}–${group.hymns.at(-1).number} · ${group.hymns.length} ${group.hymns.length === 1 ? 'himno' : 'himnos'}`), icon('caret-down', 18));
      return h('section', { class: 'hymn-group' }, head, grid);
    });
  }

  function drawResults() {
    rows = [];
    const hit = (result) => {
      rows.push(result.number);
      const titleHit = !result.label && result.marks.length;
      return h('button', { class: 'hymn hymn-hit', dataset: { n: result.number }, onclick: () => select(result.number), ondblclick: () => { select(result.number); project(); } },
        h('span', { class: 'hymn-n' }, String(result.number)),
        h('span', { class: 'hymn-hit-text' },
          h('span', { class: 'hymn-title' }, ...(titleHit ? marked(result.title, result.marks) : [result.title])),
          result.label && h('small', {}, h('b', {}, result.label), ' ', ...marked(result.text, result.marks))));
    };
    if (found.type === 'number') {
      return found.results.length ? [h('div', { class: 'hymn-hits' }, ...found.results.map(hit))]
        : [h('div', { class: 'empty' }, h('strong', {}, `No hay un himno ${input.value.trim()}`), `El himnario tiene ${book.hymns.length} himnos.`)];
    }
    if (!found.total) {
      return [h('div', { class: 'empty' }, h('strong', {}, 'Ningún himno coincide'),
        book.report?.withLyrics ? 'Prueba con otras palabras, con menos, o con el número del himno.' : 'No hay letras en la carpeta del himnario: solo se busca por número y por título.')];
    }
    return [h('div', { class: 'hymn-hits' }, ...found.levels.flatMap((level) => [
      h('div', { class: 'hymn-level' }, level.label, h('small', {}, String(level.total))),
      ...level.results.map(hit),
      level.total > level.results.length && h('p', { class: 'muted hymn-more' }, `Y ${level.total - level.results.length} más. Escribe algo más para afinar.`),
    ].filter(Boolean)))];
  }

  // Marca el elegido, el que está al aire y el señalado, sin rehacer los botones.
  function paint() {
    const air = onAir();
    for (const button of body.querySelectorAll('.hymn')) {
      const n = Number(button.dataset.n);
      const live = n === air;
      button.classList.toggle('selected', n === selected);
      button.classList.toggle('live', live);
      button.setAttribute('aria-pressed', n === selected);
      const fav = favorites().includes(n);
      if (fav !== Boolean(button.querySelector('.hymn-star'))) {
        if (fav) button.append(h('span', { class: 'hymn-star', 'aria-label': 'Favorito' }, icon('star', 12)));
        else button.querySelector('.hymn-star').remove();
      }
    }
    body.querySelectorAll('.hymn-hit').forEach((button, i) => button.classList.toggle('active', i === active));
    for (const chip of views.children) {
      chip.classList.toggle('on', !found && chip.dataset.view === view);
      chip.setAttribute('aria-selected', !found && chip.dataset.view === view);
    }

    const hymn = current();
    bar.hidden = !hymn;
    if (hymn) {
      number.textContent = String(hymn.number);
      name.textContent = [hymn.title, hymn.duration && formatTime(hymn.duration)].filter(Boolean).join(' · ');
      const usable = canPlayTrack(hymn);
      for (const chip of sound) {
        const id = chip.dataset.track;
        chip.classList.toggle('on', id === soundFor(hymn));
        chip.setAttribute('aria-pressed', id === soundFor(hymn));
        chip.disabled = id === 'instrumental' && !usable;
        chip.title = id !== 'instrumental' ? 'El himno con las voces' : usable ? 'Solo la música, para que cante la iglesia'
          : hasFfmpeg() ? 'Este himno no trae pista instrumental' : 'Para la pista hace falta ffmpeg en el equipo principal';
      }
      if (favButton) {
        const fav = favorites().includes(hymn.number);
        favButton.classList.toggle('on', fav);
        favButton.setAttribute('aria-pressed', fav);
        favButton.title = fav ? 'Quitar de favoritos' : 'Marcar como favorito: queda en la vista «Favoritos»';
      }
      lyricsButton.disabled = !hymn.lyrics;
      lyricsButton.title = hymn.lyrics ? 'Ver la letra de este himno' : 'No hay letra de este himno en la carpeta del himnario';
    }
    if ((hymn?.number ?? null) !== carded) drawCard(hymn);
    if (el.isConnected && !el.hidden) {
      ctx.setPreview(hymn ? { kind: 'song', number: hymn.number, title: hymn.title, track: soundFor(hymn), duration: hymn.duration } : null);
    }
  }

  function render() {
    if (selected && !current()) selected = null;
    const key = found ? `buscar|${input.value}|${found.total}` : `${view}|${book.version}${view === 'favorites' ? `|${favorites().join()}` : ''}`;
    if (key !== drawn) {
      drawn = key;
      body.replaceChildren(...(found ? drawResults() : drawLibrary()));
      body.scrollTop = 0;
    }
    const issues = ctx.canEdit ? book.report?.notes?.length || 0 : 0;
    notesButton.hidden = !issues;
    notesCount.textContent = issues === 1 ? '1 aviso' : `${issues} avisos`;
    paint();
  }

  // ---- Buscar ----
  let timer = null;
  let asked = 0; // para que una respuesta lenta no pise a otra más nueva
  function clearSearch() {
    clearTimeout(timer);
    asked += 1;
    input.value = '';
    found = null;
    active = -1;
  }
  const searchNow = guard(async () => {
    const text = input.value.trim();
    if (!text) { clearSearch(); render(); return; }
    const mine = (asked += 1);
    const result = await api(`/api/hymns/search?q=${encodeURIComponent(text)}`);
    if (mine !== asked) return;
    found = result;
    active = -1;
    render();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(searchNow, SEARCH_PAUSE_MS);
  });
  // En el buscador: ↑ ↓ recorren lo encontrado; Enter va al himno señalado (o al primero) y deja
  // el buscador, de modo que otro Enter lo proyecta. "25, Enter, Enter" proyecta el himno 25.
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      active = Math.max(0, Math.min(rows.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      paint();
      body.querySelector('.hymn-hit.active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      if (input.value.trim() && (!found || drawn !== `buscar|${input.value}|${found.total}`)) await searchNow();
      const target = rows[Math.max(0, active)];
      if (!found || target == null) return;
      clearSearch();
      input.blur();
      render();
      select(target, { reveal: true });
    } else if (e.key === 'Escape' && input.value) {
      e.stopPropagation();
      clearSearch();
      render();
    }
  });

  // ---- Ventanas ----
  const showLyrics = guard(async () => { if (current()) await openLyrics(current().number); });
  function showNotes() {
    const report = book.report || { notes: [] };
    const box = dialog('Para revisar en el himnario',
      h('p', { class: 'muted' }, `${report.total} himnos en video, ${report.withLyrics} con letra. Los videos están en Contenido/Himnario/videos y las letras en Contenido/Himnario/letras, en el equipo principal. Al corregir algo ahí, Manna lo vuelve a leer solo.`),
      h('ul', { class: 'hymn-notes-list' }, ...report.notes.map((note) => h('li', {}, note))),
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, h('button', { class: 'btn primary', onclick: () => box.close() }, 'Entendido')));
  }

  // ---- Estado ----
  let loading = false;
  let again = false; // cambió otra vez mientras se pedía: se vuelve a pedir al terminar
  const load = guard(async () => {
    if (loading) { again = true; return; }
    loading = true;
    try {
      book = await api('/api/hymns');
      if (found) clearSearch();
      render();
    } finally {
      loading = false;
      if (again) {
        again = false;
        load();
      }
    }
  });
  subscribe('hymns', (hymns) => { if (hymns.ready && hymns.version !== book.version) load(); else render(); });
  subscribe('projection', paint);
  subscribe('tools', paint);

  return {
    onShow: render,
    keys(e) {
      // Una cifra lleva al buscador: los himnos se piden casi siempre por su número.
      if (/^\d$/.test(e.key)) {
        input.focus();
        return false;
      }
      const hymn = current();
      if (!hymn) return false;
      if (e.key === 'Enter') { project(); return true; }
      // ↑ ↓ pasan al himno anterior o al siguiente sin tocar la proyección.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = found ? rows : book.hymns.map((entry) => entry.number);
        const at = list.indexOf(hymn.number) + (e.key === 'ArrowDown' ? 1 : -1);
        if (at < 0 || at >= list.length) return true;
        select(list[at]);
        body.querySelector('.hymn.selected')?.scrollIntoView({ block: 'nearest' });
        return true;
      }
      return false;
    },
  };
}

export default {
  id: 'himnario', name: 'Himnario', icon: 'music-notes', mount,
  needs: [{ tools: ['ffmpeg'], feature: 'usar la pista instrumental de los himnos (cantados sí funcionan)' }],
};
