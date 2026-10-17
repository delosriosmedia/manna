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

  const swap = guard((content) => action('projection.swap', content));
  const caret = () => icon('caret-down', 12);
  const versionLabel = h('span', {});
  const compareLabel = h('span', {});
  const versesLabel = h('span', {});
  const versionBtn = h('button', { class: 'btn bar-btn', 'aria-haspopup': 'menu', title: 'Versión de la Biblia', 'aria-label': 'Versión de la Biblia', onclick: () => versionMenu() }, versionLabel, caret());
  const compareBtn = h('button', { class: 'btn bar-btn', 'aria-haspopup': 'menu', onclick: () => compareMenu() }, icon('columns', 16), compareLabel, caret());
  const versesBtn = h('button', { class: 'btn bar-btn bar-verses', 'aria-haspopup': 'dialog', title: 'Otro versículo', 'aria-label': 'Otro versículo', onclick: () => (layer ? layer.close() : openVerses()) }, versesLabel, caret());
  const el = h('div', { class: 'bible-bar' }, versionBtn, compareBtn, versesBtn);

  // ---- Versión y comparar ----
  function versionMenu() {
    const { ids, ref } = airOf(item);
    menu(versionBtn, versions().map((v) => ({
      label: nameOf(v),
      note: v.id === ids[0] ? 'al aire' : null,
      // En una comparación cambia la primera versión; si la elegida ya era la otra, se intercambian.
      onclick: () => swap(contentOf(ids.length > 1 ? [v.id, v.id === ids[1] ? ids[0] : ids[1]] : [v.id], ref, layoutNow(item))),
    })));
  }

  function compareMenu() {
    const { ids, ref } = airOf(item);
    menu(compareBtn, [
      ...(ids.length > 1 ? [{ label: 'Una sola', icon: 'book-open-text', onclick: () => swap(contentOf([ids[0]], ref)) }, '-'] : []),
      ...versions().filter((v) => v.id !== ids[0]).map((v) => ({
        label: nameOf(v),
        note: v.id === ids[1] ? 'al aire' : null,
        onclick: () => swap(contentOf([ids[0], v.id], ref, layoutNow(item))),
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
    const versionId = airOf(item).ids[0];
    const title = h('b', { class: 'vp-title' });
    const grid = h('div', { class: 'vp-grid', role: 'group', 'aria-label': 'Versículos' });
    const nav = (delta) => guard(async () => {
      const flat = (await booksOf(versionId)).flatMap((b) => b.chapters.map((c) => [b.n, c]));
      const next = flat[flat.findIndex(([b, c]) => b === view.book && c === view.chapter) + delta];
      if (next) await load(...next);
    });
    const popup = h('div', { class: 'menu verse-pop', role: 'dialog', 'aria-label': 'Versículos del capítulo' },
      h('div', { class: 'vp-head' },
        h('button', { class: 'icon-btn sm', 'aria-label': 'Capítulo anterior', onclick: nav(-1) }, icon('caret-left', 16)),
        title,
        h('button', { class: 'icon-btn sm', 'aria-label': 'Capítulo siguiente', onclick: nav(1) }, icon('caret-right', 16))),
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
      Object.assign(view, { book, chapter });
      title.textContent = `${data.name} ${chapter}`;
      let held = false; // la pulsación larga ya amplió el tramo: el clic que la sigue no cuenta
      grid.replaceChildren(...data.verses.map((v) => {
        let timer = null;
        const cancel = () => clearTimeout(timer);
        return h('button', {
          class: 'vp-n', dataset: { n: v.n },
          onpointerdown: () => { held = false; timer = setTimeout(() => { held = true; showVerse(v.n, true); }, LONG_PRESS_MS); },
          onpointerup: cancel, onpointerleave: cancel, onpointercancel: cancel,
          oncontextmenu: (e) => e.preventDefault(),
          onclick: (e) => { if (!held) showVerse(v.n, e.shiftKey); },
        }, String(v.n));
      }));
      repaint();
      grid.querySelector('.live')?.scrollIntoView({ block: 'nearest' });
    }

    await load(item.ref.book, item.ref.chapter);
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
    const outside = (e) => { if (!popup.contains(e.target) && !versesBtn.contains(e.target)) close(); };
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
    setTimeout(() => {
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', onKey);
    });
  });

  return {
    el,
    update(next) {
      item = next;
      const { ids } = airOf(item);
      const can = versions().length > 1;
      versionLabel.textContent = abbrOf(ids[0]);
      compareLabel.textContent = ids.length > 1 ? abbrOf(ids[1]) : '';
      compareBtn.classList.toggle('on', ids.length > 1);
      compareBtn.disabled = !can;
      compareBtn.title = can ? 'El mismo pasaje en dos versiones' : 'Para comparar hacen falta dos biblias en «Contenido/Biblias»';
      compareBtn.setAttribute('aria-label', can ? 'Comparar con otra versión' : compareBtn.title);
      versesLabel.textContent = item.reference;
      layer?.repaint();
    },
    destroy: () => layer?.close(),
  };
}
