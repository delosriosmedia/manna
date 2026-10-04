// Texto proyectado: tipografías, sombras y ajuste automático del tamaño.
// Lo comparten los tipos de contenido que muestran texto sobre el fondo (pasajes, comparador).

export const FONTS = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  trebuchet: '"Trebuchet MS", "Lucida Sans", sans-serif',
  impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
};

export const SHADOWS = {
  none: 'none',
  soft: '0 0.3cqh 1cqh rgba(0,0,0,.6)',
  outline: '-0.25cqh -0.25cqh 0 #000, 0.25cqh -0.25cqh 0 #000, -0.25cqh 0.25cqh 0 #000, 0.25cqh 0.25cqh 0 #000, 0 0.5cqh 1.5cqh rgba(0,0,0,.9)',
  strong: '0 0.5cqh 2.5cqh rgba(0,0,0,.95), 0 0.3cqh 0.8cqh rgba(0,0,0,.85)',
};

// Aplica a un bloque de texto los estilos elegidos en Ajustes.
export function applyTextStyles(inner, styles) {
  inner.style.fontFamily = FONTS[styles.fontFamily] || FONTS.sans;
  inner.style.textShadow = SHADOWS[styles.textShadow] || SHADOWS.strong;
  inner.dataset.ref = styles.refPosition;
}

// Reduce el texto hasta que quepa: un versículo largo nunca se sale de la pantalla.
// stage: el escenario (lleva la variable --fit); host: el área disponible; inner: el bloque de texto.
export function fitText(stage, host, inner) {
  const available = host.clientHeight - parseFloat(getComputedStyle(host).paddingTop) * 2;
  if (available <= 0) return;
  let lo = 0.2;
  let hi = 1;
  stage.style.setProperty('--fit', 1);
  if (inner.offsetHeight <= available) return;
  for (let i = 0; i < 8; i += 1) {
    const mid = (lo + hi) / 2;
    stage.style.setProperty('--fit', mid);
    if (inner.offsetHeight <= available) lo = mid; else hi = mid;
  }
  stage.style.setProperty('--fit', lo);
}
