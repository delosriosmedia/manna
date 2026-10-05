// Dónde queda una imagen en una pantalla, según su ajuste, el zoom y el punto que va al centro.
// Lo usan la proyección (para dibujarla) y los mandos (para marcar qué parte se ve), así las dos
// coinciden siempre. Las mismas reglas valen para una miniatura: solo cambia el tamaño.
//
// screen: { W, H } de la pantalla, { iw, ih } de la imagen.
// view:   { fit: 'contain' | 'cover', zoom: 1..5, x, y } (ver server/core/view.js)
export function place({ W, H, iw, ih }, { fit, zoom, x, y }) {
  const base = fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  const width = iw * base * zoom;
  const height = ih * base * zoom;
  // Si cabe, va centrada; si sobra, se desplaza sin dejar huecos en los bordes.
  const axis = (size, screen, center) => (size <= screen ? (screen - size) / 2 : Math.max(screen - size, Math.min(0, screen / 2 - center * size)));
  return { width, height, left: axis(width, W, x), top: axis(height, H, y), scale: base * zoom };
}

// Qué parte de la imagen se ve, en fracciones de 0 a 1.
export function visible(screen, view) {
  const p = place(screen, view);
  const width = Math.min(1, screen.W / p.width);
  const height = Math.min(1, screen.H / p.height);
  return { left: Math.max(0, -p.left / p.width), top: Math.max(0, -p.top / p.height), width, height };
}

// El punto central que de verdad se muestra: el pedido, ajustado a los bordes.
export function centerOf(screen, view) {
  const v = visible(screen, view);
  return { x: v.left + v.width / 2, y: v.top + v.height / 2 };
}

export const FULL_VIEW = { zoom: 1, x: 0.5, y: 0.5 };
export const MAX_ZOOM = 5;
