import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { centerOf, FULL_VIEW, MAX_ZOOM, place, visible } from './view.js';

// Lo que se proyecta como una imagen que ocupa la pantalla entera (una imagen de Medios, una
// diapositiva): cómo se dibuja y cómo se gobierna su encuadre mientras está al aire. Cada tipo
// de contenido lo usa desde su kind.js:
//
//   registerKind('image', { …, draw: drawPicture, controls: pictureControls });
//
// El elemento que se dibuja lleva { url, width, height, fit } y, si la tiene, `thumb`: una versión
// pequeña, que basta para una miniatura.

// Las pantallas de proyección son casi siempre 16:9; los mandos marcan lo que se ve en una así.
const SCREEN = { W: 16, H: 9 };
const SEND_EVERY_MS = 60;
// Por debajo de este ancho (en píxeles reales) una miniatura se ve igual con la versión pequeña.
const SMALL = 420;

// La imagen ocupa la pantalla entera, completa (con bandas negras) o llenándola, y mientras
// está al aire se puede acercar y desplazar.
export function drawPicture(host) {
  const img = h('img', { alt: '', draggable: false });
  const box = h('div', { class: 'img-view' }, img);
  host.replaceChildren(box);
  let item = null;
  let view = null;
  let full = false; // ya se cargó la imagen grande de este elemento: no se vuelve a la pequeña

  function layout() {
    const W = host.clientWidth;
    const H = host.clientHeight;
    const iw = img.naturalWidth || item?.width;
    const ih = img.naturalHeight || item?.height;
    if (!item || !W || !H || !iw || !ih) return;
    const p = place({ W, H, iw, ih }, { fit: item.fit, ...FULL_VIEW, ...view });
    img.style.width = `${iw}px`;
    img.style.height = `${ih}px`;
    img.style.transform = `translate(${p.left}px, ${p.top}px) scale(${p.scale})`;
  }
  // Qué archivo se carga: en una miniatura sin acercar basta la versión pequeña.
  function load() {
    if (!item) return;
    const width = host.clientWidth * (window.devicePixelRatio || 1);
    // Una miniatura se dibuja antes de colocarse en la página, cuando aún no mide nada: si hay
    // versión pequeña, se espera a saber el tamaño (avisa el observador) en vez de pedir la grande.
    if (!width && item.thumb && !full) return;
    const small = item.thumb && !full && (view?.zoom || 1) <= 1.01 && width <= SMALL;
    const want = small ? item.thumb : item.url;
    if (!small) full = true;
    if (img.getAttribute('src') === want) return;
    box.classList.remove('ready');
    img.src = want;
  }
  // Una imagen recién cargada aparece ya en su sitio; solo después los cambios de encuadre se deslizan.
  img.addEventListener('load', () => {
    layout();
    requestAnimationFrame(() => box.classList.add('ready'));
  });
  const observer = new ResizeObserver(() => {
    load();
    layout();
  });
  observer.observe(host);

  return {
    update(next) {
      if (item?.url !== next.url) full = false;
      item = next;
      load();
      layout();
    },
    live(state) {
      view = state;
      load();
      layout();
    },
    destroy: () => observer.disconnect(),
  };
}

// Mandos del encuadre: la imagen entera con un marco que señala lo que se ve (se arrastra; la
// rueda o dos dedos acercan), el deslizador de acercar y «Vista completa».
//   fits: false quita los botones «Completa» / «Llenar» (una diapositiva siempre va completa).
export function pictureControls(host, { send }, { fits: withFits = true } = {}) {
  const fits = withFits ? [['contain', 'Completa'], ['cover', 'Llenar']].map(([id, label]) =>
    h('button', { class: 'btn grow', dataset: { fit: id }, onclick: () => push({ fit: id }) }, label)) : [];
  const thumb = h('img', { alt: '', draggable: false });
  const frame = h('div', { class: 'nav-frame' });
  const picture = h('div', { class: 'nav-img' }, thumb, frame);
  const nav = h('div', { class: 'nav', role: 'application', 'aria-label': 'Encuadre: arrastra para elegir qué parte de la imagen se ve; rueda o dos dedos para acercar' }, picture);
  const slider = h('input', { type: 'range', min: 1, max: MAX_ZOOM, step: 0.05, value: 1, 'aria-label': 'Acercar' });
  const amount = h('strong', { class: 'nav-zoom' }, '1,0×');
  const reset = h('button', { class: 'btn', title: 'Volver a la vista completa', onclick: () => push({ reset: true }) }, icon('arrows-out', 15), 'Vista completa');
  host.replaceChildren(
    h('div', { class: 'transport' }, ...fits),
    nav,
    h('div', { class: 'transport nav-row' }, icon('magnifying-glass-minus', 16), slider, icon('magnifying-glass-plus', 16), amount),
    h('div', { class: 'transport' }, reset));

  let item = null;
  let view = { fit: 'contain', ...FULL_VIEW };
  let busy = false;      // la persona está moviendo algo: manda lo que ella ve, no lo que llega
  let queued = null;     // lo que falta por enviar
  let sending = false;
  let lastSent = 0;

  // Las órdenes se juntan y se envían de una en una: arrastrar produce cientos por segundo.
  async function flush() {
    if (sending || !queued) return;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait > 0) { setTimeout(flush, wait); return; }
    sending = true;
    const patch = queued;
    queued = null;
    lastSent = Date.now();
    await send(patch);
    sending = false;
    flush();
  }
  function push(patch) {
    view = patch.reset ? { fit: view.fit, ...FULL_VIEW } : { ...view, ...patch };
    queued = patch.reset ? patch : { ...(queued?.reset ? {} : queued), ...patch };
    paint();
    flush();
  }

  const size = () => ({ ...SCREEN, iw: thumb.naturalWidth || item?.width || 16, ih: thumb.naturalHeight || item?.height || 9 });
  function paint() {
    const screen = size();
    // La imagen entera, tan grande como quepa en el recuadro.
    const r = Math.min(nav.clientWidth / screen.iw, nav.clientHeight / screen.ih) || 0;
    picture.style.width = `${screen.iw * r}px`;
    picture.style.height = `${screen.ih * r}px`;
    const v = visible(screen, view);
    Object.assign(frame.style, { left: `${v.left * 100}%`, top: `${v.top * 100}%`, width: `${v.width * 100}%`, height: `${v.height * 100}%` });
    frame.hidden = v.width > 0.999 && v.height > 0.999;
    fits.forEach((b) => b.classList.toggle('on', b.dataset.fit === view.fit));
    slider.value = view.zoom;
    amount.textContent = `${view.zoom.toFixed(1).replace('.', ',')}×`;
    reset.disabled = view.zoom === 1 && Math.abs(view.x - 0.5) < 0.001 && Math.abs(view.y - 0.5) < 0.001;
  }
  const zoomTo = (zoom) => push({ zoom: Math.max(1, Math.min(MAX_ZOOM, Math.round(zoom * 100) / 100)) });
  // Llevar el centro a un punto, sin pedir más de lo que la imagen permite.
  const moveTo = (x, y) => push(centerOf(size(), { ...view, x, y }));

  slider.addEventListener('input', () => zoomTo(Number(slider.value)));
  nav.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomTo(view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });

  // Un dedo (o el ratón) mueve el encuadre; dos dedos acercan y alejan.
  const fingers = new Map();
  let grab = null;   // distancia entre el dedo y el centro del encuadre al empezar
  let pinch = null;  // { distance, zoom } al poner el segundo dedo
  const at = (e) => {
    const r = picture.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };
  nav.addEventListener('pointerdown', (e) => {
    // Así el arrastre sigue aunque el dedo se salga del recuadro. Si el navegador no puede, se sigue igual.
    try { nav.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    fingers.set(e.pointerId, e);
    busy = true;
    if (fingers.size === 2) {
      pinch = { distance: spread(), zoom: view.zoom };
      return;
    }
    const p = at(e);
    const v = visible(size(), view);
    const inside = p.x >= v.left && p.x <= v.left + v.width && p.y >= v.top && p.y <= v.top + v.height;
    const center = centerOf(size(), view);
    // Tocar dentro del encuadre lo agarra; tocar fuera lo lleva ahí.
    grab = inside ? { dx: p.x - center.x, dy: p.y - center.y } : { dx: 0, dy: 0 };
    if (!inside) moveTo(p.x, p.y);
  });
  nav.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, e);
    if (pinch && fingers.size === 2) {
      zoomTo(pinch.zoom * (spread() / pinch.distance));
    } else if (grab) {
      const p = at(e);
      moveTo(p.x - grab.dx, p.y - grab.dy);
    }
  });
  const release = (e) => {
    fingers.delete(e.pointerId);
    pinch = null;
    grab = null;
    if (!fingers.size) busy = false;
  };
  nav.addEventListener('pointerup', release);
  nav.addEventListener('pointercancel', release);

  thumb.addEventListener('load', paint);
  const observer = new ResizeObserver(paint);
  observer.observe(nav);

  return {
    update(state, next) {
      // En el recuadro de los mandos basta la versión pequeña.
      const source = next.thumb || next.url;
      if (thumb.getAttribute('src') !== source) thumb.src = source;
      item = next;
      // Mientras la persona arrastra o queda algo por enviar, lo que llega es más viejo que lo que ve.
      if (!busy && !queued && !sending) view = { fit: next.fit, ...FULL_VIEW, ...state };
      paint();
    },
    destroy: () => observer.disconnect(),
  };
}
