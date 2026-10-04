import { h } from '../../core/dom.js';
import { keyOf, kindOf } from '../../core/kinds.js';
import '../kinds.js';

// "Escenario": dibuja el estado de proyección dentro de cualquier contenedor.
// Lo usan la pantalla de proyección (a tamaño completo) y las vistas previas del control (en
// miniatura): todo se mide en relación con el alto del contenedor, así que ambas se ven igual.
//
// El escenario pone el fondo y decide qué se ve según el modo (al aire, solo fondo, negro).
// El contenido lo dibuja el tipo de cada elemento (ver web/core/kinds.js).
//
// sound: esta pantalla es la que suena (la ventana de proyección del equipo principal).
export function createStage(container, { sound = false } = {}) {
  const bg = h('div', { class: 'stage-bg' });
  const overlay = h('div', { class: 'stage-overlay' });
  const content = h('div', { class: 'stage-content' });
  container.classList.add('stage');
  container.replaceChildren(bg, overlay, content);

  let drawn = null;  // { kind, view }: lo que hay dibujado ahora
  let current = null; // el último elemento recibido
  let live = null;    // { uid, state, volume }
  let lastKey = '';

  function applyLive() {
    if (!drawn?.view.live || !current) return;
    const mine = live && live.uid === current.uid ? live.state : null;
    drawn.view.live(mine, { volume: live?.volume ?? 1 });
  }

  function render({ mode, item, styles }) {
    container.dataset.mode = item ? mode : (mode === 'black' ? 'black' : 'clear');
    bg.style.background = styles.backgroundType === 'image' && styles.bgImage
      ? `url("${styles.bgImage}") center / cover no-repeat`
      : styles.backgroundType === 'gradient' ? styles.bgGradient : styles.bgColor;
    overlay.style.opacity = styles.overlayOpacity;
    container.style.setProperty('--fs', styles.fontSize);

    current = item;
    if (!item) {
      // Sin contenido se conserva lo dibujado (queda oculto por el modo), para que se desvanezca
      // en vez de desaparecer de golpe; lo que suene, se detiene.
      drawn?.view.stop?.();
      return;
    }
    const def = kindOf(item.kind);
    if (drawn && drawn.kind !== item.kind) {
      drawn.view.destroy?.();
      content.replaceChildren();
      drawn = null;
    }
    container.dataset.fill = def?.background === false ? 'full' : 'text';
    if (!def) return; // tipo que esta versión no sabe dibujar
    if (!drawn) drawn = { kind: item.kind, view: def.draw(content, { stage: container, sound }) };
    drawn.view.update(item, { mode, styles });
    const key = keyOf(item);
    if (key !== lastKey && mode === 'live') content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    lastKey = key;
    applyLive();
  }

  return {
    render,
    // Estado en vivo de lo que está al aire (espacio "live" del servidor).
    setLive(next) {
      live = next;
      applyLive();
    },
  };
}
