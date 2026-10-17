import { action, api, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge, kindOf, titleOf } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';
import { whenLabel } from '../../core/time.js';
import { createStage } from '../projection/stage.js';
import { createLiveControls } from '../projection/live.js';

const MAX_SLIDES = 60;
const WIDE = 1000; // desde este ancho del cajón, los pasos van en su columna (lo mismo dice order.css)

// Línea secundaria de un elemento: tipo · detalle · cuántos pasos tiene.
// Si lleva un nombre propio, primero va el que le da su contenido ("Juan 3:16"), para no perderlo.
function describe(item) {
  const kind = kindOf(item.kind);
  const unit = kind?.unit && item.steps ? `${item.steps} ${kind.unit[item.steps === 1 ? 0 : 1]}` : '';
  return [item.original, kind?.label, item.subtitle, unit].filter(Boolean).join(' · ');
}

// Módulo Orden del culto: la lista de todo lo que se va a proyectar, en orden, venga del
// módulo que venga. A la izquierda, la lista; a la derecha (o debajo del elegido, si el cajón es
// estrecho), los pasos del elemento elegido. La otra vista, el «Mapa del culto», lo enseña de un
// vistazo: una columna por elemento, cuántos pasos tiene y por dónde va.
// Con canEdit se puede añadir, reordenar y quitar; sin él (función "Control del orden"), solo proyectar.
// Los tipos que suenan: su elemento ofrece «Escuchar en este dispositivo».
const SOUNDS = new Set(['song', 'video', 'audio', 'youtube']);

// El nombre que se propone al guardar un orden: el día, la fecha y la hora («Sábado 18/10/26 19:30»).
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const two = (n) => String(n).padStart(2, '0');
const nameForNow = (d = new Date()) => `${DAYS[d.getDay()]} ${two(d.getDate())}/${two(d.getMonth() + 1)}/${two(d.getFullYear() % 100)} ${two(d.getHours())}:${two(d.getMinutes())}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function mount(el, ctx) {
  let items = [];
  let selectedId = null;
  let live = null;        // source de lo que está al aire: { orderId, step }
  let loaded = null;      // { key, steps, whole } del elemento seleccionado
  let loadedShown = null; // el `loaded` con el que se dibujó el detalle
  let collapsed = false;  // el usuario recogió el detalle a propósito: no se vuelve a abrir solo
  let opened = false;     // ya se mostró el orden por primera vez
  let wide = false;       // el cajón deja sitio a la columna de los pasos
  let view = prefs.get('orden.vista') === 'mapa' ? 'mapa' : 'lista';

  const list = h('div', { class: 'olist' });
  const map = h('div', { class: 'omap' });
  const summary = h('small', {});
  const viewTabs = [['lista', 'Lista'], ['mapa', 'Mapa del culto']].map(([id, label]) =>
    h('button', { class: 'btn', role: 'tab', dataset: { view: id }, onclick: () => setView(id) }, label));
  const detail = h('div', { class: 'odetail' });
  const side = h('div', { class: 'oside' });
  // Mandos del elemento que está al aire. Se crean una vez y se colocan en su detalle.
  const liveControls = h('div', {});
  createLiveControls(liveControls);
  // El orden en uso («Sin nombre» o el suyo); con permiso de editar, abre «Órdenes guardados».
  const orderName = h('span', {});
  const switcher = ctx.canEdit
    ? h('button', { class: 'btn order-switch', 'aria-haspopup': 'dialog', title: 'Órdenes guardados', onclick: () => openOrders() }, icon('folder-simple', 16), orderName, icon('caret-down', 14))
    : h('span', { class: 'order-switch' }, orderName);
  const quick = h('input', {
    type: 'text', placeholder: 'Añadir una cita rápida: jn 3 16', autocomplete: 'off', 'aria-label': 'Añadir una cita al orden',
    onkeydown: (e) => { if (e.key === 'Enter') quickAdd(quick.value.trim()); },
  });

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Orden del culto'), switcher,
      ctx.canEdit && h('label', { class: 'search' }, icon('plus', 16), quick, h('kbd', {}, '↵')),
      !ctx.canEdit && h('span', { class: 'spacer' }),
      ctx.canEdit && h('button', { class: 'btn', onclick: (e) => openAddMenu(e.currentTarget) }, icon('plus', 15), 'Añadir'),
      ctx.canEdit && h('button', { class: 'icon-btn', 'aria-label': 'Más opciones', onclick: (e) => menu(e.currentTarget, [
        { label: 'Vaciar el orden', icon: 'trash', onclick: confirmClear },
      ]) }, icon('dots-three', 18))),
    h('div', { class: 'order-bar', role: 'tablist', 'aria-label': 'Vista' }, ...viewTabs, summary),
    h('div', { class: 'order-grid' }, list, map, side));

  const run = (type, payload) => guard(() => action(type, payload))();
  const show = (id, step) => run('order.show', step === undefined ? { id } : { id, step });
  const content = () => items.filter((i) => i.kind !== 'section');

  // ---- Añadir ----
  function openAddMenu(anchor) {
    menu(anchor, [
      { label: 'Pasaje bíblico', icon: 'book-open-text', onclick: () => ctx.go('biblia') },
      { label: 'Himno', icon: 'music-notes', onclick: () => ctx.go('himnario') },
      { label: 'Medios', icon: 'image', note: 'Imágenes, videos, audios y presentaciones', onclick: () => ctx.go('medios') },
      { label: 'Página web', icon: 'globe', note: 'Canva, Kahoot…', onclick: () => ctx.go('paginas') },
      { label: 'Sección', icon: 'rows', onclick: () => askTitle({ title: 'Nueva sección', onSave: (title) => run('order.addSection', { title }) }) },
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

  // ---- Órdenes guardados (fase 23 de docs/PLAN.md) ----
  // Solo se guarda el que tiene nombre; el sin nombre se vacía al cerrar Manna. El que está en uso es el de la cola
  // para todos los dispositivos, y cada cambio queda en él.
  let ordersBox = null;
  const ordersList = h('div', { class: 'orders' });
  function openOrders() {
    ordersBox = dialog('Órdenes guardados', ordersList,
      h('p', { class: 'muted orders-note' }, 'Solo se guarda el orden que tiene nombre, y cada cambio queda guardado solo. El orden sin nombre se vacía al cerrar Manna.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' }, h('button', { class: 'btn', onclick: () => startNew() }, icon('plus', 15), 'Nuevo orden')));
    renderOrders();
  }
  function renderOrders() {
    if (!ordersBox?.el.isConnected) return;
    const o = state.order || {};
    const row = ({ id = null, name, count, updated }) => {
      const using = (o.active || null) === id;
      return h('div', { class: `order-saved${using ? ' on' : ''}`, dataset: { id: id || '' } },
        h('span', { class: 'item-text' }, h('strong', {}, name || 'Sin nombre'),
          h('small', {}, [plural(count, 'elemento', 'elementos'), id ? whenLabel(updated) : 'se vacía al cerrar Manna'].join(' · '))),
        using ? h('span', { class: 'badge' }, 'En uso') : h('button', { class: 'btn', onclick: () => use(id, name ? `«${name}»` : 'el orden sin nombre') }, 'Usar'),
        !id && using && h('button', { class: 'btn primary', onclick: () => saveDraft() }, 'Guardar con un nombre'),
        id && h('button', { class: 'icon-btn sm', 'aria-label': `Opciones de ${name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askTitle({ title: 'Cambiar el nombre', value: name, placeholder: name, onSave: (next) => run('order.renameOrder', { id, name: next }) }) },
          { label: 'Duplicar', icon: 'copy', note: 'Una copia con otro nombre', onclick: () => askTitle({ title: 'Duplicar el orden', value: `${name} (copia)`, placeholder: name, onSave: (next) => run('order.duplicate', { id, name: next }) }) },
          '-',
          { label: 'Eliminar', icon: 'trash', onclick: () => confirmDelete(id, name) },
        ]) }, icon('dots-three', 16)));
    };
    ordersList.replaceChildren(row({ count: o.draft || 0 }), ...(o.saved || []).map(row));
  }
  // then: lo que se hace después de guardarlo (empezar uno nuevo).
  const saveDraft = (then = null) => askTitle({
    title: 'Guardar con un nombre', value: nameForNow(), placeholder: nameForNow(),
    hint: 'Queda en «Órdenes guardados» y sigue en uso. Cada cambio se guarda solo.',
    onSave: guard(async (name) => {
      await action('order.save', { name });
      if (then) await then();
    }),
  });
  // Lo que cambia para todos al dejar el orden en uso.
  // buttons(close): los botones de la ventana, además de «Cancelar».
  const ask = (title, text, buttons) => {
    let box = null;
    const close = () => box.close();
    box = dialog(title, h('p', {}, text),
      h('div', { class: 'row', style: 'justify-content: flex-end; flex-wrap: wrap;' },
        h('button', { class: 'btn', onclick: close }, 'Cancelar'),
        ...buttons(close)));
  };
  function use(id, label) {
    ask('Cambiar de orden', `Todos los dispositivos verán ${label} en la cola del culto. Lo que está al aire sigue al aire.`, (close) => [
      h('button', { class: 'btn primary', onclick: guard(async () => {
        const { removed } = await action('order.use', id ? { id } : {});
        close();
        if (removed) toast(`Se quitaron ${plural(removed, 'elemento que ya no está', 'elementos que ya no están')} en la biblioteca.`);
      }) }, 'Usar este orden')]);
  }
  function startNew() {
    const o = state.order || {};
    const lost = o.draft ? `El orden sin nombre tiene ${plural(o.draft, 'elemento', 'elementos')} y se vaciará. ` : '';
    const kept = o.active ? `«${o.name}» queda guardado. ` : '';
    if (!lost && !kept) return toast('Ya estás en un orden nuevo, sin nombre.');
    ask('Nuevo orden', `${lost}${kept}Todos los dispositivos verán la cola vacía.`, (close) => [
      lost && !o.active && h('button', { class: 'btn', onclick: () => { close(); saveDraft(() => action('order.new')); } }, 'Guardarlo antes'),
      h('button', { class: `btn ${lost ? 'danger' : 'primary'}`, onclick: () => { run('order.new'); close(); } }, lost ? 'Vaciarlo y empezar' : 'Empezar uno nuevo'),
    ].filter(Boolean));
  }
  function confirmDelete(id, name) {
    ask('Eliminar el orden', `«${name}» se borra de los órdenes guardados.${state.order?.active === id ? ' Como está en uso, la cola pasa al orden sin nombre.' : ''}`, (close) => [
      h('button', { class: 'btn danger', onclick: () => { run('order.deleteOrder', { id }); close(); } }, 'Eliminar')]);
  }

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
      renderMap();
      return;
    }
    const liveIndex = items.findIndex((i) => i.id === live?.orderId);
    let n = 0;
    // La lista se rehace con cada cambio de lo que está al aire: el foco vuelve a la misma fila (o a su botón).
    const focusedRow = list.contains(document.activeElement) ? document.activeElement.closest('[data-id]') : null;
    const focusedId = focusedRow?.dataset.id;
    const focusedPart = focusedRow && document.activeElement !== focusedRow ? document.activeElement.getAttribute('aria-label') : null;
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
        // Con el teclado se llega con Tab, e Intro o Espacio hacen lo mismo que un clic.
        role: 'button', tabindex: '0', 'aria-expanded': String(item.id === selectedId), 'aria-current': isLive ? 'true' : null,
        onkeydown: (e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.click();
        },
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
    if (focusedId) {
      const row = [...list.querySelectorAll('[data-id]')].find((r) => r.dataset.id === focusedId);
      const part = focusedPart && [...(row?.querySelectorAll('button') || [])].find((b) => b.getAttribute('aria-label') === focusedPart);
      (part || row)?.focus({ preventScroll: true });
    }
    placeDetail();
    renderMap();
  }

  // ---- Mapa del culto ----
  // Una columna por elemento (sin secciones): su número y su tipo, cuántos pasos tiene y si ya pasó
  // (marca cian) o está al aire (el paso, en rojo). Debajo, los pasos del elegido, para ir a uno.
  function renderMap() {
    const rows = content();
    summary.textContent = rows.length ? `${rows.length} ${rows.length === 1 ? 'elemento' : 'elementos'} · ${rows.reduce((sum, i) => sum + (i.steps || 1), 0)} pasos` : '';
    if (view !== 'mapa') return;
    if (!rows.length) {
      map.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'El orden del culto está vacío'), 'Aquí se verá de un vistazo, con cuántos pasos tiene cada elemento y por dónde va.'));
      return;
    }
    const at = rows.findIndex((i) => i.id === live?.orderId);
    const focus = rows.find((i) => i.id === selectedId) || rows[at] || null;
    const cells = (fn) => rows.map((item, i) => fn(item, i));
    const grid = h('div', { class: 'omap-grid', style: `grid-template-columns: 64px repeat(${rows.length}, minmax(48px, 1fr)); min-width: ${64 + rows.length * 52}px` },
      h('span', { class: 'omap-label' }, 'Elemento'),
      ...cells((item, i) => h('button', {
        class: `omap-item${i === at ? ' live' : ''}${item.id === focus?.id ? ' on' : ''}`, dataset: { id: item.id }, title: item.title, 'aria-label': `${i + 1}. ${item.title}`,
        onclick: () => select(item.id), ondblclick: () => show(item.id),
      }, kindBadge(item.kind), h('strong', {}, String(i + 1)))),
      h('span', { class: 'omap-label' }, 'Pasos'),
      ...cells((item) => h('span', { class: 'omap-cell' }, String(item.steps || 1))),
      h('span', { class: 'omap-label' }, 'Hecho'),
      ...cells((item, i) => (i < at ? h('span', { class: 'omap-cell omap-mark done', title: 'Ya pasó' }, icon('check', 14))
        : i === at ? h('span', { class: 'omap-cell omap-mark' }, h('b', { title: 'Al aire' }, String((live.step ?? 0) + 1)))
          : h('span', { class: 'omap-cell omap-mark' }, '·'))));
    const now = focus && live?.orderId === focus.id ? (live.step ?? -1) : -1;
    const steps = focus
      ? h('div', { class: 'omap-steps' }, h('strong', {}, `Pasos de «${focus.title}»`),
        h('div', { class: 'omap-cells' }, ...Array.from({ length: Math.min(focus.steps || 1, MAX_SLIDES) }, (_, k) => h('button', {
          class: `step-cell${k === now ? ' on' : k < now ? ' done' : ''}`, 'aria-label': `Paso ${k + 1}`, onclick: () => show(focus.id, k),
        }, String(k + 1)))),
        h('p', { class: 'muted' }, 'Un toque elige un elemento; doble toque lo proyecta. Un paso lo proyecta desde ahí.'))
      : h('p', { class: 'muted' }, 'Toca un elemento para ver sus pasos.');
    const scroll = map.querySelector('.omap-scroll')?.scrollLeft || 0;
    map.replaceChildren(h('div', { class: 'omap-scroll' }, grid), steps);
    map.querySelector('.omap-scroll').scrollLeft = scroll;
  }

  function setView(id) {
    view = id;
    prefs.set('orden.vista', id);
    viewTabs.forEach((b) => {
      b.classList.toggle('on', b.dataset.view === id);
      b.setAttribute('aria-selected', String(b.dataset.view === id));
    });
    list.hidden = id !== 'lista';
    map.hidden = id !== 'mapa';
    placeDetail();
    renderMap();
  }

  // ---- Detalle: los pasos del elemento seleccionado ----
  // En pantallas anchas va en su columna; en estrechas, justo debajo de la fila elegida.
  function placeDetail() {
    wide = el.clientWidth >= WIDE;
    const row = list.querySelector('.orow.selected');
    side.hidden = !wide || view !== 'lista';
    detail.classList.toggle('inline', !wide);
    if (wide) side.replaceChildren(detail);
    else if (row) row.after(detail);
    else detail.remove();
  }

  const markSelected = () => {
    list.querySelectorAll('.orow').forEach((r) => {
      r.classList.toggle('selected', r.dataset.id === selectedId);
      r.setAttribute('aria-expanded', String(r.dataset.id === selectedId));
    });
    renderMap();
  };

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
      let res;
      try {
        res = await api(`/api/order/${id}/steps`);
      } catch (err) {
        // Sin sus pasos no se queda la ficha cargando para siempre: se deselecciona y guard() avisa.
        if (selectedId === id) { selectedId = null; markSelected(); renderDetail(null); }
        throw err;
      }
      if (selectedId !== id) return;
      loaded = { key, ...res };
    }
    renderDetail(item);
  });

  // step: el paso que muestra (null = el elemento entero), para marcar el que está al aire sin rehacer la miniatura.
  function slide(caption, contentItem, isLive, onclick, step) {
    const monitor = h('div', { class: `monitor${isLive ? ' on-air' : ''}` });
    createStage(monitor, { thumbnail: true }).render({ mode: 'live', item: contentItem, styles: state.projection.styles });
    return h('button', { class: 'slide', dataset: { step: step == null ? 'todo' : String(step) }, onclick }, monitor,
      h('span', { class: 'slide-cap' }, h('span', {}, caption), isLive ? h('b', {}, 'Al aire') : null));
  }
  // Pasar al paso siguiente del mismo elemento solo mueve la marca «Al aire»: con una presentación larga, rehacer sus
  // 60 miniaturas en cada «Siguiente» pesa.
  let detailShape = null;
  function markLiveStep(item) {
    const onAir = live?.orderId === item.id;
    for (const b of detail.querySelectorAll('.slide[data-step]')) {
      const step = b.dataset.step === 'todo' ? null : Number(b.dataset.step);
      const on = onAir && (live.step ?? null) === step;
      b.querySelector('.monitor').classList.toggle('on-air', on);
      const cap = b.querySelector('.slide-cap');
      const badge = cap.querySelector('b');
      if (on && !badge) cap.append(h('b', {}, 'Al aire'));
      if (!on && badge) badge.remove();
    }
  }

  // Lo que suena se puede oír solo en este dispositivo antes de pasarlo (no en el equipo principal: ctx.listen es null).
  const listen = guard(async (item) => {
    let url = null;
    if (item.kind === 'song') {
      const hymn = await api(`/api/hymns/${item.data.number}`);
      url = (item.data.track === 'instrumental' && hymn.instrumentalUrl) || hymn.url;
    } else {
      url = Object.values(state.media || {}).flat().find((clip) => clip?.id === item.data.id)?.url;
    }
    if (url) ctx.listen({ url, title: item.title });
  });

  function renderDetail(item) {
    const shape = item && loaded && JSON.stringify([item.id, item.title, item.subtitle, item.steps, items.indexOf(item), items.length, live?.orderId === item.id, state.projection.styles]);
    if (shape && shape === detailShape && loadedShown === loaded) {
      markLiveStep(item);
      return;
    }
    detailShape = shape;
    loadedShown = loaded;
    if (!item) {
      detail.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'Elige un elemento'), 'Aquí verás sus pasos: los versículos de un pasaje, las estrofas de un himno o las diapositivas de una presentación.'));
      return;
    }
    const head = h('div', { class: 'odetail-head' }, kindBadge(item.kind),
      h('div', { class: 'item-text' }, h('h2', {}, item.title), h('small', {}, describe(item))));
    // Fuera de la cabecera, que en el celular no se ve (la fila ya dice qué es).
    const listenButton = ctx.listen && SOUNDS.has(item.kind) && h('button', { class: 'btn odetail-listen', 'aria-label': 'Escuchar en este dispositivo', onclick: () => listen(item) }, icon('speaker-high', 16), 'Escuchar');
    // En celular la fila no lleva el botón de opciones (el ancho es para el título): van aquí.
    const index = items.indexOf(item);
    const tools = ctx.canEdit && h('div', { class: 'odetail-tools' },
      h('button', { class: 'btn', onclick: () => rename(item) }, icon('pencil-simple', 16), 'Nombre'),
      h('button', { class: 'btn', disabled: index === 0, onclick: () => run('order.move', { id: item.id, toIndex: index - 1 }) }, icon('arrow-up', 16), 'Subir'),
      h('button', { class: 'btn', disabled: index === items.length - 1, onclick: () => run('order.move', { id: item.id, toIndex: index + 1 }) }, icon('arrow-down', 16), 'Bajar'),
      h('button', { class: 'btn danger', onclick: () => run('order.remove', { id: item.id }) }, icon('trash', 16), 'Quitar'));
    if (!loaded) {
      detail.replaceChildren(...[head, listenButton].filter(Boolean), h('div', { class: 'slides' }, ...Array.from({ length: Math.min(item.steps || 1, 4) }, () => h('div', { class: 'slide skeleton' }, h('div', { class: 'monitor' })))));
      if (tools) detail.append(tools);
      return;
    }
    const onAir = live?.orderId === item.id;
    // Un elemento de un solo paso se rotula con su tipo; los demás, con lo que muestra cada paso.
    const caption = (s, i) => (loaded.steps.length === 1 ? kindOf(item.kind)?.label : s.reference || titleOf(s)) || `Paso ${i + 1}`;
    const slides = loaded.steps.slice(0, MAX_SLIDES).map((s, i) =>
      slide(caption(s, i), s, onAir && live.step === i, () => show(item.id, i), i));
    // Elementos cortos (un pasaje de pocos versículos): también se pueden mostrar enteros.
    if (loaded.whole && item.steps <= (kindOf(item.kind)?.wholeUpTo || 0)) {
      slides.unshift(slide('Todo junto', loaded.whole, onAir && live.step == null, () => show(item.id, null), null));
    }
    detail.replaceChildren(...[head, listenButton, onAir && liveControls, h('div', { class: 'slides' }, ...slides),
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
    orderName.textContent = o.name || 'Sin nombre';
    if (ctx.canEdit) switcher.setAttribute('aria-label', `Órdenes guardados (en uso: ${orderName.textContent})`);
    renderOrders();
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

  // Se mide el cajón, no la pantalla: el mismo módulo va en uno estrecho, en uno ancho o en el celular.
  new ResizeObserver(() => { if ((el.clientWidth >= WIDE) !== wide) placeDetail(); }).observe(el);
  setView(view);

  return {
    onShow: placeDetail,
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
