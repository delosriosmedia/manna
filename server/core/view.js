// La vista de una imagen al aire: cómo se ajusta a la pantalla, cuánto se acerca y qué punto queda
// en el centro. Es lógica pura, igual para todo lo que se proyecta como imagen (una imagen de
// Medios, una diapositiva). En la interfaz, la misma cuenta está en web/modules/projection/view.js.
//
// fit    'contain' = completa, con bandas negras si no tiene la forma de la pantalla
//        'cover'   = llena la pantalla, recortando lo que sobre
// zoom   1 (lo que da el ajuste) a MAX_ZOOM
// x, y   punto de la imagen que queda en el centro de la pantalla, de 0 a 1
export const FITS = ['contain', 'cover'];
export const MAX_ZOOM = 5;

export const validFit = (fit) => (FITS.includes(fit) ? fit : 'contain');
const between = (value, min, max, fallback) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback);

export function initialView(fit, saved = null) {
  const view = { fit: validFit(fit), zoom: 1, x: 0.5, y: 0.5 };
  return saved && typeof saved === 'object' ? applyView(view, saved) : view;
}

// Aplica una orden de los mandos. Lo que no se entiende se ignora; lo que se sale, se ajusta.
export function applyView(state, patch) {
  if (patch.reset) return { fit: FITS.includes(patch.fit) ? patch.fit : state.fit, zoom: 1, x: 0.5, y: 0.5 };
  return {
    fit: FITS.includes(patch.fit) ? patch.fit : state.fit,
    zoom: Math.round(between(patch.zoom, 1, MAX_ZOOM, state.zoom) * 100) / 100,
    x: Math.round(between(patch.x, 0, 1, state.x) * 1000) / 1000,
    y: Math.round(between(patch.y, 0, 1, state.y) * 1000) / 1000,
  };
}
