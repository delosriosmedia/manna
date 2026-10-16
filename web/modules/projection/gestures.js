import { action, state } from '../../core/api.js';
import { guard } from '../../core/dom.js';
import { createSender } from '../../core/sender.js';
import { centerOf, FULL_VIEW, MAX_ZOOM, place } from './view.js';

// «Señalar» y «Mover» con el dedo o el ratón sobre una vista de lo que está al aire: la grande del Presentador,
// la proyección de fondo del escenario o el recuadro de «Historias».
//   Señalar: cada movimiento manda dónde está, en fracciones de la imagen (stage.pointAt); al soltar, se quita.
//   Mover: un dedo (o el ratón) desplaza el encuadre, dos acercan y alejan, y la rueda acerca.
//   Sin herramienta: onTap(lado) al soltar un toque corto (el Presentador pasa: 1 a la derecha, -1 a la izquierda).
// tool() dice cuál está encendida: 'point', 'move' o null. box: el recuadro de la proyección, si los gestos se
// recogen en algo más grande (el fondo entero del escenario, porque la proyección no recibe el ratón).
export function attachGestures(el, { stage, tool, onTap = null, box = el }) {
  const aim = createSender((patch) => action('projection.pointer', patch).catch(() => {}), { every: 40 });
  const frame = createSender(guard((patch) => action('projection.control', patch)));
  const fingers = new Map();
  let grip = null; // { screen, view, x, y, center, width, height, spread, sent }
  let tap = null;  // sin herramienta: dónde empezó el toque
  const framing = () => {
    const item = state.projection?.item;
    const view = state.live?.uid === item?.uid ? state.live?.state : null;
    return item && state.projection.mode === 'live' && view?.zoom ? { item, view } : null;
  };
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
  };
  const pointAt = (e) => aim.push(stage.pointAt(e.clientX, e.clientY) || { x: null, y: null }, { replace: true });
  function grab() {
    const f = framing();
    if (!f) { grip = null; return; }
    const r = box.getBoundingClientRect();
    const screen = { W: r.width, H: r.height, iw: f.item.width || 16, ih: f.item.height || 9 };
    const view = { fit: f.item.fit, ...FULL_VIEW, ...f.view, ...grip?.sent };
    const shown = place(screen, view);
    const [first] = fingers.values();
    grip = { screen, view, x: first.clientX, y: first.clientY, center: centerOf(screen, view), width: shown.width, height: shown.height, spread: spread(), sent: grip?.sent };
  }
  function drag() {
    if (!grip) return;
    if (fingers.size > 1 && grip.spread) {
      const zoom = Math.max(1, Math.min(MAX_ZOOM, Math.round(grip.view.zoom * (spread() / grip.spread) * 100) / 100));
      grip.sent = { ...grip.sent, zoom };
      frame.push({ zoom });
      return;
    }
    const [first] = fingers.values();
    const target = centerOf(grip.screen, { ...grip.view, x: grip.center.x - (first.clientX - grip.x) / grip.width, y: grip.center.y - (first.clientY - grip.y) / grip.height });
    grip.sent = { ...grip.sent, ...target };
    frame.push(target);
  }

  el.addEventListener('pointerdown', (e) => {
    const using = tool();
    if (!using && !onTap) return;
    // Con una herramienta, el gesto es suyo: ni selecciona texto ni cierra lo que haya debajo (el cajón).
    if (using) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura, se sigue igual */ }
    fingers.set(e.pointerId, e);
    if (using === 'point') pointAt(e);
    else if (using === 'move') grab();
    else tap = fingers.size === 1 ? { x: e.clientX, y: e.clientY } : null;
  });
  el.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, e);
    if (tool() === 'point') pointAt(e);
    else if (tool() === 'move') drag();
  });
  const release = (e) => {
    if (!fingers.delete(e.pointerId)) return;
    const using = tool();
    if (using === 'point') aim.push({ x: null, y: null }, { replace: true });
    else if (using === 'move') { if (fingers.size) grab(); else grip = null; }
    else if (tap && onTap && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12) {
      const r = box.getBoundingClientRect();
      onTap(e.clientX > r.left + r.width / 2 ? 1 : -1);
    }
    if (!fingers.size) tap = null;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  // Con «Mover», la rueda del ratón acerca y aleja.
  el.addEventListener('wheel', (e) => {
    const f = tool() === 'move' && framing();
    if (!f) return;
    e.preventDefault();
    frame.push({ zoom: Math.max(1, Math.min(MAX_ZOOM, Math.round(f.view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12) * 100) / 100)) });
  }, { passive: false });
  // Que un clic que acaba un gesto no llegue a lo de debajo (el fondo cierra el cajón al tocarlo).
  el.addEventListener('click', (e) => { if (tool()) e.stopImmediatePropagation(); });

  return {
    // ¿Hay algo acercado o desplazado? (para encender «Restablecer»)
    framed() {
      const f = framing();
      const v = f && { ...FULL_VIEW, ...f.view };
      return Boolean(v) && !(v.zoom <= 1 && Math.abs(v.x - 0.5) < 0.001 && Math.abs(v.y - 0.5) < 0.001);
    },
    reset: guard(() => action('projection.control', { ...FULL_VIEW })),
  };
}
