import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

// «Escuchar aquí»: el sonido de lo que está al aire, en este dispositivo (un celular con audífonos). Suena la
// propia proyección de fondo de este dispositivo, que ya va al punto de las pantallas: así el archivo baja una
// sola vez por la red, y lo que suena se sincroniza sin apuro (createStage con loose). Antes era un <audio>
// aparte con el mismo archivo: bajaba dos veces y se oía a saltos (prueba del dueño, 2026-10-16).
// Apagado al abrir la página. No cambia el volumen general ni lo que suena en la iglesia: aquí suena entero y
// se sube o se baja con los botones del dispositivo.
export function createListener(stage) {
  let on = false;
  const buttons = new Set();

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
    // Dentro del toque: el navegador deja sonar este elemento ahora.
    stage.setListen(on);
  }

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
