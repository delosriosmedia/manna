import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatTime } from '../../core/playback.js';

// «Escuchar antes de añadir»: un himno o un medio suena solo en este dispositivo, desde su principio, sin pasar
// por la proyección ni por el reloj compartido: lo que está al aire no se entera. Una escucha a la vez, en una
// barra arriba que se cierra con su ×, al cerrar el cajón o al empezar otra. No se ofrece en el equipo
// principal (sonaría por los parlantes de la iglesia).
export function createPreview() {
  const media = h('audio', { preload: 'auto' });
  const title = h('strong', {});
  const time = h('small', { class: 'pv-time' });
  const seek = h('input', { class: 'pv-seek', type: 'range', min: 0, max: 1, step: 0.01, value: 0, 'aria-label': 'Punto de la escucha',
    oninput: () => { if (Number.isFinite(media.duration)) media.currentTime = Number(seek.value) * media.duration; } });
  const toggle = h('button', { class: 'icon-btn pv-toggle', onclick: () => (media.paused ? media.play().catch(() => {}) : media.pause()) });
  const bar = h('div', { class: 'preview-bar glass', role: 'region', 'aria-label': 'Escuchando en este dispositivo', hidden: true },
    icon('speaker-high', 18), h('div', { class: 'pv-text' }, h('small', {}, 'Solo en este dispositivo'), title),
    toggle, seek, time, h('button', { class: 'icon-btn pv-close', 'aria-label': 'Dejar de escuchar', onclick: () => stop() }, icon('x', 16)), media);

  const paint = () => {
    toggle.replaceChildren(icon(media.paused ? 'play' : 'pause', 18));
    toggle.setAttribute('aria-label', media.paused ? 'Seguir escuchando' : 'Pausar la escucha');
    const d = Number.isFinite(media.duration) ? media.duration : 0;
    seek.value = d ? media.currentTime / d : 0;
    time.textContent = d ? `${formatTime(media.currentTime)} / ${formatTime(d)}` : '';
  };
  for (const ev of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended']) media.addEventListener(ev, paint);

  function play({ url, title: name }) {
    if (!url) return;
    title.textContent = name;
    if (media.getAttribute('src') !== url) media.src = url;
    media.currentTime = 0;
    bar.hidden = false;
    // Se llama desde un toque: el navegador deja sonar.
    media.play().catch(() => {});
    paint();
  }
  function stop() {
    media.pause();
    media.removeAttribute('src');
    media.load();
    bar.hidden = true;
  }
  return { bar, play, stop };
}
