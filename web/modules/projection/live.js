import { action, state, subscribe } from '../../core/api.js';
import { guard } from '../../core/dom.js';
import { kindOf } from '../../core/kinds.js';

// Mandos de lo que está al aire. Cada tipo de contenido pone los suyos (el zoom de una imagen,
// la reproducción de un video); aquí solo se les da sitio y se les entrega el estado.
// El contenedor se oculta cuando lo que está en pantalla no tiene mandos.
export function createLiveControls(container) {
  const send = guard((patch) => action('projection.control', patch));
  let mounted = null; // { kind, view }
  container.classList.add('live-controls');
  container.hidden = true;

  function sync() {
    const item = state.projection?.item;
    const def = item && kindOf(item.kind);
    if (!def?.controls) {
      mounted?.view.destroy?.();
      mounted = null;
      container.replaceChildren();
      container.hidden = true;
      return;
    }
    if (mounted?.kind !== item.kind) {
      mounted?.view.destroy?.();
      container.replaceChildren();
      mounted = { kind: item.kind, view: def.controls(container, { send }) };
    }
    container.hidden = false;
    const live = state.live;
    mounted.view.update(live && live.uid === item.uid ? live.state : null, item);
  }

  subscribe('projection', sync);
  subscribe('live', sync);
}
