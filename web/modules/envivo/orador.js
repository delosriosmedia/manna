import { action, serverNow, state, subscribe } from '../../core/api.js';
import { guard, h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge, kindOf } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';
import { allPagesButton, framingButtons, goToStep, mando, pagesStrip } from '../projection/slot.js';
import { createVerseSheet, versionNow } from './versiculo.js';
import { createVerseList, messageItems, messageShortcuts, refOf, sheetWords } from './versiculos.js';

// Lo propio de los dos oradores en «En vivo» (fases 46 y 47). El completo, sus pestañas (tableros T5, T6, U3 y U7): Diapositivas,
// Versículos y Textos. El sencillo, su control de bolsillo (T7, T8, U4 y U8): Siguiente y Anterior enormes y lo justo. Los dos, la hoja
// «Versículo» y la hora del equipo principal.
const TABS = [['diapositivas', 'Diapositivas'], ['versiculos', 'Versículos'], ['textos', 'Textos']];
const isDeck = (item) => item?.kind === 'slides' || item?.kind === 'lyrics';
const nowOf = (item) => (item.kind === 'slides' ? item.number : item.index) - 1;
const pagesOf = (item) => kindOf(item.kind)?.pagesOf?.(item) || [];

export function createOrador(ctx, { variant, root, slot, slotApi, back }) {
  const sencillo = variant === 'sencillo';
  let deck = null;     // la última presentación al aire (sigue en su pestaña aunque salga otra cosa)
  let anchor = null;   // por dónde va en el orden
  let tab = prefs.get('orador.pestana', 'diapositivas');
  let marked = null;   // el texto marcado

  const sheet = createVerseSheet({
    message: () => messageShortcuts(anchor),
    ...sheetWords,
    onOpen: () => { root.dataset.sheet = 'true'; },
    onClose: () => { delete root.dataset.sheet; },
  });

  // Acostado, el dock sigue a la vista con la hoja abierta: tocarlo es irse de ella.
  root.addEventListener('click', (e) => { if (sheet.isOpen() && e.target.closest('.dockbar')) sheet.close(); }, true);

  // ---- La hora del equipo principal, sin segundos ----
  const clockText = h('span', {});
  const clock = h('div', { class: 'ev-clock glass' }, icon('clock', 13), clockText);
  const paintClock = () => {
    const d = new Date(serverNow());
    clockText.textContent = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  paintClock();
  setInterval(paintClock, 10_000);

  // ---- Lo que se pasa ----
  const allPages = allPagesButton({ now: (item) => nowOf(item), pages: pagesOf });
  const count = h('b', {});
  const countOf = h('span', {});
  const followsText = h('small', {});
  const leftText = h('span', { class: 'ev-oleft' });
  const followsShort = h('span', { class: 'ev-osigue' });
  const onAirName = h('b', { class: 'ev-otitle' });
  const followsPic = h('img', { alt: '' });
  const prevPic = h('img', { alt: '' });
  const info = h('div', { class: 'ev-oinfo' },
    h('span', { class: 'ev-opic ev-opic-prev' }, prevPic),
    h('div', { class: 'ev-ocount' }, h('span', { class: 'ev-onums' }, count, countOf), h('div', { class: 'ev-otext' }, onAirName, h('small', {}, leftText, followsShort))),
    h('div', { class: 'ev-ofollows' }, followsText, h('span', { class: 'ev-opic' }, followsPic)));
  function paintInfo(item) {
    const pages = isDeck(item) ? pagesOf(item) : [];
    const at = isDeck(item) ? nowOf(item) : -1;
    info.classList.toggle('empty', !pages.length);
    count.textContent = pages.length ? String(at + 1) : '';
    countOf.textContent = pages.length ? ` de ${pages.length}` : '';
    const remaining = pages.length - at - 1;
    leftText.textContent = !pages.length ? (item ? kindOf(item.kind)?.label ?? '' : 'Nada al aire') : remaining === 0 ? 'Es la última' : `Quedan ${remaining}`;
    onAirName.textContent = pages.length ? item.title : '';
    followsText.textContent = !pages.length ? '' : remaining === 0 ? 'Sigue el orden' : `Sigue la ${at + 2}`;
    followsShort.textContent = followsText.textContent.toLowerCase();
    const setPic = (img, page) => {
      img.parentElement.classList.toggle('ev-off', !page);
      if (page && img.getAttribute('src') !== page.thumb) img.src = page.thumb;
    };
    setPic(followsPic, pages[at + 1]);
    setPic(prevPic, pages[at - 1]);
  }

  // Volver: lo mismo que «Volver a…» de la lista, en un botón de la fila de herramientas del sencillo.
  const volver = sencillo && h('button', { class: 'ev-tool', disabled: true, onclick: () => back.click() }, icon('arrow-left', 15), h('span', {}, 'Volver'));
  const versiculo = sencillo && h('button', { class: 'ev-tool', onclick: () => sheet.open() }, icon('book-open-text', 15), h('span', { class: 'ev-tool-one' }, 'Versículo'), h('span', { class: 'ev-tool-other' }, 'Otro versículo'));
  const todas = sencillo && h('button', { class: 'ev-tool', onclick: () => allPages.el.click() }, icon('squares-four', 15), h('span', {}, 'Todas'));
  const tools = sencillo && h('div', { class: 'ev-tools' }, versiculo, volver, todas);
  // La tableta acostada del sencillo tiene sitio para los versículos del mensaje, a un toque.
  const chips = sencillo && h('div', { class: 'ev-omsg' });
  function paintChips() {
    const mine = messageItems(anchor).slice(0, 2);
    chips.hidden = !mine.length;
    chips.replaceChildren(h('span', { class: 'ev-omsg-label' }, 'Del mensaje, encima'), ...mine.map((i) => mando({ label: i.title, glyph: 'stack', onclick: guard(() => action('projection.over', { data: { versionId: versionNow()?.id, ref: refOf(i) } })) })));
  }

  // ---- El sencillo, bloqueado: nada se pasa por accidente ----
  let holdTimer = null;
  const unlock = h('button', { class: 'ev-unlock', onpointerdown: () => { holdTimer = setTimeout(() => setLocked(false), 900); }, onpointerup: () => clearTimeout(holdTimer), onpointercancel: () => clearTimeout(holdTimer), onpointerleave: () => clearTimeout(holdTimer), onclick: (e) => { if (e.detail === 0) setLocked(false); } }, 'Mantén para desbloquear');
  const lockScreen = sencillo && h('div', { class: 'ev-locked', hidden: true }, icon('lock-simple', 28), h('b', {}, 'Bloqueado'), h('small', {}, 'Nada se pasa por accidente, aunque el teléfono se quede encendido en el bolsillo o sobre la Biblia.'), unlock);
  const lock = sencillo && h('button', { class: 'ev-lock glass', 'aria-label': 'Bloquear', 'aria-pressed': 'false', onclick: () => setLocked(root.dataset.locked !== 'true') }, icon('lock-simple', 15));
  function setLocked(on) {
    root.dataset.locked = String(on);
    lockScreen.hidden = !on;
    lock.setAttribute('aria-pressed', String(on));
    lock.setAttribute('aria-label', on ? 'Bloqueado' : 'Bloquear');
  }

  if (sencillo) {
    return {
      topExtras: [clock, lock],
      nodes: [info, tools, chips, lockScreen, sheet.el, sheet.shortcuts, sheet.note],
      paint(p) {
        if (isDeck(p.item)) deck = p.item;
        if (p.item?.source?.orderId) anchor = p.item.source.orderId;
        paintInfo(p.item);
        paintChips();
        allPages.update(isDeck(p.item) ? p.item : deck);
        todas.disabled = !isDeck(p.item) && !deck;
        volver.disabled = back.hidden;
      },
      finished: (p) => p.item?.kind === 'slides' && p.item.number === p.item.pages && !p.over && !p.next?.animation,
    };
  }

  // ---- El completo: sus pestañas ----
  const tabs = TABS.map(([id, label]) => h('button', { class: 'ev-seg-btn', dataset: { tab: id }, onclick: () => { tab = id; prefs.set('orador.pestana', id); paintTabs(); paintPanes(); } }, label));
  const tabsRow = h('div', { class: 'ev-tabs' }, h('div', { class: 'ev-seg', role: 'tablist' }, ...tabs),
    slotApi.tool('point'), h('span', { class: 'ev-tabs-move' }, slotApi.tool('move')));
  function paintTabs() {
    root.dataset.tab = tab;
    for (const b of tabs) {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    }
  }

  // Diapositivas: acercar y mover, y todas en una rejilla. Con otra cosa al aire (un video), sus mandos en la misma ranura.
  const framing = framingButtons(slotApi);
  const paneTools = h('div', { class: 'ev-pane-tools' }, slotApi.tool('move'), framing.minus, framing.plus);
  const thumbs = h('div', { class: 'ev-thumbs' });
  const noDeck = h('div', { class: 'ev-vacio' }, h('b', {}, 'Sin presentación al aire'), h('small', {}, 'Elígela en Medios y aquí estarán sus diapositivas.'),
    ctx.has('medios') && mando({ label: 'Abrir Medios', glyph: 'image', onclick: () => ctx.go('medios') }));
  const paneSlides = h('div', { class: 'ev-pane', dataset: { pane: 'diapositivas' } }, paneTools, slot, thumbs, noDeck);
  function paintSlides(p) {
    const showing = isDeck(p.item) ? p.item : deck;
    paneTools.hidden = !isDeck(p.item);
    slot.hidden = !p.item || isDeck(p.item);
    noDeck.hidden = Boolean(showing) || Boolean(p.item); // con otra cosa al aire, sus mandos ocupan la pestaña
    thumbs.hidden = !showing;
    if (isDeck(p.item)) framing.update(state.live?.uid === p.item.uid ? state.live.state : null);
    if (!showing) return;
    const key = `${showing.kind}|${showing.id ?? showing.number}|${showing.pages}`;
    if (thumbs.dataset.key !== key) {
      thumbs.dataset.key = key;
      thumbs.replaceChildren(...pagesOf(showing).map((page, k) => h('button', { class: 'ev-thumb', dataset: { k }, 'aria-label': `Poner la diapositiva ${page.label}`, onclick: () => goToStep(deck, k) },
        h('span', {}, h('img', { src: page.thumb, alt: '', loading: 'lazy' })), h('small', {}, page.label))));
    }
    const at = isDeck(p.item) ? nowOf(p.item) : -1;
    for (const b of thumbs.children) {
      const k = Number(b.dataset.k);
      const on = k === at;
      b.classList.toggle('on', on);
      b.lastChild.textContent = `${k + 1}${on ? ' · al aire' : k === at + 1 && at >= 0 ? ' · sigue' : ''}`;
    }
    const current = thumbs.children[at];
    if (current && thumbs.dataset.at !== String(at)) {
      thumbs.dataset.at = String(at);
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  // Versículos: los del mensaje (versiculos.js).
  const verses = createVerseList({ anchor: () => anchor, onCite: () => sheet.open() });
  const sectionName = (text) => h('div', { class: 'ev-sec ev-osec' }, h('span', {}, text)); // sin pestañas (tableta acostada)
  const paneVerses = h('div', { class: 'ev-pane', dataset: { pane: 'versiculos' } }, verses.citeRow, sectionName('Versículos del mensaje'), verses.rows);

  // Textos: los que hay, sin escribirlos. Un toque marca; solo el marcado lleva ▶.
  const textRows = h('div', { class: 'ev-vrows' });
  const paneTexts = h('div', { class: 'ev-pane', dataset: { pane: 'textos' } }, sectionName('Textos del mensaje'), textRows);
  function paintTexts() {
    const list = (state.texts?.list || []).filter((t) => t.style !== 'fixed');
    if (!list.length) {
      textRows.replaceChildren(h('div', { class: 'ev-vacio' }, h('b', {}, 'No hay textos'), h('small', {}, 'Se escriben en Textos, desde Control total.')));
      return;
    }
    textRows.replaceChildren(...list.map((t) => {
      const parts = t.text.split(/\n\s*\n/).filter((x) => x.trim()).length;
      const first = t.text.trim().split('\n')[0];
      return h('div', { class: `ev-row${marked === t.id ? ' marked' : ''}` },
        h('button', { class: 'ev-row-main', title: first, onclick: () => { marked = t.id; paintTexts(); } }, kindBadge('text'),
          h('span', { class: 'ev-t' }, h('b', {}, t.style === 'quote' ? `«${first}»` : first), h('small', {}, parts > 1 ? `Texto · ${parts} partes` : 'Texto'))),
        h('button', { class: 'ev-play', 'aria-label': `Poner «${first}»`, onclick: guard(async () => {
          await action('projection.show', { kind: 'text', data: { id: t.id } });
          marked = null;
          paintTexts();
        }) }, icon('play', 12)));
    }));
  }

  function paintPanes() {
    const p = state.projection;
    if (!p) return;
    paintSlides(p);
    verses.paint();
    paintTexts();
  }
  paintTabs();
  subscribe('texts', () => paintTexts());
  subscribe('bible', () => verses.paint());

  // La tira de la tableta de pie, y lo que va bajo la vista acostado.
  const strip = h('div', { class: 'ev-pick-tools' }, slotApi.tool('point'), slotApi.tool('move'), allPages.el);
  const tira = pagesStrip({ count: 4, pages: pagesOf, now: nowOf });
  tira.el.classList.add('ev-otira');
  const panes = h('div', { class: 'ev-panes' }, paneSlides, paneVerses, paneTexts);
  const body = h('div', { class: 'ev-orador' }, tabsRow, panes, back);

  return {
    topExtras: [clock],
    nodes: [info, tira.el, strip, body, sheet.el, sheet.shortcuts, sheet.note],
    scroller: panes,
    live() { const item = state.projection?.item; if (isDeck(item)) framing.update(state.live?.uid === item.uid ? state.live.state : null); },
    paint(p) {
      if (isDeck(p.item)) deck = p.item;
      if (p.item?.source?.orderId) anchor = p.item.source.orderId;
      paintInfo(p.item);
      allPages.update(isDeck(p.item) ? p.item : deck);
      tira.el.hidden = !isDeck(p.item);
      if (isDeck(p.item)) tira.update(p.item);
      paintPanes();
    },
    finished: () => false,
  };
}
