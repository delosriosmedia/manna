import { h } from '../../core/dom.js';

const FONTS = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  trebuchet: '"Trebuchet MS", "Lucida Sans", sans-serif',
  impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
};

const SHADOWS = {
  none: 'none',
  soft: '0 0.3cqh 1cqh rgba(0,0,0,.6)',
  outline: '-0.25cqh -0.25cqh 0 #000, 0.25cqh -0.25cqh 0 #000, -0.25cqh 0.25cqh 0 #000, 0.25cqh 0.25cqh 0 #000, 0 0.5cqh 1.5cqh rgba(0,0,0,.9)',
  strong: '0 0.5cqh 2.5cqh rgba(0,0,0,.95), 0 0.3cqh 0.8cqh rgba(0,0,0,.85)',
};

// "Escenario": dibuja el estado de proyección dentro de cualquier contenedor.
// Lo usan la pantalla de proyección (a tamaño completo) y la vista previa del control (en miniatura):
// todo se mide en relación con el alto del contenedor, así que ambas se ven igual.
export function createStage(container) {
  const bg = h('div', { class: 'stage-bg' });
  const overlay = h('div', { class: 'stage-overlay' });
  const ref = h('div', { class: 'stage-ref' });
  const text = h('div', { class: 'stage-text' });
  const inner = h('div', { class: 'stage-inner' }, text, ref);
  const content = h('div', { class: 'stage-content' }, inner);
  container.classList.add('stage');
  container.replaceChildren(bg, overlay, content);

  let lastKey = '';

  // Reduce el texto hasta que quepa: un versículo largo nunca se sale de la pantalla.
  function fit() {
    const available = content.clientHeight - parseFloat(getComputedStyle(content).paddingTop) * 2;
    if (available <= 0) return;
    let lo = 0.2;
    let hi = 1;
    container.style.setProperty('--fit', 1);
    if (inner.offsetHeight <= available) return;
    for (let i = 0; i < 8; i += 1) {
      const mid = (lo + hi) / 2;
      container.style.setProperty('--fit', mid);
      if (inner.offsetHeight <= available) lo = mid; else hi = mid;
    }
    container.style.setProperty('--fit', lo);
  }

  function render({ mode, item, styles }) {
    container.dataset.mode = item ? mode : (mode === 'black' ? 'black' : 'clear');

    bg.style.background = styles.backgroundType === 'image' && styles.bgImage
      ? `url("${styles.bgImage}") center / cover no-repeat`
      : styles.backgroundType === 'gradient' ? styles.bgGradient : styles.bgColor;
    overlay.style.opacity = styles.overlayOpacity;
    container.style.setProperty('--fs', styles.fontSize);
    inner.style.fontFamily = FONTS[styles.fontFamily] || FONTS.sans;
    inner.style.textShadow = SHADOWS[styles.textShadow] || SHADOWS.strong;
    text.style.color = styles.textColor;
    ref.style.color = styles.refColor;
    inner.dataset.ref = styles.refPosition;

    if (item) {
      const many = item.verses.length > 1;
      text.replaceChildren(...item.verses.flatMap((v) => [
        many ? h('sup', { class: 'stage-vn' }, String(v.n)) : null,
        `${v.text} `,
      ]).filter(Boolean));
      ref.textContent = item.version ? `${item.reference} (${item.version})` : item.reference;
      const key = `${item.versionId}|${item.reference}`;
      if (key !== lastKey && mode === 'live') inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      lastKey = key;
    }
    fit();
  }

  new ResizeObserver(fit).observe(container);
  return { render };
}
