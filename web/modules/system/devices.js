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

// Lo que se escribe a mano en el navegador: sin "http://", que el navegador pone solo.
const typed = (url) => url.replace(/^http:\/\//, '');

// Ventana "Dispositivos": cómo conectar celulares y otros equipos, y el PIN.
// - Un solo código QR, con la dirección numérica recomendada (funciona en cualquier dispositivo;
//   al abrirla, la página pasa sola a la dirección con nombre si el dispositivo la entiende).
// - Para escribir a mano se ofrece la dirección con nombre ("manna.local"), más corta y estable.
// - Si el equipo tiene más de una red, las demás direcciones quedan como alternativa, plegadas.
export async function openDevicesDialog(isLocal) {
  const { addresses, nameUrl, altPort, secure } = state.system;
  const body = [];

  if (!addresses.length) {
    body.push(h('p', { class: 'empty' }, 'Este equipo no está conectado a ninguna red. Conéctalo a la wifi o al cable para que otros dispositivos puedan entrar.'));
  } else {
    const code = h('div', {});
    const address = h('code', {});
    const fallback = h('p', { class: 'muted', style: 'margin: 0; text-align: center;' });
    const show = (url) => {
      code.replaceChildren(qr(url));
      address.textContent = typed(nameUrl || url);
      fallback.replaceChildren(...(nameUrl ? ['Si no abre, escribe ', h('strong', {}, typed(url))] : []));
    };
    show(addresses[0]);

    body.push(
      h('ol', { class: 'steps' },
        h('li', {}, 'Conecta el celular o equipo a la ', h('strong', {}, 'misma red wifi'), ' que este equipo.'),
        h('li', {}, 'Escanea el código con la cámara, o escribe esta dirección en el navegador:')),
      h('div', { class: 'device' }, code, address, fallback),
    );

    // Muchos televisores no abren una dirección sin puerto (la buscan en internet) o la convierten
    // en una página segura. Manna atiende de las dos formas; aquí se dice qué escribir y qué esperar.
    body.push(h('details', { class: 'alt-addresses' },
      h('summary', {}, '¿Es un televisor?'),
      h('p', { class: 'muted' }, 'En el navegador del televisor escribe la dirección completa, con todo:'),
      h('p', {}, h('code', { style: 'user-select: all;' }, altPort ? `${addresses[0]}:${altPort}/proyeccion` : `${addresses[0]}/proyeccion`)),
      secure && h('p', { class: 'muted' }, 'Si el televisor muestra un aviso de seguridad, elige «Avanzado» y luego «Continuar»: la página es este equipo, no un sitio de internet.'),
      h('p', { class: 'muted' }, 'Con un televisor Samsung, Manna puede abrirle el navegador y escribirle la dirección: está en el módulo «Televisores».')));

    if (addresses.length > 1) {
      body.push(h('details', { class: 'alt-addresses' },
        h('summary', {}, '¿No conecta? Probar con otra dirección'),
        h('p', { class: 'muted' }, 'Este equipo está conectado a más de una red (por ejemplo, wifi y cable). Manna eligió la más probable. Si el dispositivo no logra entrar, elige otra y vuelve a escanear:'),
        h('div', { class: 'row', style: 'flex-wrap: wrap;' }, ...addresses.map((url, i) =>
          h('button', { class: 'btn', onclick: () => show(url) }, typed(url), i === 0 ? ' (recomendada)' : '')))));
    }
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
