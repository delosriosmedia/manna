import { action, subscribe } from './api.js';
import { h, guard, toast } from './dom.js';

// Un solo Manna a la vez (fase 21): si ya funciona otro en este equipo o en la red, este no hace nada y lo dice
// en toda la pantalla, hasta que el otro se apague (entonces se reinicia solo y el aviso se va). buttons: con los
// botones («Volver a comprobar» y, en el equipo principal, «Apagar este Manna»); sin ellos, solo el aviso (la
// pantalla de proyección, que no carga los estilos de la interfaz: por eso el recuadro lleva los suyos).
export function watchBlocked({ buttons = true, isLocal = false } = {}) {
  let el = null;
  let shown = 'null';
  subscribe('system', ({ blocked }) => {
    if (JSON.stringify(blocked ?? null) === shown) return;
    shown = JSON.stringify(blocked ?? null);
    el?.remove();
    el = null;
    if (!blocked) return;
    const who = blocked.version ? `Manna ${blocked.version}` : 'otro Manna';
    el = h('div', { class: 'blocked', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Ya hay otro Manna funcionando',
      style: 'position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--canvas, #030406); color: var(--ink, #f1f4f8); font-family: var(--font, system-ui, sans-serif);' },
    h('div', { style: 'max-width: 520px; display: grid; gap: 14px; text-align: center;' },
      h('h2', { style: 'margin: 0; font-size: 22px;' }, 'Ya hay otro Manna funcionando'),
      h('p', { style: 'margin: 0;' }, !blocked.here ? `En esta red, en ${blocked.where} (${who}).`
        : isLocal ? `En este mismo equipo, en ${blocked.where} (${who}).` : `En el equipo principal hay otro Manna abierto (${who}).`),
      h('p', { style: 'margin: 0; opacity: 0.75;' }, 'Este no funciona, para no confundir a los dispositivos ni a la proyección. Usa ese, o apágalo y pulsa «Volver a comprobar»: este se pone en marcha solo en cuanto el otro se apague.'),
      buttons && h('div', { class: 'row', style: 'justify-content: center; flex-wrap: wrap;' },
        h('button', { class: 'btn primary', onclick: guard(async () => {
          toast((await action('system.recheck'))?.blocked ? 'El otro Manna sigue abierto.' : 'Ya no hay otro Manna: este se pone en marcha.');
        }) }, 'Volver a comprobar'),
        isLocal && h('button', { class: 'btn danger', onclick: guard(() => action('system.shutdown')) }, 'Apagar este Manna'))));
    document.body.append(el);
  });
}
