import { h } from '../../core/dom.js';

// Arrastrar un elemento de Medios hasta el nombre de una categoría (fase 22 de docs/PLAN.md). Con el ratón
// empieza al moverlo; con el dedo, al mantenerlo pulsado un momento (si se mueve antes, es que se quiere
// desplazar la lista). Una etiqueta con su nombre sigue al puntero y se marca la categoría que hay debajo.
// Lo que se arrastra lleva `data-drag` (su id) y `data-name`; una categoría, `data-category` ('' es Principal).
// drop({ id, name }, categoría) recibe lo soltado sobre una categoría.
const HOLD_MS = 350;
const SLOP = 8;

export function attachDrag(list, { drop }) {
  let press = null;     // { id, name, card, x, y, touch, timer }
  let ghost = null;
  let target = null;
  let quietUntil = 0;   // tras soltar, el clic que llega no elige nada

  const under = (x, y) => document.elementFromPoint(x, y)?.closest('[data-category]') || null;
  const mark = (next) => {
    if (next === target) return;
    target?.classList.remove('drop-on');
    target = next;
    target?.classList.add('drop-on');
  };
  function begin() {
    clearTimeout(press.timer);
    ghost = h('div', { class: 'drag-ghost' }, press.name);
    document.body.append(ghost);
    press.card.classList.add('dragging');
    document.documentElement.classList.add('media-dragging');
    place(press.x, press.y);
  }
  function place(x, y) {
    ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
    mark(under(x, y));
  }
  function end(e) {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    if (!press) return;
    clearTimeout(press.timer);
    if (ghost) {
      const key = e.type === 'pointerup' ? target?.dataset.category : undefined;
      ghost.remove();
      ghost = null;
      mark(null);
      press.card.classList.remove('dragging');
      document.documentElement.classList.remove('media-dragging');
      quietUntil = Date.now() + 400;
      if (key !== undefined) drop({ id: press.id, name: press.name }, key);
    }
    press = null;
  }
  function move(e) {
    if (!press) return;
    if (ghost) { place(e.clientX, e.clientY); return; }
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < SLOP) return;
    // El dedo se movió antes de tiempo: está desplazando la lista.
    if (press.touch) end(e);
    else begin();
  }

  list.addEventListener('pointerdown', (e) => {
    const card = e.target.closest?.('[data-drag]');
    if (!card || e.button !== 0 || e.target.closest('.media-more, .deck-more')) return;
    const touch = e.pointerType !== 'mouse';
    press = { id: card.dataset.drag, name: card.dataset.name, card, x: e.clientX, y: e.clientY, touch };
    if (touch) press.timer = setTimeout(begin, HOLD_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
  // Mientras se arrastra con el dedo, la lista no se desplaza; el oyente existe desde el principio para que
  // el navegador deje cancelar el desplazamiento.
  list.addEventListener('touchmove', (e) => { if (ghost) e.preventDefault(); }, { passive: false });
  // Mantener pulsado no abre el menú del navegador, y el ratón no arrastra la imagen por su cuenta.
  list.addEventListener('contextmenu', (e) => { if (press?.touch || ghost) e.preventDefault(); });
  list.addEventListener('dragstart', (e) => { if (e.target.closest?.('[data-drag]')) e.preventDefault(); });
  list.addEventListener('click', (e) => {
    if (Date.now() < quietUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}
