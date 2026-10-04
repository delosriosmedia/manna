import { serverNow } from './api.js';

// Reloj de reproducción, lado del navegador. El servidor guarda { playing, position, at, duration }
// (ver server/core/playback.js) y cada pantalla calcula con eso en qué segundo va.
export function positionAt(clock, now = serverNow()) {
  if (!clock) return 0;
  const raw = clock.position + (clock.playing ? Math.max(0, now - clock.at) / 1000 : 0);
  return clock.duration == null ? raw : Math.min(raw, clock.duration);
}

// 75 -> "1:15", 3725 -> "1:02:05". tenths: añade las décimas (cronómetros).
export function formatTime(seconds, { tenths = false } = {}) {
  const total = Math.max(0, seconds || 0);
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n) => String(n).padStart(2, '0');
  const text = h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
  return tenths ? `${text}.${Math.floor((total - s) * 10)}` : text;
}

// Llama a fn en cada cuadro de pantalla entre start() y stop().
export function everyFrame(fn) {
  let handle = null;
  const tick = () => {
    fn();
    handle = requestAnimationFrame(tick);
  };
  return {
    start() { if (handle == null) handle = requestAnimationFrame(tick); },
    stop() { if (handle != null) cancelAnimationFrame(handle); handle = null; },
  };
}
