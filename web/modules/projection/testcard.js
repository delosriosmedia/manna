import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { everyFrame, formatTime, positionAt } from '../../core/playback.js';

const PATTERNS = [['ajuste', 'Encuadre'], ['barras', 'Colores'], ['blanco', 'Blanco']];
const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];

// Tipo de contenido "imagen de prueba": encuadre (bordes y esquinas), barras de color o blanco,
// con un cronómetro que debe marcar lo mismo en todas las pantallas.
registerKind('testcard', {
  icon: 'frame-corners',
  label: 'Prueba',
  unit: null,
  title: () => 'Imagen de prueba',
  key: () => 'testcard',
  background: false,

  draw(host) {
    const size = h('span', {});
    const time = h('span', { class: 'tc-time' }, '0:00.0');
    const card = h('div', { class: 'tc', dataset: { pattern: 'ajuste' } },
      h('div', { class: 'tc-bars' }, ...BARS.map((color) => h('span', { style: `background: ${color};` }))),
      h('div', { class: 'tc-frame' }, ...['tl', 'tr', 'bl', 'br'].map((corner) => h('i', { class: corner }))),
      h('div', { class: 'tc-circle' }),
      h('div', { class: 'tc-info' }, h('strong', {}, 'Manna · Imagen de prueba'), size, time));
    host.replaceChildren(card);

    let clock = null;
    const paint = () => { time.textContent = formatTime(positionAt(clock), { tenths: true }); };
    const frames = everyFrame(paint);
    const measure = () => { size.textContent = `Esta pantalla: ${Math.round(host.clientWidth)} × ${Math.round(host.clientHeight)}`; };
    const observer = new ResizeObserver(measure);
    observer.observe(host);

    return {
      update: measure,
      live(state) {
        card.dataset.pattern = state?.pattern || 'ajuste';
        clock = state?.clock || null;
        paint();
        if (clock?.playing) frames.start(); else frames.stop();
      },
      stop: () => frames.stop(),
      destroy() {
        frames.stop();
        observer.disconnect();
      },
    };
  },

  controls(host, { send }) {
    const time = h('strong', { class: 'tc-clock' }, '0:00.0');
    const toggle = h('button', { class: 'btn grow', onclick: () => send({ playing: !clock?.playing }) });
    const patterns = PATTERNS.map(([id, label]) => h('button', { class: 'btn grow', dataset: { id }, onclick: () => send({ pattern: id }) }, label));
    host.replaceChildren(
      h('div', { class: 'transport' }, ...patterns),
      h('div', { class: 'transport' }, time, toggle,
        h('button', { class: 'btn', title: 'Poner el cronómetro en cero', 'aria-label': 'Reiniciar el cronómetro', onclick: () => send({ restart: true, playing: false }) }, icon('arrow-counter-clockwise', 16))),
      h('p', { class: 'muted' }, 'El cronómetro debe marcar lo mismo en todas las pantallas.'));

    let clock = null;
    const paint = () => { time.textContent = formatTime(positionAt(clock), { tenths: true }); };
    const frames = everyFrame(paint);
    return {
      update(state) {
        clock = state?.clock || null;
        patterns.forEach((b) => b.classList.toggle('on', b.dataset.id === (state?.pattern || 'ajuste')));
        toggle.replaceChildren(icon(clock?.playing ? 'pause' : 'play', 15), clock?.playing ? 'Pausar' : 'Cronómetro');
        paint();
        if (clock?.playing) frames.start(); else frames.stop();
      },
      destroy: () => frames.stop(),
    };
  },
});
