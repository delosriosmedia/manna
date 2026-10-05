import { action, reportSound } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { everyFrame, formatTime, positionAt } from '../../core/playback.js';
import { createSender } from '../../core/sender.js';
import { createPlayer } from './player.js';
import { createVolume } from './volume.js';

// Lo que se reproduce (un video, un audio, un himno): cómo lo dibuja una pantalla y con qué mandos
// se gobierna mientras está al aire. El servidor guarda el reloj (reproduciendo o en pausa, y en
// qué segundo) y cada pantalla lleva su reproductor a ese punto. Suena una sola pantalla; las
// demás van en silencio. Cada tipo de contenido lo usa desde su kind.js:
//
//   draw: (host) => drawClip(host, { build, make, onItem, sources }),
//   controls: clipControls,

// Lo que dibuja la pantalla.
//   build()               elementos fijos (la imagen del video, el nombre de un audio)
//   make()                crea el <video> o el <audio>; se hace uno nuevo para cada contenido,
//                         porque el anterior termina de desvanecerse por su cuenta (ver player.js)
//   onItem(item, media)   lo que haya que poner al llegar el elemento (imagen, subtítulos)
//   sources(item, state)  los archivos que esta pantalla puede reproducir, del preferido al de
//                         reserva. Por defecto, item.url. `state` son los mandos en vivo (o null).
export function drawClip(host, { build, make, onItem = () => {}, sources = (item) => [item.url] }) {
  const notice = h('div', { class: 'clip-notice', hidden: true });
  const box = h('div', { class: 'clip-view' }, ...build(), notice);
  host.replaceChildren(box);
  let item = null;
  let state = null;   // los mandos en vivo de lo que está al aire
  let media = null;
  let player = null;
  let playing = null; // el archivo que lleva el reproductor actual
  let told = false;   // la duración se dice una sola vez
  const failed = new Set(); // archivos que este navegador, al final, no pudo reproducir
  // El primero de los archivos posibles que no haya fallado aquí.
  const pick = (entry, live = state) => (entry ? sources(entry, live).filter(Boolean).find((url) => !failed.has(url)) || null : null);

  function fresh() {
    player?.release();
    told = false;
    playing = null;
    media = make();
    box.prepend(media);
    // Si el archivo preferido no se deja reproducir aquí, se pasa al de reserva.
    media.addEventListener('error', () => {
      const url = media.getAttribute('src');
      if (!url || failed.has(url)) return;
      failed.add(url);
      const next = pick(item);
      if (next) { playing = next; media.src = next; }
    });
    player = createPlayer(media, {
      onAudible: reportSound,
      // Si el servidor no sabe cuánto dura (un equipo sin ffmpeg), se lo dice la primera pantalla
      // que lo reproduce (si esta función no puede dar órdenes, otra lo hará).
      onDuration(seconds) {
        if (!item || item.duration != null || told) return;
        told = true;
        action('projection.control', { duration: seconds }).catch(() => {});
      },
    });
    if (item) onItem(item, media);
  }
  fresh();

  return {
    update(next) {
      // Otro contenido: reproductor nuevo. El de antes se desvanece y se va solo. (Que a lo mismo
      // le llegue otro archivo para otras pantallas no cambia nada aquí si ya se estaba reproduciendo.)
      const before = pick(item);
      if (before && before !== pick(next)) fresh();
      item = next;
      // En una pantalla que aún no tiene qué reproducir se ve la imagen y por qué.
      const why = next.unavailable || (pick(next) ? '' : next.waiting || '');
      notice.textContent = why;
      notice.hidden = !why;
      onItem(next, media);
    },
    // live null: esto es una vista previa o una miniatura, no lo que está al aire. No se carga nada.
    live(live, { volume = 1, sound = false } = {}) {
      state = live;
      const source = pick(item);
      box.classList.toggle('on-air', Boolean(live && source));
      if (!live || !source) {
        player.stop();
        return;
      }
      // Lo mismo, con otro archivo (un himno que pasa de cantado a pista): reproductor nuevo en el
      // mismo punto, y el sonido del anterior se desvanece.
      if (playing && playing !== source) fresh();
      playing = source;
      player.load(source);
      player.apply(live.clock, { volume, sound });
      // Se muestran los subtítulos del idioma elegido (live.subtitles), o ninguno.
      [...(media.textTracks || [])].forEach((track, i) => {
        track.mode = live.subtitles && item.subtitles?.[i]?.lang === live.subtitles ? 'showing' : 'hidden';
      });
    },
    stop: () => player.stop(),
    destroy: () => player.release(),
  };
}

// Mandos de lo que suena: reinicio, pausa, saltos, barra de avance, volumen y subtítulos.
export function clipControls(host, { send }) {
  // Mientras salen órdenes o se arrastra la barra, lo que llega del servidor es más viejo que lo que
  // se ve: se guarda y se pinta al terminar.
  const sender = createSender(send, { onIdle: () => apply() });
  let clock = null;
  let item = null;
  let subtitles = false; // idioma de los subtítulos que se muestran, o false
  let dragging = false;
  let latest = null; // lo último que dijo el servidor

  const toggle = h('button', { class: 'btn grow', onclick: () => sender.push({ playing: !(clock?.playing && !ended()) }) });
  const jump = (seconds) => () => sender.push({ position: Math.max(0, Math.min(clock?.duration ?? Infinity, positionAt(clock) + seconds)) });
  const bar = h('input', { type: 'range', min: 0, max: 1, step: 0.1, value: 0, 'aria-label': 'Avance' });
  const now = h('span', { class: 'clip-time' }, '0:00');
  const total = h('span', { class: 'clip-time' }, '');
  const captions = h('button', { class: 'btn grow', onclick: () => sender.push({ subtitles: subtitles ? false : language.value || true }) }, icon('closed-captioning', 16), 'Subtítulos');
  // Con subtítulos en más de un idioma (los de YouTube), se elige cuál.
  const language = h('select', { class: 'select', 'aria-label': 'Idioma de los subtítulos', onchange: () => sender.push({ subtitles: language.value }) });
  const captionsRow = h('div', { class: 'transport' }); // solo lleva sus mandos si el video tiene subtítulos
  let offered = ''; // qué subtítulos se están ofreciendo ahora
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
      subtitles = latest.subtitles || false;
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
    const tracks = item?.subtitles || [];
    const signature = tracks.map((track) => track.lang).join();
    if (signature !== offered) {
      offered = signature;
      language.replaceChildren(...tracks.map((track) => h('option', { value: track.lang }, track.label)));
      captionsRow.replaceChildren(...(tracks.length ? [captions, tracks.length > 1 && language].filter(Boolean) : []));
    }
    if (subtitles) language.value = subtitles;
    captions.classList.toggle('on', Boolean(subtitles));
    captions.setAttribute('aria-pressed', Boolean(subtitles));
    paint();
    if (playing) frames.start(); else frames.stop();
  }

  return {
    update(live, next) {
      item = next;
      latest = live;
      apply();
    },
    destroy() {
      frames.stop();
      volume.destroy();
    },
  };
}
