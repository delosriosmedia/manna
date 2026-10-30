import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { action, serverNow, state, subscribe } from '../../core/api.js';
import { registerKind } from '../../core/kinds.js';
import { everyFrame, positionAt } from '../../core/playback.js';
import { mando, mandoVacio } from '../projection/slot.js';
import { SHADOWS, applyTextStyles } from '../projection/text.js';
import { chime, tick } from './sounds.js';

// Tipo de contenido "tiempo" (fase 32): la hora, un cronómetro o un temporizador, con cinco estilos (sencillo, digital,
// tarjeta, anillo y barra), tres tamaños, nueve sitios y un aspecto sutil o normal (lo dice su data; ver
// server/modules/time/clock.js). En la proyección va sobre el fondo de Ajustes, con su letra y sus colores; en una capa,
// sin fondo y con sombra para que se lea sobre lo claro y lo oscuro. La cuenta se lee del espacio `time` con el reloj
// compartido (positionAt): todas las pantallas ven el mismo segundo.
// La pantalla que suena hace, en los últimos 10 segundos de un temporizador, el tictac (más marcado en los últimos 5) y,
// al llegar a cero, la alarma suave (sounds.js).

export const STYLE_NAMES = { sencillo: 'Sencillo', digital: 'Digital', tarjeta: 'Tarjeta', anillo: 'Anillo', barra: 'Barra' };
const RING = 2 * Math.PI * 45;
const two = (n) => String(n).padStart(2, '0');
const span = (s) => {
  const t = Math.max(0, s);
  const hours = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return hours ? `${hours}:${two(m)}:${two(t % 60)}` : `${m}:${two(t % 60)}`;
};
const timerOf = (id) => (state.time?.timers || []).find((t) => t.id === id) || null;
// Un mismo temporizador puede estar al aire y en una capa a la vez: suena uno solo.
const claims = new Map();

// Lo que marca un reloj en el instante `now`: { text, suffix, progress (0 a 1), left (segundos que quedan), done }.
export function readout(item, timer, now = serverNow()) {
  if (item.type === 'hora') {
    const d = new Date(now);
    const minutes = d.getMinutes() + d.getSeconds() / 60;
    if (item.format === '24') return { text: `${d.getHours()}:${two(d.getMinutes())}`, suffix: '', progress: minutes / 60 };
    return { text: `${d.getHours() % 12 || 12}:${two(d.getMinutes())}`, suffix: d.getHours() < 12 ? 'a. m.' : 'p. m.', progress: minutes / 60 };
  }
  if (!timer) return { text: '–:––', suffix: '', progress: 0 };
  const position = positionAt(timer.clock, now);
  if (timer.type === 'stopwatch') return { text: span(Math.floor(position)), suffix: '', progress: (position % 60) / 60 };
  const left = Math.max(0, timer.clock.duration - position);
  return { text: span(Math.ceil(left)), suffix: '', progress: timer.clock.duration ? left / timer.clock.duration : 0, left, done: left <= 0 };
}

registerKind('clock', {
  icon: 'timer',
  label: 'Tiempo',
  unit: null,
  title: (item) => item.title,
  key: (item) => `${item.id || 'hora'}|${item.style}|${item.size}|${item.place}|${item.look}|${item.format}`,

  draw(host, { layer = false, thumbnail = false }) {
    const title = h('span', { class: 'clk-title' });
    const digits = h('span', { class: 'clk-digits' });
    const suffix = h('span', { class: 'clk-suffix' });
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 100 100');
    ring.setAttribute('class', 'clk-ring');
    ring.setAttribute('aria-hidden', 'true');
    const track = arc.cloneNode();
    for (const c of [track, arc]) { c.setAttribute('cx', 50); c.setAttribute('cy', 50); c.setAttribute('r', 45); }
    track.setAttribute('class', 'clk-track');
    arc.setAttribute('class', 'clk-arc');
    arc.setAttribute('stroke-dasharray', RING);
    ring.append(track, arc);
    const fill = h('i', {});
    const bar = h('span', { class: 'clk-bar' }, fill);
    const box = h('div', { class: 'clk-box' }, title, h('span', { class: 'clk-number' }, ring, digits, suffix), bar);
    const root = h('div', { class: 'clk', dataset: { layer: layer ? '1' : '0' } }, box);
    host.replaceChildren(root);

    let item = null;
    let timer = null;
    let sound = false;
    let volume = 1;
    let last = null; // segundos enteros que quedaban la vez anterior (para el tictac)
    const me = {};
    const sounding = () => sound && !thumbnail && timer?.type === 'timer' && timer.sound && (claims.get(timer.id) ?? me) === me;

    function paint() {
      if (!item) return;
      const now = serverNow();
      const r = readout(item, timer, now);
      if (digits.textContent !== r.text) digits.textContent = r.text;
      suffix.textContent = r.suffix;
      suffix.hidden = !r.suffix;
      arc.setAttribute('stroke-dashoffset', RING * (1 - r.progress));
      fill.style.transform = `scaleX(${r.progress})`;
      root.dataset.done = r.done ? '1' : '0';
      // El tictac y la alarma, solo al cruzar cada segundo mientras se mira (no al abrir la pantalla ya en cero).
      if (r.left == null || !timer?.clock.playing) { last = null; return; }
      const whole = Math.ceil(r.left);
      if (sounding() && last != null && whole < last && last - whole <= 2) {
        claims.set(timer.id, me);
        if (whole === 0) chime({ volume });
        else if (whole <= 10) tick(whole, { strong: whole <= 5, volume });
      }
      last = whole;
    }
    const frames = everyFrame(paint);
    let hourly = null;
    const run = () => {
      frames.stop();
      clearInterval(hourly);
      hourly = null;
      if (thumbnail || !item) return;
      if (item.type === 'hora') hourly = setInterval(paint, 1000);
      else if (timer?.clock.playing) frames.start();
    };
    const off = subscribe('time', () => {
      timer = item?.id ? timerOf(item.id) : null;
      title.textContent = item?.type === 'hora' ? '' : timer?.title || item?.title || '';
      paint();
      run();
    });

    return {
      update(next, { styles }) {
        item = next;
        timer = item.id ? timerOf(item.id) : null;
        Object.assign(root.dataset, { style: item.style, size: item.size, place: item.place, look: item.look, type: item.type });
        applyTextStyles(box, styles);
        // En una capa no hay fondo de proyección detrás: la sombra, siempre la fuerte.
        if (layer) box.style.textShadow = SHADOWS.strong;
        root.style.setProperty('--clk-ink', styles.textColor);
        root.style.setProperty('--clk-accent', styles.refColor);
        title.textContent = item.type === 'hora' ? '' : timer?.title || item.title || '';
        title.hidden = !title.textContent;
        paint();
        run();
      },
      live(_, opts = {}) {
        sound = Boolean(opts.sound);
        volume = opts.volume ?? 1;
        if (!sound && timer && claims.get(timer.id) === me) claims.delete(timer.id);
      },
      stop: () => { frames.stop(); clearInterval(hourly); },
      destroy() {
        frames.stop();
        clearInterval(hourly);
        off();
        for (const [id, who] of claims) if (who === me) claims.delete(id);
      },
    };
  },

  // Mandos al aire: empezar o pausar, volver al principio y sumar o restar un minuto. La hora no tiene.
  controls(host) {
    const digits = h('strong', { class: 'clk-ctl-digits' });
    const toggle = h('button', { class: 'btn primary grow' });
    const buttons = h('div', { class: 'transport' },
      toggle,
      h('button', { class: 'btn t3', title: 'Volver al principio', 'aria-label': 'Volver al principio', onclick: () => send('time.reset') }, icon('arrow-counter-clockwise', 16)),
      h('button', { class: 'btn t3', title: 'Restar un minuto', 'aria-label': 'Restar un minuto', onclick: () => send('time.adjust', { minutes: -1 }) }, icon('minus', 16), h('span', { class: 'lbl' }, '1 min')),
      h('button', { class: 'btn t3', title: 'Sumar un minuto', 'aria-label': 'Sumar un minuto', onclick: () => send('time.adjust', { minutes: 1 }) }, icon('plus', 16), h('span', { class: 'lbl' }, '1 min')));
    const note = h('p', { class: 'muted sec' });
    host.replaceChildren(h('div', { class: 'transport' }, digits), buttons, note);
    let item = null;
    const send = (type, extra = {}) => item?.id && action(type, { id: item.id, ...extra }).catch(() => {});
    const paint = () => {
      const timer = item?.id ? timerOf(item.id) : null;
      digits.textContent = item ? readout(item, timer).text : '';
    };
    const frames = everyFrame(paint);
    const refresh = () => {
      const timer = item?.id ? timerOf(item.id) : null;
      const playing = Boolean(timer?.clock.playing) && !readout(item, timer).done;
      toggle.replaceChildren(icon(playing ? 'pause' : 'play', 16), h('span', { class: 'lbl' }, playing ? 'Pausar' : 'Empezar'));
      toggle.onclick = () => send(playing ? 'time.pause' : 'time.start');
      buttons.hidden = !timer;
      note.textContent = item?.type === 'hora' ? 'La hora del equipo principal.' : timer ? '' : 'Este reloj ya no está.';
      note.hidden = !note.textContent;
      paint();
      if (playing || item?.type === 'hora') frames.start(); else frames.stop();
    };
    const off = subscribe('time', () => item && refresh());
    return {
      update(_, next) {
        item = next;
        refresh();
      },
      destroy() {
        frames.stop();
        off();
      },
    };
  },

  // La cuenta de un reloj, para su isla de «En vivo».
  count: (item) => readout(item, item.id ? timerOf(item.id) : null).text,

  slot(host, api) {
    let item = null;
    const send = (type, extra = {}) => item?.id && action(type, { id: item.id, ...extra }).catch(() => {});
    const digits = h('strong', { class: 'ev-count' });
    const toggle = mando({ cls: 'ev-span2', onclick: () => send(toggle.dataset.playing === 'true' ? 'time.pause' : 'time.start') });
    const less = mando({ label: '−1 min', onclick: () => send('time.adjust', { minutes: -1 }) });
    const more = mando({ label: '+1 min', onclick: () => send('time.adjust', { minutes: 1 }) });
    host.replaceChildren(digits, toggle, less, more, mandoVacio(), api.more());
    const paint = () => { digits.textContent = item ? readout(item, item.id ? timerOf(item.id) : null).text : ''; };
    const frames = everyFrame(paint);
    const refresh = () => {
      const timer = item?.id ? timerOf(item.id) : null;
      const playing = Boolean(timer?.clock.playing) && !readout(item, timer).done;
      toggle.dataset.playing = String(playing);
      toggle.replaceChildren(icon(playing ? 'pause' : 'play', 14), h('span', {}, playing ? 'Pausar' : 'Empezar'));
      for (const b of [toggle, less, more]) b.disabled = !timer;
      paint();
      if (playing || item?.type === 'hora') frames.start(); else frames.stop();
    };
    const off = subscribe('time', () => item && refresh());
    return {
      update(_, next) { item = next; refresh(); },
      destroy() { frames.stop(); off(); },
    };
  },

  // En la barra de capas (escenario.js, fase 34): la burbuja que se desprende de la ficha de un temporizador o un
  // cronómetro, con su cuenta en vivo y sus botones (el temporizador, también +1 min). La hora no lleva: no se maneja.
  island(item) {
    if (!item?.id) return null;
    const digits = h('span', { class: 'ix-digits' });
    const toggle = h('button', { class: 'ix-btn ix-play' });
    const plus = h('button', { class: 'ix-btn ix-plus', title: 'Sumar un minuto', 'aria-label': `Sumar un minuto: ${item.title}`, onclick: () => send('time.adjust', { minutes: 1 }) }, '+1');
    const el = h('div', { class: 'island-extra', role: 'group', 'aria-label': `${item.title}: su cuenta y sus botones` },
      digits, toggle,
      h('button', { class: 'ix-btn', title: 'Volver al principio', 'aria-label': `Volver al principio: ${item.title}`, onclick: () => send('time.reset') }, icon('arrow-counter-clockwise', 14)),
      plus);
    const send = (type, extra = {}) => action(type, { id: item.id, ...extra }).catch(() => {});
    const paint = () => { digits.textContent = readout(item, timerOf(item.id)).text; };
    const frames = everyFrame(paint);
    let shown = null;
    const refresh = () => {
      const timer = timerOf(item.id);
      const r = readout(item, timer);
      const playing = Boolean(timer?.clock.playing) && !r.done;
      el.dataset.state = !timer ? 'gone' : r.done ? 'done' : playing ? 'running' : 'paused';
      plus.hidden = timer?.type !== 'timer';
      if (shown !== playing) {
        shown = playing;
        toggle.replaceChildren(icon(playing ? 'pause' : 'play', 14));
        toggle.title = playing ? 'Pausar' : 'Empezar';
        toggle.setAttribute('aria-label', `${toggle.title}: ${item.title}`);
        toggle.onclick = () => send(playing ? 'time.pause' : 'time.start');
      }
      paint();
      if (playing) frames.start(); else frames.stop();
    };
    const off = subscribe('time', refresh);
    return {
      el,
      destroy() {
        frames.stop();
        off();
      },
    };
  },
});
