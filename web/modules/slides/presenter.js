import { action, state, subscribe } from '../../core/api.js';
import { h, guard } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createStage } from '../projection/stage.js';
import { createLiveControls } from '../projection/live.js';
import { describeLive, toggleMode } from '../projection/controls.js';
import { FULL_VIEW } from '../projection/view.js';
import { attachGestures } from '../projection/gestures.js';
import { DECK_ACCEPT, openDeckUpload } from './upload.js';
import { pageUrl, plural, thumbUrl } from './deck.js';

const wide = matchMedia('(min-width: 860px)');
const TABS = [['orden', 'Del orden'], ['biblioteca', 'Biblioteca'], ['subir', 'Subir']];

// Pantalla del presentador (función «Presentador de diapositivas»): una presentación cada vez, con
// la diapositiva al aire en grande, la siguiente y todas en rejilla. Sobre la grande, el dedo señala
// en la proyección (puntero), mueve y acerca el encuadre o, sin herramienta, pasa como en «Historias»
// (a la derecha avanza, a la izquierda vuelve). «Siguiente» no sale de la presentación.
// También una página web (módulo Páginas web): la grande y el puntero; «Anterior» y «Siguiente» le
// llegan como las flechas si es un archivo propio o va en su propia ventana.
function mount(el, ctx) {
  let deckId = null;
  let pageId = null;   // página web elegida, en vez de una presentación
  let orderId = null;  // elemento del orden del que se eligió, para proyectar desde él
  let awaited = null;  // recién subida que aún no llegó con el estado
  let touched = false; // la persona ya eligió (o volvió a la lista): no se sigue sola a lo que esté al aire
  let tab = null;      // pestaña elegida; mientras no se elija, «Del orden» si tiene presentaciones
  // En el escritorio se empieza señalando; en el celular, tocando para pasar («Señalar» se enciende aparte).
  let tool = wide.matches ? 'point' : null;
  const decks = () => state.slides?.decks || [];
  const deck = () => decks().find((d) => d.id === deckId && d.status === 'ready') || null;
  const pages = () => state.web?.pages || [];
  const page = () => pages().find((p) => p.id === pageId) || null;
  // La página elegida, si es lo que hay en pantalla (también en negro).
  const pageOnAir = () => {
    const item = state.projection?.item;
    return item?.kind === 'web' && item.id === pageId ? item : null;
  };
  // Número de la diapositiva de esta presentación que está en pantalla (también en negro); 0 si ninguna.
  const at = () => {
    const item = state.projection?.item;
    return item?.kind === 'slides' && item.id === deckId ? item.number : 0;
  };

  // ---- Elegir la presentación ----
  const picker = h('input', { type: 'file', accept: DECK_ACCEPT, hidden: true });
  picker.addEventListener('change', () => {
    // Mientras PowerPoint la convierte, se ve su avance en la biblioteca; al terminar, se abre sola.
    if (picker.files[0]) openDeckUpload(picker.files[0], { onDone: (id) => { tab = 'biblioteca'; choose(id); } });
    picker.value = '';
  });
  const tabs = h('div', { class: 'pr-tabs', role: 'tablist' }, ...TABS.map(([id, label]) =>
    h('button', { class: 'chip', role: 'tab', dataset: { tab: id }, onclick: () => { tab = id; render(); } }, label)));
  const list = h('div', { class: 'deck-list pr-list' });
  const chooser = h('div', { class: 'pr-choose' }, tabs, list);

  // ---- Presentar ----
  const back = h('button', { class: 'btn', onclick: () => choose(null) }, icon('caret-left', 16), 'Presentaciones');
  const title = h('span', { class: 'pr-title' });
  const live = h('div', { class: 'monitor pr-live' });
  const stage = createStage(live);
  const onAir = h('p', { class: 'pr-onair', hidden: true });
  const toolButtons = [['point', 'hand-pointing', 'Señalar'], ['move', 'arrows-out-cardinal', 'Mover']].map(([id, glyph, label]) =>
    h('button', { class: 'chip', dataset: { tool: id }, 'aria-pressed': 'false', onclick: () => { tool = tool === id ? null : id; paintTools(); } }, icon(glyph, 15), label));
  // Vuelve a la imagen entera; solo se puede pulsar con algo acercado o desplazado.
  const resetZoom = h('button', { class: 'chip', 'aria-label': 'Restablecer el zoom', title: 'Ver la diapositiva entera', onclick: guard(() => action('projection.control', { ...FULL_VIEW })) },
    icon('arrow-counter-clockwise', 15), 'Restablecer');
  const hint = h('small', { class: 'pr-hint' });
  const prev = h('button', { class: 'btn big', 'aria-label': 'Anterior', onclick: () => go(-1) }, icon('caret-left', 18));
  const next = h('button', { class: 'btn big primary grow', onclick: () => go(1) });
  const black = h('button', { class: 'btn big', title: 'Pantalla en negro', onclick: () => toggleMode('black') }, 'Negro');
  const nextLabel = h('span', {});
  const nextImg = h('img', { alt: '' });
  const nextEnd = h('span', { class: 'pr-end' }, 'Fin de la presentación');
  const nextView = h('button', { class: 'monitor pr-next', 'aria-label': 'Proyectar la siguiente', onclick: () => go(1) }, nextImg, nextEnd);
  const nextHead = h('div', { class: 'dock-label' }, 'Siguiente', nextLabel);
  // La anterior, del mismo tamaño, a la izquierda de la siguiente.
  const prevLabel = h('span', {});
  const prevImg = h('img', { alt: '' });
  const prevStart = h('span', { class: 'pr-start' }, 'Es la primera');
  const prevView = h('button', { class: 'monitor pr-prev', 'aria-label': 'Proyectar la anterior', onclick: () => go(-1) }, prevImg, prevStart);
  const around = h('div', { class: 'pr-around' },
    h('div', {}, h('div', { class: 'dock-label' }, 'Anterior', prevLabel), prevView),
    h('div', {}, nextHead, nextView));
  const controls = h('div', {});
  const grid = h('div', { class: 'slide-grid' });
  const gridBox = h('div', { class: 'pr-grid' }, grid);
  // La grande ocupa todo lo que deja la columna de la derecha (la siguiente, los mandos y todas), sin
  // nada encima: así se puede señalar en cualquier punto.
  const present = h('div', { class: 'pr-body' },
    h('div', { class: 'pr-main' },
      h('div', { class: 'pr-tools' }, ...toolButtons, resetZoom, hint),
      h('div', { class: 'pr-screen' }, live), onAir, around,
      h('div', { class: 'transport' }, prev, next, black)),
    h('div', { class: 'pr-side' }, controls, gridBox));

  el.replaceChildren(h('div', { class: 'ws-head' }, back, h('h1', {}, 'Presentador'), title), chooser, present, picker);
  el.classList.add('presenter');
  createLiveControls(controls);

  function choose(id, fromOrder = null, kind = 'slides') {
    touched = true;
    awaited = kind === 'slides' && id && !decks().some((d) => d.id === id) ? id : null;
    deckId = kind === 'slides' ? id : null;
    pageId = kind === 'web' ? id : null;
    orderId = fromOrder;
    render();
  }
  const fromOrder = () => orderId && (state.order?.items || []).some((i) => i.id === orderId);

  // Proyecta la diapositiva n: desde su elemento del orden, si se eligió de ahí y sigue en él.
  const project = guard(async (n) => {
    const d = deck();
    if (!d || n < 1 || n > d.pages) return;
    if (fromOrder()) await action('order.show', { id: orderId, step: n - 1 });
    else await action('projection.show', { kind: 'slides', data: { id: d.id }, step: n - 1 });
  });
  const showPage = guard(async () => {
    if (fromOrder()) await action('order.show', { id: orderId, step: 0 });
    else await action('projection.show', { kind: 'web', data: { id: pageId } });
  });
  const press = guard((key) => action('projection.control', { key }));
  const pageKeys = (item) => Boolean(item && (item.file || item.window));
  // Sin salir de la presentación: si no hay ninguna de ella en pantalla, «Siguiente» empieza por la primera.
  // Una página: si no está en pantalla, «Proyectar» la pone; si está, las flechas (si las admite).
  function go(delta) {
    if (!pageId) return project(at() ? at() + delta : 1);
    const item = pageOnAir();
    if (!item) return delta > 0 && showPage();
    return pageKeys(item) && press(delta > 0 ? 'ArrowRight' : 'ArrowLeft');
  }

  function paintTools() {
    toolButtons.forEach((b) => {
      b.classList.toggle('on', b.dataset.tool === tool);
      b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    });
    live.dataset.tool = tool || 'pass';
    paintReset();
    const what = pageId ? 'página' : 'diapositiva';
    hint.textContent = tool === 'point' ? `Toca la ${what} para señalar en la pantalla` : tool === 'move' ? 'Arrastra para mover; dos dedos para acercar' : `Toca la ${what}: a la derecha avanza, a la izquierda vuelve`;
  }

  function paintReset() {
    resetZoom.hidden = Boolean(pageId);
    resetZoom.disabled = !gestures.framed();
  }

  function renderList() {
    const listed = (i) => i.kind === 'slides' || i.kind === 'web';
    const view = tab || ((state.order?.items || []).some(listed) ? 'orden' : 'biblioteca');
    tabs.querySelectorAll('.chip').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === view);
      b.setAttribute('aria-selected', String(b.dataset.tab === view));
    });
    const row = (d, extra, onclick) => {
      const ready = d?.status === 'ready';
      return h('div', { class: `deck${ready ? '' : ' pending'}` },
        h('button', { class: 'deck-pick', disabled: !ready, onclick },
          h('span', { class: `deck-cover${ready ? '' : ' blank'}` }, ready ? h('img', { src: thumbUrl(d, 1), alt: '', loading: 'lazy' }) : icon('presentation-chart', 26)),
          h('span', { class: 'item-text' }, h('strong', {}, extra.title), h('small', {}, extra.facts))));
    };
    const pageRow = (pg, title, onclick) => h('div', { class: `deck${pg ? '' : ' pending'}` },
      h('button', { class: 'deck-pick', disabled: !pg, onclick },
        h('span', { class: 'deck-cover blank' }, icon('globe', 26)),
        h('span', { class: 'item-text' }, h('strong', {}, title), h('small', {}, pg ? `Página web · ${pg.subtitle}` : 'Ya no está en Páginas web'))));
    const findPage = (id) => pages().find((pg) => pg.id === id);
    const facts = (d) => (!d ? 'Ya no está en la biblioteca' : d.status === 'ready' ? plural(d.pages) : d.status === 'converting' ? 'Convirtiéndose…' : d.error || 'No se pudo convertir');
    const empty = (strong, text, ...more) => h('div', { class: 'empty' }, h('strong', {}, strong), text, ...more);
    if (view === 'orden') {
      const items = (state.order?.items || []).filter(listed);
      const find = (i) => decks().find((d) => d.id === i.data?.id);
      list.replaceChildren(...(items.length
        ? items.map((i) => (i.kind === 'web'
          ? pageRow(findPage(i.data?.id), i.title, () => choose(i.data.id, i.id, 'web'))
          : row(find(i), { title: i.title, facts: facts(find(i)) }, () => choose(i.data.id, i.id))))
        : [empty('No hay presentaciones en el orden del culto', 'Elige una de la biblioteca o súbela.')]));
    } else if (view === 'biblioteca') {
      list.replaceChildren(...(decks().length || pages().length
        ? [...decks().map((d) => row(d, { title: d.name, facts: facts(d) }, () => choose(d.id))),
          ...pages().map((pg) => pageRow(pg, pg.name, () => choose(pg.id, null, 'web')))]
        : [empty('Aún no hay presentaciones', 'Súbela desde «Subir».')]));
    } else {
      list.replaceChildren(empty('Subir una presentación', 'En PDF o, si el equipo principal tiene PowerPoint, tal cual. Al terminar se abre aquí.',
        h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: () => picker.click() }, icon('upload-simple', 16), 'Elegir archivo'))));
    }
  }

  function renderGrid(d, n) {
    const key = `${d.id}|${d.pages}`;
    if (grid.dataset.key !== key) {
      grid.dataset.key = key;
      // Miniaturas pequeñas siempre: un iPhone con decenas de imágenes grandes cierra la página.
      grid.replaceChildren(...Array.from({ length: d.pages }, (_, i) =>
        h('button', { class: 'slide-pick', dataset: { n: i + 1 }, 'aria-label': `Proyectar la diapositiva ${i + 1}`, onclick: () => project(i + 1) },
          h('span', { class: 'slide-thumb' }, h('img', { src: thumbUrl(d, i + 1), alt: '', loading: 'lazy' })),
          h('span', { class: 'slide-n' }, String(i + 1)))));
    }
    for (const button of grid.children) {
      const on = Number(button.dataset.n) === n;
      if (button.classList.contains('live') === on) continue;
      button.classList.toggle('live', on);
      button.querySelector('.badge')?.remove();
      if (on) {
        button.querySelector('.slide-thumb').append(h('span', { class: 'badge live' }, 'Al aire'));
        // En el celular la rejilla va debajo: desplazarla movería la página entera.
        if (wide.matches) button.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function render() {
    if (awaited && decks().some((d) => d.id === awaited)) awaited = null;
    // Al entrar sin elegir nada, se sigue la presentación que esté en pantalla.
    const item = state.projection?.item;
    if (!touched && !deckId && !pageId && (item?.kind === 'slides' || item?.kind === 'web')) {
      if (item.kind === 'slides') deckId = item.id;
      else pageId = item.id;
      orderId = item.source?.orderId || null;
    }
    const d = deck();
    const pg = page();
    el.dataset.view = d || pg ? 'present' : 'choose';
    back.hidden = !d && !pg;
    title.textContent = d ? d.name : pg ? pg.name : '';
    if (!d && !pg) {
      renderList();
      return;
    }
    const p = state.projection;
    const showing = p?.mode === 'live' && Boolean(p.item);
    live.classList.toggle('on-air', showing);
    black.classList.toggle('on', p?.mode === 'black');
    // Una página no tiene siguiente ni rejilla, ni encuadre que mover.
    toolButtons[1].hidden = Boolean(pg);
    if (pg && tool === 'move') tool = 'point';
    paintTools();
    for (const part of [around, gridBox]) part.hidden = Boolean(pg);
    if (pg) {
      const air = pageOnAir();
      onAir.hidden = Boolean(air) || !p?.item;
      if (!onAir.hidden) onAir.textContent = `En pantalla: ${describeLive(p).text || describeLive(p).label}. «Proyectar» pone esta página.`;
      prev.disabled = !pageKeys(air);
      next.disabled = Boolean(air) && !pageKeys(air);
      next.replaceChildren(air ? 'Siguiente' : 'Proyectar', icon('caret-right', 18));
      return;
    }
    const n = at();
    // Lo de otra cosa en pantalla se dice: la grande muestra siempre lo que se proyecta.
    onAir.hidden = Boolean(n) || !p?.item;
    if (!onAir.hidden) onAir.textContent = `En pantalla: ${describeLive(p).text || describeLive(p).label}. «Empezar» proyecta la primera diapositiva.`;
    prev.disabled = n <= 1;
    next.disabled = n >= d.pages;
    next.replaceChildren(n ? 'Siguiente' : 'Empezar', icon('caret-right', 18));
    const upcoming = n + 1 <= d.pages ? n + 1 : 0;
    nextLabel.textContent = upcoming ? `${upcoming} de ${d.pages}` : '';
    nextView.disabled = !upcoming;
    nextImg.hidden = !upcoming;
    nextEnd.hidden = Boolean(upcoming);
    if (upcoming && nextImg.getAttribute('src') !== thumbUrl(d, upcoming)) nextImg.src = thumbUrl(d, upcoming);
    const before = n > 1 ? n - 1 : 0;
    prevLabel.textContent = before ? `${before} de ${d.pages}` : '';
    prevView.disabled = !before;
    prevImg.hidden = !before;
    prevStart.hidden = Boolean(before);
    if (before && prevImg.getAttribute('src') !== thumbUrl(d, before)) prevImg.src = thumbUrl(d, before);
    renderGrid(d, n);
  }

  // ---- El dedo sobre la diapositiva grande ----
  // Señalar, Mover (projection/gestures.js) o, sin herramienta, tocar para pasar: a la derecha avanza, a la izquierda vuelve.
  const gestures = attachGestures(live, { stage, tool: () => tool, onTap: (side) => go(side) });

  subscribe('projection', (p) => {
    stage.render(p);
    render();
  });
  subscribe('live', (l) => { stage.setLive(l); paintReset(); });
  subscribe('pointer', (p) => stage.setPointer(p));
  subscribe('slides', render);
  subscribe('web', render);
  subscribe('order', () => { if (!deck() && !page()) render(); });
  paintTools();

  return {
    onShow: render,
    keys(e) {
      const mode = { b: 'black', c: 'clear' }[e.key.toLowerCase()];
      if (mode) { toggleMode(mode); return true; }
      if (!deck() && !page()) return false;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { go(1); return true; }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { go(-1); return true; }
      return false;
    },
  };
}

export default { id: 'presentador', name: 'Presentador', icon: 'presentation-chart', mount };
