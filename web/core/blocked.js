import { action, subscribe } from './api.js';
import { h, guard, toast } from './dom.js';
import { whenLabel } from './time.js';

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
    if (blocked.replaced) {
      el = replacedNotice(blocked, { buttons, isLocal });
      document.body.append(el);
      return;
    }
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

// Otro equipo pasó a ser el oficial de la iglesia (fase 37, decisión 63): este no funciona hasta que se vuelva a
// emparejar con un código nuevo de «Administrar la iglesia» → Equipo.
function replacedNotice(blocked, { buttons, isLocal }) {
  const code = h('input', { class: 'input', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6, autocomplete: 'off', placeholder: '6 números', 'aria-label': 'Código',
    style: 'max-width: 160px; text-align: center;', oninput: () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); } });
  return h('div', { class: 'blocked', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Este equipo ya no es el oficial',
    style: 'position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--canvas, #030406); color: var(--ink, #f1f4f8); font-family: var(--font, system-ui, sans-serif);' },
  h('div', { style: 'max-width: 520px; display: grid; gap: 14px; text-align: center;' },
    h('h2', { style: 'margin: 0; font-size: 22px;' }, 'Este equipo ya no es el oficial'),
    h('p', { style: 'margin: 0;' }, `«${blocked.by}» pasó a ser el equipo oficial de ${blocked.church}${blocked.at ? ` (${whenLabel(blocked.at)})` : ''}.`),
    h('p', { style: 'margin: 0; opacity: 0.75;' }, 'Este no funciona, para que lo preparado llegue a un solo equipo. Para volver a usarlo, pide un código en «Administrar la iglesia» → Equipo y escríbelo aquí: el otro quedará bloqueado.'),
    buttons && h('form', { class: 'row', style: 'justify-content: center; flex-wrap: wrap;', onsubmit: (e) => {
      e.preventDefault();
      guard(async () => {
        await action('cloud.pair', { code: code.value, confirm: true });
        toast('Este equipo vuelve a ser el oficial: Manna se pone en marcha.');
      })();
    } }, code, h('button', { class: 'btn primary', type: 'submit' }, 'Volver a ser el equipo oficial')),
    buttons && isLocal && h('div', { class: 'row', style: 'justify-content: center;' }, h('button', { class: 'btn danger', onclick: guard(() => action('system.shutdown')) }, 'Apagar este Manna'))));
}
