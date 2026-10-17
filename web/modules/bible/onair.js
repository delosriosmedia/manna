import { action, api, state } from '../../core/api.js';
import { guard, h, menu } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';

// Mandos de un pasaje al aire (tipos `verses` y `compare`): cambiar su versión, compararlo con otra o
// pasar a otro versículo sin ir a la Biblia. Son tres botones; el de los versículos abre una capa con los
// números del capítulo. Cambiar la versión o comparar no saca el pasaje del orden del culto
// (`projection.swap`); elegir otro versículo sí (`projection.show`, como desde la Biblia).
const LONG_PRESS_MS = 450;
const LAYOUTS = ['columns', 'rows'];

const versions = () => state.bible?.versions || [];
const nameOf = (v) => (v.abbr ? `${v.name} (${v.abbr})` : v.name);
const abbrOf = (id) => {
  const v = versions().find((x) => x.id === id);
  return v?.abbr || v?.name || '';
};

// Los capítulos de cada versión, pedidos una vez.
const booksCache = new Map();
async function booksOf(versionId) {
  if (!booksCache.has(versionId)) booksCache.set(versionId, (await api(`/api/bible/${versionId}/books`)).books);
  return booksCache.get(versionId);
}

// Todos los capítulos de la versión, en orden, como [libro, capítulo].
const chaptersCache = new Map();
async function chaptersOf(versionId) {
  if (!chaptersCache.has(versionId)) chaptersCache.set(versionId, (await booksOf(versionId)).flatMap((b) => b.chapters.map((c) => [b.n, c])));
  return chaptersCache.get(versionId);
}

// Lo que está al aire, entero aunque se vea un solo paso: las versiones, y el pasaje.
const airOf = (item) => {
  const data = item.source.data;
  return { ids: item.kind === 'compare' ? data.versions : [data.versionId], ref: data.ref };
};
const contentOf = (ids, ref, layout) => (ids.length > 1
  ? { kind: 'compare', data: { versions: ids, ref, layout } }
  : { kind: 'verses', data: { versionId: ids[0], ref } });

// La disposición de una comparación nueva: la de la pantalla Biblia, que este dispositivo recuerda.
const layoutNow = (item) => {
  const live = state.live?.uid === item.uid ? state.live.state?.layout : null;
  const saved = prefs.get('comparar.disposicion');
  return live || (LAYOUTS.includes(saved) ? saved : 'columns');
};

// Devuelve { el, update(item), destroy() }.
export function createBibleBar() {
  let item = null;
  let layer = null; // la capa de versículos abierta: { close(), repaint() }
  let opening = false; // la capa se está preparando (pide el capítulo): un segundo toque no abre otra
  let destroyed = false;

  const swap = guard((content) => action('projection.swap', content));
  const caret = () => icon('caret-down', 12);
  const versionLabel = h('span', {});
  const compareLabel = h('span', {});
  const versesLabel = h('span', {});
  const versionBtn = h('button', { class: 'btn bar-btn', 'aria-haspopup': 'menu', title: 'Versión de la Biblia', onclick: () => versionMenu() }, versionLabel, caret());
  const compareBtn = h('button', { class: 'btn bar-btn', 'aria-haspopup': 'menu', onclick: () => compareMenu() }, icon('columns', 16), compareLabel, caret());
  const versesBtn = h('button', { class: 'btn bar-btn bar-verses', 'aria-haspopup': 'dialog', title: 'Otro versículo', onclick: () => (layer ? layer.close() : !opening && openVerses()) }, versesLabel, caret());
  const el = h('div', { class: 'bible-bar' }, versionBtn, compareBtn, versesBtn);

  // ---- Versión y comparar ----
  // menu() quita de la pantalla cualquier capa abierta sin avisarle: se cierra antes, como es debido.
  function versionMenu() {
    layer?.close();
    const { ids, ref } = airOf(item);
    menu(versionBtn, versions().map((v) => ({
      label: nameOf(v),
      note: v.id === ids[0] ? 'al aire' : null,
      // En una comparación cambia la primera versión; si la elegida ya era la otra, se intercambian. La que ya está al aire no hace nada.
      onclick: () => v.id !== ids[0] && swap(contentOf(ids.length > 1 ? [v.id, v.id === ids[1] ? ids[0] : ids[1]] : [v.id], ref, layoutNow(item))),
    })));
  }

  function compareMenu() {
    layer?.close();
    const { ids, ref } = airOf(item);
    menu(compareBtn, [
      ...(ids.length > 1 ? [{ label: 'Una sola', icon: 'book-open-text', onclick: () => swap(contentOf([ids[0]], ref)) }, '-'] : []),
      ...versions().filter((v) => v.id !== ids[0]).map((v) => ({
        label: nameOf(v),
        note: v.id === ids[1] ? 'al aire' : null,
        onclick: () => v.id !== ids[1] && swap(contentOf([ids[0], v.id], ref, layoutNow(item))),
      })),
    ]);
  }

  // ---- Versículos ----
  const view = { book: 0, chapter: 0 }; // el capítulo que muestra la capa
  const showVerse = guard((n, extend) => {
    const { ids } = airOf(item);
    const shown = item.ref;
    const same = shown.book === view.book && shown.chapter === view.chapter;
    // Ampliar: el tramo que está al aire, hasta el versículo tocado.
    const [from, to] = extend && same ? [Math.min(shown.verseStart, n), Math.max(shown.verseEnd, n)] : [n, n];
    const { kind, data } = contentOf(ids, { book: view.book, chapter: view.chapter, verseStart: from, verseEnd: to }, layoutNow(item));
    return action('projection.show', { kind, data });
  });

  const openVerses = guard(async () => {
    opening = true;
    try { await openLayer(); } finally { opening = false; }
  });

  async function openLayer() {
    const versionId = airOf(item).ids[0];
    const title = h('b', { class: 'vp-title' });
    const grid = h('div', { class: 'vp-grid', role: 'group', 'aria-label': 'Versículos' });
    const nav = (delta) => guard(async () => {
      const flat = await chaptersOf(versionId);
      const next = flat[flat.findIndex(([b, c]) => b === view.book && c === view.chapter) + delta];
      if (next) await load(...next);
    });
    const prev = h('button', { class: 'icon-btn sm', 'aria-label': 'Capítulo anterior', onclick: nav(-1) }, icon('caret-left', 16));
    const following = h('button', { class: 'icon-btn sm', 'aria-label': 'Capítulo siguiente', onclick: nav(1) }, icon('caret-right', 16));
    const popup = h('div', { class: 'menu verse-pop', role: 'dialog', 'aria-label': 'Versículos del capítulo' },
      h('div', { class: 'vp-head' }, prev, title, following),
      grid,
      h('p', { class: 'vp-hint' }, 'Toca para proyectar. Mantén pulsado (o Mayús + clic) para ampliar el tramo.'));

    // Marca lo que está al aire sin rehacer la rejilla.
    function repaint() {
      const shown = item.ref;
      grid.querySelectorAll('button').forEach((b) => {
        const n = Number(b.dataset.n);
        const live = shown.book === view.book && shown.chapter === view.chapter && n >= shown.verseStart && n <= shown.verseEnd;
        b.classList.toggle('live', live);
        if (live) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }

    async function load(book, chapter) {
      const data = await api(`/api/bible/${versionId}/chapter/${book}/${chapter}`);
      const flat = await chaptersOf(versionId);
      const at = flat.findIndex(([b, c]) => b === book && c === chapter);
      Object.assign(view, { book, chapter });
      title.textContent = `${data.name} ${chapter}`;
      prev.disabled = at <= 0; // Génesis 1 no tiene anterior ni Apocalipsis 22, siguiente
      following.disabled = at >= flat.length - 1;
      let held = false; // la pulsación larga ya amplió el tramo: el clic que la sigue no cuenta
      grid.replaceChildren(...data.verses.map((v) => {
        let timer = null;
        const cancel = () => clearTimeout(timer);
        // Sin clic detrás (el dedo salió del número), la pulsación larga ya no cuenta.
        const abandon = () => { cancel(); held = false; };
        return h('button', {
          class: 'vp-n', dataset: { n: v.n },
          onpointerdown: () => { held = false; timer = setTimeout(() => { held = true; showVerse(v.n, true); }, LONG_PRESS_MS); },
          onpointerup: cancel, onpointerleave: abandon, onpointercancel: abandon,
          oncontextmenu: (e) => e.preventDefault(),
          // El clic que sigue a una pulsación larga se ignora, una sola vez: el siguiente (también con Intro) vale.
          onclick: (e) => { const long = held; held = false; if (!long) showVerse(v.n, e.shiftKey); },
        }, String(v.n));
      }));
      repaint();
      grid.querySelector('.live')?.scrollIntoView({ block: 'nearest' });
    }

    await load(item.ref.book, item.ref.chapter);
    if (destroyed) return; // los mandos se cambiaron mientras se pedía el capítulo
    document.body.append(popup);
    // Sobre el botón si está en la mitad de abajo de la pantalla (la barra de mandos), y si no, debajo.
    const a = versesBtn.getBoundingClientRect();
    const m = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(8, Math.min(a.left, innerWidth - m.width - 8))}px`;
    const above = a.top > innerHeight / 2;
    if (above) popup.style.bottom = `${innerHeight - a.top + 4}px`;
    else popup.style.top = `${a.bottom + 4}px`;
    // Con poca altura (el celular de lado), la rejilla se desplaza en vez de salirse de la pantalla.
    popup.style.maxHeight = `${Math.max(160, above ? a.top - 12 : innerHeight - a.bottom - 12)}px`;

    const onKey = (e) => { if (e.key === 'Escape') close(true); };
    // Tocar fuera cierra solo esta capa: el toque no sigue hacia lo que haya debajo (la hoja de mandos, el cajón),
    // salvo que sea un botón o un campo, que sí lo recibe.
    const swallow = (e) => e.stopPropagation();
    const outside = (e) => {
      if (popup.contains(e.target) || versesBtn.contains(e.target)) return;
      close();
      if (e.target.closest('button, a, input, select, summary, label')) return;
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 400);
    };
    function close(back = false) {
      popup.remove();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKey);
      layer = null;
      versesBtn.setAttribute('aria-expanded', 'false');
      if (back) versesBtn.focus();
    }
    layer = { close, repaint };
    versesBtn.setAttribute('aria-expanded', 'true');
    // Las flechas mueven el foco por la rejilla, como en menu(): ← → de uno en uno, ↑ ↓ de fila en fila.
    grid.addEventListener('keydown', (e) => {
      const cells = [...grid.children];
      const at = cells.indexOf(document.activeElement);
      const columns = cells.filter((c) => c.offsetTop === cells[0].offsetTop).length;
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + columns, ArrowUp: at - columns }[e.key];
      if (at < 0 || to === undefined) return;
      e.preventDefault();
      cells[Math.min(Math.max(to, 0), cells.length - 1)].focus();
    });
    (grid.querySelector('.live') || grid.firstElementChild)?.focus({ preventScroll: true });
    setTimeout(() => {
      if (layer?.close !== close) return; // se cerró antes de empezar a escuchar
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', onKey);
    });
  }

  return {
    el,
    update(next) {
      item = next;
      const { ids } = airOf(item);
      const can = versions().length > 1;
      versionLabel.textContent = abbrOf(ids[0]);
      versionBtn.setAttribute('aria-label', `Versión de la Biblia: ${abbrOf(ids[0])}`);
      compareLabel.textContent = ids.length > 1 ? abbrOf(ids[1]) : '';
      compareBtn.classList.toggle('on', ids.length > 1);
      compareBtn.disabled = !can;
      compareBtn.title = can ? 'El mismo pasaje en dos versiones' : 'Para comparar hacen falta dos biblias en «Contenido/Biblias»';
      compareBtn.setAttribute('aria-label', can ? `Comparar con otra versión${ids.length > 1 ? `: ${abbrOf(ids[1])}` : ''}` : compareBtn.title);
      versesLabel.textContent = item.reference;
      versesBtn.setAttribute('aria-label', `Otro versículo: ${item.reference}`);
      layer?.repaint();
    },
    destroy() {
      destroyed = true;
      layer?.close();
    },
  };
}
