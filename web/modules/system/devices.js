import { action, api, state } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import qrcode from '../../vendor/qrcode.mjs';

function qr(text) {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const box = h('div', { class: 'qr' });
  box.innerHTML = code.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  return box;
}

// Ventana "Dispositivos": dirección y QR para conectar celulares y otros equipos, y el PIN.
export async function openDevicesDialog(isLocal) {
  const { addresses } = state.system;
  const body = [];

  if (!addresses.length) {
    body.push(h('p', { class: 'empty' }, 'Este equipo no está conectado a ninguna red. Conéctalo a la wifi o al cable para que otros dispositivos puedan entrar.'));
  } else {
    body.push(h('p', { class: 'muted', style: 'margin-top: 0;' }, 'Con el dispositivo en la misma red, escanea el código o escribe la dirección en el navegador:'));
    for (const url of addresses) body.push(h('div', { class: 'device' }, qr(url), h('code', {}, url)));
  }

  if (isLocal) {
    const { pin } = await api('/api/system/pin');
    const input = h('input', { class: 'input', inputMode: 'numeric', maxLength: 8, value: pin, 'aria-label': 'PIN' });
    body.push(
      h('div', { class: 'label', style: 'margin-top: 16px;' }, 'PIN para las funciones de control'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn', onclick: guard(async () => {
        await action('system.setPin', { pin: input.value.trim() });
        toast('PIN cambiado. Los demás dispositivos deberán escribir el nuevo.');
      }) }, 'Cambiar')),
      h('p', { class: 'muted' }, 'La pantalla de proyección no pide PIN. Este equipo tampoco.'),
    );
  } else {
    body.push(h('p', { class: 'muted' }, 'El PIN solo se puede ver y cambiar desde el equipo principal.'));
  }
  dialog('Conectar dispositivos', ...body);
}
