import { action, api, state } from '../../core/api.js';
import { h, guard, marked, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';

// «Buscar en todo» (Ctrl K, fase 13 de docs/PLAN.md): versículos, himnos, medios, presentaciones y
// páginas en una sola lista. La Biblia (RV1960) y el himnario buscan en el servidor, con sus índices;
// lo demás ya está en el estado y se filtra aquí por el nombre.
// Un toque marca la fila (con su ▶ para proyectar y, si se puede editar, su + para añadir al orden); doble toque
// o Intro proyecta y cierra. La capa se cierra al tocar fuera y con Esc.
const PAUSE_MS = 150;
const LIMIT = 5;
const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Un resultado: { kind, data, step?, title, head?, subtitle?, text?, marks? }.
async function bible(q) {
  const versions = state.bible?.versions || [];
  // Se busca en la RV1960 y se proyecta en la versión elegida en la Biblia, como hace ella.
  const version = versions.find((v) => v.id === prefs.get('version')) || versions[0];
  if (!version) return [];
  const res = await api(`/api/bible/${version.id}/search?q=${encodeURIComponent(q)}&limit=${LIMIT}`);
  const hits = res.type === 'ref' ? [{ ref: res.ref, title: res.reference }]
    : res.levels.flatMap((l) => l.results).slice(0, LIMIT).map((r) => ({
      ref: { book: r.book, chapter: r.chapter, verseStart: r.verse, verseEnd: r.verse }, title: r.reference, text: r.text, marks: r.marks,
    }));
  return hits.map(({ ref, ...hit }) => ({ ...hit, kind: 'verses', data: { versionId: version.id, ref }, subtitle: version.abbr || version.name }));
}

async function hymns(q) {
  if (!state.hymns?.count) return [];
  const res = await api(`/api/hymns/search?q=${encodeURIComponent(q)}&limite=${LIMIT}`);
  const found = res.type === 'number' ? res.results : res.levels.flatMap((l) => l.results);
  return found.slice(0, LIMIT).map((r) => ({
    kind: 'song', data: { number: r.number, track: 'vocal' }, title: `${r.number} · ${r.title}`,
    // Lo hallado en el título se marca en él; lo hallado en la letra, en su trozo.
    head: r.label == null ? [`${r.number} · `, ...marked(r.title, r.marks)] : null,
    subtitle: r.label ? `Himnario · ${r.label}` : 'Himnario', text: r.text, marks: r.marks,
  }));
}

const byName = (q, list) => {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return list.filter((r) => words.every((w) => fold(r.title).includes(w))).slice(0, LIMIT);
};
async function videos(q) {
  const m = state.media || {};
  return byName(q, [...(m.videos || []), ...(m.youtube || [])].map((x) => ({ kind: x.kind, data: { id: x.id }, title: x.name })));
}
async function media(q) {
  const m = state.media || {};
  return byName(q, [
    ...(m.images || []).map((x) => ({ kind: 'image', data: { id: x.id, fit: x.fit }, title: x.name })),
    ...(m.audios || []).map((x) => ({ kind: 'audio', data: { id: x.id }, title: x.name })),
  ]);
}
async function slides(q) {
  return byName(q, (state.slides?.decks || []).filter((d) => d.status === 'ready')
    .map((d) => ({ kind: 'slides', data: { id: d.id }, step: 0, title: d.name, subtitle: `${d.pages} ${d.pages === 1 ? 'diapositiva' : 'diapositivas'}` })));
}
async function texts(q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return (state.texts?.list || []).filter((t) => words.every((w) => fold(`${t.text} ${t.author}`).includes(w))).slice(0, LIMIT)
    .map((t) => ({ kind: 'text', data: { id: t.id }, title: t.text.split('\n')[0].slice(0, 60), subtitle: t.style === 'quote' ? (t.author || 'Cita') : 'Texto' }));
}
async function pages(q) {
  return byName(q, (state.web?.pages || []).map((p) => ({ kind: 'web', data: { id: p.id }, title: p.name, subtitle: p.subtitle })));
}
// La hora y los relojes, con su aspecto de siempre (server/modules/time/clock.js).
async function clocks(q) {
  return byName(q, [{ kind: 'clock', data: { type: 'hora' }, title: 'Hora', subtitle: 'Reloj' },
    ...(state.time?.timers || []).map((t) => ({ kind: 'clock', data: { id: t.id }, title: t.title, subtitle: t.type === 'timer' ? 'Temporizador' : 'Cronómetro' }))]);
}
const SOURCES = [['Biblia', bible], ['Himnario', hymns], ['Videos', videos], ['Medios', media], ['Diapositivas', slides], ['Textos', texts], ['Tiempo', clocks], ['Páginas web', pages]];
// Los grupos principales: con sitio (860 px o más), en columnas, uno al lado de otro; los demás, debajo, en filas.
const MAIN = ['Biblia', 'Himnario', 'Videos'];

// canEdit: ofrece Añadir al orden.
export function createSearch({ canEdit }) {
  let rows = [];     // [{ result, el }] en el orden en que se ven
  let active = -1;   // el señalado con las flechas: Intro lo proyecta
  let shown = null;  // la búsqueda cuyos resultados se ven
  let asked = 0;     // la última pedida: una respuesta vieja no pisa a una nueva
  let timer = null;
  let opener = null;

  // Para un lector de pantalla, el campo es un combobox: anuncia la fila señalada con las flechas (aria-activedescendant).
  const input = h('input', { type: 'search', placeholder: 'Una cita, un himno, un video…', 'aria-label': 'Buscar en todo', autocomplete: 'off', enterKeyHint: 'search', oninput: () => soon(),
    role: 'combobox', 'aria-controls': 'finder-list', 'aria-autocomplete': 'list', 'aria-expanded': 'false' });
  const list = h('div', { class: 'finder-list', id: 'finder-list', 'aria-label': 'Resultados' });
  const box = h('section', { class: 'finder glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Buscar en todo' },
    h('label', { class: 'finder-input' }, icon('magnifying-glass', 18), input, h('kbd', {}, 'Esc')),
    list,
    h('p', { class: 'finder-hint' }, 'Un toque marca · ▶, doble toque o Intro proyecta'));
  const layer = h('div', { class: 'finder-layer', hidden: true, onclick: (e) => { if (e.target === layer) close(); }, onkeydown: (e) => keys(e) }, box);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const button = h('button', { class: 'finder-chip glass', 'aria-label': 'Buscar en todo', 'aria-haspopup': 'dialog', title: `Buscar en todo (${mac ? '⌘' : 'Ctrl'} K)`, onclick: () => open() },
    icon('magnifying-glass', 18), h('span', {}, 'Buscar en todo'), h('kbd', {}, mac ? '⌘ K' : 'Ctrl K'));

  function open() {
    if (layer.hidden) {
      opener = document.activeElement;
      layer.hidden = false;
      document.body.classList.add('finding');
      if (shown === null) render('', null);
    }
    input.focus();
    input.select();
  }
  function close() {
    if (layer.hidden) return;
    layer.hidden = true;
    document.body.classList.remove('finding');
    opener?.focus?.();
  }

  function soon() {
    clearTimeout(timer);
    timer = setTimeout(run, PAUSE_MS);
  }
  async function run() {
    clearTimeout(timer);
    const q = input.value.trim();
    const mine = ++asked;
    if (q.length < 2 && !/^\d$/.test(q)) return render(q, null);
    const groups = await Promise.all(SOURCES.map(async ([label, find]) => ({ label, results: await find(q).catch(() => []) })));
    if (mine === asked) render(q, groups.filter((g) => g.results.length));
  }

  function render(q, groups) {
    shown = q;
    rows = [];
    active = -1;
    const main = (groups || []).filter((g) => MAIN.includes(g.label));
    box.classList.toggle('wide', main.length > 1);
    const found = Boolean(groups?.length);
    if (found) list.setAttribute('role', 'listbox'); else list.removeAttribute('role');
    input.setAttribute('aria-expanded', String(found));
    input.removeAttribute('aria-activedescendant');
    if (!groups) return list.replaceChildren(h('p', { class: 'finder-empty' }, 'Escribe una cita (jn 3 16), el número o unas palabras de un himno, o el nombre de una imagen, un video, una presentación o una página.'));
    if (!groups.length) return list.replaceChildren(h('p', { class: 'finder-empty' }, `Nada encontrado para «${q}».`));
    const section = (g) => [h('small', { class: 'finder-group', role: 'presentation' }, g.label), ...g.results.map(row)];
    list.replaceChildren(
      ...(main.length ? [h('div', { class: 'finder-main', role: 'presentation', style: `--cols: ${main.length}` }, ...main.map((g) => h('div', { class: 'finder-col', role: 'presentation' }, ...section(g))))] : []),
      ...groups.filter((g) => !MAIN.includes(g.label)).flatMap(section));
    mark(0);
  }
  function row(result) {
    const i = rows.length;
    const el = h('div', {
      class: 'finder-row', role: 'option', id: `finder-row-${i}`, 'aria-selected': 'false', title: result.title,
      onclick: () => mark(i), ondblclick: () => project(i),
    }, kindBadge(result.kind), h('span', { class: 'item-text' }, h('strong', {}, result.head || result.title),
      result.text ? h('small', {}, ...marked(result.text, result.marks)) : result.subtitle && h('small', {}, result.subtitle)),
    h('span', { class: 'finder-acts' },
      canEdit && h('button', { class: 'icon-btn sm', 'aria-label': `Añadir «${result.title}» al orden`, title: 'Añadir al orden del culto', tabindex: '-1', onclick: guard(async (e) => {
        e.stopPropagation();
        await action('order.add', { kind: result.kind, data: result.data });
        toast(`«${result.title}» añadido al orden del culto.`);
      }) }, icon('plus', 14)),
      h('button', { class: 'icon-btn sm', 'aria-label': `Proyectar «${result.title}»`, title: 'Proyectar (Intro)', tabindex: '-1', onclick: (e) => { e.stopPropagation(); project(i); } }, icon('play', 14))));
    rows.push({ result, el });
    return el;
  }
  function mark(i) {
    rows[active]?.el.classList.remove('on');
    rows[active]?.el.setAttribute('aria-selected', 'false');
    active = i;
    if (!rows[i]) return;
    rows[i].el.classList.add('on');
    rows[i].el.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', rows[i].el.id);
    rows[i].el.scrollIntoView({ block: 'nearest' });
  }
  const project = guard(async (i) => {
    const { result } = rows[i];
    close();
    await action('projection.show', { kind: result.kind, data: result.data, step: result.step ?? null });
  });
  // Intro antes de que lleguen los resultados de lo último escrito: se esperan, para no proyectar los de antes.
  async function enter() {
    if (input.value.trim() !== shown) await run();
    if (rows[active]) project(active);
  }

  // Dentro de la búsqueda, las letras y las flechas no gobiernan la proyección (atajos de shell.js).
  function keys(e) {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') mark(Math.max(0, Math.min(rows.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1))));
    else if (e.key === 'Enter') enter();
    else return;
    e.preventDefault();
  }

  return { button, layer, open, close, isOpen: () => !layer.hidden };
}
