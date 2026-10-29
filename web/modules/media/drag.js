import { h } from '../../core/dom.js';

// Arrastrar un elemento de Medios hasta el nombre de una categoría (fase 22 de docs/PLAN.md). Con el ratón
// empieza al moverlo; con el dedo, al mantenerlo pulsado un momento (si se mueve antes, es que se quiere
// desplazar la lista). Una etiqueta con su nombre sigue al puntero y se marca la categoría que hay debajo.
// Lo que se arrastra lleva `data-drag` (su id) y `data-name`; una categoría, `data-category` ('' es Principal).
// drop({ id, name }, categoría) recibe lo soltado sobre una categoría. Soltado sobre otro elemento de su misma lista
// (S42), place({ id, name }, ids) recibe el orden nuevo de esa lista: queda antes o después de él, según el lado.
const HOLD_MS = 350;
const SLOP = 8;

export function attachDrag(list, { drop, place: put }) {
  let press = null;     // { id, name, card, x, y, touch, timer }
  let ghost = null;
  let target = null;
  let after = false;    // sobre otro elemento: va después de él (si no, antes)
  let quietUntil = 0;   // tras soltar, el clic que llega no elige nada

  // Una categoría o, con place, otro elemento de la misma lista.
  const under = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const card = put && el?.closest('[data-drag]');
    return el?.closest('[data-category]') || (card && card !== press.card && card.parentElement === press.card.parentElement ? card : null);
  };
  const mark = (next, x = 0, y = 0) => {
    if (next?.dataset.drag) {
      // En una lista de una columna cuenta la mitad de arriba o de abajo; en una rejilla, la de la izquierda o la derecha.
      const r = next.getBoundingClientRect();
      const column = r.width >= next.parentElement.getBoundingClientRect().width * 0.9;
      after = column ? y > r.top + r.height / 2 : x > r.left + r.width / 2;
    }
    target?.classList.remove('drop-on', 'drop-before', 'drop-after');
    target = next;
    target?.classList.add(target.dataset.drag ? (after ? 'drop-after' : 'drop-before') : 'drop-on');
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
    mark(under(x, y), x, y);
  }
  function end(e) {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    if (!press) return;
    clearTimeout(press.timer);
    if (ghost) {
      const done = e.type === 'pointerup' && target;
      const key = done ? target.dataset.category : undefined;
      // El orden nuevo de la lista, si se soltó sobre otro elemento.
      const order = done && target.dataset.drag && (() => {
        const ids = [...press.card.parentElement.querySelectorAll(':scope > [data-drag]')].map((c) => c.dataset.drag).filter((id) => id !== press.id);
        ids.splice(ids.indexOf(target.dataset.drag) + (after ? 1 : 0), 0, press.id);
        return ids;
      })();
      ghost.remove();
      ghost = null;
      mark(null);
      press.card.classList.remove('dragging');
      document.documentElement.classList.remove('media-dragging');
      quietUntil = Date.now() + 400;
      if (key !== undefined) drop({ id: press.id, name: press.name }, key);
      else if (order) put({ id: press.id, name: press.name }, order);
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
