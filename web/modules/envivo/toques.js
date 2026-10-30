import { watchActions } from '../../core/api.js';
import { toast } from '../../core/dom.js';

// Un toque accidental no hace nada, y siempre se sabe si llegó (DESIGN.md 12 ter, reglas 2 y 5). Se mira en una sola
// puerta, al pasar el toque hacia los botones, en lugar de en cada uno.
const MOVED = 8;        // px: el dedo se movió, no era un toque
const LONG = 800;       // ms: un toque más largo no activa
const SCROLLED = 300;   // ms: la lista se acaba de mover
const CALM = 1500;      // ms: ni la lista ni los mandos se mueven tras soltar el dedo
const AIR_CHANGED = 300;// ms: los mandos ignoran toques tras cambiar lo que está al aire
const ROTATED = 400;    // ms sin toques tras girar el dispositivo
const SLOW = 300;       // ms: una rayita de espera dentro del botón
const LOST = 2000;      // ms: «Manna no ha contestado»

export function guardTouches(root, { list, controls, cover }) {
  const fingers = new Set();
  let start = null;     // { x, y, at }: dónde empezó el toque
  let spoiled = false;  // ya no es un toque (se movió, o hay otro dedo)
  let scrolledAt = -Infinity;
  let deafUntil = 0;
  let deafControlsUntil = 0;
  let onZone = 0;       // dedos sobre la lista o los mandos
  let calmAt = 0;
  let pressed = null;
  let lastButton = null;
  let pressedAt = -Infinity;
  const waiting = new Map(); // lo que espera a que el dedo se aparte
  let timer = null;

  const now = () => performance.now();
  const inZone = (el) => list.contains(el) || controls.contains(el);
  const unpress = () => { pressed?.classList.remove('pressed'); pressed = null; };

  root.addEventListener('pointerdown', (e) => {
    fingers.add(e.pointerId);
    if (inZone(e.target)) onZone += 1;
    if (fingers.size > 1) {
      spoiled = true;
      unpress();
      return;
    }
    start = { x: e.clientX, y: e.clientY, at: now() };
    spoiled = false;
    pressed = e.target.closest('button');
    pressed?.classList.add('pressed'); // en el primer cuadro: :active llega tarde en un celular
    if (pressed) {
      lastButton = pressed;
      pressedAt = now();
    }
  }, true);
  root.addEventListener('pointermove', (e) => {
    if (start && !spoiled && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVED) {
      spoiled = true;
      unpress();
    }
  }, true);
  const lift = (e) => {
    if (!fingers.delete(e.pointerId)) return;
    if (e.type === 'pointercancel') spoiled = true;
    unpress();
    if (onZone > 0) {
      onZone -= 1;
      calmAt = now() + CALM;
      schedule();
    }
  };
  addEventListener('pointerup', lift, true);
  addEventListener('pointercancel', lift, true);
  list.addEventListener('scroll', () => { scrolledAt = now(); }, { passive: true });

  // Una fila que no se ve entera no responde.
  const cutOff = (el) => {
    const row = el.closest('.ev-row');
    if (!row) return false;
    const r = row.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    return r.top < (cover.hidden ? b.top : cover.getBoundingClientRect().bottom) - 1 || r.bottom > b.bottom + 1;
  };
  root.addEventListener('click', (e) => {
    const touch = start;
    start = null;
    if (!touch || e.detail === 0) return; // el teclado o un lector de pantalla no se equivocan así
    const t = now();
    const inList = list.contains(e.target);
    if (spoiled || t - touch.at > LONG || t < deafUntil || (controls.contains(e.target) && t < deafControlsUntil)
      || (inList && (t - scrolledAt < SCROLLED || cutOff(e.target)))) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  matchMedia('(orientation: portrait)').addEventListener('change', () => { deafUntil = now() + ROTATED; });

  // Si el dedo sigue encima de la lista o los mandos, lo que los movería espera (aunque otro operador pase).
  const isCalm = () => !onZone && now() >= calmAt;
  function schedule() {
    clearTimeout(timer);
    if (!waiting.size) return;
    timer = setTimeout(() => {
      if (!isCalm()) { schedule(); return; }
      const due = [...waiting.values()];
      waiting.clear();
      due.forEach((fn) => fn());
    }, Math.max(100, calmAt - now()));
  }

  // Lo que pulsa una persona en la pantalla (no en un módulo): si tarda, se dice en el botón y luego en un aviso.
  watchActions((sent) => {
    const button = now() - pressedAt < LONG + 200 && !lastButton?.closest('.drawer') ? lastButton : null;
    if (!button) return;
    const slow = setTimeout(() => button.classList.add('waiting'), SLOW);
    const lost = setTimeout(() => toast('Manna no ha contestado. Mira si sigue la conexión e inténtalo otra vez.', 'error'), LOST);
    const end = () => { clearTimeout(slow); clearTimeout(lost); button.classList.remove('waiting'); };
    sent.then(end, end);
  });

  return {
    airChanged() { deafControlsUntil = now() + AIR_CHANGED; },
    whenCalm(key, fn) {
      if (isCalm()) { fn(); return; }
      waiting.set(key, fn);
      schedule();
    },
  };
}
