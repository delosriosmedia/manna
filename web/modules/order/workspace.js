import { action, api, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge, kindOf, titleOf } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';
import { createStage } from '../projection/stage.js';
import { createLiveControls } from '../projection/live.js';

const MAX_SLIDES = 60;
const wide = matchMedia('(min-width: 1180px)');

// Línea secundaria de un elemento: tipo · detalle · cuántos pasos tiene.
// Si lleva un nombre propio, primero va el que le da su contenido ("Juan 3:16"), para no perderlo.
function describe(item) {
  const kind = kindOf(item.kind);
  const unit = kind?.unit && item.steps ? `${item.steps} ${kind.unit[item.steps === 1 ? 0 : 1]}` : '';
  return [item.original, kind?.label, item.subtitle, unit].filter(Boolean).join(' · ');
}

// Módulo Orden del culto: la lista de todo lo que se va a proyectar, en orden, venga del
// módulo que venga. A la izquierda, la lista; a la derecha, los pasos del elemento elegido.
// Con canEdit se puede añadir, reordenar y quitar; sin él (función "Control del orden"), solo proyectar.
function mount(el, ctx) {
  let items = [];
  let selectedId = null;
  let live = null;        // source de lo que está al aire: { orderId, step }
  let loaded = null;      // { key, steps, whole } del elemento seleccionado
  let collapsed = false;  // el usuario recogió el detalle a propósito: no se vuelve a abrir solo
  let opened = false;     // ya se mostró el orden por primera vez

  const list = h('div', { class: 'olist' });
  const detail = h('div', { class: 'odetail' });
  const side = h('div', { class: 'oside' });
  // Mandos del elemento que está al aire. Se crean una vez y se colocan en su detalle.
  const liveControls = h('div', {});
  createLiveControls(liveControls);
  const quick = h('input', {
    type: 'text', placeholder: 'Añadir una cita rápida: jn 3 16', autocomplete: 'off', 'aria-label': 'Añadir una cita al orden',
    onkeydown: (e) => { if (e.key === 'Enter') quickAdd(quick.value.trim()); },
  });

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Orden del culto'),
      ctx.canEdit && h('label', { class: 'search' }, icon('plus', 16), quick, h('kbd', {}, '↵')),
      !ctx.canEdit && h('span', { class: 'spacer' }),
      ctx.canEdit && h('button', { class: 'btn', onclick: (e) => openAddMenu(e.currentTarget) }, icon('plus', 15), 'Añadir'),
      ctx.canEdit && h('button', { class: 'icon-btn', 'aria-label': 'Más opciones', onclick: (e) => menu(e.currentTarget, [
        { label: 'Vaciar el orden', icon: 'trash', onclick: confirmClear },
      ]) }, icon('dots-three', 18))),
    h('div', { class: 'order-grid' }, list, side));

  const run = (type, payload) => guard(() => action(type, payload))();
  const show = (id, step) => run('order.show', step === undefined ? { id } : { id, step });
  const content = () => items.filter((i) => i.kind !== 'section');

  // ---- Añadir ----
  function openAddMenu(anchor) {
    menu(anchor, [
      { label: 'Pasaje bíblico', icon: 'book-open-text', onclick: () => ctx.go('biblia') },
      { label: 'Comparación de versiones', icon: 'columns', onclick: () => ctx.go('comparador') },
      { label: 'Imagen', icon: 'image', onclick: () => ctx.go('medios') },
      { label: 'Sección', icon: 'rows', onclick: () => askTitle({ title: 'Nueva sección', onSave: (title) => run('order.addSection', { title }) }) },
      '-',
      { label: 'Himno', icon: 'music-notes', note: 'Próximamente', disabled: true },
      { label: 'Video', icon: 'video', note: 'Próximamente', disabled: true },
      { label: 'Diapositivas', icon: 'presentation-chart', note: 'Próximamente', disabled: true },
    ]);
  }

  // Pide un nombre. allowEmpty: se puede guardar vacío (vuelve al nombre original).
  function askTitle({ title, value = '', maxLength = 60, placeholder = 'Apertura, Alabanza, Mensaje…', hint = null, allowEmpty = false, onSave }) {
    const input = h('input', { class: 'input', value, maxLength, placeholder, 'aria-label': 'Nombre' });
    const box = dialog(title, h('form', { onsubmit: (e) => { e.preventDefault(); if (allowEmpty || input.value.trim()) { onSave(input.value.trim()); box.close(); } } },
      h('div', { class: 'field' }, input),
      hint && h('p', { class: 'muted' }, hint),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', type: 'button', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary' }, 'Guardar'))));
    input.focus();
    input.select();
  }

  function confirmClear() {
    const box = dialog('Vaciar el orden',
      h('p', {}, 'Se quitarán todos los elementos y secciones. No afecta a lo que está en pantalla.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: () => { run('order.clear'); box.close(); } }, 'Vaciar')));
  }

  const quickAdd = guard(async (q) => {
    if (!q) return;
    const versionId = prefs.get('version') || state.bible?.versions[0]?.id;
    if (!versionId) return toast('No hay biblias instaladas.', 'error');
    const res = await api(`/api/bible/${versionId}/search?q=${encodeURIComponent(q)}`);
    if (res.type !== 'ref') return toast('No reconozco esa cita. Prueba con algo como "jn 3 16" o "salmo 23:1-4".', 'error');
    if (!res.ref.verseStart) return toast('Escribe también el versículo, por ejemplo "jn 3 16".', 'error');
    const item = await action('order.add', { kind: 'verses', data: { versionId, ref: res.ref } });
    quick.value = '';
    selectedId = item.id;
    toast(`Añadido: ${item.title}`);
  });

  // Cualquier elemento puede llevar un nombre propio; el de su contenido sigue a la vista debajo.
  function rename(item) {
    const save = (title) => run('order.rename', { id: item.id, title });
    if (item.kind === 'section') return askTitle({ title: 'Cambiar nombre', value: item.title, onSave: save });
    return askTitle({
      title: 'Cambiar nombre', value: item.title, maxLength: 120, placeholder: item.original || item.title, allowEmpty: true, onSave: save,
      hint: item.original ? `Déjalo vacío para volver a "${item.original}".` : 'Es el nombre que se verá en el orden del culto. No cambia lo que se proyecta.',
    });
  }

  // ---- Lista ----
  function rowMenu(anchor, item, index) {
    menu(anchor, [
      { label: 'Cambiar nombre', icon: 'pencil-simple', onclick: () => rename(item) },
      { label: 'Subir', icon: 'arrow-up', disabled: index === 0, onclick: () => run('order.move', { id: item.id, toIndex: index - 1 }) },
      { label: 'Bajar', icon: 'arrow-down', disabled: index === items.length - 1, onclick: () => run('order.move', { id: item.id, toIndex: index + 1 }) },
      '-',
      { label: 'Quitar del orden', icon: 'trash', onclick: () => run('order.remove', { id: item.id }) },
    ]);
  }

  function renderList() {
    if (!items.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, 'El orden del culto está vacío'),
        ctx.canEdit ? 'Añade pasajes desde la Biblia, o escribe una cita arriba y pulsa Enter.' : 'Se prepara desde un dispositivo con control completo.',
        ctx.canEdit && h('p', { style: 'margin-top: 14px;' }, h('button', { class: 'btn', onclick: () => ctx.go('biblia') }, icon('book-open-text', 16), 'Ir a la Biblia'))));
      side.hidden = true;
      return;
    }
    const liveIndex = items.findIndex((i) => i.id === live?.orderId);
    let n = 0;
    list.replaceChildren(...items.map((item, index) => {
      const more = ctx.canEdit && h('button', { class: 'icon-btn sm', 'aria-label': 'Opciones', onclick: (e) => { e.stopPropagation(); rowMenu(e.currentTarget, item, index); } }, icon('dots-three', 16));
      if (item.kind === 'section') {
        return h('div', { class: 'osection', dataset: { id: item.id }, draggable: ctx.canEdit }, h('span', {}, item.title), more);
      }
      n += 1;
      const isLive = index === liveIndex;
      return h('div', {
        class: `orow${isLive ? ' live' : ''}${liveIndex > index ? ' past' : ''}${item.id === selectedId ? ' selected' : ''}`,
        dataset: { id: item.id }, draggable: ctx.canEdit, title: item.title,
        'aria-expanded': String(item.id === selectedId),
        // Un clic despliega los pasos del elemento; otro clic sobre el mismo los recoge.
        onclick: () => (item.id === selectedId ? collapse() : select(item.id)),
        ondblclick: () => { if (item.id !== selectedId) select(item.id); show(item.id); },
      },
      ctx.canEdit && h('span', { class: 'grip', 'aria-hidden': 'true' }, icon('dots-six-vertical', 16)),
      h('span', { class: 'num' }, String(n)),
      kindBadge(item.kind),
      h('span', { class: 'item-text' }, h('strong', {}, item.title), h('small', {}, describe(item))),
      isLive
        ? h('span', { class: 'badge live' }, 'Al aire')
        : h('button', { class: 'icon-btn sm', 'aria-label': `Proyectar ${item.title}`, onclick: (e) => { e.stopPropagation(); show(item.id); } }, icon('play', 14)),
      more);
    }));
    placeDetail();
  }

  // ---- Detalle: los pasos del elemento seleccionado ----
  // En pantallas anchas va en su columna; en estrechas, justo debajo de la fila elegida.
  function placeDetail() {
    const row = list.querySelector('.orow.selected');
    side.hidden = !wide.matches;
    detail.classList.toggle('inline', !wide.matches);
    if (wide.matches) side.replaceChildren(detail);
    else if (row) row.after(detail);
    else detail.remove();
  }

  const markSelected = () => list.querySelectorAll('.orow').forEach((r) => {
    r.classList.toggle('selected', r.dataset.id === selectedId);
    r.setAttribute('aria-expanded', String(r.dataset.id === selectedId));
  });

  function collapse() {
    collapsed = true;
    selectedId = null;
    markSelected();
    placeDetail();
    renderDetail(null);
  }

  const select = guard(async (id, { reveal = false } = {}) => {
    collapsed = false;
    selectedId = id;
    markSelected();
    const item = items.find((i) => i.id === id);
    if (!item) return renderDetail(null);
    placeDetail();
    // reveal: true lleva la fila a la vista moviendo lo mínimo; 'center' la centra (al abrir).
    if (reveal) list.querySelector('.orow.selected')?.scrollIntoView({ block: reveal === true ? 'nearest' : reveal });
    const key = `${item.id}|${item.title}|${item.steps}`;
    if (loaded?.key !== key) {
      loaded = null;
      renderDetail(item);
      const res = await api(`/api/order/${id}/steps`);
      if (selectedId !== id) return;
      loaded = { key, ...res };
    }
    renderDetail(item);
  });

  function slide(caption, contentItem, isLive, onclick) {
    const monitor = h('div', { class: `monitor${isLive ? ' on-air' : ''}` });
    createStage(monitor).render({ mode: 'live', item: contentItem, styles: state.projection.styles });
    return h('button', { class: 'slide', onclick }, monitor,
      h('span', { class: 'slide-cap' }, h('span', {}, caption), isLive ? h('b', {}, 'Al aire') : null));
  }

  function renderDetail(item) {
    if (!item) {
      detail.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'Elige un elemento'), 'Aquí verás sus pasos: los versículos de un pasaje, las estrofas de un himno o las diapositivas de una presentación.'));
      return;
    }
    const head = h('div', { class: 'odetail-head' }, kindBadge(item.kind),
      h('div', { class: 'item-text' }, h('h2', {}, item.title), h('small', {}, describe(item))));
    // En celular la fila no lleva el botón de opciones (el ancho es para el título): van aquí.
    const index = items.indexOf(item);
    const tools = ctx.canEdit && h('div', { class: 'odetail-tools' },
      h('button', { class: 'btn', onclick: () => rename(item) }, icon('pencil-simple', 16), 'Nombre'),
      h('button', { class: 'btn', disabled: index === 0, onclick: () => run('order.move', { id: item.id, toIndex: index - 1 }) }, icon('arrow-up', 16), 'Subir'),
      h('button', { class: 'btn', disabled: index === items.length - 1, onclick: () => run('order.move', { id: item.id, toIndex: index + 1 }) }, icon('arrow-down', 16), 'Bajar'),
      h('button', { class: 'btn danger', onclick: () => run('order.remove', { id: item.id }) }, icon('trash', 16), 'Quitar'));
    if (!loaded) {
      detail.replaceChildren(head, h('div', { class: 'slides' }, ...Array.from({ length: Math.min(item.steps || 1, 4) }, () => h('div', { class: 'slide skeleton' }, h('div', { class: 'monitor' })))));
      if (tools) detail.append(tools);
      return;
    }
    const onAir = live?.orderId === item.id;
    // Un elemento de un solo paso se rotula con su tipo; los demás, con lo que muestra cada paso.
    const caption = (s, i) => (loaded.steps.length === 1 ? kindOf(item.kind)?.label : s.reference || titleOf(s)) || `Paso ${i + 1}`;
    const slides = loaded.steps.slice(0, MAX_SLIDES).map((s, i) =>
      slide(caption(s, i), s, onAir && live.step === i, () => show(item.id, i)));
    // Elementos cortos (un pasaje de pocos versículos): también se pueden mostrar enteros.
    if (loaded.whole && item.steps <= (kindOf(item.kind)?.wholeUpTo || 0)) {
      slides.unshift(slide('Todo junto', loaded.whole, onAir && live.step == null, () => show(item.id, null)));
    }
    detail.replaceChildren(...[head, onAir && liveControls, h('div', { class: 'slides' }, ...slides),
      loaded.steps.length > MAX_SLIDES && h('p', { class: 'muted', style: 'margin-top: 12px;' }, `Se muestran los primeros ${MAX_SLIDES} pasos. Usa "Siguiente" para recorrer el resto.`),
      !loaded.steps.length && h('p', { class: 'muted' }, 'Este elemento no tiene pasos que mostrar.'),
      tools,
    ].filter(Boolean));
  }

  // ---- Reordenar arrastrando ----
  if (ctx.canEdit) {
    let dragId = null;
    const clearMarks = () => list.querySelectorAll('.drop-before, .drop-after').forEach((r) => r.classList.remove('drop-before', 'drop-after'));
    const target = (e) => {
      const row = e.target.closest?.('.orow, .osection');
      if (!row || !list.contains(row)) return null;
      const box = row.getBoundingClientRect();
      return { row, after: e.clientY > box.top + box.height / 2 };
    };
    list.addEventListener('dragstart', (e) => {
      const row = e.target.closest?.('.orow, .osection');
      if (!row) return;
      dragId = row.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
      row.classList.add('dragging');
    });
    list.addEventListener('dragover', (e) => {
      const t = dragId && target(e);
      if (!t) return;
      e.preventDefault();
      clearMarks();
      t.row.classList.add(t.after ? 'drop-after' : 'drop-before');
    });
    list.addEventListener('drop', (e) => {
      const t = dragId && target(e);
      clearMarks();
      if (!t) return;
      e.preventDefault();
      const from = items.findIndex((i) => i.id === dragId);
      let to = items.findIndex((i) => i.id === t.row.dataset.id) + (t.after ? 1 : 0);
      if (from < to) to -= 1;
      if (to !== from) run('order.move', { id: dragId, toIndex: to });
    });
    list.addEventListener('dragend', () => {
      dragId = null;
      clearMarks();
      list.querySelector('.dragging')?.classList.remove('dragging');
    });
  }

  // ---- Estado compartido ----
  subscribe('order', (o) => {
    items = o.items;
    if (!items.some((i) => i.id === selectedId)) selectedId = null;
    renderList();
    const first = selectedId || (!collapsed && (live?.orderId || content()[0]?.id));
    // Al abrir, la lista se coloca en lo que está al aire; después ya no se mueve sola.
    if (first && items.some((i) => i.id === first)) select(first, { reveal: !opened && first === live?.orderId && 'center' });
    else renderDetail(null);
    opened = true;
  });

  subscribe('projection', (p) => {
    const next = p.mode === 'live' ? p.item?.source : null;
    const moved = next?.orderId && next.orderId !== live?.orderId;
    live = next || null;
    if (!items.length) return;
    renderList();
    // La selección acompaña a lo que está al aire cuando se avanza por el orden.
    if (moved && !collapsed && items.some((i) => i.id === next.orderId)) select(next.orderId, { reveal: true });
    else if (selectedId) renderDetail(items.find((i) => i.id === selectedId));
  });

  wide.addEventListener('change', () => { placeDetail(); });

  return {
    keys(e) {
      const rows = content();
      const index = rows.findIndex((i) => i.id === selectedId);
      if (e.key === 'ArrowDown' && rows[index + 1]) select(rows[index + 1].id, { reveal: true });
      else if (e.key === 'ArrowUp' && rows[index - 1]) select(rows[index - 1].id, { reveal: true });
      else if (e.key === 'Enter' && selectedId) show(selectedId);
      else return false;
      return true;
    },
  };
}

export default { id: 'orden', name: 'Orden', icon: 'list-numbers', mount };
