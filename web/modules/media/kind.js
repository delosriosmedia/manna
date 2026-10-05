import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { centerOf, FULL_VIEW, MAX_ZOOM, place, visible } from './view.js';

// Las pantallas de proyección son casi siempre 16:9; los mandos marcan lo que se ve en una así.
const SCREEN = { W: 16, H: 9 };
const SEND_EVERY_MS = 60;

// Tipo de contenido "imagen": ocupa la pantalla entera, completa (con bandas negras) o llenándola,
// y mientras está al aire se puede acercar y desplazar.
registerKind('image', {
  icon: 'image',
  label: 'Imagen',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.url,
  background: false,

  draw(host) {
    const img = h('img', { alt: '', draggable: false });
    const box = h('div', { class: 'img-view' }, img);
    host.replaceChildren(box);
    let item = null;
    let view = null;

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
    // Una imagen recién cargada aparece ya en su sitio; solo después los cambios de encuadre se deslizan.
    img.addEventListener('load', () => {
      layout();
      requestAnimationFrame(() => box.classList.add('ready'));
    });
    const observer = new ResizeObserver(layout);
    observer.observe(host);

    return {
      update(next) {
        if (item?.url !== next.url) {
          box.classList.remove('ready');
          img.src = next.url;
        }
        item = next;
        layout();
      },
      live(state) {
        view = state;
        layout();
      },
      destroy: () => observer.disconnect(),
    };
  },

  controls(host, { send }) {
    const fits = [['contain', 'Completa'], ['cover', 'Llenar']].map(([id, label]) =>
      h('button', { class: 'btn grow', dataset: { fit: id }, onclick: () => push({ fit: id }) }, label));
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
        if (item?.url !== next.url) thumb.src = next.url;
        item = next;
        // Mientras la persona arrastra o queda algo por enviar, lo que llega es más viejo que lo que ve.
        if (!busy && !queued && !sending) view = { fit: next.fit, ...FULL_VIEW, ...state };
        paint();
      },
      destroy: () => observer.disconnect(),
    };
  },
});
