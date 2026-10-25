import { HttpError } from '../../core/router.js';
import { createClock, hasEnded, positionAt } from '../../core/playback.js';
import { cleanName } from '../../core/names.js';

// Lógica pura del módulo Tiempo (fase 32): cómo se ve un reloj y qué hace cada orden con un cronómetro o un
// temporizador. El reloj de cada uno es el de la reproducción (core/playback.js): { playing, position, at,
// duration }, en segundos; un temporizador lleva duration y al llegar a ella se queda quieto en cero.

export const STYLES = ['sencillo', 'digital', 'tarjeta', 'anillo', 'barra'];
export const SIZES = ['s', 'm', 'l'];
export const PLACES = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
export const LOOKS = ['sutil', 'normal'];
export const FORMATS = ['12', '24'];
export const TYPES = ['timer', 'stopwatch'];
export const MAX_SECONDS = 24 * 3600;
export const MAX_TITLE = 60;

// Cómo se ve cada uno si no se dice otra cosa: la hora, pequeña y sutil en una esquina; un cronómetro o un
// temporizador, grande en el centro.
export const DEFAULTS = {
  hora: { style: 'sencillo', size: 's', place: 'br', look: 'sutil', format: '12' },
  count: { style: 'tarjeta', size: 'l', place: 'mc', look: 'normal' },
};

const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);

// Lo que se guarda para localizar un reloj y cómo se ve (el data del tipo `clock`): { type: 'hora', … } o { id, … }.
export function cleanData(data) {
  const hora = data?.type === 'hora';
  const base = hora ? DEFAULTS.hora : DEFAULTS.count;
  const look = {
    style: pick(data?.style, STYLES, base.style),
    size: pick(data?.size, SIZES, base.size),
    place: pick(data?.place, PLACES, base.place),
    look: pick(data?.look, LOOKS, base.look),
  };
  if (hora) return { type: 'hora', ...look, format: pick(String(data?.format), FORMATS, base.format) };
  if (typeof data?.id !== 'string' || !data.id) throw new HttpError(400, 'Falta qué cronómetro o temporizador es.');
  return { id: data.id, ...look };
}

// 75 → "1:15"; 3725 → "1:02:05".
export function clockText(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const two = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

// Lo que escribe la persona al crear o cambiar uno. Devuelve { type, title, seconds, sound }.
export function cleanTimer({ type, title, seconds, sound }) {
  if (!TYPES.includes(type)) throw new HttpError(400, 'Elige si es un temporizador o un cronómetro.');
  const name = cleanName(title, MAX_TITLE);
  if (type === 'stopwatch') return { type, title: name || 'Cronómetro', seconds: null, sound: false };
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total < 1) throw new HttpError(400, 'Escribe cuánto dura el temporizador.');
  if (total > MAX_SECONDS) throw new HttpError(400, 'Un temporizador puede durar 24 horas como mucho.');
  return { type, title: name || `Temporizador de ${clockText(total)}`, seconds: total, sound: sound !== false };
}

export const newClock = (timer, now) => createClock({ duration: timer.type === 'timer' ? timer.seconds : null, now });

// Sumar o restar minutos (+1 / −1 en los mandos). A un temporizador le cambia lo que le queda (nunca menos de cero);
// a un cronómetro, lo que lleva. Si estaba corriendo sigue corriendo; uno que ya llegó a cero queda quieto.
export function adjustClock(clock, minutes, now) {
  if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > 60) throw new HttpError(400, 'Se suma o se resta de minuto en minuto.');
  const position = positionAt(clock, now);
  const playing = clock.playing && !hasEnded(clock, now);
  if (clock.duration == null) return { ...clock, playing, position: Math.max(0, position + minutes * 60), at: now };
  const duration = Math.min(MAX_SECONDS, Math.max(position, clock.duration + minutes * 60));
  return { ...clock, playing: playing && duration > position, position, at: now, duration };
}
