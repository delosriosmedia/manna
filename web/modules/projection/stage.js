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
// sound: esta pantalla es la que suena. Lo decide el servidor y puede cambiar (setSound).
// thumbnail: es una miniatura de una lista (los pasos del orden del culto): el tipo carga lo más ligero que tenga.
// loose: lo que suena se sincroniza sin apuro (un dispositivo remoto por wifi): mejor un poco desfasado que a saltos.
// setListen(true): «Escuchar aquí»: suena en este dispositivo, entero (el volumen general es el de la iglesia).
// Una miniatura (thumbnail) no reproduce lo que suena salvo que se escuche: un video muestra su imagen, sin gastar
// batería, red ni procesador en un celular (still).
export function createStage(container, { sound: initialSound = false, thumbnail = false, loose = false } = {}) {
  let sound = initialSound;
  let listening = false;
  const bg = h('div', { class: 'stage-bg' });
  const overlay = h('div', { class: 'stage-overlay' });
  const content = h('div', { class: 'stage-content' });
  const pointer = h('div', { class: 'stage-pointer', hidden: true });
  container.classList.add('stage');
  container.replaceChildren(bg, overlay, content, pointer);

  let drawn = null;  // { kind, view }: lo que hay dibujado ahora
  let current = null; // el último elemento recibido
  let live = null;    // { uid, state, volume }
  let point = null;   // { uid, x, y }: dónde señala el puntero (espacio "pointer" del servidor)
  let lastKey = '';

  // El tipo dice dónde cae en pantalla un punto de su contenido (locate); el que no sabe, no lo muestra.
  function placePointer() {
    const on = point?.x != null && point.uid === current?.uid && container.dataset.mode === 'live';
    const at = on ? drawn?.view.locate?.(point.x, point.y) : null;
    pointer.hidden = !at;
    if (!at) return;
    const r = container.getBoundingClientRect();
    pointer.style.transform = `translate(${at.x - r.left}px, ${at.y - r.top}px)`;
  }

  function applyLive() {
    if (!drawn?.view.live || !current) return;
    const mine = live && live.uid === current.uid ? live.state : null;
    drawn.view.live(mine, { volume: listening ? 1 : live?.volume ?? 1, sound: sound || listening, loose, still: thumbnail && !listening });
  }

  function render({ mode, item, styles }) {
    container.dataset.mode = item ? mode : (mode === 'black' ? 'black' : 'clear');
    bg.style.background = styles.backgroundType === 'image' && styles.bgImage
      ? `url("${styles.bgImage}") center / cover no-repeat`
      : styles.backgroundType === 'gradient' ? styles.bgGradient : styles.bgColor;
    overlay.style.opacity = styles.overlayOpacity;
    container.style.setProperty('--fs', styles.fontSize);
    container.style.setProperty('--cue', (styles.subtitleSize ?? 100) / 100);

    current = item;
    if (!item) {
      // Sin contenido se conserva lo dibujado (queda oculto por el modo), para que se desvanezca
      // en vez de desaparecer de golpe; lo que suene, se detiene.
      drawn?.view.stop?.();
      placePointer();
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
    if (!drawn) drawn = { kind: item.kind, view: def.draw(content, { stage: container, sound, thumbnail }) };
    drawn.view.update(item, { mode, styles });
    const key = keyOf(item);
    if (key !== lastKey && mode === 'live') content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    lastKey = key;
    applyLive();
    placePointer();
  }

  return {
    render,
    setPointer(next) {
      point = next;
      // Solo las pantallas que muestran el puntero vigilan su tamaño y el encuadre (las miniaturas, no).
      if (!placePointer.watching) {
        placePointer.watching = true;
        new ResizeObserver(placePointer).observe(container);
        content.addEventListener('transitionend', placePointer);
        content.addEventListener('load', placePointer, true);
      }
      placePointer();
    },
    // Qué punto del contenido al aire hay bajo unas coordenadas de la página (o null).
    pointAt: (clientX, clientY) => (current && container.dataset.mode === 'live' ? drawn?.view.spot?.(clientX, clientY) ?? null : null),
    // Estado en vivo de lo que está al aire (espacio "live" del servidor).
    setLive(next) {
      live = next;
      applyLive();
    },
    setSound(value) {
      if (sound === Boolean(value)) return;
      sound = Boolean(value);
      applyLive();
    },
    // ¿Lo dibujado sabe situar un punto? (con eso se puede señalar sobre él)
    pointable: () => Boolean(drawn?.view.locate),
    setListen(value) {
      if (listening === Boolean(value)) return;
      listening = Boolean(value);
      applyLive();
    },
  };
}
