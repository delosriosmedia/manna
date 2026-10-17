import { action, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { whenLabel } from '../../core/time.js';
import { openDevicesDialog } from './devices.js';

// Los dos botones de la barra de arriba del Control completo: la conexión por internet (un wifi con ondas) y
// el código QR para conectar dispositivos. El wifi es un dibujo propio, no del sprite: cada onda es un elemento
// aparte para poder encenderlas una tras otra mientras conecta.
const WIFI = `<svg class="wifi" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path class="w1" d="M8.75 15.25a4.6 4.6 0 0 1 6.5 0"/><path class="w2" d="M5.5 12a9.2 9.2 0 0 1 13 0"/><path class="w3" d="M2.24 8.74a13.8 13.8 0 0 1 19.52 0"/></g><circle cx="12" cy="18.5" r="1.25" fill="currentColor"/><path class="slash" d="M4.5 4.5l15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

// status del servidor -> [data-state del botón, lo que dice]
const BUTTON = {
  off: ['off', 'Conexión por internet apagada'],
  starting: ['connecting', 'Conectando por internet…'],
  checking: ['connecting', 'Comprobando la conexión…'],
  on: ['on', 'Conectado por internet'],
  unchecked: ['unchecked', 'Conectado, sin comprobar la dirección'],
  error: ['error', 'Conexión por internet con un problema'],
  busy: ['error', 'La usa otro equipo'],
};

// «Encendida» solo cuando Manna entró por su dirección de internet y se contestó a sí mismo (lo comprueba cada minuto).
const NET = {
  off: 'Apagada.',
  starting: 'Conectando con Cloudflare…',
  checking: 'Conectada con Cloudflare. Comprobando que se llega a Manna desde internet…',
  on: 'Encendida y comprobada desde internet. Se entra por esta dirección:',
  unchecked: 'Conectada con Cloudflare, sin comprobar: falta la dirección del dominio propio («Cambiar el dominio propio»).',
  busy: 'Esta conexión ya la está usando otro equipo con Manna. Este no se conecta, para no cortar a quien entra desde fuera, y se conectará solo cuando el otro la suelte.',
};

// El estado dicho con frases. Mientras reintenta, el último problema sigue a la vista.
export const netText = (s) => (s.status === 'error' ? s.error
  : [NET[s.status], s.status === 'busy' && s.busy && `(El otro tiene Manna ${s.busy}.)`, s.error && `Último intento: ${s.error}`].filter(Boolean).join(' '));

export function createInternetButton(ctx) {
  const button = h('button', { class: 'tool-btn tool-wifi', 'aria-haspopup': 'dialog', onclick: () => openInternetDialog(ctx) });
  button.innerHTML = WIFI;
  const paint = (s) => {
    const [st, label] = BUTTON[s.status] || BUTTON.error;
    button.dataset.state = st;
    if (s.status === 'busy') button.dataset.why = 'busy';
    else delete button.dataset.why;
    button.setAttribute('aria-label', label);
    button.title = label;
  };
  paint({ status: 'off' });
  subscribe('internet', paint);
  return button;
}

export const createDevicesButton = (isLocal) => h('button', {
  class: 'tool-btn tool-qr', 'aria-label': 'Conectar dispositivos', title: 'Conectar dispositivos', 'aria-haspopup': 'dialog',
  onclick: guard(() => openDevicesDialog(isLocal)),
}, icon('qr-mini', 20));

// La barra de arriba del Control completo: ambos en una píldora. A quien entra por internet no se le ofrece el wifi:
// apagarlo le cortaría a él mismo.
export const connectionTools = (me) => (ctx) => h('div', { class: 'topbar-tools glass', role: 'group', 'aria-label': 'Conexión' },
  !me.internet && createInternetButton(ctx), createDevicesButton(me.isLocal));

// La hoja del wifi: el estado en detalle, la dirección y encender o apagar. Se repinta mientras esté abierta.
function openInternetDialog(ctx) {
  const text = h('p', { class: 'net-text' });
  const link = h('a', { target: '_blank', rel: 'noopener' });
  const address = h('p', { class: 'net-address', hidden: true }, link,
    h('button', { class: 'btn', onclick: guard(async () => {
      await navigator.clipboard.writeText(link.href);
      toast('Dirección copiada.');
    }) }, icon('copy', 15), 'Copiar'));
  const since = h('p', { class: 'muted', hidden: true });
  const toggle = h('button', { class: 'btn', onclick: guard(async () => {
    const on = !state.internet?.on;
    await action('internet.set', { on });
    toast(on ? 'Conectando por internet…' : 'Conexión por internet apagada.');
  }) });
  const box = dialog('Conexión por internet', text, address, since,
    h('div', { class: 'row net-actions' },
      ctx.isLocal ? toggle : h('p', { class: 'muted' }, 'Solo se cambia desde el equipo principal.'),
      h('button', { class: 'btn', onclick: () => { box.close(); ctx.go('ajustes'); } }, icon('gear-six', 15), 'Más opciones en Ajustes')));
  const off = subscribe('internet', (s) => {
    if (!box.el.isConnected) return off();
    text.textContent = netText(s);
    text.classList.toggle('warn', Boolean(s.error));
    address.hidden = !(s.status === 'on' && s.url);
    if (s.url) {
      link.href = s.url;
      link.textContent = s.url;
    }
    since.hidden = !(s.status === 'on' && s.since);
    if (s.since) since.textContent = `Comprobada desde ${whenLabel(s.since)}.`;
    toggle.replaceChildren(icon('power', 15), s.on ? 'Apagar' : 'Encender');
  });
}
