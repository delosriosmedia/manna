import { HttpError } from './router.js';

// Reloj de reproducción compartido. El servidor no reproduce nada: solo guarda en qué punto
// iba y desde cuándo corre. Cada pantalla calcula la posición con eso (ver web/core/playback.js),
// así que todas van a la par y la barra de avance no necesita mensajes continuos.
//
//   { playing, position, at, duration }
//   position  segundos en el instante `at`
//   at        milisegundos del reloj del servidor
//   duration  segundos, o null si no tiene final (un cronómetro)

export function createClock({ duration = null, now = Date.now() } = {}) {
  return { playing: false, position: 0, at: now, duration: duration > 0 ? duration : null };
}

// En qué segundo va en el instante `now`. Al llegar al final se queda ahí.
export function positionAt(clock, now = Date.now()) {
  if (!clock) return 0;
  const raw = clock.position + (clock.playing ? Math.max(0, now - clock.at) / 1000 : 0);
  return clock.duration == null ? raw : Math.min(raw, clock.duration);
}

export const hasEnded = (clock, now = Date.now()) => clock?.duration != null && positionAt(clock, now) >= clock.duration;

// Aplica una orden al reloj: { playing?, position?, restart? }. Lo que no venga, no cambia.
export function applyClock(clock, patch, now = Date.now()) {
  let position = positionAt(clock, now);
  let playing = clock.playing && !hasEnded(clock, now);
  if (patch.restart) position = 0;
  if (patch.position !== undefined) {
    if (!Number.isFinite(patch.position) || patch.position < 0) throw new HttpError(400, 'Ese punto de la reproducción no es válido.');
    position = clock.duration == null ? patch.position : Math.min(patch.position, clock.duration);
  }
  if (patch.playing !== undefined) {
    playing = Boolean(patch.playing);
    // "Reproducir" con el final alcanzado vuelve a empezar.
    if (playing && clock.duration != null && position >= clock.duration) position = 0;
  }
  return { ...clock, playing, position, at: now };
}

// Tras un reinicio del servidor: se queda en pausa donde iba cuando se guardó (`savedAt`),
// en vez de dar por reproducido el tiempo que estuvo apagado.
export function freezeClock(clock, savedAt) {
  if (!clock) return createClock();
  return { ...clock, playing: false, position: positionAt(clock, savedAt), at: savedAt };
}
