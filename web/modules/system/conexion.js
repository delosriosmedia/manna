import { action, state, subscribe } from '../../core/api.js';
import { h, guard, pageZoom, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { whenLabel } from '../../core/time.js';
import { devicesBody } from './devices.js';

// Los dos botones de la barra de arriba del Control total: la conexión por internet (un wifi con ondas) y
// el código QR para conectar dispositivos. El wifi es un dibujo propio, no del sprite: cada onda es un elemento
// aparte para poder encenderlas una tras otra mientras conecta.
const WIFI = `<svg class="wifi" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path class="w1" d="M8.75 15.25a4.6 4.6 0 0 1 6.5 0"/><path class="w2" d="M5.5 12a9.2 9.2 0 0 1 13 0"/><path class="w3" d="M2.24 8.74a13.8 13.8 0 0 1 19.52 0"/></g><circle cx="12" cy="18.5" r="1.25" fill="currentColor"/><path class="slash" d="M4.5 4.5l15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

// status del servidor -> [data-state del botón, lo que dice]
const BUTTON = {
  off: ['off', 'Conexión por internet apagada'],
  starting: ['connecting', 'Conectando por internet…'],
  checking: ['connecting', 'Comprobando la conexión…'],
  on: ['on', 'Conectado por internet'],
  unchecked: ['unchecked', 'Conectado, sin comprobar la dirección'],
  error: ['error', 'Conexión por internet con un problema'],
  busy: ['error', 'La usa otro equipo'],
};

// «Encendida» solo cuando Manna entró por su dirección de internet y se contestó a sí mismo (lo comprueba cada minuto).
const NET = {
  off: 'Apagada.',
  starting: 'Conectando con Cloudflare…',
  checking: 'Conectada con Cloudflare. Comprobando que se llega a Manna desde internet…',
  on: 'Encendida y comprobada desde internet. Se entra por esta dirección:',
  unchecked: 'Conectada con Cloudflare, sin comprobar: falta la dirección del dominio propio («Cambiar el dominio propio»).',
  busy: 'Esta conexión ya la está usando otro equipo con Manna. Este no se conecta, para no cortar a quien entra desde fuera, y se conectará solo cuando el otro la suelte.',
};

// El estado dicho con frases. Mientras reintenta, el último problema sigue a la vista.
export const netText = (s) => (s.status === 'error' ? s.error
  : [NET[s.status], s.status === 'busy' && s.busy && `(El otro tiene Manna ${s.busy}.)`, s.error && `Último intento: ${s.error}`].filter(Boolean).join(' '));

function createInternetButton(onclick) {
  const button = h('button', { class: 'tool-btn tool-wifi', 'aria-expanded': 'false', 'aria-controls': 'tools-card', onclick });
  button.innerHTML = WIFI;
  const paint = (s) => {
    const [st, label] = BUTTON[s.status] || BUTTON.error;
    button.dataset.state = st;
    if (s.status === 'busy') button.dataset.why = 'busy';
    else delete button.dataset.why;
    button.setAttribute('aria-label', label);
    button.title = label;
  };
  paint({ status: 'off' });
  subscribe('internet', paint);
  return button;
}

const createDevicesButton = (onclick) => h('button', {
  class: 'tool-btn tool-qr', 'aria-label': 'Conectar dispositivos', title: 'Conectar dispositivos', 'aria-expanded': 'false', 'aria-controls': 'tools-card', onclick,
}, icon('qr-mini', 20));

// La barra de arriba del Control total: ambos en una píldora. A quien entra por internet no se le ofrece el wifi:
// apagarlo le cortaría a él mismo; tampoco a quien no es administrador (fase 35), que no puede encenderlo. Pulsar uno (pedido del dueño, 2026-10-18) agranda la píldora en su sitio hasta
// ser una tarjeta con lo suyo, y lo que hay a su izquierda se corre; se encoge al pulsarlo otra vez, con Esc, al
// tocar fuera o cuando el ratón lleva 2 s fuera. Con la tarjeta abierta, el otro botón cambia lo que dice.
// La píldora (.topbar-tools) ocupa su sitio en la barra y crece solo de ancho; la tarjeta (.tools-card) cuelga de
// ella hacia abajo, sin mover lo demás de su fila.
const WIDTH = 360;
const LEAVE_MS = 2000;
export const connectionTools = (me) => (ctx) => {
  const title = h('h2', { class: 'tools-title' });
  const panel = h('div', { class: 'tools-panel' });
  const wifi = !me.internet && Boolean(me.user?.admin) && createInternetButton(() => toggle('wifi'));
  const qr = createDevicesButton(() => toggle('qr'));
  const card = h('div', { class: 'tools-card glass', id: 'tools-card', onpointerenter: () => clearTimeout(leaving),
    onpointerleave: (e) => { if (e.pointerType === 'mouse' && open) leaving = setTimeout(close, LEAVE_MS); } },
  h('div', { class: 'tools-row' }, title, wifi, qr), panel);
  const slot = h('div', { class: 'topbar-tools', role: 'group', 'aria-label': 'Conexión' }, card);
  let open = null; // 'wifi' | 'qr'
  let stop = null; // deja de repintar lo de dentro
  let leaving = 0;
  let closed = null; // { w, h, slot }: la píldora cerrada, y lo que crece en la fila al abrirse
  let run = 0; // cada apertura o cierre invalida lo que quedaba por hacer del anterior

  const outside = (e) => { if (!card.contains(e.target)) close(); };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation(); // no cierra además el cajón (shell.js)
    close();
  };
  // Lleva la tarjeta a su tamaño con una transición corta; done() al terminar (o al instante sin animaciones).
  const resize = (w, hgt, done, slotW = w) => {
    const mine = ++run;
    card.style.width = `${card.offsetWidth}px`;
    card.style.height = `${card.offsetHeight}px`;
    void card.offsetWidth; // fija el punto de partida antes de cambiarlo
    card.classList.add('moving');
    card.style.width = `${w}px`;
    card.style.height = `${hgt}px`;
    slot.style.width = `${slotW}px`;
    const end = () => { if (mine === run) { card.classList.remove('moving'); done(); } };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) end();
    else setTimeout(end, 240);
  };
  // Lo que mide la tarjeta con su contenido, a lo ancho que tendrá.
  const measure = (w) => {
    const [ow, oh] = [card.style.width, card.style.height];
    card.style.width = `${w}px`;
    card.style.height = '';
    const hgt = card.offsetHeight;
    card.style.width = ow;
    card.style.height = oh;
    return hgt;
  };

  async function fill(which) {
    stop?.();
    stop = null;
    title.textContent = which === 'wifi' ? 'Conexión por internet' : 'Conectar dispositivos';
    if (which === 'wifi') {
      const body = internetBody(ctx, () => { close(); ctx.go('ajustes'); });
      stop = body.stop;
      panel.replaceChildren(...body.nodes);
    } else panel.replaceChildren(...await devicesBody(me.isLocal));
    for (const b of [wifi, qr].filter(Boolean)) b.setAttribute('aria-expanded', String(b === (which === 'wifi' ? wifi : qr)));
  }

  const toggle = guard(async (which) => {
    clearTimeout(leaving);
    if (open === which) return close();
    const first = !open;
    open = which;
    if (first) {
      // Si aún se estaba cerrando, la medida de cerrada es la de antes.
      if (!card.classList.contains('open')) {
        closed = { w: slot.offsetWidth, h: card.offsetHeight };
        slot.style.width = `${closed.w}px`;
        slot.style.height = `${closed.h}px`; // la tarjeta sale de la fila: la píldora guarda su alto
        card.style.width = `${closed.w}px`;
        card.style.height = `${closed.h}px`;
        card.classList.add('open');
      }
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', onKey, true);
    }
    // La tarjeta no pasa del ancho de la barra (en el celular, la cubre entera). La píldora crece lo que dejan los
    // huecos de la barra y lo que puede encoger el estado al aire; si no basta, la tarjeta pasa por encima. Se mide al
    // abrirla, cerrada: al cambiar de wifi a QR no se mueve.
    const bar = slot.closest('.topbar');
    const w = Math.min(WIDTH, bar.clientWidth);
    if (first) {
      const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      const inner = (el) => [...el.children].filter((c) => c.offsetWidth).reduce((sum, c) => sum + c.offsetWidth + gap, -gap);
      const status = bar.querySelector(':scope > .scene-status')?.offsetWidth || 0;
      const room = bar.clientWidth - [...bar.querySelectorAll(':scope > .tb-side')].reduce((sum, el) => sum + inner(el) + gap, 0) - status
        + Math.max(0, status - 160);
      closed.slot = Math.min(w, closed.w + Math.max(0, room));
    }
    panel.style.width = `${w}px`;
    // Anclada a la derecha de la píldora; si así se saldría por la izquierda (en el celular la píldora no está en el
    // borde), se corre hacia la derecha lo justo.
    const over = (bar.getBoundingClientRect().left - slot.getBoundingClientRect().right) / pageZoom() + w;
    card.style.right = over > 0 ? `${-over}px` : '';
    card.classList.add('filling');
    await fill(which);
    if (open !== which) return;
    resize(w, measure(w), () => { card.style.height = ''; }, closed.slot);
    requestAnimationFrame(() => card.classList.remove('filling'));
  });

  function close() {
    if (!open) return;
    // Si el foco estaba dentro (el PIN, un botón), vuelve al botón que la abrió en vez de perderse.
    if (card.contains(document.activeElement)) (open === 'wifi' ? wifi : qr).focus();
    open = null;
    clearTimeout(leaving);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', onKey, true);
    for (const b of [wifi, qr].filter(Boolean)) b.setAttribute('aria-expanded', 'false');
    card.classList.add('filling');
    resize(closed.w, closed.h, () => {
      stop?.();
      stop = null;
      panel.replaceChildren();
      title.textContent = '';
      card.classList.remove('open', 'filling');
      for (const el of [card, slot, panel]) el.removeAttribute('style');
    });
  }
  return slot;
};

// Lo de la conexión por internet: el estado en detalle, la dirección y encender o apagar. Se repinta mientras se ve.
function internetBody(ctx, more) {
  const text = h('p', { class: 'net-text' });
  const link = h('a', { target: '_blank', rel: 'noopener' });
  const address = h('p', { class: 'net-address', hidden: true }, link,
    h('button', { class: 'btn', onclick: guard(async () => {
      await navigator.clipboard.writeText(link.href);
      toast('Dirección copiada.');
    }) }, icon('copy', 15), 'Copiar'));
  const since = h('p', { class: 'muted', hidden: true });
  const toggle = h('button', { class: 'btn', onclick: guard(async () => {
    const on = !state.internet?.on;
    await action('internet.set', { on });
    toast(on ? 'Conectando por internet…' : 'Conexión por internet apagada.');
  }) });
  const stop = subscribe('internet', (s) => {
    text.textContent = netText(s);
    text.classList.toggle('warn', Boolean(s.error));
    address.hidden = !(s.status === 'on' && s.url);
    if (s.url) {
      link.href = s.url;
      link.textContent = s.url;
    }
    since.hidden = !(s.status === 'on' && s.since);
    if (s.since) since.textContent = `Comprobada desde ${whenLabel(s.since)}.`;
    toggle.replaceChildren(icon('power', 15), s.on ? 'Apagar' : 'Encender');
  });
  return {
    stop,
    nodes: [text, address, since, h('div', { class: 'row net-actions' },
      ctx.isLocal ? toggle : h('p', { class: 'muted' }, 'Solo se cambia desde el equipo principal.'),
      h('button', { class: 'btn', onclick: more }, icon('gear-six', 15), 'Más opciones en Ajustes'))],
  };
}
