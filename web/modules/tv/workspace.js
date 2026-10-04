import { action, api, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

// Módulo Televisores: un televisor de la red muestra la proyección desde su navegador.
// Manna le abre el navegador y le sirve de control remoto (teclas, puntero y texto).
const REFRESH_MS = 10_000;
const HELP_AFTER_MS = 9000;

const byId = (id) => (state.tv?.list || []).find((tv) => tv.id === id);

// Lo que se dice del televisor en una línea, y con qué tono.
function describe(tv) {
  if (tv.pairing) return { text: 'Acepta el aviso que aparece en el televisor…', tone: 'warn' };
  if (tv.showing) return { text: 'Mostrando la proyección', tone: 'ok' };
  if (tv.on === false) return { text: 'No responde: está apagado o fuera de la red', tone: 'off' };
  if (!tv.paired) return { text: tv.error || 'Falta vincularlo', tone: 'warn' };
  if (tv.arrival === 'rejected') return { text: 'Llegó a Manna, pero no aceptó la conexión segura', tone: 'warn' };
  if (tv.browser === 'open') return { text: 'Encendido · navegador abierto', tone: 'on' };
  return { text: tv.on ? 'Encendido' : 'Comprobando…', tone: tv.on ? 'on' : 'off' };
}

const statusLine = (tv) => {
  const { text, tone } = describe(tv);
  return h('span', { class: `status tv-status ${tone}` }, h('span', { class: 'tally' }), text);
};

// Qué hacer cuando el televisor llegó a Manna pero no muestra la proyección.
function advice(tv) {
  if (tv.showing || tv.on === false) return null;
  if (tv.arrival === 'rejected') {
    return 'El televisor encontró a Manna, pero su navegador se detuvo en un aviso de seguridad. En el televisor elige «Avanzado» (o «Detalles») y luego «Continuar»: la página es este equipo, no un sitio de internet.';
  }
  if (tv.arrival) return 'El televisor ya abrió Manna. Si ves la lista de funciones, elige «Pantalla de proyección».';
  return null;
}

// ---- Control remoto ----

function touchpad(id) {
  const pad = h('div', { class: 'pad', role: 'application', 'aria-label': 'Panel táctil: desliza para mover el puntero del televisor y toca para pulsar' },
    h('span', {}, 'Desliza para mover el puntero'), h('small', {}, 'Un toque pulsa'));
  let last = null;     // última posición del dedo
  let travelled = 0;
  let startedAt = 0;
  let pending = { dx: 0, dy: 0 };
  let sending = false;
  let failed = false;

  // Los movimientos se juntan y se envían de uno en uno, para no encolar órdenes viejas.
  async function flush() {
    if (sending || failed || (!pending.dx && !pending.dy)) return;
    sending = true;
    const { dx, dy } = pending;
    pending = { dx: 0, dy: 0 };
    try {
      await action('tv.move', { id, dx, dy });
    } catch (err) {
      failed = true;
      toast(err.message, 'error');
    }
    sending = false;
    flush();
  }

  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
    travelled = 0;
    startedAt = Date.now();
    failed = false;
    pad.classList.add('active');
  });
  pad.addEventListener('pointermove', (e) => {
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    travelled += Math.abs(dx) + Math.abs(dy);
    // Un poco más rápido que el dedo: la pantalla del televisor es mucho mayor que el panel.
    pending.dx += dx * 2;
    pending.dy += dy * 2;
    flush();
  });
  const end = guard(async () => {
    if (!last) return;
    const tap = travelled < 8 && Date.now() - startedAt < 500;
    last = null;
    pad.classList.remove('active');
    if (tap) await action('tv.click', { id });
  });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', () => { last = null; pad.classList.remove('active'); });
  return pad;
}

function openRemote(id, { guide = false } = {}) {
  const tv = byId(id);
  if (!tv) return;
  const key = (name, label, glyph) => h('button', {
    class: 'btn', 'aria-label': label, title: label,
    onclick: guard(() => action('tv.key', { id, key: name })),
  }, glyph.startsWith('icon:') ? icon(glyph.slice(5), 18) : glyph);

  const status = h('div', {});
  const help = h('p', { class: 'tv-help', hidden: true });
  const text = h('input', { class: 'input', placeholder: 'Texto para el televisor', 'aria-label': 'Texto para escribir en el televisor', enterKeyHint: 'send' });
  const type = guard(async () => {
    if (!text.value) return;
    await action('tv.text', { id, text: text.value });
    text.value = '';
  });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') type(); });
  const address = h('code', { class: 'tv-address' });
  api(`/api/tv/${id}/address`).then(({ url }) => { address.textContent = url; }).catch(() => {});

  const box = dialog(`Control de ${tv.name}`,
    status,
    help,
    touchpad(id),
    h('div', { class: 'remote-keys' },
      key('back', 'Atrás', 'icon:arrow-left'), key('up', 'Arriba', 'icon:caret-up'), key('home', 'Inicio del televisor', 'icon:house'),
      key('left', 'Izquierda', 'icon:caret-left'), key('ok', 'Aceptar', 'OK'), key('right', 'Derecha', 'icon:caret-right'),
      key('voldown', 'Bajar el volumen', 'icon:speaker-low'), key('down', 'Abajo', 'icon:caret-down'), key('volup', 'Subir el volumen', 'icon:speaker-high')),
    h('div', { class: 'row' }, text, h('button', { class: 'btn', onclick: type }, icon('keyboard', 16), 'Escribir')),
    h('details', { class: 'alt-addresses', open: guide },
      h('summary', {}, 'La primera vez: dejar el televisor listo'),
      h('ol', { class: 'steps' },
        h('li', {}, h('button', { class: 'link', onclick: guard(async () => { await action('tv.open', { id }); toast('Navegador abierto en el televisor.'); }) }, 'Abre el navegador del televisor'), '.'),
        h('li', {}, 'En el televisor, entra a la barra de direcciones, hasta que aparezca su teclado. Puedes usar este control o el del televisor.'),
        h('li', {}, h('button', { class: 'link', onclick: guard(async () => { await action('tv.address', { id }); toast('Dirección escrita en el televisor.'); }) }, 'Escribe la dirección de Manna'), ' con un toque, sin teclearla: ', address),
        h('li', {}, 'Si el televisor muestra un aviso de seguridad, elige «Avanzado» y «Continuar».'),
        h('li', {}, 'Cuando veas la proyección, guarda esa página como ', h('strong', {}, 'página de inicio'), ' en el menú del navegador del televisor. Desde entonces bastará con «Abrir la proyección».'))));

  let off = null;
  const render = () => {
    if (!box.el.isConnected) { off?.(); return; }
    const now = byId(id);
    if (!now) { box.close(); return; }
    status.replaceChildren(statusLine(now));
    const tip = advice(now);
    help.textContent = tip || '';
    help.hidden = !tip;
  };
  off = subscribe('tv', render);
}

// ---- Añadir ----

function openAdd() {
  const found = h('div', { class: 'tv-found' });
  const ip = h('input', { class: 'input', placeholder: '192.168.1.20', inputMode: 'decimal', 'aria-label': 'Dirección del televisor' });
  const add = guard(async (address) => {
    await action('tv.add', { ip: address });
    box.close();
    toast('Televisor añadido. Acepta el aviso que aparece en su pantalla.');
  });
  const search = h('button', { class: 'btn', onclick: guard(() => action('tv.search')) }, icon('magnifying-glass', 16), 'Buscar en la red');
  ip.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(ip.value); });

  const box = dialog('Añadir un televisor',
    h('p', { class: 'muted' }, 'El televisor debe estar encendido y en la misma red que este equipo. Por ahora, Manna gobierna televisores Samsung.'),
    h('div', { class: 'row' }, search),
    found,
    h('div', { class: 'label', style: 'margin-top: 16px;' }, 'O escribe su dirección'),
    h('div', { class: 'row' }, ip, h('button', { class: 'btn', onclick: () => add(ip.value) }, 'Añadir')),
    h('p', { class: 'muted', style: 'margin-top: 10px;' }, 'La dirección está en el televisor: Configuración › Conexión › Red › Estado de red › Configuración IP.'));

  let off = null;
  const render = ({ found: list, searching }) => {
    if (!box.el.isConnected) { off?.(); return; }
    search.disabled = searching;
    search.lastChild.textContent = searching ? 'Buscando…' : 'Buscar en la red';
    found.replaceChildren(...(searching || !list ? []
      : list.length ? list.map((tv) => h('div', { class: 'tv-row' },
        icon('television-simple', 20),
        h('span', { class: 'item-text' }, h('strong', {}, tv.name), h('small', {}, `${tv.model} · ${tv.ip}`)),
        h('button', { class: 'btn', onclick: () => add(tv.ip) }, 'Añadir')))
        : [h('p', { class: 'muted' }, 'No apareció ningún televisor Samsung nuevo. Comprueba que esté encendido, o escribe su dirección.')]));
  };
  off = subscribe('tv', render);
}

// ---- Pantalla del módulo ----

function mount(el) {
  const list = h('div', { class: 'tv-list' });
  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Televisores'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: openAdd }, icon('plus', 16), 'Añadir televisor')),
    h('div', { class: 'tvs' },
      h('p', { class: 'muted tv-intro' }, 'Un televisor de la misma red puede mostrar la proyección desde su navegador: sin cables y sin ocupar la salida del proyector. Manna le abre el navegador y le sirve de control remoto.'),
      list));

  const open = guard(async (id) => {
    await action('tv.open', { id });
    toast('Navegador abierto en el televisor.');
    // Si al rato no muestra la proyección, es que aún no se le ha dicho la dirección: se abre la guía.
    setTimeout(() => {
      if (el.hidden || document.querySelector('.modal-backdrop') || byId(id)?.showing !== false) return;
      openRemote(id, { guide: true });
    }, HELP_AFTER_MS);
  });

  const more = (tv, anchor) => menu(anchor, [
    { label: 'Cerrar el navegador del televisor', icon: 'x', disabled: tv.on === false, onclick: guard(() => action('tv.close', { id: tv.id })) },
    { label: tv.paired ? 'Vincular de nuevo' : 'Vincular', icon: 'arrows-left-right', onclick: guard(() => action('tv.pair', { id: tv.id })) },
    '-',
    { label: 'Quitar de la lista', icon: 'trash', onclick: guard(() => action('tv.remove', { id: tv.id })) },
  ]);

  subscribe('tv', ({ list: tvs = [] }) => {
    if (!tvs.length) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, 'Aún no hay televisores'),
        'Añade uno para abrirle la proyección desde aquí.',
        h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: openAdd }, icon('plus', 16), 'Añadir televisor'))));
      return;
    }
    list.replaceChildren(...tvs.map((tv) => {
      const tip = advice(tv);
      return h('article', { class: 'tv', dataset: { id: tv.id } },
        h('div', { class: 'tv-icon' }, icon('television-simple', 26)),
        h('div', { class: 'tv-text' },
          h('strong', {}, tv.name),
          h('small', {}, [tv.model, tv.ip].filter(Boolean).join(' · ')),
          statusLine(tv)),
        h('div', { class: 'tv-actions' },
          !tv.paired && !tv.pairing
            ? h('button', { class: 'btn primary', onclick: guard(() => action('tv.pair', { id: tv.id })) }, 'Vincular')
            : h('button', { class: 'btn primary', disabled: tv.pairing, onclick: () => open(tv.id) }, icon('monitor', 16), 'Abrir la proyección'),
          h('button', { class: 'btn', disabled: !tv.paired, onclick: () => openRemote(tv.id) }, 'Control remoto'),
          h('button', { class: 'icon-btn', 'aria-label': `Más opciones de ${tv.name}`, onclick: (e) => more(tv, e.currentTarget) }, icon('dots-three', 18))),
        tip && h('p', { class: 'tv-help' }, tip));
    }));
  });

  // El estado de cada televisor se consulta solo mientras esta pantalla está a la vista.
  const refresh = () => {
    if (el.hidden || document.visibilityState !== 'visible' || !state.tv?.list?.length) return;
    action('tv.refresh').catch(() => {});
  };
  setInterval(refresh, REFRESH_MS);
  return { onShow: refresh };
}

export default { id: 'televisores', name: 'Televisores', icon: 'television-simple', place: 'bottom', mount };
