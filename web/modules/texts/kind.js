import { h } from '../../core/dom.js';
import { registerKind } from '../../core/kinds.js';
import { notaMando, stepCells, wholeCell } from '../projection/slot.js';
import { applyTextStyles, fitText } from '../projection/text.js';

// Tipo de contenido "texto" (módulo Textos): un mensaje o una cita sobre el fondo de la proyección, con la letra
// y los colores de Ajustes, como un pasaje bíblico. La cita va entre comillas (abre en su primera parte y
// cierra en la última) y lleva su autor debajo, en el sitio y el color de la cita bíblica.
registerKind('text', {
  icon: 'text-aa',
  label: 'Texto',
  unit: ['parte', 'partes'],
  wholeUpTo: 3,
  stepLabel: (_item, k) => `Parte ${k + 1}`,
  title: (item) => (item.parts > 1 && item.part ? `${item.title} · ${item.part} de ${item.parts}` : item.title),
  key: (item) => `${item.id}|${item.part}|${item.style}|${item.author}|${item.text}`,

  draw(host, { stage }) {
    const text = h('div', { class: 'stage-text stage-message' });
    const ref = h('div', { class: 'stage-ref' });
    const inner = h('div', { class: 'stage-inner' }, text, ref);
    host.replaceChildren(inner);
    const fit = () => fitText(stage, host, inner);
    const observer = new ResizeObserver(fit);
    observer.observe(stage);

    return {
      update(item, { styles }) {
        applyTextStyles(inner, styles);
        text.style.color = styles.textColor;
        ref.style.color = styles.refColor;
        const quote = item.style === 'quote';
        const first = !item.part || item.part === 1;
        const last = !item.part || item.part === item.parts;
        text.textContent = quote ? `${first ? '«' : ''}${item.text}${last ? '»' : ''}` : item.text;
        ref.textContent = quote && last && item.author ? `— ${item.author}` : '';
        ref.hidden = !ref.textContent;
        fit();
      },
      destroy() {
        observer.disconnect();
        stage.style.removeProperty('--fit');
      },
    };
  },

  slot(host, api) {
    const cells = stepCells(2, { total: (item) => item.parts, now: (item) => (item.parts === 1 ? 0 : item.source.step), name: (k) => `Parte ${k + 1}` });
    const whole = wholeCell();
    host.replaceChildren(...cells.els, whole.el, api.more(), notaMando('Sin más mandos. Se escribe en Textos.'));
    return {
      update(_, item) {
        cells.update(item);
        whole.update(item);
        whole.el.classList.toggle('ev-off', item.parts < 2);
      },
    };
  },
});

// Texto fijo (2026-10-29): va en una capa, como el reloj, en uno de sus nueve sitios, con una de cuatro letras que se
// leen bien de lejos, sin recuadro, en una franja o en una píldora, quieto o pasando como una franja de noticias. Su
// color no se elige: mira lo que tiene detrás cada segundo (la imagen, el video o el lienzo al aire si se dejan leer;
// si no, el fondo de Ajustes con su velo) y va oscuro sobre lo claro y claro sobre lo oscuro, siempre con un halo
// del color contrario para que se lea también sobre lo intermedio.
const SPEED = { slow: 0.42, normal: 0.28, fast: 0.18 }; // segundos por letra al pasar
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const parseColor = (text) => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text || '')?.[1];
  if (hex) return (hex.length === 3 ? hex.split('').map((c) => c + c) : hex.match(/../g)).map((c) => parseInt(c, 16));
  const rgb = /rgba?\(([^)]+)\)/.exec(text || '')?.[1]?.split(',').map(Number);
  return rgb?.length >= 3 ? rgb.slice(0, 3) : null;
};

function sampler() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 12;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const average = () => {
    const d = g.getImageData(0, 0, 12, 12).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += luminance([d[i], d[i + 1], d[i + 2]]);
    return sum / (d.length / 4);
  };
  // Lo que se ve de un elemento (imagen, video, lienzo) bajo el recuadro, o null si no se deja leer.
  const read = (el, box) => {
    const r = el.getBoundingClientRect();
    const w = el.naturalWidth || el.videoWidth || el.width;
    const hh = el.naturalHeight || el.videoHeight || el.height;
    const left = Math.max(box.left, r.left);
    const top = Math.max(box.top, r.top);
    const right = Math.min(box.right, r.right);
    const bottom = Math.min(box.bottom, r.bottom);
    if (!w || !hh || right <= left || bottom <= top) return null;
    try {
      g.drawImage(el, ((left - r.left) / r.width) * w, ((top - r.top) / r.height) * hh, ((right - left) / r.width) * w, ((bottom - top) / r.height) * hh, 0, 0, 12, 12);
      return average();
    } catch { return null; } // de otro sitio, o aún sin cargar
  };
  const backImage = new Image();
  return (stage, box, styles) => {
    if (stage.dataset.mode === 'black') return 0;
    if (stage.dataset.mode === 'live') {
      for (const el of stage.querySelectorAll('.stage-content img, .stage-content video, .stage-content canvas')) {
        if (!el.offsetParent || getComputedStyle(el).visibility === 'hidden') continue;
        const seen = read(el, box);
        if (seen != null) return seen;
      }
    }
    // El fondo de Ajustes, oscurecido por su velo.
    const veil = 1 - (Number(styles?.overlayOpacity) || 0);
    if (styles?.backgroundType === 'image' && styles.bgImage) {
      if (backImage.getAttribute('src') !== styles.bgImage) backImage.src = styles.bgImage;
      if (backImage.complete && backImage.naturalWidth) {
        // La parte de la imagen que cae detrás, como si llenara la proyección.
        const s = stage.getBoundingClientRect();
        const [w, hh] = [backImage.naturalWidth, backImage.naturalHeight];
        try {
          g.drawImage(backImage, ((box.left - s.left) / s.width) * w, ((box.top - s.top) / s.height) * hh, (box.width / s.width) * w, (box.height / s.height) * hh, 0, 0, 12, 12);
          return average() * veil;
        } catch { /* aún sin cargar */ }
      }
    }
    const color = parseColor(styles?.backgroundType === 'gradient' ? /#[0-9a-f]{3,6}|rgba?\([^)]+\)/i.exec(styles.bgGradient || '')?.[0] : styles?.bgColor);
    return color ? luminance(color) * veil : 0;
  };
}

registerKind('fixed', {
  icon: 'push-pin',
  label: 'Texto fijo',
  title: (item) => item.title,
  key: (item) => `${item.id}|${item.text}|${JSON.stringify(item.look)}`,
  // Con el fondo de la proyección detrás: en las vistas previas se ve como quedará (la píldora y la franja son
  // translúcidas). En una capa se dibuja sin fondo.

  draw(host, { stage, thumbnail = false }) {
    const text = h('span', { class: 'fix-text' });
    const box = h('div', { class: 'fix-box' }, text);
    const root = h('div', { class: 'fix', dataset: { tone: 'light' } }, box);
    host.replaceChildren(root);
    let styles = null;
    const sample = sampler();
    // Con margen, para que no parpadee sobre algo intermedio.
    const tone = () => {
      if (thumbnail || !stage?.isConnected) return;
      const l = sample(stage, box.getBoundingClientRect(), styles);
      if (root.dataset.tone === 'light' && l > 0.6) root.dataset.tone = 'dark';
      else if (root.dataset.tone === 'dark' && l < 0.5) root.dataset.tone = 'light';
    };
    const timer = setInterval(tone, 1000);
    return {
      update(item, extra) {
        styles = extra?.styles || styles;
        const look = item.look || {};
        Object.assign(root.dataset, { font: look.font, size: look.size, place: look.place, box: look.box, motion: look.motion });
        const scroll = look.motion === 'scroll';
        text.textContent = scroll ? item.text.replace(/\s*\n\s*/g, '   ·   ') : item.text;
        root.style.setProperty('--fix-dur', `${Math.max(8, text.textContent.length * (SPEED[look.speed] || SPEED.normal))}s`);
        requestAnimationFrame(tone);
      },
      visible: (on) => { if (on) tone(); },
      destroy: () => clearInterval(timer),
    };
  },
});
