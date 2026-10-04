import { action, disconnect, subscribe } from '../../core/api.js';
import { h, allowLeaving, dialog, go, guard } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createDisplayToggle, createStylePanel, describeDisplay } from '../projection/controls.js';
import { openDevicesDialog } from '../system/devices.js';

// Módulo Ajustes: lo que se prepara antes de la reunión y no hace falta tener a mano durante ella.
function mount(el, ctx) {
  const styles = h('div', {});
  const displayText = h('p', { class: 'muted' });
  const screens = h('p', { class: 'muted' });
  const version = h('p', { class: 'version' });

  const section = (title, hint, ...content) => h('section', { class: 'set' },
    h('div', { class: 'set-title' }, h('h2', {}, title), hint && h('p', { class: 'muted' }, hint)),
    h('div', { class: 'set-body' }, ...content));

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Ajustes')),
    h('div', { class: 'settings' },
      section('Apariencia de la proyección', 'Los cambios se ven al instante en el monitor "Al aire" y en todas las pantallas.', styles),
      section('Proyector de este equipo', 'La ventana a pantalla completa en la segunda pantalla del equipo principal.',
        displayText, h('div', { class: 'row' }, createDisplayToggle())),
      section('Dispositivos', 'Celulares, tabletas y otros equipos de la misma red.',
        screens, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: guard(() => openDevicesDialog(ctx.isLocal)) }, icon('qr-code', 16), 'Conectar un dispositivo'))),
      section('Este dispositivo', null,
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go('/') }, icon('arrows-left-right', 16), 'Cambiar de función'))),
      ctx.isLocal && section('Apagar', 'Manna funciona sin ventana propia. Al apagarlo se cierra la proyección y los demás dispositivos se desconectan.',
        h('div', { class: 'row' }, h('button', { class: 'btn danger', onclick: askShutdown }, icon('power', 16), 'Apagar Manna'))),
      section('Acerca de', null,
        h('div', { class: 'lockup about' },
          h('img', { src: '/marca.svg', alt: '' }),
          h('p', { class: 'wordmark' }, 'MANNA'),
          h('p', { class: 'tagline' }, 'Church projection app'),
          version,
          h('a', { class: 'btn', style: 'margin-top: 14px;', href: 'https://github.com/delosriosmedia/manna', target: '_blank', rel: 'noopener' }, 'Sitio del proyecto')))));

  createStylePanel(styles);
  subscribe('system', (s) => { version.textContent = s.version ? `Versión ${s.version}` : ''; });

  subscribe('projection', ({ display }) => {
    const d = describeDisplay(display);
    displayText.textContent = d.warn
      ? 'No hay una segunda pantalla conectada. Al conectar el proyector, la ventana se abre sola.'
      : `${d.text}.`;
  });
  subscribe('conexiones', ({ porRol = {} }) => {
    const n = (role) => porRol[role] || 0;
    const controls = n('control') + n('orden');
    screens.textContent = `Conectados ahora: ${n('proyeccion')} ${n('proyeccion') === 1 ? 'pantalla' : 'pantallas'} de proyección y ${controls} ${controls === 1 ? 'control' : 'controles'}.`;
  });

  function askShutdown() {
    const box = dialog('Apagar Manna',
      h('p', {}, 'Se cerrará la proyección y los demás dispositivos se desconectarán.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('system.shutdown');
          disconnect();
          allowLeaving();
          document.title = 'Manna · Apagado';
          document.body.className = '';
          document.body.replaceChildren(h('main', { class: 'goodbye' },
            h('img', { src: '/marca.svg', alt: '', width: 96 }),
            h('h1', {}, 'Manna está apagado'),
            h('p', { class: 'muted' }, 'Ya puedes cerrar esta pestaña. Para volver a abrirlo, usa el icono Manna.')));
        }) }, 'Apagar Manna')));
  }
}

export default { id: 'ajustes', name: 'Ajustes', icon: 'gear-six', place: 'bottom', mount };
