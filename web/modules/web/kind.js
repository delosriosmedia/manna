import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';

// Tipo de contenido "página web": la página ocupa la pantalla dentro de un marco (iframe). Se dibuja
// siempre a 1920 × 1080 y se escala, para que tenga la misma disposición en el proyector y en una
// vista previa. La que no se deja mostrar dentro de Manna (item.window) la abre el proyector en su
// propia ventana: aquí, como en las miniaturas, solo se ve una tarjeta.
// Un archivo propio recibe las flechas que se pulsan desde cualquier dispositivo (live.presses): cada
// pantalla entrega a su marco las que le faltan y, si la página se recarga, todas desde el principio.
// En una capa (fase 31) el marco va sin fondo, y la página recibe { manna: 'capa', visible } al cargar y cada vez que
// se muestra u oculta: así sabe cuándo se ve de verdad lo que pone (el concurso del Sábado Joven lo usa).
const WIDTH = 1920;
const HEIGHT = 1080;
const where = (item) => (item.window ? 'Se ve en su propia ventana en el proyector' : item.file ? 'Archivo HTML' : new URL(item.url).hostname);

registerKind('web', {
  icon: 'globe',
  label: 'Página web',
  title: (item) => item.title,
  key: (item) => item.url,
  background: false,

  draw(host, { thumbnail, layer = false }) {
    const name = h('strong', {});
    const note = h('small', {});
    const card = h('div', { class: 'web-card' }, icon('globe', 48), name, note);
    host.replaceChildren(card);
    let frame = null;
    let presses = { presses: [], count: 0 };
    let seen = 0; // cuántas pulsaciones ha recibido ya el marco
    let shown = null; // en una capa: si se ve (lo último que se le dijo a la página)
    const tell = () => layer && shown != null && frame?.contentWindow?.postMessage({ manna: 'capa', visible: shown }, '*');
    const deliver = () => {
      const missing = presses.presses.slice(Math.max(0, presses.presses.length - (presses.count - seen)));
      seen = presses.count;
      for (const key of missing) frame?.contentWindow?.postMessage({ manna: 'tecla', key }, '*');
    };
    const fit = () => frame?.style.setProperty('--web-scale', Math.min(host.clientWidth / WIDTH, host.clientHeight / HEIGHT));
    const resize = new ResizeObserver(fit);
    resize.observe(host);

    return {
      update(item) {
        if (thumbnail || item.window) {
          frame?.remove();
          frame = null;
          name.textContent = item.title;
          note.textContent = where(item);
          card.hidden = false;
          return;
        }
        card.hidden = true;
        // Proyectarla otra vez la vuelve a abrir desde el principio.
        const key = `${item.uid}|${item.url}`;
        if (frame?.dataset.key === key) return;
        frame?.remove();
        // Un archivo propio, sin origen (no puede tocar Manna); una página de internet, con el suyo,
        // pero sin poder llevarse la proyección a otra dirección.
        frame = h('iframe', {
          class: 'web-frame', src: item.url, title: item.title, dataset: { key }, allow: 'autoplay; fullscreen', referrerpolicy: 'no-referrer',
          sandbox: item.file ? 'allow-scripts' : 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation',
        });
        frame.addEventListener('load', () => {
          seen = presses.count - presses.presses.length;
          deliver();
          tell();
        });
        host.append(frame);
        fit();
      },
      visible(on) {
        if (on === shown) return;
        shown = on;
        tell();
      },
      live(state) {
        presses = state?.presses ? state : { presses: [], count: 0 };
        if (seen > presses.count) seen = 0;
        deliver();
      },
      // Para el puntero: dónde cae un punto de la página (en fracciones del marco) y al revés.
      locate(x, y) {
        const r = frame?.getBoundingClientRect();
        return r?.width ? { x: r.left + x * r.width, y: r.top + y * r.height } : null;
      },
      spot(clientX, clientY) {
        const r = frame?.getBoundingClientRect();
        if (!r?.width) return null;
        const x = (clientX - r.left) / r.width;
        const y = (clientY - r.top) / r.height;
        return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
      },
      destroy: () => resize.disconnect(),
    };
  },

  controls(host, { send }) {
    const text = h('small', { class: 'muted sec' });
    const keys = h('div', { class: 'row web-keys' },
      h('button', { class: 'btn', 'aria-label': 'Página anterior', title: 'Página anterior (flecha izquierda de la página)', onclick: () => send({ key: 'ArrowLeft' }) }, icon('caret-left', 16), h('span', { class: 'lbl' }, 'Anterior')),
      h('button', { class: 'btn', 'aria-label': 'Página siguiente', title: 'Página siguiente (flecha derecha de la página)', onclick: () => send({ key: 'ArrowRight' }) }, h('span', { class: 'lbl' }, 'Siguiente'), icon('caret-right', 16)));
    host.replaceChildren(h('div', { class: 'live-part' }, keys, text));
    return {
      update(state, item) {
        keys.hidden = !(item.file || item.window);
        text.textContent = item.file
          ? 'Pasa la página como lo harían las flechas del teclado.'
          : item.window
            ? 'Se ve en su propia ventana en el proyector. Anterior y Siguiente le llegan como las flechas; lo demás, con el ratón del equipo principal.'
            : 'Se maneja con el ratón sobre la pantalla de proyección.';
      },
    };
  },
});
