import { positionAt } from '../../core/playback.js';

// Lleva un <video> o un <audio> a la par con el reloj de reproducción del servidor. Todas las
// pantallas hacen lo mismo con el mismo reloj, así que van juntas sin hablarse entre ellas.
//
//   const player = createPlayer(elemento, { onDuration, onAudible });
//   player.load(url);  player.apply(reloj, { volume, sound });  player.stop();  player.release();
//
// El sonido nunca se corta de golpe: al pausar, al ocultarse o al cambiar de contenido se
// desvanece en un instante (FADE_MS). La interfaz no espera a eso: reacciona enseguida.
//
// onDuration(segundos): cuánto dura, cuando el navegador lo sabe.
// onAudible(false | true): el navegador no deja sonar a esta página (aún nadie la ha tocado), o ya sí.
const SEEK_OVER = 0.45;   // con más desfase que esto se salta al punto
const NUDGE_OVER = 0.07;  // con menos no se toca; entre medias se acelera o frena un poco
const EVERY_MS = 400;
export const FADE_MS = 300;

// Donde terminan de desvanecerse los reproductores que ya no están en pantalla. Tienen que seguir
// dentro de la página: un <video> que se saca de ella se detiene en seco.
let holder = null;
function park(media) {
  if (!holder) {
    holder = document.createElement('div');
    holder.hidden = true;
    document.body.append(holder);
  }
  holder.append(media);
}

export function createPlayer(media, { onDuration = () => {}, onAudible = () => {} } = {}) {
  let clock = null;
  let sound = false;
  let volume = 1;
  let timer = null;
  let fade = null;     // desvanecido en curso: { timer }
  let settled = null;  // punto en el que quedó tras desvanecerse (ver más abajo)
  // El navegador de una pestaña corriente no deja sonar hasta que alguien toca la página (la
  // ventana de proyección sí puede). Mientras tanto se reproduce en silencio, y suena en cuanto se pueda.
  let needsTouch = false;
  media.preload = 'auto';
  media.playsInline = true;
  media.muted = true;

  const audible = () => sound && !needsTouch;
  const level = () => Math.max(0, Math.min(1, volume));

  function cancelFade() {
    if (!fade) return;
    clearInterval(fade.timer);
    fade = null;
  }
  // Baja el volumen hasta cero y entonces llama a then(). Si no está sonando, es inmediato.
  function fadeOut(then) {
    cancelFade();
    if (media.paused || media.muted || media.volume === 0) { then(false); return; }
    const from = media.volume;
    const start = performance.now();
    const step = () => {
      const done = (performance.now() - start) / FADE_MS;
      media.volume = Math.max(0, from * (1 - done));
      if (done < 1) return;
      cancelFade();
      then(true);
    };
    fade = { timer: setInterval(step, 16) };
  }

  function start() {
    media.muted = !audible();
    media.play().catch((err) => {
      if (err?.name !== 'NotAllowedError' || media.muted) return;
      // No dejó sonar: se sigue en silencio, para que la imagen no se quede parada, y se avisa
      // para que suene otra pantalla del equipo.
      needsTouch = true;
      onAudible(false);
      media.muted = true;
      media.play().catch(() => {});
    });
  }

  function sync() {
    if (!clock || !media.getAttribute('src')) return;
    if (needsTouch && navigator.userActivation?.hasBeenActive) {
      needsTouch = false;
      onAudible(true);
    }
    const target = positionAt(clock);
    const ended = clock.duration != null && target >= clock.duration;
    const shouldPlay = clock.playing && !ended;
    const ready = media.readyState >= 1 && !media.seeking;
    const drift = media.currentTime - target;

    if (shouldPlay) {
      cancelFade();
      settled = null;
      media.volume = level();
      if (!media.paused) media.muted = !audible();
      if (ready) {
        if (Math.abs(drift) > SEEK_OVER) {
          media.currentTime = target;
          media.playbackRate = 1;
        } else media.playbackRate = Math.abs(drift) < NUDGE_OVER ? 1 : drift > 0 ? 0.95 : 1.05;
      }
      if (media.paused) start();
      return;
    }

    // Tiene que estar parado.
    if (!media.paused) {
      if (!fade) {
        fadeOut((faded) => {
          media.pause();
          media.volume = level();
          media.playbackRate = 1;
          // Mientras se desvanecía siguió un instante más allá del punto de la pausa. Se deja ahí
          // (volver atrás se vería como un salto) hasta que alguien mueva la reproducción.
          settled = faded ? positionAt(clock) : null;
          if (!faded) sync();
        });
      }
      return;
    }
    if (fade) return;
    media.volume = level();
    if (!ready) return;
    if (settled != null && Math.abs(settled - target) < 0.01 && Math.abs(drift) < SEEK_OVER + FADE_MS / 1000) return;
    settled = null;
    if (Math.abs(drift) > 0.05) media.currentTime = target;
  }

  media.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(media.duration) && media.duration > 0) onDuration(media.duration);
    sync();
  });
  // Un toque en cualquier parte de la página basta para que el navegador deje sonar.
  const touched = () => { if (needsTouch) sync(); };
  document.addEventListener('pointerdown', touched, true);
  document.addEventListener('keydown', touched, true);

  function halt() {
    clearInterval(timer);
    timer = null;
    clock = null;
  }
  function forget() {
    document.removeEventListener('pointerdown', touched, true);
    document.removeEventListener('keydown', touched, true);
  }

  return {
    load(url) {
      if (media.getAttribute('src') !== url) media.src = url;
    },
    apply(next, { volume: general = 1, sound: mine = false } = {}) {
      clock = next;
      volume = general;
      sound = mine;
      sync();
      if (!timer) timer = setInterval(sync, EVERY_MS);
    },
    // Deja de reproducir (lo que había ya no está al aire), con el sonido desvaneciéndose.
    stop() {
      halt();
      fadeOut(() => {
        media.pause();
        media.volume = level();
      });
    },
    // Este reproductor ya no se va a usar: termina de sonar fuera de la pantalla y se suelta.
    release() {
      halt();
      forget();
      const sounding = !media.paused && !media.muted && media.volume > 0;
      if (sounding) park(media);
      else media.remove();
      fadeOut(() => {
        media.pause();
        media.removeAttribute('src');
        media.load();
        media.remove();
      });
    },
  };
}
