import { positionAt } from '../../core/playback.js';

// Lleva un <video> o un <audio> a la par con el reloj de reproducción del servidor. Todas las
// pantallas hacen lo mismo con el mismo reloj, así que van juntas sin hablarse entre ellas.
//
//   const player = createPlayer(elemento, { onBlocked, onDuration });
//   player.load(url);  player.apply(reloj, { volume, sound });  player.stop();
//
// onBlocked(reanudar | null): el navegador no deja sonar sin que alguien toque la página
//   (una pestaña corriente; la ventana de proyección sí puede). `reanudar` es lo que hay que llamar
//   desde ese toque; null cuando ya suena.
// onDuration(segundos): cuánto dura, cuando el navegador lo sabe.
const SEEK_OVER = 0.45;   // con más desfase que esto se salta al punto
const NUDGE_OVER = 0.07;  // con menos no se toca; entre medias se acelera o frena un poco
const EVERY_MS = 400;

export function createPlayer(media, { onBlocked = () => {}, onDuration = () => {} } = {}) {
  let clock = null;
  let sound = false;
  let volume = 1;
  let timer = null;
  media.preload = 'auto';
  media.playsInline = true;
  media.muted = true;

  function sync() {
    if (!clock || !media.getAttribute('src')) return;
    media.muted = !sound;
    media.volume = Math.max(0, Math.min(1, volume));
    const target = positionAt(clock);
    const ended = clock.duration != null && target >= clock.duration;
    const shouldPlay = clock.playing && !ended;
    if (media.readyState >= 1 && !media.seeking) {
      const drift = media.currentTime - target;
      if (!shouldPlay || Math.abs(drift) > SEEK_OVER) {
        if (Math.abs(drift) > 0.05) media.currentTime = target;
        media.playbackRate = 1;
      } else {
        media.playbackRate = Math.abs(drift) < NUDGE_OVER ? 1 : drift > 0 ? 0.95 : 1.05;
      }
    }
    if (shouldPlay && media.paused) {
      media.play().then(() => onBlocked(null), (err) => {
        // Sin sonido el navegador siempre deja; con sonido puede pedir un toque.
        if (err?.name === 'NotAllowedError' && sound) onBlocked(() => media.play().then(() => onBlocked(null), () => {}));
      });
    } else if (!shouldPlay && !media.paused) media.pause();
  }
  media.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(media.duration) && media.duration > 0) onDuration(media.duration);
    sync();
  });

  return {
    load(url) {
      if (media.getAttribute('src') !== url) media.src = url;
    },
    apply(next, { volume: level = 1, sound: audible = false } = {}) {
      clock = next;
      volume = level;
      sound = audible;
      sync();
      if (!timer) timer = setInterval(sync, EVERY_MS);
    },
    stop() {
      clearInterval(timer);
      timer = null;
      clock = null;
      media.pause();
      onBlocked(null);
    },
    destroy() {
      this.stop();
      media.removeAttribute('src');
      media.load();
    },
  };
}
