import { action, reportSound } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { everyFrame, formatTime, positionAt } from '../../core/playback.js';
import { createSender } from '../../core/sender.js';
import { createVolume } from '../projection/volume.js';
import { createPlayer } from './player.js';

// Tipos de contenido "video" y "audio". Los dos se reproducen igual: el servidor guarda el reloj
// (reproduciendo o en pausa, y en qué segundo) y cada pantalla lleva su reproductor a ese punto.
// Suena una sola pantalla; las demás van en silencio.

// Lo que dibuja la pantalla. make() crea el <video> o el <audio>; se hace uno nuevo para cada
// contenido, porque el anterior termina de desvanecerse por su cuenta (ver player.js).
function drawClip(host, { build, make, onItem }) {
  const notice = h('div', { class: 'clip-notice', hidden: true });
  const box = h('div', { class: 'clip-view' }, ...build(), notice);
  host.replaceChildren(box);
  let item = null;
  let media = null;
  let player = null;
  let told = false; // la duración se dice una sola vez

  function fresh() {
    player?.release();
    told = false;
    media = make();
    box.prepend(media);
    player = createPlayer(media, {
      onAudible: reportSound,
      // En un equipo sin ffmpeg el servidor no sabe cuánto dura: se lo dice la primera pantalla
      // que lo reproduce (si esta función no puede dar órdenes, otra lo hará).
      onDuration(seconds) {
        if (!item || item.duration != null || told) return;
        told = true;
        action('projection.control', { duration: seconds }).catch(() => {});
      },
    });
  }
  fresh();

  return {
    update(next) {
      // Otro contenido: reproductor nuevo. El de antes se desvanece y se va solo.
      if (item?.url && item.url !== next.url) fresh();
      item = next;
      notice.textContent = next.unavailable || '';
      notice.hidden = !next.unavailable;
      onItem(next, media);
    },
    // state null: esto es una vista previa o una miniatura, no lo que está al aire. No se carga nada.
    live(state, { volume = 1, sound = false } = {}) {
      box.classList.toggle('on-air', Boolean(state && item?.url));
      if (!state || !item?.url) {
        player.stop();
        return;
      }
      player.load(item.url);
      player.apply(state.clock, { volume, sound });
      const track = media.textTracks?.[0];
      if (track) track.mode = state.subtitles ? 'showing' : 'hidden';
    },
    stop: () => player.stop(),
    destroy: () => player.release(),
  };
}

// Mandos de lo que suena: reinicio, pausa, saltos, barra de avance, subtítulos y volumen.
function clipControls(host, { send }) {
  // Mientras salen órdenes o se arrastra la barra, lo que llega del servidor es más viejo que lo que
  // se ve: se guarda y se pinta al terminar.
  const sender = createSender(send, { onIdle: () => apply() });
  let clock = null;
  let item = null;
  let subtitles = false;
  let dragging = false;
  let latest = null; // lo último que dijo el servidor

  const toggle = h('button', { class: 'btn grow', onclick: () => sender.push({ playing: !(clock?.playing && !ended()) }) });
  const jump = (seconds) => () => sender.push({ position: Math.max(0, Math.min(clock?.duration ?? Infinity, positionAt(clock) + seconds)) });
  const bar = h('input', { type: 'range', min: 0, max: 1, step: 0.1, value: 0, 'aria-label': 'Avance' });
  const now = h('span', { class: 'clip-time' }, '0:00');
  const total = h('span', { class: 'clip-time' }, '');
  const captions = h('button', { class: 'btn', onclick: () => sender.push({ subtitles: !subtitles }) }, icon('closed-captioning', 16), 'Subtítulos');
  const captionsRow = h('div', { class: 'transport' }); // solo lleva el botón si el video tiene subtítulos
  const volume = createVolume();
  host.replaceChildren(
    h('div', { class: 'transport' },
      h('button', { class: 'btn', title: 'Volver al principio', 'aria-label': 'Volver al principio', onclick: () => sender.push({ restart: true }) }, icon('arrow-counter-clockwise', 16)),
      toggle,
      h('button', { class: 'btn clip-jump', title: 'Retroceder 10 segundos', onclick: jump(-10) }, '−10'),
      h('button', { class: 'btn clip-jump', title: 'Adelantar 10 segundos', onclick: jump(10) }, '+10')),
    h('div', { class: 'transport clip-seek' }, now, bar, total),
    volume.el,
    captionsRow);

  const ended = () => clock?.duration != null && positionAt(clock) >= clock.duration;
  function paint() {
    const position = positionAt(clock);
    if (!dragging) bar.value = position;
    now.textContent = formatTime(dragging ? Number(bar.value) : position);
  }
  const frames = everyFrame(paint);
  bar.addEventListener('input', () => {
    dragging = true;
    now.textContent = formatTime(Number(bar.value));
    sender.push({ position: Number(bar.value) });
  });
  const release = () => {
    dragging = false;
    apply();
  };
  bar.addEventListener('change', release);
  bar.addEventListener('pointerup', release);

  function apply() {
    if (latest && (!clock || !(sender.busy || dragging))) {
      clock = latest.clock;
      subtitles = Boolean(latest.subtitles);
    }
    render();
  }
  function render() {
    const playing = Boolean(clock?.playing) && !ended();
    toggle.replaceChildren(icon(playing ? 'pause' : 'play', 16), playing ? 'Pausar' : ended() ? 'Otra vez' : 'Reproducir');
    const known = clock?.duration != null;
    bar.disabled = !known;
    bar.max = known ? clock.duration : 1;
    total.textContent = known ? formatTime(clock.duration) : '';
    if (Boolean(item?.subtitles) !== captions.isConnected) captionsRow.replaceChildren(...(item?.subtitles ? [captions] : []));
    captions.classList.toggle('on', subtitles);
    captions.setAttribute('aria-pressed', subtitles);
    paint();
    if (playing) frames.start(); else frames.stop();
  }

  return {
    update(state, next) {
      item = next;
      latest = state;
      apply();
    },
    destroy() {
      frames.stop();
      volume.destroy();
    },
  };
}

registerKind('video', {
  icon: 'video',
  label: 'Video',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.url || item.title,
  background: false,
  draw(host) {
    const poster = h('img', { class: 'clip-poster', alt: '', hidden: true });
    return drawClip(host, {
      build: () => [poster],
      make: () => h('video', { class: 'clip-video' }, h('track', { kind: 'subtitles', srclang: 'es', label: 'Subtítulos' })),
      onItem(item, video) {
        poster.hidden = !item.poster;
        if (item.poster && poster.getAttribute('src') !== item.poster) poster.src = item.poster;
        const track = video.querySelector('track');
        if (item.subtitles && track.getAttribute('src') !== item.subtitles) track.src = item.subtitles;
      },
    });
  },
  controls: clipControls,
});

registerKind('audio', {
  icon: 'waveform',
  label: 'Audio',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.url || item.title,
  // Se ve el fondo de la proyección, con el nombre de lo que suena.
  draw(host) {
    const title = h('div', { class: 'stage-ref' });
    return drawClip(host, {
      build: () => [h('div', { class: 'stage-inner clip-audio' }, icon('waveform', 64), title)],
      make: () => h('audio', {}),
      onItem(item) { title.textContent = item.title; },
    });
  },
  controls: clipControls,
});
