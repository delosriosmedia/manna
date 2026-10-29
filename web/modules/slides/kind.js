import { api, subscribe } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { registerKind } from '../../core/kinds.js';
import { drawPicture, pictureControls } from '../projection/picture.js';

// DeckCraft con animaciones (fase 33, parte 3): una presentación con `deckcraft` la pasa DeckCraft (su versión web, la
// copia de Manna) en la pantalla que suena, que es la ventana del proyector del equipo principal, encima de la imagen
// de la diapositiva (que queda debajo por si no arranca, y es lo que ven las demás pantallas y las miniaturas).
// DeckCraft dice por dónde va (su diapositiva cuenta también las ocultas, que salta: `hidden`) y esta pantalla se lo
// dice a Manna; las teclas de «Siguiente» y «Anterior» le llegan del espacio `deckcraft`. Acercada, se ve la imagen.
function drawDeckCraft(host, picture) {
  let item = null;
  let sound = false;
  let zoomed = false;
  let frame = null;   // { el, id, open, hidden, page, step, recent, timer }
  let presses = { count: 0, key: null };
  const report = (body) => api('/api/slides/deckcraft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  const tell = (msg) => frame?.el.contentWindow?.postMessage(msg, location.origin);
  // La diapositiva de Manna (1…, sin las ocultas) y la de DeckCraft (0…, con ellas).
  const toPage = (index) => (index == null ? null : index + 1 - frame.hidden.filter((i) => i < index).length);
  const toIndex = (page) => { let i = -1; for (let seen = 0; seen < (page || 1); ) { i += 1; if (!frame.hidden.includes(i)) seen += 1; } return i; };

  function close() {
    if (!frame) return;
    clearInterval(frame.timer);
    frame.el.remove();
    frame = null;
  }
  function open() {
    close();
    const mine = { id: item.id, open: false, hidden: [], page: null, step: 0, recent: [], seen: presses.count };
    mine.el = h('iframe', { class: 'deckcraft-frame', src: '/deckcraft/index.html?blank', allow: 'autoplay; fullscreen', title: 'DeckCraft' });
    mine.el.hidden = true;
    mine.timer = setInterval(() => mine.open && report({ id: mine.id, page: mine.page, step: mine.step }), 10_000);
    frame = mine;
    host.append(mine.el);
  }
  async function heard(e) {
    if (!frame || e.source !== frame.el.contentWindow || e.origin !== location.origin) return;
    const msg = e.data || {};
    if (msg.deckcraft === 'ready') {
      const mine = frame;
      const res = await fetch(`/api/slides/${encodeURIComponent(mine.id)}/original`).catch(() => null);
      if (!res?.ok || frame !== mine) return;
      const bytes = await res.arrayBuffer();
      tell({ deckcraft: 'open', name: `${mine.id}.pptx`, bytes, from: 0 });
    }
    if (msg.deckcraft !== 'state') return;
    frame.hidden = Array.isArray(msg.hidden) ? msg.hidden : [];
    const page = toPage(msg.slide);
    // Sin pase, o pasado de la última: se ve la imagen, y Manna sigue con lo que venga.
    if (msg.slide == null || msg.ended) {
      if (frame.open && msg.ended) report({ id: frame.id, page: frame.page, step: frame.step, ended: true });
      frame.el.hidden = true;
      frame.open = false;
      return;
    }
    // Recién abierta: primero a la diapositiva que está al aire.
    if (!frame.open && item && page !== item.number) {
      tell({ deckcraft: 'goto', slide: toIndex(item.number) });
      return;
    }
    frame.open = true;
    frame.el.hidden = zoomed;
    if (page !== frame.page || msg.step !== frame.step) {
      frame.page = page;
      frame.step = msg.step;
      frame.recent = [...frame.recent.filter((r) => Date.now() - r.at < 3000), { page, at: Date.now() }];
      report({ id: frame.id, page, step: msg.step });
    }
  }
  window.addEventListener('message', heard);
  const stop = subscribe('deckcraft', (d) => {
    const fresh = d.count - (frame?.seen ?? d.count);
    presses = d;
    if (!frame) return;
    frame.seen = d.count;
    if (frame.open) for (let i = 0; i < Math.min(fresh, 5); i += 1) tell({ deckcraft: 'key', key: d.key });
  });

  // moved: llegó otra cosa al aire. Solo entonces se lleva DeckCraft a otra diapositiva: los mandos en vivo de la
  // diapositiva nueva llegan antes que ella, y con lo de antes todavía aquí lo devolverían adonde estaba.
  function sync(moved = false) {
    if (!item?.deckcraft || !sound) { close(); return; }
    if (frame?.id !== item.id) open();
    frame.el.hidden = !frame.open || zoomed;
    // Elegida otra diapositiva desde Manna (no la que acaba de decir DeckCraft): allá va.
    if (moved && frame.open && item.number !== frame.page && !frame.recent.some((r) => r.page === item.number)) tell({ deckcraft: 'goto', slide: toIndex(item.number) });
  }
  return {
    ...picture,
    update(next, extra) {
      picture.update(next, extra);
      const moved = next?.uid !== item?.uid;
      item = next;
      sync(moved);
    },
    live(state, extra) {
      picture.live(state, extra);
      sound = Boolean(extra?.sound) && !extra?.still;
      zoomed = (state?.zoom || 1) > 1.01;
      sync();
    },
    destroy() {
      window.removeEventListener('message', heard);
      stop();
      close();
      picture.destroy();
    },
  };
}

// Tipo de contenido "diapositivas": cada diapositiva es una imagen que ocupa la pantalla. Se
// dibuja y se encuadra como cualquier imagen (projection/picture.js); sus mandos añaden por dónde
// va la presentación y cuál es la diapositiva que viene.
registerKind('slides', {
  icon: 'presentation-chart',
  label: 'Diapositivas',
  unit: ['diapositiva', 'diapositivas'],
  title: (item) => `${item.title} · ${item.number} de ${item.pages}`,
  // Con DeckCraft, toda la presentación es una: el escenario no funde al pasar (DeckCraft hace su transición).
  key: (item) => (item.deckcraft ? `deckcraft|${item.id}` : item.url),
  background: false,
  draw: (host, options) => (options?.thumbnail ? drawPicture(host, options) : drawDeckCraft(host, drawPicture(host, options))),

  controls(host, tools) {
    const where = h('strong', {});
    const left = h('small', { class: 't3' });
    const picture = h('img', { alt: '' });
    const label = h('span', {});
    const next = h('div', { class: 'slide-next t3' }, h('span', { class: 'slide-next-thumb' }, picture), h('span', { class: 'slide-next-text' }, h('small', {}, 'Sigue'), label));
    const info = h('div', { class: 'slide-info' }, h('div', { class: 'slide-count' }, where, left), next);
    // Los mandos del encuadre van debajo, tal cual; sin «Completa / Llenar»: una diapositiva va siempre entera.
    // Si la pasa PowerPoint, se dice debajo.
    const framing = h('div', { class: 'live-part slide-framing' });
    const ppt = h('p', { class: 'slide-ppt muted sec' }, 'La pasa PowerPoint en el proyector, con sus videos y animaciones: «Siguiente» avanza también las animaciones, y «Señalar» se ve encima. Al acercarla, PowerPoint se aparta hasta volver a la vista completa.');
    const covered = h('p', { class: 'slide-ppt muted sec' }, 'Hay una capa a la vista: PowerPoint la taparía, así que va como imágenes. Para pasarla con PowerPoint, oculta la capa en «Capas».');
    const deckcraft = h('p', { class: 'slide-ppt muted sec' }, 'La pasa DeckCraft en el proyector, con sus animaciones y transiciones: «Siguiente» avanza también las animaciones. Las demás pantallas ven la imagen de la diapositiva. Al acercarla se ve la imagen, hasta volver a la vista completa.');
    host.replaceChildren(info, framing, ppt, covered, deckcraft);
    const view = pictureControls(framing, tools, { fits: false });

    return {
      update(state, item) {
        const remaining = item.pages - item.number;
        where.replaceChildren(h('span', { class: 'lbl' }, 'Diapositiva '), `${item.number} de ${item.pages}`);
        left.textContent = remaining === 0 ? 'Es la última' : remaining === 1 ? 'Queda 1' : `Quedan ${remaining}`;
        next.classList.toggle('none', !item.next);
        if (item.next) {
          if (picture.getAttribute('src') !== item.next.thumb) picture.src = item.next.thumb;
          label.textContent = `Diapositiva ${item.next.number}`;
        } else {
          picture.removeAttribute('src');
          label.textContent = 'Fin de la presentación';
        }
        ppt.hidden = !item.powerpoint;
        deckcraft.hidden = !item.deckcraft;
        covered.hidden = !item.covered;
        view.update(state, item);
      },
      destroy: () => view.destroy(),
    };
  },
});
