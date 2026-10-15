import { state, subscribe } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindOf } from '../../core/kinds.js';
import { createPlayer } from './player.js';

// «Escuchar aquí»: el sonido de lo que está al aire, en este dispositivo (un celular con audífonos), al mismo
// punto que las pantallas (sigue el reloj compartido). Apagado al abrir la página. No cambia el volumen general
// ni lo que suena en la iglesia: aquí suena entero y se sube o se baja con los botones del dispositivo.
// Qué archivo se oye lo dice cada tipo con `sound(item, mandos)`.
// Un solo <audio> para todo: el navegador de un celular solo deja sonar lo que se empezó con un toque, y así
// ese mismo elemento sigue con lo que venga después.
export function createListener() {
  const media = h('audio', { preload: 'auto' });
  media.hidden = true;
  document.body.append(media);
  const player = createPlayer(media);
  let on = false;
  const buttons = new Set();

  function follow() {
    const item = state.projection?.item;
    const live = state.live;
    const url = on && item && live?.uid === item.uid ? kindOf(item.kind)?.sound?.(item, live.state) : null;
    if (!url || !live.state?.clock) { player.stop(); return; }
    player.load(url);
    player.apply(live.state.clock, { volume: 1, sound: true });
  }
  function paint() {
    for (const b of buttons) {
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.replaceChildren(icon(on ? 'speaker-high' : 'speaker-x', 16), h('span', {}, on ? 'Escuchando aquí' : 'Escuchar aquí'));
    }
  }
  function toggle() {
    on = !on;
    paint();
    follow();
    // Dentro del toque: así el navegador deja sonar este elemento ahora y después.
    if (on && media.getAttribute('src') && media.paused) media.play().catch(() => {});
  }
  subscribe('projection', follow);
  subscribe('live', follow);

  return {
    // Un botón más (el del celular y el de la barra de abajo comparten el estado).
    button() {
      const b = h('button', { class: 'btn listen-btn', title: 'Oír en este dispositivo lo que suena al aire', onclick: toggle });
      buttons.add(b);
      paint();
      return b;
    },
  };
}
