import { action, api, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge, kindOf, titleOf } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';
import { whenLabel } from '../../core/time.js';
import { createStage } from '../projection/stage.js';
import { createLiveControls } from '../projection/live.js';
import { openCitas } from './citas.js';

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
// estrecho), los pasos del elemento elegido.
// Cada orden tiene nombre, dueño y fecha (fase 35). Con permiso de editar hay tres pestañas: «Este orden» (el que esta persona
// tiene abierto: ahí va lo que añade, y se proyecta desde él si está en uso), «Órdenes» (los suyos, o todos si es el
// administrador, por semanas de domingo a sábado) y «Favoritos» (los que se repiten). Sin canEdit (función «Control
// del orden»), solo el que está en uso, para proyectar.
// Los tipos que suenan: su elemento ofrece «Escuchar en este dispositivo».
const SOUNDS = new Set(['song', 'video', 'audio', 'youtube']);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Con estos órdenes libres o menos (de los 20 que caben por iglesia), el cajón pide limpiar los antiguos.
const WARN_LEFT = 5;

// Fechas de los órdenes: «AAAA-MM-DD», el día del culto. El nombre que se propone es el del servidor
// (server/modules/order/logic.js): «Orden Ana 25 de oct.».
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];
const two = (n) => String(n).padStart(2, '0');
const dayOf = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const dateOf = (day) => new Date(`${day}T12:00`);
const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const dayLabel = (day) => { const d = dateOf(day); return `${DAYS[d.getDay()].slice(0, 3)}. ${shortDate(d)}`; };
// El domingo de su semana (las semanas van de domingo a sábado), como «AAAA-MM-DD».
const weekOf = (day) => { const d = dateOf(day); d.setDate(d.getDate() - d.getDay()); return dayOf(d); };
function weekLabel(start) {
  const weeks = Math.round((dateOf(start) - dateOf(weekOf(dayOf()))) / (7 * 86_400_000));
  const end = dateOf(start);
  end.setDate(end.getDate() + 6);
  const span = `${shortDate(dateOf(start))} – ${shortDate(end)}`;
  const name = { 0: 'Esta semana', 1: 'La semana que viene', [-1]: 'La semana pasada' }[weeks];
  return name ? `${name} · ${span}` : `Del ${span}`;
}

function mount(el, ctx) {
  let items = [];
  let selectedId = null;
  let live = null;        // source de lo que está al aire: { orderId, step }
  let loaded = null;      // { key, steps, whole } del elemento seleccionado
  let loadedShown = null; // el `loaded` con el que se dibujó el detalle
  let collapsed = false;  // el usuario recogió el detalle a propósito: no se vuelve a abrir solo
  let opened = false;     // ya se mostró el orden por primera vez
  let wide = false;       // el cajón deja sitio a la columna de los pasos
  const TABS = [['este', 'Este orden'], ['ordenes', 'Órdenes'], ['favoritos', 'Favoritos']];
  let view = ctx.can('order.edit') && TABS.some(([id]) => id === prefs.get('orden.vista')) ? prefs.get('orden.vista') : 'este';
  let editable = false;   // el orden que se ve es de esta persona (o es el administrador)
  let viewing = null;     // { id, name, ownerName, date } del orden que se ve
  let inUseHere = false;  // el que se ve es el que está en uso: se proyecta desde él

  const list = h('div', { class: 'olist' });
  const browse = h('div', { class: 'obrowse' });
  const note = h('div', { class: 'order-note', role: 'status', hidden: true });
  // Cuando quedan pocos órdenes libres (hay un máximo por iglesia), el aviso de limpiar los antiguos.
  const full = h('div', { class: 'order-note order-full', role: 'status', hidden: true });
  // Un orden cambiado en la iglesia y en la nube a la vez, sin conexión (fase 37, decisión 63): quedó el último cambio.
  const conflicts = h('div', { class: 'order-conflicts' });
  const summary = h('small', {});
  const viewTabs = ctx.can('order.edit') ? TABS.map(([id, label]) =>
    h('button', { class: 'btn', role: 'tab', dataset: { view: id }, onclick: () => setView(id) }, label)) : [];
  const detail = h('div', { class: 'odetail' });
  const side = h('div', { class: 'oside' });
  // Mandos del elemento que está al aire. Se crean una vez y se colocan en su detalle.
  const liveControls = h('div', {});
  createLiveControls(liveControls);
  // El nombre del orden que se ve, junto al título (decisión 64): quien puede cambiarlo lo escribe ahí mismo y se guarda
  // solo al terminar (al salir del campo o con Intro; con Esc vuelve el de antes, y el shell quita el foco).
  const orderName = h('input', {
    class: 'order-name', maxLength: 60, autocomplete: 'off', spellcheck: false, placeholder: 'Ningún orden', 'aria-label': 'Nombre del orden',
    onfocus: () => orderName.select(),
    oninput: () => fitName(),
    onkeydown: (e) => {
      if (e.key === 'Enter') orderName.blur();
      if (e.key === 'Escape') orderName.value = viewing?.name || '';
    },
    onchange: guard(async () => {
      const name = orderName.value.trim();
      if (!name || name === viewing?.name) {
        orderName.value = viewing?.name || '';
        fitName();
        return;
      }
      try {
        await action('order.renameOrder', { id: viewing.id, name });
      } catch (err) {
        orderName.value = viewing?.name || '';
        fitName();
        throw err;
      }
    }),
  });
  const fitName = () => { orderName.size = Math.min(40, Math.max(6, (orderName.value || orderName.placeholder).length + 1)); };
  const quick = h('input', {
    type: 'text', placeholder: 'Añadir una cita rápida: jn 3 16', autocomplete: 'off', 'aria-label': 'Añadir una cita al orden',
    onkeydown: (e) => { if (e.key === 'Enter') quickAdd(quick.value.trim()); },
    // Varias citas pegadas de una vez (en líneas o con «;»): la lista para revisarlas (fase 27).
    onpaste: (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (!/[\n;]/.test(text.trim())) return;
      e.preventDefault();
      openCitas({ text });
    },
  });

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Orden del culto'), orderName,
      ctx.can('order.edit') && h('label', { class: 'search' }, icon('plus', 16), quick, h('kbd', {}, '↵')),
      !ctx.can('order.edit') && h('span', { class: 'spacer' }),
      ctx.can('order.edit') && h('button', { class: 'btn order-add', 'aria-label': 'Añadir', onclick: (e) => openAddMenu(e.currentTarget) }, icon('plus', 15), h('span', {}, 'Añadir')),
      ctx.can('order.edit') && h('button', { class: 'icon-btn', 'aria-label': 'Más opciones', onclick: (e) => menu(e.currentTarget, [
        { label: 'Nuevo orden', icon: 'plus', onclick: () => newOrder() },
        { label: 'Vaciar el orden', icon: 'trash', disabled: !editable || !items.length, onclick: confirmClear },
      ]) }, icon('dots-three', 18))),
    h('div', { class: 'order-bar', role: 'tablist', 'aria-label': 'Vista' }, ...viewTabs, summary),
    note, full, conflicts,
    h('div', { class: 'order-grid' }, list, browse, side));

  const run = (type, payload) => guard(() => action(type, payload))();
  // Se proyecta desde el orden que está en uso; desde otro, primero se pone en uso.
  // Sin proyección (preparar el culto), no hay nada que mostrar.
  const show = (id, step) => (!ctx.canProject ? undefined : inUseHere ? run('order.show', step === undefined ? { id } : { id, step }) : use(viewing));
  const content = () => items.filter((i) => i.kind !== 'section');

  // ---- Añadir ----
  function openAddMenu(anchor) {
    menu(anchor, [
      { label: 'Pasaje bíblico', icon: 'book-open-text', onclick: () => ctx.go('biblia') },
      { label: 'Himno', icon: 'music-notes', onclick: () => ctx.go('himnario') },
      { label: 'Medios', icon: 'image', note: 'Imágenes, videos, audios y presentaciones', onclick: () => ctx.go('medios') },
      ctx.has('paginas') && { label: 'Página web', icon: 'globe', note: 'Canva, Kahoot…', onclick: () => ctx.go('paginas') },
      { label: 'Sección', icon: 'rows', onclick: () => askTitle({ title: 'Nueva sección', onSave: (title) => run('order.addSection', { title }) }) },
      '-',
      { label: 'Citas de un texto o documento', icon: 'file-text', note: 'Pegar, o un Word o un PDF', onclick: () => openCitas() },
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
    if (q.includes(';')) { quick.value = ''; openCitas({ text: q }); return; }
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

  // ---- Órdenes (fases 23 y 35) ----
  // Cada uno tiene nombre, dueño y fecha. El que está en uso es el de la cola para todos los dispositivos; el que se
  // ve aquí es el que esta persona tiene abierto, y cada cambio queda en él.
  const me = ctx.user;
  function orderRow(o) {
    const using = o.id === state.order?.active;
    const open = o.id === state.orders?.editing;
    return h('div', { class: `order-saved${using ? ' on' : ''}${open ? ' open' : ''}`, dataset: { id: o.id } },
      h('button', { class: 'order-open', 'aria-label': `Abrir ${o.name}`, onclick: () => openOrder(o) },
        h('span', { class: 'item-text' }, h('strong', {}, o.name),
          h('small', {}, [dayLabel(o.date), o.owner !== me?.id && o.ownerName, plural(o.count, 'elemento', 'elementos')].filter(Boolean).join(' · ')))),
      h('button', { class: `icon-btn sm order-star${o.favorite ? ' on' : ''}`, 'aria-pressed': String(o.favorite), 'aria-label': o.favorite ? `Quitar ${o.name} de favoritos` : `Añadir ${o.name} a favoritos`,
        onclick: () => run('order.favorite', { id: o.id, on: !o.favorite }) }, icon('star', 16)),
      using ? h('span', { class: 'badge' }, 'En uso') : h('button', { class: 'btn', onclick: () => use(o) }, 'Usar'),
      h('button', { class: 'icon-btn sm', 'aria-label': `Opciones de ${o.name}`, onclick: (e) => menu(e.currentTarget, [
        { label: 'Cambiar el nombre o la fecha', icon: 'pencil-simple', onclick: () => editOrder(o) },
        '-',
        { label: 'Eliminar', icon: 'trash', onclick: () => confirmDelete(o) },
      ]) }, icon('dots-three', 16)));
  }
  // «Órdenes»: por semanas, de domingo a sábado, la más nueva arriba. «Favoritos»: por nombre.
  function renderBrowse() {
    if (view === 'este') return;
    const all = state.orders?.list || [];
    const head = h('div', { class: 'obrowse-head' }, h('button', { class: 'btn', onclick: () => newOrder() }, icon('plus', 15), 'Nuevo orden'));
    if (view === 'favoritos') {
      const favs = all.filter((o) => o.favorite).sort((x, y) => x.name.localeCompare(y.name, 'es'));
      browse.replaceChildren(head, favs.length ? h('div', { class: 'orders' }, ...favs.map(orderRow))
        : h('div', { class: 'empty' }, h('strong', {}, 'Sin favoritos'), 'Marca con la estrella los órdenes que se repiten (la Santa Cena, el culto de jóvenes) para tenerlos aquí.'));
      return;
    }
    if (!all.length) {
      browse.replaceChildren(head, h('div', { class: 'empty' }, h('strong', {}, me?.admin ? 'Aún no hay órdenes' : 'Aún no tienes órdenes'), 'Crea uno con «Nuevo orden», o añade algo desde la Biblia o el Himnario: va a uno nuevo, con el nombre del día.'));
      return;
    }
    const weeks = new Map();
    for (const o of [...all].sort((x, y) => x.date.localeCompare(y.date) || x.updated - y.updated)) {
      const start = weekOf(o.date);
      if (!weeks.has(start)) weeks.set(start, []);
      weeks.get(start).push(o);
    }
    browse.replaceChildren(head, ...[...weeks].sort(([x], [y]) => y.localeCompare(x)).map(([start, rows]) =>
      h('section', { class: 'orders-week', dataset: { week: start } }, h('h3', {}, weekLabel(start)), h('div', { class: 'orders' }, ...rows.map(orderRow)))));
  }
  // Pide nombre y fecha: para uno nuevo (o null) o para cambiar los de uno.
  function askOrder({ title, o = null, onSave }) {
    const date = h('input', { class: 'input', type: 'date', value: o?.date || dayOf(), 'aria-label': 'Fecha', required: true });
    const today = new Date();
    const name = h('input', { class: 'input', maxLength: 60, value: o?.name || '', placeholder: `Orden ${me?.name || ''} ${today.getDate()} de ${MONTHS[today.getMonth()]}`, 'aria-label': 'Nombre' });
    const box = dialog(title, h('form', { onsubmit: guard(async (e) => { e.preventDefault(); await onSave({ name: name.value.trim(), date: date.value }); box.close(); }) },
      h('div', { class: 'order-form' },
        h('label', { class: 'order-field' }, h('span', {}, 'Fecha del culto'), date),
        h('label', { class: 'order-field' }, h('span', {}, 'Nombre'), name)),
      !o && h('p', { class: 'muted' }, 'Sin nombre, lleva el tuyo y el de hoy. Es tuyo: solo lo ven y lo cambian tú y el administrador.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', type: 'button', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary' }, o ? 'Guardar' : 'Crear'))));
    name.focus();
  }
  const newOrder = () => askOrder({ title: 'Nuevo orden', onSave: async ({ name, date }) => {
    const { left } = await action('order.create', { name, date });
    setView('este');
    if (left <= WARN_LEFT) toast(left ? `Quedan ${plural(left, 'orden libre', 'órdenes libres')}: limpia los órdenes antiguos que ya no necesites.` : 'Ya no caben más órdenes: limpia los antiguos que ya no necesites.');
  } });
  const editOrder = (o) => askOrder({ title: 'Cambiar el nombre o la fecha', o, onSave: ({ name, date }) => action('order.renameOrder', { id: o.id, name: name || o.name, date }) });
  const openOrder = guard(async (o) => {
    await action('order.open', { id: o.id });
    setView('este');
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
  function use(o) {
    if (!o?.id) return;
    ask('Cambiar de orden', `Todos los dispositivos verán «${o.name}» en la cola del culto. Lo que está al aire sigue al aire.`, (close) => [
      h('button', { class: 'btn primary', onclick: guard(async () => {
        const { removed } = await action('order.use', { id: o.id });
        close();
        if (removed) toast(`Se quitaron ${plural(removed, 'elemento que ya no está', 'elementos que ya no están')} en la biblioteca.`);
      }) }, 'Usar este orden')]);
  }
  function confirmDelete(o) {
    ask('Eliminar el orden', `«${o.name}» se borra.${state.order?.active === o.id ? ' Como está en uso, la cola del culto queda vacía.' : ''}`, (close) => [
      h('button', { class: 'btn danger', onclick: () => { run('order.deleteOrder', { id: o.id }); close(); } }, 'Eliminar')]);
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
    const rows = content();
    summary.textContent = rows.length ? `${plural(rows.length, 'elemento', 'elementos')} · ${rows.reduce((sum, i) => sum + (i.steps || 1), 0)} pasos` : '';
    if (!items.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, viewing?.id ? 'Este orden está vacío' : 'Ningún orden en uso'),
        ctx.can('order.edit') ? 'Añade pasajes desde la Biblia, o escribe una cita arriba y pulsa Enter.' : 'Se prepara desde un dispositivo con control completo.',
        ctx.can('order.edit') && h('p', { style: 'margin-top: 14px;' }, h('button', { class: 'btn', onclick: () => ctx.go('biblia') }, icon('book-open-text', 16), 'Ir a la Biblia'))));
      side.hidden = true;
      return;
    }
    const liveIndex = items.findIndex((i) => i.id === live?.orderId);
    let n = 0;
    // La lista se rehace con cada cambio de lo que está al aire: el foco vuelve a la misma fila (o a su botón).
    const focusedRow = list.contains(document.activeElement) ? document.activeElement.closest('[data-id]') : null;
    const focusedId = focusedRow?.dataset.id;
    const focusedPart = focusedRow && document.activeElement !== focusedRow ? document.activeElement.getAttribute('aria-label') : null;
    list.replaceChildren(...items.map((item, index) => {
      const more = editable && h('button', { class: 'icon-btn sm', 'aria-label': 'Opciones', onclick: (e) => { e.stopPropagation(); rowMenu(e.currentTarget, item, index); } }, icon('dots-three', 16));
      if (item.kind === 'section') {
        return h('div', { class: 'osection', dataset: { id: item.id }, draggable: editable }, h('span', {}, item.title), more);
      }
      n += 1;
      const isLive = index === liveIndex;
      return h('div', {
        class: `orow${isLive ? ' live' : ''}${liveIndex > index ? ' past' : ''}${item.id === selectedId ? ' selected' : ''}`,
        dataset: { id: item.id }, draggable: editable, title: item.title,
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
      editable && h('span', { class: 'grip', 'aria-hidden': 'true' }, icon('dots-six-vertical', 16)),
      h('span', { class: 'num' }, String(n)),
      kindBadge(item.kind),
      h('span', { class: 'item-text' }, h('strong', {}, item.title), h('small', {}, describe(item))),
      isLive
        ? h('span', { class: 'badge live' }, 'Al aire')
        : ctx.canProject && h('button', { class: 'icon-btn sm', 'aria-label': `Proyectar ${item.title}`, onclick: (e) => { e.stopPropagation(); show(item.id); } }, icon('play', 14)),
      more);
    }));
    if (focusedId) {
      const row = [...list.querySelectorAll('[data-id]')].find((r) => r.dataset.id === focusedId);
      const part = focusedPart && [...(row?.querySelectorAll('button') || [])].find((b) => b.getAttribute('aria-label') === focusedPart);
      (part || row)?.focus({ preventScroll: true });
    }
    placeDetail();
  }

  function setView(id) {
    view = id;
    if (ctx.can('order.edit')) prefs.set('orden.vista', id);
    viewTabs.forEach((b) => {
      b.classList.toggle('on', b.dataset.view === id);
      b.setAttribute('aria-selected', String(b.dataset.view === id));
    });
    list.hidden = id !== 'este';
    browse.hidden = id === 'este';
    summary.hidden = id !== 'este';
    renderNote();
    placeDetail();
    renderBrowse();
  }

  // ---- Detalle: los pasos del elemento seleccionado ----
  // En pantallas anchas va en su columna; en estrechas, justo debajo de la fila elegida.
  function placeDetail() {
    wide = el.clientWidth >= WIDE;
    const row = list.querySelector('.orow.selected');
    side.hidden = !wide || view !== 'este';
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
    const shape = item && loaded && JSON.stringify([item.id, item.title, item.subtitle, item.steps, items.indexOf(item), items.length, live?.orderId === item.id, editable, state.projection.styles]);
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
    const tools = editable && h('div', { class: 'odetail-tools' },
      h('button', { class: 'btn', onclick: () => rename(item) }, icon('pencil-simple', 16), 'Nombre'),
      h('button', { class: 'btn', disabled: index === 0, onclick: () => run('order.move', { id: item.id, toIndex: index - 1 }) }, icon('arrow-up', 16), 'Subir'),
      h('button', { class: 'btn', disabled: index === items.length - 1, onclick: () => run('order.move', { id: item.id, toIndex: index + 1 }) }, icon('arrow-down', 16), 'Bajar'),
      h('button', { class: 'btn danger', onclick: () => run('order.remove', { id: item.id }) }, icon('trash', 16), 'Quitar'));
    // Lo que no está en este equipo lo dice su tipo, en vez de pedir miniaturas que no existen.
    const away = kindOf(item.kind)?.elsewhere?.(item);
    if (away) {
      detail.replaceChildren(...[head, away, tools].filter(Boolean));
      return;
    }
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
  if (ctx.can('order.edit')) {
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
      const t = dragId && editable && target(e);
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

  // Bajo las pestañas: si lo que se ve no está en uso, o es de otra persona, se dice (y cómo resolverlo).
  function renderNote() {
    const inUse = state.order || {};
    const parts = view !== 'este' || !ctx.can('order.edit') ? null
      : !viewing?.id ? ['No tienes ningún orden abierto. Lo que añadas va a uno nuevo, con el nombre del día.', h('button', { class: 'btn', onclick: () => setView('ordenes') }, 'Ver los órdenes')]
        : !editable ? [`Este orden es de ${viewing.ownerName}: solo lo cambian ${viewing.ownerName} o el administrador.`, h('button', { class: 'btn', onclick: () => newOrder() }, icon('plus', 15), 'Nuevo orden')]
          : !inUseHere && ctx.canProject ? [inUse.active ? `No está en uso: la cola del culto muestra «${inUse.name}».` : 'No está en uso: la cola del culto está vacía.', h('button', { class: 'btn', onclick: () => use(viewing) }, 'Usar este orden')]
            : null;
    note.hidden = !parts;
    note.replaceChildren(...(parts ? [h('span', {}, parts[0]), parts[1]] : []));
    const { total = 0, limit = Infinity } = state.orders || {};
    const left = limit - total;
    full.hidden = !ctx.can('order.edit') || left > WARN_LEFT;
    conflicts.replaceChildren(...(ctx.can('order.edit') ? state.orders?.conflicts || [] : []).map((c) => h('div', { class: 'order-note', role: 'status' },
      h('span', {}, `«${c.name}» se cambió en la iglesia y en la nube a la vez, sin conexión entre ellas: quedó el cambio más reciente, el de ${c.where}.`),
      h('button', { class: 'btn', onclick: guard(() => action('order.dismissConflict', { id: c.id })) }, 'Entendido'))));
    full.replaceChildren(...[h('span', {}, `${left > 0 ? `Quedan ${plural(left, 'orden libre', 'órdenes libres')} de ${limit}.` : `Ya hay ${limit} órdenes, el máximo: no se pueden crear más.`} Limpia los órdenes antiguos que ya no necesites${me?.admin ? '' : ' (los de otras personas los borra el administrador)'}.`),
      view !== 'ordenes' && h('button', { class: 'btn', onclick: () => setView('ordenes') }, 'Ver los órdenes')].filter(Boolean));
  }

  // ---- Estado compartido ----
  // Con permiso de editar se ve el orden que esta persona tiene abierto (espacio `orders`, solo suyo); si no tiene
  // ninguno, o sin permiso, el que está en uso.
  function refresh() {
    const inUse = state.order || {};
    const mine = (ctx.can('order.edit') && state.orders) || {};
    const open = mine.editing && mine.list?.find((o) => o.id === mine.editing);
    editable = Boolean(open);
    viewing = open || (inUse.active ? { id: inUse.active, name: inUse.name, ownerName: inUse.owner } : null);
    items = open ? mine.items : inUse.items || [];
    inUseHere = Boolean(viewing?.id) && viewing.id === inUse.active;
    orderName.readOnly = !editable;
    if (document.activeElement !== orderName) {
      orderName.value = viewing?.name || '';
      fitName();
    }
    renderNote();
    renderBrowse();
    if (!items.some((i) => i.id === selectedId)) selectedId = null;
    renderList();
    const first = selectedId || (!collapsed && (live?.orderId || content()[0]?.id));
    // Al abrir, la lista se coloca en lo que está al aire; después ya no se mueve sola.
    if (first && items.some((i) => i.id === first)) select(first, { reveal: !opened && first === live?.orderId && 'center' });
    else renderDetail(null);
    opened = true;
  }
  subscribe('order', refresh);
  subscribe('orders', refresh);

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
