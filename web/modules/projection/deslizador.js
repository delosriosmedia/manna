import { h } from '../../core/dom.js';

// Deslizador de «En vivo» (DESIGN.md 12 ter, regla 2): tocar la barra no hace nada; solo se arrastra su bola (44 × 35 de
// toque, sin salir de la barra), se aplica al soltar y se cancela alejándose 40 px.
//   onCommit(valor)  al soltar, si cambió
//   onMove(valor)    mientras se arrastra (null al cancelar), para decir la cifra
const AWAY = 40;
const clamp = (v, max) => Math.min(max, Math.max(0, v));

export function ballSlider({ label, thick = false, step = 1, onCommit, onMove = () => {} }) {
  let value = 0;
  let max = 1;
  let drag = null; // { from, grab, left, width, y, shown }
  const hit = h('span', { class: 'ev-ball', role: 'slider', tabindex: '0', 'aria-label': label });
  const el = h('div', { class: `ev-slider${thick ? ' thick' : ''}` }, h('span', { class: 'ev-track' }, h('i', {})), h('b', {}), hit);
  const paint = (v) => {
    el.style.setProperty('--p', max ? clamp(v, max) / max : 0);
    hit.setAttribute('aria-valuenow', Math.round(v));
    hit.setAttribute('aria-valuemax', Math.round(max));
  };
  hit.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { hit.setPointerCapture(e.pointerId); } catch { /* sin captura, se sigue igual */ }
    const r = el.getBoundingClientRect();
    drag = { from: value, shown: value, left: r.left, width: r.width, y: e.clientY, grab: e.clientX - (r.left + (max ? value / max : 0) * r.width) };
    el.classList.add('dragging');
  });
  hit.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const away = Math.abs(e.clientY - drag.y) > AWAY;
    drag.shown = away ? drag.from : clamp(((e.clientX - drag.grab - drag.left) / drag.width) * max, max);
    paint(drag.shown);
    onMove(away ? null : drag.shown);
  });
  const end = (commit) => {
    if (!drag) return;
    const { shown, from } = drag;
    drag = null;
    el.classList.remove('dragging');
    if (commit && shown !== from) {
      value = shown;
      onCommit(shown);
    } else paint(value);
    onMove(null);
  };
  hit.addEventListener('pointerup', () => end(true));
  hit.addEventListener('pointercancel', () => end(false));
  // Con el teclado, de paso en paso.
  hit.addEventListener('keydown', (e) => {
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    value = clamp(value + d, max);
    paint(value);
    onCommit(value);
  });
  return {
    el,
    set(next, nextMax = max) {
      max = nextMax;
      if (drag) return; // manda lo que hace el dedo, no lo que llega
      value = next;
      paint(next);
    },
    busy: () => Boolean(drag),
  };
}
