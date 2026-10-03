import { action, connect, subscribe } from '../core/api.js';
import { mountConnectionBar } from '../core/connection.js';
import { $, h, confirmBeforeClose, guard } from '../core/dom.js';
import { ensureRole } from '../core/session.js';
import { createModeButtons, describeLive } from '../modules/projection/controls.js';
import { createPlaylistPanel } from '../modules/playlist/panel.js';

// Control del guion: pensado para el celular. Solo proyecta los pasajes ya guardados.
await ensureRole('guion');

createPlaylistPanel($('#list'));

const step = (delta) => guard(() => action('projection.step', { delta }));
const modeButtons = createModeButtons();
modeButtons.forEach((b) => b.classList.add('big'));
$('#bar').append(
  h('button', { class: 'btn big', 'aria-label': 'Versículo anterior', onclick: step(-1) }, '◀'),
  h('button', { class: 'btn big', 'aria-label': 'Versículo siguiente', onclick: step(1) }, '▶'),
  ...modeButtons,
);

subscribe('projection', (p) => {
  const live = describeLive(p);
  $('#live').textContent = live.live ? `● ${live.text}` : live.text;
  $('#live').style.color = live.live ? 'var(--live)' : 'var(--muted)';
});

mountConnectionBar();
confirmBeforeClose();
connect('guion');
