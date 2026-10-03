import { onConnection, reconnect } from './api.js';
import { h } from './dom.js';

const SHOW_AFTER_MS = 1500;   // un corte de un instante no merece aviso
const EXPLAIN_AFTER_MS = 10_000;

// Aviso de conexión perdida para las páginas de control. La reconexión es automática;
// si tarda, explica qué revisar. No se usa en la pantalla de proyección: ahí se mantiene
// lo último que se mostró, sin mensajes a la vista del público.
export function mountConnectionBar() {
  const detail = h('span', {});
  const bar = h('div', { class: 'offline-bar', role: 'alert', hidden: true },
    h('strong', {}, 'Sin conexión con el equipo principal. '),
    detail,
    h('button', { class: 'btn', onclick: reconnect }, 'Reintentar'));
  document.body.prepend(bar);

  let timers = [];
  onConnection((online) => {
    timers.forEach(clearTimeout);
    timers = [];
    document.body.classList.toggle('offline', !online);
    if (online) {
      bar.hidden = true;
      return;
    }
    timers.push(setTimeout(() => {
      detail.textContent = 'Reconectando…';
      bar.hidden = false;
    }, SHOW_AFTER_MS));
    timers.push(setTimeout(() => {
      detail.textContent = 'Comprueba que este dispositivo sigue en la wifi de la iglesia y que Manna está abierto en el equipo principal. '
        + 'Si el router se reinició, la dirección pudo cambiar: vuelve a escanear el código QR (botón "Dispositivos" del equipo principal).';
    }, EXPLAIN_AFTER_MS));
  });
}
