import { action, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { layerButton } from '../../core/capas.js';
import { createStage } from '../projection/stage.js';
import { STYLE_NAMES, readout } from './kind.js';

// Módulo Tiempo (fase 32): la hora, cronómetros y temporizadores. A un lado la lista (la hora y los guardados, con su
// cuenta y sus botones de empezar y volver al principio); al otro, cómo se verá el elegido: estilo, tamaño, sitio y
// aspecto, con su vista previa sobre el fondo de Ajustes. Se proyecta, se pone en una capa o se añade al orden.
// Cómo se ve cada uno lo recuerda este dispositivo (prefs); lo que se proyecta lo lleva en su data.

// Lo de siempre, como en el servidor (server/modules/time/clock.js).
const DEFAULTS = {
  hora: { style: 'sencillo', size: 's', place: 'br', look: 'sutil', format: '12' },
  count: { style: 'tarjeta', size: 'l', place: 'mc', look: 'normal' },
};
const SIZES = [['s', 'Pequeño'], ['m', 'Mediano'], ['l', 'Grande']];
const LOOKS = [['sutil', 'Sutil'], ['normal', 'Normal']];
const FORMATS = [['12', '12 h'], ['24', '24 h']];
const PLACES = [
  ['tl', 'Arriba a la izquierda'], ['tc', 'Arriba en el centro'], ['tr', 'Arriba a la derecha'],
  ['ml', 'En medio a la izquierda'], ['mc', 'En el centro'], ['mr', 'En medio a la derecha'],
  ['bl', 'Abajo a la izquierda'], ['bc', 'Abajo en el centro'], ['br', 'Abajo a la derecha'],
];
const timers = () => state.time?.timers || [];
const HORA = 'hora';

function mount(el, ctx) {
  let chosen = HORA; // 'hora' o el id de un cronómetro o temporizador
  const timer = () => (chosen === HORA ? null : timers().find((t) => t.id === chosen) || null);
  const lookOf = (id) => ({ ...(id === HORA ? DEFAULTS.hora : DEFAULTS.count), ...prefs.get(`tiempo.aspecto.${id}`, {}) });
  const setLook = (patch) => {
    prefs.set(`tiempo.aspecto.${chosen}`, { ...lookOf(chosen), ...patch });
    paintLook();
    // Si ese reloj está en una capa, la capa toma el aspecto nuevo (sin mostrarse si estaba oculta).
    const it = what();
    for (const slot of state.layers?.slots || []) {
      if (it && slot.kind === 'clock' && (slot.data?.id || null) === (it.data.id || null)) {
        action('layers.set', { n: slot.n, kind: 'clock', data: it.data, visible: slot.visible }).catch(() => {});
      }
    }
  };
  // Lo que se proyecta: { kind: 'clock', data, title }.
  const what = () => {
    const t = timer();
    if (chosen !== HORA && !t) return null;
    const look = lookOf(chosen);
    if (chosen === HORA) return { kind: 'clock', data: { type: 'hora', ...look }, title: 'Hora' };
    const { format, ...rest } = look;
    return { kind: 'clock', data: { id: t.id, ...rest }, title: t.title };
  };

  // ---- Crear y cambiar ----
  function openEditor(type, existing = null) {
    const isTimer = type === 'timer';
    const name = h('input', { class: 'input', maxLength: 60, value: existing?.title || '', placeholder: isTimer ? 'Por ejemplo, Anuncios' : 'Por ejemplo, Alabanza', 'aria-label': 'Nombre' });
    const total = existing?.seconds ?? 5 * 60;
    const minutes = h('input', { class: 'input time-num', type: 'number', min: 0, max: 1440, value: Math.floor(total / 60), 'aria-label': 'Minutos' });
    const seconds = h('input', { class: 'input time-num', type: 'number', min: 0, max: 59, value: total % 60, 'aria-label': 'Segundos' });
    const sound = h('input', { type: 'checkbox', checked: existing ? existing.sound : true });
    const save = guard(async () => {
      const secs = Number(minutes.value || 0) * 60 + Number(seconds.value || 0);
      const { id } = await action('time.save', { id: existing?.id, type, title: name.value, seconds: secs, sound: sound.checked });
      box.close();
      chosen = id;
      toast(existing ? 'Cambios guardados.' : `${isTimer ? 'Temporizador' : 'Cronómetro'} creado.`);
      render();
    });
    const box = dialog(existing ? 'Cambiar' : isTimer ? 'Nuevo temporizador' : 'Nuevo cronómetro',
      h('div', { class: 'time-form' },
        h('label', { class: 'time-field' }, h('span', {}, 'Nombre'), name),
        isTimer && h('label', { class: 'time-field' }, h('span', {}, 'Dura'),
          h('span', { class: 'row time-span' }, minutes, h('span', {}, 'min'), seconds, h('span', {}, 's'))),
        isTimer && h('label', { class: 'row time-sound' }, sound, h('span', {}, 'Tictac en los últimos 10 segundos y una alarma suave al final')),
        !isTimer && h('p', { class: 'muted' }, 'Cuenta hacia arriba desde cero.')),
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: save }, 'Guardar')));
    name.focus();
  }
  const confirmRemove = (t) => {
    const box = dialog('Eliminar',
      h('p', {}, `«${t.title}» se quitará de la lista. Si está en el orden del culto o en una capa, dejará de verse.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('time.remove', { id: t.id });
          box.close();
        }) }, 'Eliminar')));
  };

  // ---- Lista ----
  const list = h('div', { class: 'time-list' });
  const rows = new Map(); // id -> { el, digits, toggle }
  const onAir = () => (state.projection?.mode === 'live' && state.projection.item?.kind === 'clock' ? state.projection.item.id || HORA : null);
  function row(id) {
    const t = id === HORA ? null : timers().find((x) => x.id === id);
    const digits = h('strong', { class: 'time-digits' });
    const toggle = t && h('button', { class: 'icon-btn time-play', onclick: guard(() => action(t.clock.playing ? 'time.pause' : 'time.start', { id })) });
    const el = h('div', { class: 'time-row', dataset: { id } },
      h('button', { class: 'time-pick', 'aria-pressed': id === chosen, onclick: () => { chosen = id; render(); }, ondblclick: () => { chosen = id; render(); project(); } },
        h('span', { class: 'kind k-clock' }, icon(id === HORA ? 'clock' : t.type === 'timer' ? 'hourglass-medium' : 'timer', 16)),
        h('span', { class: 'item-text' }, h('strong', {}, id === HORA ? 'Hora' : t.title),
          h('small', {}, id === HORA ? 'La del equipo principal' : t.type === 'timer' ? 'Temporizador' : 'Cronómetro', h('span', { class: 'badge live' }, 'Al aire'))),
        digits),
      toggle,
      t && h('button', { class: 'icon-btn sm', title: 'Volver al principio', 'aria-label': `Volver al principio: ${t.title}`, onclick: guard(() => action('time.reset', { id })) }, icon('arrow-counter-clockwise', 16)),
      t && ctx.canEdit && h('button', { class: 'icon-btn sm', 'aria-label': `Opciones de ${t.title}`, onclick: (e) => menu(e.currentTarget, [
        { label: 'Cambiar', icon: 'pencil-simple', onclick: () => openEditor(t.type, t) },
        '-',
        { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(t) },
      ]) }, icon('dots-three', 16)));
    return { el, digits, toggle };
  }
  function renderList() {
    if (chosen !== HORA && !timer()) chosen = HORA; // lo eliminaron
    rows.clear();
    const ids = [HORA, ...timers().map((t) => t.id)];
    for (const id of ids) rows.set(id, row(id));
    list.replaceChildren(...[...rows.values()].map((r) => r.el),
      ...(timers().length ? [] : [h('p', { class: 'muted time-empty' }, ctx.canEdit ? 'Con «Nuevo» creas un temporizador (cuenta atrás, con su título) o un cronómetro.' : 'Aún no hay cronómetros ni temporizadores.')]));
    tickList();
  }
  // La cuenta de cada fila, y el estado de sus botones.
  function tickList() {
    const air = onAir();
    for (const [id, r] of rows) {
      const t = id === HORA ? null : timers().find((x) => x.id === id);
      const now = readout(id === HORA ? { type: 'hora', format: lookOf(HORA).format } : { type: t?.type }, t);
      r.digits.textContent = now.suffix ? `${now.text} ${now.suffix}` : now.text;
      r.el.classList.toggle('selected', id === chosen);
      r.el.classList.toggle('live', id === air);
      r.el.querySelector('.time-pick').setAttribute('aria-pressed', String(id === chosen));
      if (r.toggle) {
        const playing = Boolean(t?.clock.playing) && !now.done;
        r.toggle.replaceChildren(icon(playing ? 'pause' : 'play', 16));
        r.toggle.setAttribute('aria-label', `${playing ? 'Pausar' : 'Empezar'}: ${t.title}`);
        r.toggle.title = playing ? 'Pausar' : 'Empezar';
      }
    }
  }

  // ---- Cómo se ve ----
  const screen = h('div', { class: 'time-preview' });
  const preview = createStage(screen);
  const chips = (pairs, key, label) => h('div', { class: 'time-chips', role: 'radiogroup', 'aria-label': label },
    ...pairs.map(([value, text]) => h('button', { class: 'chip', type: 'button', role: 'radio', dataset: { key, value }, onclick: () => setLook({ [key]: value }) }, text)));
  const styles = chips(Object.entries(STYLE_NAMES), 'style', 'Estilo');
  const sizes = chips(SIZES, 'size', 'Tamaño');
  const looks = chips(LOOKS, 'look', 'Aspecto');
  const formats = chips(FORMATS, 'format', 'Formato de la hora');
  const places = h('div', { class: 'time-places', role: 'radiogroup', 'aria-label': 'Dónde' },
    ...PLACES.map(([value, text]) => h('button', { class: 'time-place', type: 'button', role: 'radio', title: text, 'aria-label': text, dataset: { key: 'place', value }, onclick: () => setLook({ place: value }) })));
  const formatRow = h('div', { class: 'time-option' }, h('span', {}, 'Formato'), formats);
  const lookPanel = h('div', { class: 'time-look' }, screen,
    h('div', { class: 'time-option' }, h('span', {}, 'Estilo'), styles),
    h('div', { class: 'time-option' }, h('span', {}, 'Tamaño'), sizes),
    h('div', { class: 'time-option' }, h('span', {}, 'Dónde'), places),
    h('div', { class: 'time-option' }, h('span', {}, 'Aspecto'), looks),
    formatRow);
  function paintLook() {
    const look = lookOf(chosen);
    for (const b of lookPanel.querySelectorAll('[role=radio]')) {
      const on = look[b.dataset.key] === b.dataset.value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
    formatRow.hidden = chosen !== HORA;
    const it = what();
    if (it && state.projection?.styles) {
      const t = timer();
      preview.render({ mode: 'live', item: { kind: 'clock', uid: 0, ...it.data, type: t?.type ?? 'hora', title: it.title }, styles: state.projection.styles });
    }
    name.textContent = it?.title || '';
  }

  // ---- Acciones ----
  const project = guard(async () => {
    const it = what();
    if (it) await action('projection.show', { kind: it.kind, data: it.data });
  });
  const name = h('span', { class: 'sel-ref' });
  const bar = h('div', { class: 'abar time-bar' }, name,
    h('button', { class: 'btn', onclick: guard(async () => {
      const it = what();
      if (!it) return;
      await action('order.add', { kind: it.kind, data: it.data });
      toast(`«${it.title}» añadido al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    layerButton(what),
    h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵')));
  const fresh = h('button', { class: 'btn', onclick: (e) => menu(e.currentTarget, [
    { label: 'Temporizador', icon: 'hourglass-medium', note: 'cuenta atrás', onclick: () => openEditor('timer') },
    { label: 'Cronómetro', icon: 'timer', note: 'cuenta hacia arriba', onclick: () => openEditor('stopwatch') },
  ]) }, icon('plus', 16), 'Nuevo');
  el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Tiempo'), h('span', { class: 'spacer' }), ctx.canEdit && fresh),
    h('div', { class: 'time-body' }, list, lookPanel), bar);

  function render() {
    renderList();
    paintLook();
  }
  // La cuenta de la lista se pinta dos veces por segundo mientras el cajón está a la vista.
  setInterval(() => { if (el.isConnected && el.offsetParent) tickList(); }, 500);
  subscribe('time', render);
  subscribe('projection', (p) => { tickList(); if (p.styles) paintLook(); });

  return {
    onShow: render,
    keys(e) {
      if (e.key !== 'Enter') return false;
      project();
      return true;
    },
  };
}

export default { id: 'tiempo', name: 'Tiempo', icon: 'timer', mount };
