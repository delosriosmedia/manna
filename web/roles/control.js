import { action, connect, onConnection, state, subscribe } from '../core/api.js';
import { $, h, guard, toast } from '../core/dom.js';
import { ensureRole } from '../core/session.js';
import { createBibleBrowser } from '../modules/bible/browser.js';
import { createStage } from '../modules/projection/stage.js';
import { createDisplayToggle, createModeButtons, createStylePanel, describeLive, toggleMode } from '../modules/projection/controls.js';
import { createPlaylistPanel } from '../modules/playlist/panel.js';
import { openDevicesDialog } from '../modules/system/devices.js';

// Control completo: une los módulos Biblia, Proyección, Guion y Sistema en una sola pantalla.
const me = await ensureRole('control');

// ---- Vista previa: lo seleccionado, con los estilos reales de la proyección ----
const preview = createStage($('#preview'));
let selected = null;
const renderPreview = () => {
  if (state.projection) preview.render({ mode: 'live', item: selected, styles: state.projection.styles });
};

// ---- Barra de acción bajo los versículos ----
const selLabel = h('strong', { class: 'sel-label' });
const project = guard(async (sel = selected) => {
  if (sel) await action('projection.show', { versionId: sel.versionId, ref: sel.ref });
});
const addToPlaylist = guard(async () => {
  if (!selected) return;
  await action('playlist.add', { versionId: selected.versionId, ref: selected.ref });
  toast(`Añadido al guion: ${selected.reference}`);
});

const bible = createBibleBrowser({
  navEl: $('#panel-nav'),
  versesEl: $('#verses'),
  onSelect(sel) {
    selected = sel;
    selLabel.textContent = sel ? sel.reference : '';
    renderPreview();
  },
  onProject: project,
});

$('#action-bar').append(
  h('div', { class: 'row sel-range' },
    h('button', { class: 'btn', title: 'Quitar el último versículo del rango', onclick: () => bible.extend(-1) }, '−'),
    selLabel,
    h('button', { class: 'btn', title: 'Añadir el versículo siguiente al rango', onclick: () => bible.extend(1) }, '+')),
  h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: addToPlaylist }, '+ Guion'),
    h('button', { class: 'btn live', title: 'Proyectar lo seleccionado (Enter)', onclick: () => project() }, '● Proyectar')),
);

// ---- Navegación ◀ ▶: si hay algo en vivo, avanza la proyección; si no, solo la selección ----
const step = guard(async (delta) => {
  const p = state.projection;
  if (p?.mode === 'live' && p.item && p.item.versionId === bible.versionId) {
    const item = await action('projection.step', { delta });
    if (item) await bible.goTo(item.ref);
  } else {
    await bible.move(delta);
  }
});

// ---- Barra superior ----
const connection = h('span', { class: 'pill' }, h('span', { class: 'dot' }), h('span', {}));
$('#status').append(connection);
$('#actions').append(
  h('button', { class: 'btn', title: 'Versículo anterior (←)', onclick: () => step(-1) }, '◀'),
  h('button', { class: 'btn', title: 'Versículo siguiente (→)', onclick: () => step(1) }, '▶'),
  ...createModeButtons(),
  createDisplayToggle(),
  h('button', { class: 'btn', onclick: guard(() => openDevicesDialog(me.isLocal)) }, 'Dispositivos'),
);

subscribe('conexiones', ({ porRol = {} }) => {
  const n = porRol.proyeccion || 0;
  connection.classList.toggle('ok', n > 0);
  connection.lastChild.textContent = n === 0 ? 'Ninguna pantalla conectada' : n === 1 ? '1 pantalla conectada' : `${n} pantallas conectadas`;
});

subscribe('projection', (p) => {
  const live = describeLive(p);
  const label = $('#live-label');
  label.textContent = live.live ? `● En vivo: ${live.text}` : live.text;
  label.style.color = live.live ? 'var(--live)' : '';
  bible.setLive(p.mode === 'live' ? p.item : null);
  renderPreview();
});

// ---- Panel lateral ----
createStylePanel($('#side-styles'));
createPlaylistPanel($('#side-playlist'), { editable: true, onShow: (item) => item.versionId === bible.versionId && bible.goTo(item.ref) });

$('#side-tabs').addEventListener('click', (e) => {
  const t = e.target.dataset.t;
  if (!t) return;
  $('#side-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target));
  $('#side-styles').hidden = t !== 'styles';
  $('#side-playlist').hidden = t !== 'playlist';
});

// ---- Pestañas inferiores (celular) ----
const bottomTabs = $('#bottom-tabs');
const showTab = (tab) => {
  document.body.dataset.tab = tab;
  bottomTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
};
bottomTabs.addEventListener('click', (e) => e.target.dataset.tab && showTab(e.target.dataset.tab));
showTab('verses');

// ---- Atajos de teclado ----
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches('input, select, textarea')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const keys = {
    ArrowRight: () => step(1), PageDown: () => step(1), ArrowDown: () => step(1),
    ArrowLeft: () => step(-1), PageUp: () => step(-1), ArrowUp: () => step(-1),
    Enter: () => project(),
    b: () => toggleMode('black'), B: () => toggleMode('black'),
    c: () => toggleMode('clear'), C: () => toggleMode('clear'),
    '/': () => bible.focusSearch(),
  };
  if (keys[e.key] && !document.querySelector('.modal-backdrop')) {
    e.preventDefault();
    keys[e.key]();
  }
});

onConnection((online) => document.body.classList.toggle('offline', !online));
connect('control');
