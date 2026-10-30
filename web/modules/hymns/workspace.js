import { action, api, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, marked, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatTime } from '../../core/playback.js';
import { prefs } from '../../core/prefs.js';
import { TRACKS, trackName } from './kind.js';
import { lyricsOf, openLyrics } from './lyrics.js';

const SEARCH_PAUSE_MS = 160; // al escribir, se busca cuando los dedos paran un instante
const VIEWS = [['grid', 'Todos', 'squares-four'], ['categories', 'Categorías', 'rows'], ['favorites', 'Favoritos', 'star'], ['letras', 'Letras sin música', 'images']];

// Módulo Himnario: los himnos en video de la carpeta de la iglesia. Se llega a uno por su número,
// por su título o por un trozo de su letra; se elige si suena cantado o solo la pista, y se
// proyecta o se añade al orden del culto.
function mount(el, ctx) {
  let book = { version: -1, hymns: [], categories: [], report: null }; // lo que dice /api/hymns
  let selected = null;                                   // número del himno elegido
  let view = VIEWS.some(([id]) => id === prefs.get('himnario.vista')) ? prefs.get('himnario.vista') : 'grid';
  // Siempre «cantado» al empezar y al elegir otro himno: la pista solo cuando se elige para ese (pedido del dueño, 2026-10-29).
  let track = 'vocal';
  let found = null;  // resultados de la búsqueda, o null si no se está buscando
  let rows = [];     // los himnos de los resultados, en el orden en que se ven
  let active = -1;   // resultado señalado con las flechas
  let drawn = '';    // qué hay dibujado en el cuerpo, para no rehacer 600 botones sin motivo
  const current = () => book.hymns.find((hymn) => hymn.number === selected) || null;
  const favorites = () => state.hymns?.favorites || [];
  const onAir = () => {
    const item = state.projection?.item;
    return state.projection?.mode === 'live' && (item?.kind === 'song' || item?.kind === 'lyrics') ? item.number : null;
  };
  // «Letras sin música»: el himno se proyecta con sus diapositivas (tipo lyrics), sin sonido.
  const letras = () => view === 'letras';
  const slideUrl = (hymn, i) => `${hymn.slidesBase}${encodeURIComponent(hymn.slideFiles[i])}`;
  const hasFfmpeg = () => Boolean((state.tools?.list || []).find((t) => t.id === 'ffmpeg')?.found);
  // ¿Se puede usar la pista de este himno? Sin ffmpeg, no; y hay himnos que no la traen. Al preparar el culto en la nube
  // sí se elige (decisión 64): la nube no tiene ffmpeg, pero el equipo de la iglesia la sacará al proyectarlo.
  const canPlayTrack = (hymn) => (!ctx.canProject || hasFfmpeg()) && hymn?.instrumental !== false;
  const soundFor = (hymn) => (track === 'instrumental' && canPlayTrack(hymn) ? 'instrumental' : 'vocal');

  // ---- Cabecera: buscador, vistas y avisos ----
  const input = h('input', { type: 'search', placeholder: 'Número, título o letra', 'aria-label': 'Buscar un himno por número, título o letra', autocomplete: 'off', enterKeyHint: 'search' });
  const views = h('div', { class: 'hymn-views', role: 'tablist' }, ...VIEWS.map(([id, label, glyph]) =>
    h('button', { class: 'chip', role: 'tab', dataset: { view: id }, title: label, 'aria-label': label, onclick: () => setView(id) }, icon(glyph, 14), h('span', { class: 'lbl' }, label))));
  // Con el cajón estrecho, de los avisos queda solo el número (CSS).
  const notesNum = h('span', {});
  const notesWord = h('span', { class: 'lbl' });
  const notesCount = h('span', {}, notesNum, notesWord);
  const notesButton = h('button', { class: 'btn hymn-notes', hidden: true, title: 'Lo que conviene revisar en la carpeta del himnario', onclick: () => showNotes() }, icon('warning-circle', 16), notesCount);
  const body = h('div', { class: 'hymns-body' });

  // ---- Barra de acciones ----
  const number = h('strong', { class: 'hymn-sel-n' });
  const name = h('span', { class: 'hint' });
  const sound = TRACKS.map(([id, label]) => h('button', { class: 'chip', dataset: { track: id }, onclick: () => setTrack(id) }, label));
  const lyricsButton = h('button', { class: 'btn hymn-lyrics-btn', onclick: () => showLyrics() }, icon('rows', 16), h('span', { class: 'hymn-long' }, 'Letra'));
  // Oírlo solo en este dispositivo antes de proyectarlo o añadirlo (no en el equipo principal: ctx.listen es null).
  // Siempre cantado: es para reconocer el himno (decisión del dueño), sea cual sea el sonido elegido para proyectar.
  const listenButton = ctx.listen && h('button', { class: 'btn hymn-listen', 'aria-label': 'Escuchar en este dispositivo', onclick: () => {
    const hymn = current();
    if (hymn) ctx.listen({ url: hymn.url, title: `${hymn.number} · ${hymn.title}` });
  } }, icon('speaker-high', 16), h('span', { class: 'hymn-long' }, 'Escuchar'));
  // Favorito: lo comparten todos los dispositivos. Solo lo marca quien puede editar (Control y Alabanza).
  const favButton = ctx.can('hymns.favorite') && h('button', { class: 'chip hymn-fav-btn', onclick: guard(async () => {
    const hymn = current();
    if (hymn) await action('hymns.favorite', { number: hymn.number, on: !favorites().includes(hymn.number) });
  }) }, icon('star', 16), h('span', { class: 'hymn-long' }, 'Favorito'));
  const project = guard(async (step = 0) => {
    const hymn = current();
    if (!hymn || !ctx.canProject) return;
    if (letras()) await action('projection.show', { kind: 'lyrics', data: { number: hymn.number }, step });
    else await action('projection.show', { kind: 'song', data: { number: hymn.number, track: soundFor(hymn) } });
  });
  const add = guard(async () => {
    const hymn = current();
    if (!hymn) return;
    if (letras()) {
      await action('order.add', { kind: 'lyrics', data: { number: hymn.number } });
      toast(`Himno ${hymn.number} añadido al orden del culto (letra sin música).`);
      return;
    }
    await action('order.add', { kind: 'song', data: { number: hymn.number, track: soundFor(hymn) } });
    toast(`Himno ${hymn.number} añadido al orden del culto (${trackName(soundFor(hymn)).toLowerCase()}).`);
  });
  const bar = h('div', { class: 'abar hymn-bar', hidden: true },
    h('span', { class: 'sel-ref' }, number), name,
    h('div', { class: 'hymn-sound', role: 'group', 'aria-label': 'Sonido' }, ...sound),
    lyricsButton, listenButton, favButton,
    h('button', { class: `btn hymn-act${ctx.canProject ? '' : ' primary'}`, onclick: () => add() }, icon('plus', 16), h('span', {}, 'Añadir', h('span', { class: 'hymn-long' }, ' al orden'))),
    ctx.canProject && h('button', { class: 'btn primary hymn-act', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵')));

  // ---- Ficha del elegido ----
  // Al lado de la rejilla, si el cajón deja sitio (hymns.css): número, título, categoría, duración y letra.
  // En un cajón estrecho no se ve, y la letra se abre con el botón «Letra» de la barra.
  const card = h('aside', { class: 'hymn-card', 'aria-label': 'Himno elegido' });
  let carded; // el número cuya ficha está dibujada
  const drawCard = guard(async (hymn) => {
    carded = hymn ? `${hymn.number}${letras() ? ' letras' : ''}` : null;
    if (!hymn) return card.replaceChildren(h('p', { class: 'muted' }, letras() ? 'Elige un himno para ver aquí sus diapositivas.' : 'Elige un himno para ver aquí su letra.'));
    const top = h('header', {}, h('strong', { class: 'hymn-card-n' }, String(hymn.number)),
      h('span', { class: 'item-text' }, h('strong', {}, hymn.title), h('small', {}, [book.categories[hymn.category], hymn.duration && formatTime(hymn.duration)].filter(Boolean).join(' · '))));
    // En «Letras sin música», sus diapositivas: tocar una la proyecta desde ahí.
    if (letras()) {
      return card.replaceChildren(top, h('div', { class: 'hymn-slides' }, ...hymn.slideFiles.map((_, i) => h('button', { class: 'hymn-slide', dataset: { i }, title: i === 0 ? 'Portada' : `Diapositiva ${i + 1}`, onclick: () => project(i) },
        h('img', { src: slideUrl(hymn, i), alt: '', loading: 'lazy' }), h('small', {}, i === 0 ? 'Portada' : String(i + 1))))));
    }
    if (!hymn.lyrics) return card.replaceChildren(top, h('p', { class: 'muted' }, 'Este himno no tiene letra en la carpeta del himnario.'));
    card.replaceChildren(top);
    const full = await api(`/api/hymns/${hymn.number}`);
    if (carded === String(hymn.number)) card.replaceChildren(top, lyricsOf(full));
    return undefined;
  });

  el.replaceChildren(...[h('div', { class: 'ws-head' }, h('h1', {}, 'Himnario'),
    h('label', { class: 'search' }, icon('magnifying-glass', 16), input), views, notesButton),
    // En la nube (preparar el culto, sin proyección), la condición con la que está ahí el himnario (decisión 55).
    !ctx.canProject && h('p', { class: 'hymn-note' }, 'Himnario para uso y estudio personal, investigación y pruebas; no comercial.'),
    h('div', { class: 'hymns-main' }, body, card), bar].filter(Boolean));

  // ---- Elegir ----
  function select(n, { reveal = false } = {}) {
    if (n !== selected) track = 'vocal';
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
    paint();
  }

  // ---- Dibujo ----
  const tile = (hymn) => h('button', { class: 'hymn', dataset: { n: hymn.number }, title: hymn.title, onclick: () => select(hymn.number), ondblclick: () => { select(hymn.number); project(); } },
    h('span', { class: 'hymn-n' }, String(hymn.number)), h('span', { class: 'hymn-title' }, hymn.title));

  function drawLibrary() {
    if (!book.hymns.length) {
      // También mientras llega la lista: el servidor ya dice cuántos hay.
      const reading = state.hymns?.ready === false || (state.hymns?.count > 0 && book.version !== state.hymns.version);
      return [h('div', { class: 'empty' }, h('strong', {}, reading ? 'Leyendo el himnario…' : 'Aún no hay himnos'),
        !reading && 'Copia los videos de los himnos a la carpeta Contenido/Himnario/videos del equipo principal, uno por himno y con su número delante: «001 Título.mp4». Aparecen aquí solos.')];
    }
    if (view === 'grid') return [h('div', { class: 'hymn-grid' }, ...book.hymns.map(tile))];
    if (view === 'letras') {
      const withSlides = book.hymns.filter((hymn) => hymn.slides > 0);
      return withSlides.length ? [h('div', { class: 'hymn-grid' }, ...withSlides.map(tile))]
        : [h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay letras sin música'), 'Copia las diapositivas del himnario a la carpeta Contenido/Himnario/diapositivas del equipo principal: una carpeta por himno, con el nombre de su video («001 Título»), y dentro 01.jpg (la portada), 02.jpg… Aparecen aquí solas.')];
    }
    if (view === 'favorites') {
      const chosen = book.hymns.filter((hymn) => favorites().includes(hymn.number));
      return chosen.length ? [h('div', { class: 'hymn-grid' }, ...chosen.map(tile))]
        : [h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay favoritos'), 'Elige un himno y toca «Favorito» en la barra de abajo: aquí quedan a mano los que más se cantan.')];
    }
    // «Sección: Categoría» (el índice por temas del himnario): la sección encabeza sus categorías; una categoría sin
    // sección (El Espíritu Santo) va sola, con su nombre entero.
    const groups = book.categories.map((name, at) => {
      const cut = name.indexOf(': ');
      return { section: cut > 0 ? name.slice(0, cut) : null, title: cut > 0 ? name.slice(cut + 2) : name, hymns: book.hymns.filter((hymn) => hymn.category === at) };
    });
    const loose = book.hymns.filter((hymn) => hymn.category == null);
    if (loose.length) groups.push({ section: null, title: book.categories.length ? 'Sin categoría' : 'Todos los himnos', hymns: loose });
    // Todas plegadas: se abre la que se toca y se pliega la que estaba abierta.
    let lastSection = null;
    return groups.filter((group) => group.hymns.length).flatMap((group) => {
      const label = group.section && group.section !== lastSection ? h('h3', { class: 'hymn-section' }, group.section) : null;
      lastSection = group.section;
      return [label, drawGroup(group)].filter(Boolean);
    });
  }
  // Una categoría plegable: su nombre, sus números y cuántos son; al abrirla, sus himnos.
  function drawGroup(group) {
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
        if (fav) button.append(h('span', { class: 'hymn-star', role: 'img', 'aria-label': 'Favorito' }, icon('star', 12)));
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
        chip.title = id !== 'instrumental' ? 'El himno con las voces' : usable ? `Solo la música, para que cante la iglesia${ctx.canProject ? '' : ' (aquí se escucha cantado; la iglesia lo proyectará con la pista)'}`
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
    // En «Letras sin música» no hay sonido que elegir ni que escuchar.
    for (const part of [bar.querySelector('.hymn-sound'), lyricsButton, listenButton].filter(Boolean)) part.hidden = letras();
    // Un himno sin diapositivas (encontrado al buscar) no se proyecta como letra.
    for (const act of bar.querySelectorAll('.hymn-act')) {
      act.disabled = Boolean(hymn) && letras() && !hymn.slides;
      act.title = act.disabled ? 'Este himno no tiene diapositivas en la carpeta del himnario' : '';
    }
    if ((hymn ? `${hymn.number}${letras() ? ' letras' : ''}` : null) !== carded) drawCard(hymn);
  }

  function render() {
    if (selected && !current()) selected = null;
    const key = found ? `buscar|${input.value}|${found.total}` : `${view}|${book.version}${view === 'favorites' ? `|${favorites().join()}` : ''}`;
    if (key !== drawn) {
      drawn = key;
      body.replaceChildren(...(found ? drawResults() : drawLibrary()));
      body.scrollTop = 0;
    }
    const issues = ctx.can('order.edit') ? book.report?.notes?.length || 0 : 0;
    notesButton.hidden = !issues;
    notesNum.textContent = issues;
    notesWord.textContent = issues === 1 ? ' aviso' : ' avisos';
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
      if (e.key === 'Enter') { (ctx.canProject ? project : add)(); return true; }
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
