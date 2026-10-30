import { action, stepAir } from '../../core/api.js';
import { dialog, guard, h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { everyFrame, formatTime, positionAt } from '../../core/playback.js';
import { createSender } from '../../core/sender.js';
import { ballSlider } from './deslizador.js';
import { MAX_ZOOM } from './view.js';

// La ranura de mandos de «En vivo» (fase 44, tablero E2): dos filas de cuatro que cambian de contenido, nunca de tamaño (en la
// tableta, una de ocho). Cada tipo de contenido pone las suyas con `slot(host, api)` en su kind.js, con estas piezas; lo
// raro va en «Más». Lo que no hay en una casilla se deja vacío (mandoVacio), para que nada cambie de sitio.
//   api: { send(patch), more() -> botón «Más», tool('point' | 'move') -> botón «Señalar» o «Mover» }
export function mando({ label, glyph, cls = '', title, aria, onclick }) {
  return h('button', { class: `ev-btn ${cls}`, title, 'aria-label': aria, onclick }, glyph && icon(glyph, 14), label != null && h('span', {}, label));
}
export const mandoVacio = () => h('span', { class: 'ev-void', 'aria-hidden': 'true' });
export const notaMando = (text, span = 4) => h('p', { class: 'ev-note', style: `grid-column: span ${span}` }, text);

// Ir a un paso de lo que está al aire. El siguiente, como «Siguiente» (conserva lo cambiado al aire, como la versión).
export const goToStep = guard((item, k) => {
  const { step, orderId, kind, data } = item.source;
  if (step != null && k === step + 1) return stepAir(1);
  return orderId ? action('order.show', { id: orderId, step: k }) : action('projection.show', { kind, data, step: k });
});

// Las casillas de los pasos: la que sale, en rojo (en blanco si no sale nada: CSS); la que sigue, con borde; las demás, neutras.
//   count  cuántas casillas; total(item)  cuántos pasos; now(item)  por cuál va (null: todos juntos); name(k, item)  su nombre
export function stepCells(count, { total, now = (item) => item.source.step, name }) {
  let item = null;
  let from = 0;
  const cells = Array.from({ length: count }, (_, i) => h('button', { class: 'ev-cell', onclick: () => item && goToStep(item, from + i) }));
  return {
    els: cells,
    update(next) {
      item = next;
      const steps = total(item);
      const at = now(item);
      // Se ve la que sale y las que siguen; con cuatro casillas, también la de antes.
      from = Math.max(0, Math.min((at ?? 0) - (count > 3 ? 1 : 0), steps - count));
      cells.forEach((cell, i) => {
        const k = from + i;
        cell.classList.toggle('ev-off', k >= steps);
        cell.classList.toggle('on', k === at);
        cell.classList.toggle('nx', k === (at ?? -1) + 1 && at != null && k < steps);
        cell.textContent = k < steps ? name(k, item) : '';
        cell.tabIndex = k < steps ? 0 : -1;
        if (k === at) cell.setAttribute('aria-current', 'step'); else cell.removeAttribute('aria-current');
      });
    },
  };
}

// «Juntos»: el elemento entero en una sola pantalla.
export function wholeCell() {
  let item = null;
  const el = h('button', { class: 'ev-cell', onclick: guard(() => {
    const { orderId, kind, data } = item.source;
    return orderId ? action('order.show', { id: orderId, step: null }) : action('projection.show', { kind, data });
  }) }, 'Juntos');
  return { el, update(next) { item = next; el.classList.toggle('on', next.source.step == null); } };
}

// Acercar, alejar y «Ver toda» de lo que se proyecta como una imagen.
export function framingButtons({ send }) {
  let zoom = 1;
  const by = (factor) => () => send({ zoom: Math.max(1, Math.min(MAX_ZOOM, Math.round(zoom * factor * 100) / 100)) });
  const minus = mando({ label: '−', aria: 'Alejar', onclick: by(1 / 1.25) });
  const plus = mando({ label: '+', aria: 'Acercar', onclick: by(1.25) });
  const all = mando({ label: 'Ver toda', onclick: () => send({ reset: true }) });
  return {
    minus, plus, all,
    update(state) {
      zoom = state?.zoom ?? 1;
      minus.disabled = zoom <= 1;
      plus.disabled = zoom >= MAX_ZOOM;
      all.disabled = zoom <= 1 && Math.abs((state?.x ?? 0.5) - 0.5) < 0.001 && Math.abs((state?.y ?? 0.5) - 0.5) < 0.001;
    },
  };
}

// «Todas»: las diapositivas en una rejilla. Un toque la pone al aire: es lo que se pidió al abrirla.
//   pages(item) -> [{ thumb, label }]
export function allPagesButton({ pages, now }) {
  let item = null;
  const open = () => {
    const grid = h('div', { class: 'ev-pages' }, ...pages(item).map((page, k) => h('button', { class: `ev-page${k === now(item) ? ' on' : ''}`, 'aria-label': `Poner ${page.label}`, onclick: () => { box.close(); goToStep(item, k); } },
      h('span', {}, h('img', { src: page.thumb, alt: '', loading: 'lazy' })), h('small', {}, page.label))));
    const box = dialog('Todas', grid);
  };
  return { el: mando({ label: 'Todas', glyph: 'squares-four', onclick: open }), update(next) { item = next; } };
}

// La fila de lo que suena: pausa, −10, +10, el avance (solo se mueve su bola) y lo que queda. Mientras salen órdenes o se
// arrastra, lo que llega del servidor es más viejo que lo que se ve.
export function clipRow({ send }) {
  const sender = createSender(send, { onIdle: () => apply() });
  let latest = null;
  let clock = null;
  const ended = () => clock?.duration != null && positionAt(clock) >= clock.duration;
  const toggle = mando({ cls: 'ev-pause', onclick: () => sender.push({ playing: !(clock?.playing && !ended()) }) });
  const jump = (seconds) => () => sender.push({ position: Math.max(0, Math.min(clock?.duration ?? Infinity, positionAt(clock) + seconds)) });
  const bar = ballSlider({ label: 'Avance', thick: true, step: 5, onCommit: (position) => sender.push({ position }) });
  const time = h('span', { class: 'ev-time' });
  const el = h('div', { class: 'ev-seek' }, toggle,
    mando({ label: '−10', cls: 'ev-jump', title: 'Retroceder 10 segundos', onclick: jump(-10) }),
    mando({ label: '+10', cls: 'ev-jump', title: 'Adelantar 10 segundos', onclick: jump(10) }),
    bar.el, time);
  function paint() {
    const position = positionAt(clock);
    const known = clock?.duration != null;
    bar.set(position, known ? clock.duration : Math.max(1, position));
    time.textContent = known ? `−${formatTime(Math.max(0, clock.duration - position))}` : formatTime(position);
  }
  const frames = everyFrame(paint);
  function apply() {
    if (latest && !(clock && sender.busy)) clock = latest.clock;
    const playing = Boolean(clock?.playing) && !ended();
    const verb = playing ? 'Pausar' : ended() ? 'Otra vez' : 'Reproducir';
    toggle.replaceChildren(icon(playing ? 'pause' : 'play', 16));
    toggle.setAttribute('aria-label', verb);
    toggle.title = verb;
    paint();
    if (playing) frames.start(); else frames.stop();
  }
  return {
    el,
    update(live) { latest = live; apply(); },
    destroy: () => frames.stop(),
  };
}

// Sin mandos propios: lo que dice su ficha, y «Más» si tiene mandos.
export function plainSlot(text) {
  return (host, api) => {
    host.replaceChildren(notaMando(text, 3), api.more());
    return {};
  };
}
