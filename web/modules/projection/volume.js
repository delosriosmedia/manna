import { action, state, subscribe } from '../../core/api.js';
import { h, guard } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createSender } from '../../core/sender.js';

// Volumen general de Manna: uno solo para todo lo que suene. No toca el volumen del equipo.
// Lo muestran los mandos de lo que tiene sonido (videos, audios, himnos).
// Devuelve { el, destroy() }.
export function createVolume() {
  const sender = createSender(guard((patch) => action('projection.volume', patch)), { onIdle: () => { if (document.activeElement !== slider) paint(state.live?.volume ?? 1); } });
  let before = 1; // a qué volumen se vuelve al quitar el silencio
  const slider = h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Volumen de Manna' });
  const amount = h('strong', { class: 'vol-amount' });
  const mute = h('button', { class: 'icon-btn', 'aria-label': 'Silenciar', onclick: () => {
    const now = Number(slider.value) / 100;
    if (now > 0) before = now;
    set(now > 0 ? 0 : before || 1);
  } });
  const nobody = h('p', { class: 'muted vol-nobody', hidden: true }, 'Ahora mismo no suena en ningún sitio: el sonido sale por la pantalla de proyección abierta en el equipo principal.');
  const el = h('div', { class: 'volume' }, h('div', { class: 'transport' }, mute, slider, amount), nobody);

  function paint(volume) {
    slider.value = Math.round(volume * 100);
    amount.textContent = `${Math.round(volume * 100)} %`;
    mute.replaceChildren(icon(volume === 0 ? 'speaker-x' : volume < 0.5 ? 'speaker-low' : 'speaker-high', 18));
    mute.setAttribute('aria-label', volume === 0 ? 'Quitar el silencio' : 'Silenciar');
  }
  function set(volume) {
    paint(volume);
    sender.push({ volume });
  }
  slider.addEventListener('input', () => set(Number(slider.value) / 100));

  const stops = [
    // Mientras la persona mueve el deslizador, manda lo que ella hace.
    subscribe('live', ({ volume }) => { if (!sender.busy && document.activeElement !== slider) paint(volume ?? 1); }),
    subscribe('conexiones', ({ sonido }) => { nobody.hidden = Boolean(sonido); }),
  ];
  paint(state.live?.volume ?? 1);
  return { el, destroy: () => stops.forEach((stop) => stop()) };
}
