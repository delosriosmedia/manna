import { action, connect, onServerUpdate, state, stepAir, subscribe } from './api.js';
import { keepAwake } from './despierto.js';
import { isMobile, layoutFor } from './disposicion.js';
import { can } from './session.js';
import { watchBlocked } from './blocked.js';
import { mountConnectionBar } from './connection.js';
import { h, allowLeaving, confirmBeforeClose, dialog, go, guard, menu, pageZoom, toast } from './dom.js';
import { icon } from './icons.js';
import { joinNames, missingFor, toolsOf } from './needs.js';
import { prefs } from './prefs.js';
import { chooseContent, contentMissing } from './contenido.js';

// Estructura de las funciones de control: el «Escenario» (fase 13 de docs/PLAN.md).
// Lo que está al aire ocupa el fondo; encima flotan la barra de arriba, el dock de módulos, el cajón
// del módulo abierto, la cola del culto y la barra de transporte. Esas piezas
// las hace createScene (modules/projection/escenario.js), que cada función le pasa. En el celular
// (< 860 px) es «Historias»: la proyección en un recuadro arriba, y los módulos en cajones que suben.
//
// Un módulo es { id, name, icon, place?, soon?, needs?, mount(el, ctx) }:
//   place   'bottom' lo coloca al final del dock (Ajustes no sale en el dock: lo abre el logo, arriba)
//   soon    previsto pero aún no construido: no sale
//   hidden  en pausa: existe y se abre por su dirección (#id), pero no sale en el dock
//   needs   programas del equipo principal que necesita (ver core/needs.js)
//   mount   dibuja el módulo en el y puede devolver { onShow(), keys(evento) -> true si lo atendió, part(id) }
// ctx (lo que recibe cada módulo): { role, isLocal, user, can(permiso), layout(), canProject, has(id), go(id, parte?), setPart(id) }. user es quien
// entró ({ id, name, admin }, fase 35): Ajustes solo lo tiene el administrador. Sin canProject (preparar el culto), los
// módulos no ofrecen «Proyectar»: añaden al orden.
//   setPart  un módulo con pestañas dice en cuál está, para avisar solo de lo que le falta a esa
//
// layout 'full' (Presentador): el único módulo ocupa la pantalla entera, sin escenario.
// layout 'pestanas' (Preparar el culto, en la nube; fase 36): sin escenario ni proyección. El dock son las pestañas (a la
// izquierda; abajo en el celular) y el módulo elegido ocupa el resto. createScene solo da { preview } (escuchar).
// topTools: [(ctx) => nodo]: lo que va al final de la barra de arriba (el wifi y el QR del Control total).
// createLiveScene: la pantalla de un celular o una tableta («En vivo», modules/envivo/escena.js), si la función la tiene. Su compose() la arma
// con la marca, el dock y el cajón, que son de aquí; el módulo abierto sube dentro de ella, sin fondo oscuro.
// liveDock: los módulos que van en su dock; los demás se abren desde la pantalla (Alabanza: «Ver todo el orden»).
export function createShell({ role, isLocal, user = null, modules, topTools = [], createScene, createLiveScene = null, liveDock = null, layout = 'escena', church = null }) {
  // Lo que el superadministrador dejó a esta iglesia (fase 39): sin los módulos apagados y, si los ordenó, en su orden
  // (el primero es el que se abre cuando este dispositivo no recuerda otro).
  const arranged = church?.layout?.[role] || [];
  const rank = (m) => (arranged.includes(m.id) ? arranged.indexOf(m.id) : arranged.length + modules.indexOf(m));
  const usable = modules.filter((m) => !m.soon && (m.id !== 'ajustes' || user?.admin) && !church?.off?.includes(m.id)).sort((a, b) => rank(a) - rank(b));
  const listed = usable.filter((m) => !m.hidden);
  const mounted = new Map(); // id -> { el, api }
  let current = null;
  const full = layout === 'full';
  const tabs = layout === 'pestanas';
  const bare = full || tabs; // sin escenario
  const narrow = matchMedia('(max-width: 859px)');
  const landscape = matchMedia('(max-width: 859px) and (max-height: 480px)');
  // Qué disposición le toca a este dispositivo (decisión 71): la dicen data-disposicion y `ctx.layout()`.
  const mobile = isMobile({ main: isLocal, forced: /[?&]tactil/.test(location.search), coarse: matchMedia('(pointer: coarse)').matches, ipad: navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1, android: /Android/.test(navigator.userAgent) });
  const layoutNow = () => layoutFor({ mobile, width: innerWidth, height: innerHeight });
  // Entre el computador y el resto cambian las piezas enteras: se vuelve a abrir la página (lo compartido está en el servidor).
  const onComputer = layoutNow() === 'computador';
  const paintLayout = () => {
    document.documentElement.dataset.disposicion = layoutNow();
    if (createLiveScene && (layoutNow() === 'computador') !== onComputer) {
      allowLeaving();
      location.reload();
    }
  };
  paintLayout();
  addEventListener('resize', paintLayout);
  if (mobile && !tabs) keepAwake();

  const notice = h('div', { class: 'ws-notice', role: 'status', hidden: true });
  const work = h('div', { class: 'work' });
  // go(id, parte): abre un módulo y, si lo admite (part en lo que devuelve su mount), una de sus pestañas.
  const ctx = { role, isLocal, user, can, layout: layoutNow, canProject: !tabs, has: (id) => usable.some((m) => m.id === id), go: (id, part) => { show(id); if (part) current?.api.part?.(part); } };
  const inline = !bare && Boolean(createLiveScene) && !onComputer; // «En vivo»: el cajón va dentro de la pantalla
  const scene = full ? null : (inline ? createLiveScene : createScene)({ ...ctx, openControls: () => openControls() });
  // Escuchar algo solo en este dispositivo antes de añadirlo ({ url, title }); null en el equipo principal.
  ctx.listen = scene?.preview ? (what) => scene.preview.play(what) : null;

  // ---- Barra de arriba: la marca, el estado y «Buscar en todo» ----
  // La marca (pedido del dueño, 2026-10-18): el logo abre Ajustes (que ya no está en el dock), la versión al lado y
  // un botón aparte para cambiar la función de este dispositivo. Sin Ajustes (las demás funciones), el logo no es botón.
  const ROLE_NAMES = { control: 'Control total', alabanza: 'Alabanza', presentador: 'Orador completo', 'orador-sencillo': 'Orador sencillo', preparacion: 'Preparar el culto', administrar: 'Administrar la iglesia', superadmin: 'Superadministrador' };
  const settings = usable.find((m) => m.id === 'ajustes');
  const version = h('small', { class: 'brand-version' });
  subscribe('system', (s) => { version.textContent = s.version || ''; });
  const logo = h('img', { src: '/logo.svg', alt: settings ? '' : 'Manna' });
  const brandMark = settings
    ? h('button', { class: 'brand-mark', dataset: { id: settings.id }, title: 'Ajustes', 'aria-label': 'Ajustes', 'aria-pressed': 'false', onclick: () => (current?.id === settings.id && isOpen() ? closeDrawer() : show(settings.id)) }, logo)
    : h('span', { class: 'brand-mark' }, logo);
  const brand = h('div', { class: 'brand glass' }, brandMark,
    h('span', { class: 'brand-text', 'aria-hidden': 'true' }, h('strong', {}, 'Manna'), version),
    h('button', { class: 'brand-switch', title: `Cambiar de función (ahora, ${ROLE_NAMES[role] || role})`, 'aria-label': 'Cambiar de función', onclick: () => {
      if (!inline || !state.projection?.item) { go('/'); return; }
      // En un celular, un toque de más en pleno culto no saca a nadie de su pantalla (DESIGN.md 12 ter, regla 3).
      const box = dialog('¿Cambiar de función?', h('p', {}, 'Hay algo al aire. Seguirá al aire aunque salgas de esta pantalla.'),
        h('div', { class: 'row', style: 'justify-content: flex-end;' },
          h('button', { class: 'btn', onclick: () => box.close() }, 'Quedarme'),
          h('button', { class: 'btn primary', onclick: () => go('/') }, 'Cambiar')));
    } }, icon('arrows-left-right', 16)));
  // Tres columnas: a la izquierda la marca y «Solo fondo» y «Negro»; al centro, «Al aire» en su burbuja; a la derecha
  // el proyector, «Buscar en todo» y lo de cada función (wifi y QR).
  const top = h('header', { class: 'topbar' },
    h('div', { class: 'tb-side' }, brand, scene?.modes),
    scene?.status,
    h('div', { class: 'tb-side end' }, scene?.power, scene?.search?.button, ...topTools.map((make) => make(ctx))));

  // ---- Dock de módulos y cajón ----
  const dockbar = h('nav', { class: 'dockbar glass', 'aria-label': 'Módulos' });
  const dockButton = (m) => h('button', { class: 'dock-item', dataset: { id: m.id }, title: m.name, 'aria-label': m.name, 'aria-pressed': 'false', onclick: () => (current?.id === m.id && isOpen() && !tabs ? closeDrawer() : show(m.id)) },
    icon(m.icon, 20), h('span', { class: 'dock-name' }, m.name));
  // Ajustes se abre con el logo (arriba), no desde el dock.
  const docked = listed.filter((m) => m !== settings);
  // «En vivo»: primero ella, aunque la iglesia ordene los módulos; luego cinco módulos y, si hay más, «Módulos».
  const inDock = !inline ? docked : liveDock ? docked.filter((m) => liveDock.includes(m.id)) : docked.length > 6 ? docked.slice(0, 5) : docked;
  const inMenu = liveDock ? [] : docked.filter((m) => !inDock.includes(m));
  const liveItem = inline && h('button', { class: 'dock-item', 'aria-label': 'En vivo', 'aria-pressed': 'false', onclick: () => closeDrawer() }, icon('screencast', 16), h('span', { class: 'dock-name' }, 'En vivo'));
  const moreItem = inMenu.length > 0 && h('button', { class: 'dock-item', 'aria-label': 'Más módulos', 'aria-haspopup': 'menu', onclick: () => menu(moreItem, inMenu.map((m) => ({ label: m.name, icon: m.icon, onclick: () => show(m.id) }))) }, icon('dots-three', 16), h('span', { class: 'dock-name' }, 'Módulos'));
  if (inline) dockbar.append(...[liveItem, ...inDock.map(dockButton), moreItem].filter(Boolean));
  else dockbar.append(...docked.filter((m) => m.place !== 'bottom').map(dockButton), h('span', { class: 'dock-fill' }), ...docked.filter((m) => m.place === 'bottom').map(dockButton));
  if (listed.length < 2 && !full) dockbar.classList.add('single');
  if (tabs) dockbar.setAttribute('aria-label', 'Pestañas');

  const drawerTitle = h('h2', {});
  const wideButton = h('button', { class: 'icon-btn sm drawer-wide', onclick: () => setWide(!drawer.classList.contains('wide')) });
  const closeButton = h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar el cajón', title: 'Cerrar (Esc)', onclick: () => closeDrawer() }, icon('x', 16));
  // Ampliar y cerrar (y, en el celular, el estado de lo al aire) viven en la cabecera del módulo abierto, para que el
  // cajón tenga una sola fila de cabecera y el nombre salga una vez; en el cajón reducido del celular y en un módulo
  // sin cabecera, en la fila propia del cajón (dockActions).
  const actions = h('div', { class: 'drawer-actions' }, scene?.mini, wideButton, closeButton);
  const drawerHead = h('div', { class: 'drawer-head' }, drawerTitle, actions);
  // El borde libre del cajón reducido, para hacerlo más grande o más pequeño sin moverlo (ver «Tamaño», abajo).
  const grip = h('div', { class: 'drawer-grip', role: 'separator', tabindex: '0', 'aria-label': 'Cambiar el tamaño del cajón', title: 'Arrastra para cambiar el tamaño' });
  const drawer = h('section', { class: 'drawer glass', hidden: true, tabindex: '-1' }, grip, drawerHead, notice, work);
  // En el celular el cajón sube desde abajo y se cierra al tocar fuera.
  const backdrop = h('div', { class: 'drawer-backdrop', hidden: true, onclick: () => closeDrawer() });
  const isOpen = () => tabs || !drawer.hidden; // con pestañas, la elegida está siempre abierta
  // Cada disposición recuerda lo suyo: en el escritorio, cajón ancho o estrecho; en el celular, reducido (se
  // ve lo que está al aire encima, y el módulo enseña solo lo esencial: clase «compact») o a pantalla completa.
  // De partida, ancho en el escritorio y reducido en el celular (decisión del dueño, 2026-10-15), salvo en uno
  // bajo (menos de 700 px), donde reducido no deja sitio. Un módulo con `full` (Ajustes) se abre siempre completo
  // en el celular.
  // En «En vivo» se abre siempre entre la vista y la franja (ampliado, tapa la vista); salvo en la tableta de pie, lleva lo esencial.
  const wideKey = () => (inline ? 'envivo.ancho' : narrow.matches ? 'cajon.completo' : 'cajon.ancho');
  const forcedFull = () => (inline || narrow.matches) && Boolean(usable.find((m) => m.id === current?.id)?.full);
  const preferredWide = () => forcedFull() || prefs.get(wideKey(), inline ? false : !narrow.matches || innerHeight < 700);
  function setWide(wide) {
    prefs.set(wideKey(), wide);
    paintSize(wide);
  }
  function paintSize(wide) {
    drawer.classList.toggle('wide', wide);
    drawer.classList.toggle('compact', (inline ? layoutNow() !== 'tableta-pie' : narrow.matches) && !wide);
    wideButton.hidden = forcedFull();
    wideButton.replaceChildren(icon(wide ? 'arrows-in' : 'arrows-out', 16));
    const label = inline || narrow.matches ? (wide ? 'Reducir el cajón' : 'Ampliar a pantalla completa') : (wide ? 'Hacer el cajón más estrecho' : 'Ampliar el cajón');
    wideButton.setAttribute('aria-label', label);
    wideButton.title = label;
    dockActions();
  }
  function dockActions() {
    // En «En vivo», siempre con el módulo: cada fila cuenta, y su nombre ya lo dice el dock.
    const own = mounted.get(current?.id)?.el.querySelector(':scope > .ws-head');
    const head = own && (inline ? getComputedStyle(own).display !== 'none' : !drawer.classList.contains('compact')) && own;
    (head || drawerHead).append(actions); // append mueve el nodo: el foco no se pierde
    actions.classList.toggle('in-ws', Boolean(head));
    drawerHead.hidden = Boolean(head);
    measureActions();
  }
  // Lo que ocupan ampliar y cerrar (cambia con lo que está al aire, en el celular): la cabecera les guarda ese sitio.
  const measureActions = () => actions.parentElement?.style.setProperty('--acts-w', `${actions.offsetWidth}px`);
  new ResizeObserver(measureActions).observe(actions);
  // Con el teclado, el foco entra en el cajón al abrirlo (si el módulo no lo pone en otro sitio) y vuelve a su botón
  // del dock al cerrarlo.
  function openDrawer() {
    drawer.hidden = false;
    backdrop.hidden = inline || !narrow.matches;
    document.body.classList.add('drawer-open');
    if (!drawer.contains(document.activeElement)) drawer.focus({ preventScroll: true });
  }
  function closeDrawer() {
    const inside = drawer.contains(document.activeElement);
    drawer.hidden = true;
    if (inside) dockbar.querySelector(`.dock-item[data-id="${current?.id}"]`)?.focus({ preventScroll: true });
    backdrop.hidden = true;
    document.body.classList.remove('drawer-open');
    paintDock();
    scene?.preview?.stop();
    document.title = 'Manna';
    history.replaceState(null, '', location.pathname);
  }
  // ---- Tamaño del cajón reducido ----
  // Se arrastra su borde libre: el derecho en el escritorio (el cajón sale del dock, a la izquierda), el de
  // arriba en el celular y el izquierdo en el celular en horizontal. Nunca se mueve, y el CSS lo limita para
  // que no tape la barra de arriba, el dock, la cola ni la barra de abajo. Cada disposición lo recuerda.
  const sizeKey = () => (!narrow.matches ? 'cajon.medida' : landscape.matches ? 'cajon.lado' : 'cajon.alto');
  const SIZE_VARS = ['--drawer-w', '--drawer-top', '--drawer-left'];
  function applySize() {
    for (const v of SIZE_VARS) drawer.style.removeProperty(v);
    const saved = prefs.get(sizeKey(), null);
    if (typeof saved !== 'number') return;
    if (!narrow.matches) drawer.style.setProperty('--drawer-w', `${saved}px`);
    else if (landscape.matches) drawer.style.setProperty('--drawer-left', `${Math.round(saved * innerWidth / pageZoom())}px`);
    else drawer.style.setProperty('--drawer-top', `${Math.round(saved * innerHeight / pageZoom())}px`);
  }
  // `grab`: dónde se cogió el borde, para que siga al dedo sin saltar hasta él.
  let grab = { dx: 0, dy: 0 };
  // Lo medido (el puntero, getBoundingClientRect) va en píxeles de pantalla; las medidas del CSS, en los de la página.
  function sizeTo(x, y) {
    const z = pageZoom();
    if (!narrow.matches) drawer.style.setProperty('--drawer-w', `${Math.round((x + grab.dx - drawer.getBoundingClientRect().left) / z)}px`);
    else if (landscape.matches) drawer.style.setProperty('--drawer-left', `${Math.round((x - grab.dx) / z)}px`);
    else drawer.style.setProperty('--drawer-top', `${Math.round((y - grab.dy) / z)}px`);
  }
  // Se guarda lo que de verdad mide (ya limitado por el CSS), y se vuelve a poner así.
  function saveSize() {
    const r = drawer.getBoundingClientRect();
    prefs.set(sizeKey(), !narrow.matches ? Math.round(r.width / pageZoom()) : landscape.matches ? r.left / innerWidth : r.top / innerHeight);
    applySize();
  }
  grip.addEventListener('pointerdown', (e) => {
    if (drawer.classList.contains('wide')) return;
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch { /* sin captura, se sigue igual */ }
    const r = drawer.getBoundingClientRect();
    grab = { dx: narrow.matches ? e.clientX - r.left : r.right - e.clientX, dy: e.clientY - r.top };
    drawer.classList.add('sizing');
  });
  grip.addEventListener('pointermove', (e) => { if (drawer.classList.contains('sizing')) sizeTo(e.clientX, e.clientY); });
  const endSizing = () => {
    if (!drawer.classList.contains('sizing')) return;
    drawer.classList.remove('sizing');
    grab = { dx: 0, dy: 0 };
    saveSize();
  };
  grip.addEventListener('pointerup', endSizing);
  grip.addEventListener('pointercancel', endSizing);
  // Con el teclado: las flechas lo agrandan o lo achican de 24 en 24 px.
  grip.addEventListener('keydown', (e) => {
    const r = drawer.getBoundingClientRect();
    const d = { ArrowRight: 24, ArrowLeft: -24, ArrowUp: -24, ArrowDown: 24 }[e.key];
    if (!d || drawer.classList.contains('wide')) return;
    e.preventDefault();
    e.stopPropagation();
    sizeTo(r.right + d, r.top + d);
    if (landscape.matches) sizeTo(r.left + d, 0);
    saveSize();
  });

  function paintDock() {
    [...dockbar.querySelectorAll('.dock-item'), brandMark].forEach((b) => {
      if (!b.dataset.id) return;
      const on = isOpen() && b.dataset.id === current?.id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    if (!inline) return;
    liveItem.classList.toggle('on', !isOpen());
    liveItem.setAttribute('aria-pressed', String(!isOpen()));
    moreItem && moreItem.classList.toggle('on', isOpen() && inMenu.some((m) => m.id === current?.id));
  }

  // ---- Mandos de lo que está al aire: una capa que se cierra al tocar fuera ----
  const controlsLayer = h('div', { class: 'controls-layer', hidden: true, onclick: (e) => { if (e.target === controlsLayer) closeControls(); } },
    h('section', { class: 'controls-pop glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mandos de lo que está al aire' },
      h('div', { class: 'drawer-head' }, h('h2', {}, 'Mandos'), h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar', onclick: () => closeControls() }, icon('x', 16))),
      scene?.controls));
  // El foco entra en los mandos al abrirlos y vuelve al botón que los abrió.
  let controlsOpener = null;
  function openControls() {
    controlsOpener = document.activeElement;
    controlsLayer.hidden = false;
    controlsLayer.querySelector('.controls-pop button')?.focus({ preventScroll: true });
  }
  function closeControls() {
    const inside = controlsLayer.contains(document.activeElement);
    controlsLayer.hidden = true;
    if (inside && controlsOpener?.isConnected) controlsOpener.focus({ preventScroll: true });
  }

  // ---- Aviso de lo que le falta al módulo abierto ----
  // Nada impide usar el módulo: solo se dice qué parte no funcionará y cómo resolverlo.
  const dismissed = new Set();
  const parts = new Map();
  function renderNotice() {
    const module = usable.find((m) => m.id === current?.id);
    // Sin escenario por pestañas (la nube) no hay equipo principal que revisar.
    const missing = module && !tabs ? missingFor(module, state.tools?.list || [], parts.get(module.id)).filter((m) => !m.soon && m.tools.some((t) => t.level !== 'optional')) : [];
    const tools = toolsOf(missing);
    const key = `${module?.id}:${tools.map((t) => t.id).join()}`;
    if (!missing.length || dismissed.has(key)) {
      notice.hidden = true;
      return;
    }
    notice.replaceChildren(...[
      icon('warning', 18),
      h('p', {}, h('strong', {}, `${tools.length > 1 ? 'Faltan' : 'Falta'} ${joinNames(tools.map((t) => t.name))}. `),
        `Aquí no se podrá ${joinNames(missing.map((m) => m.feature))}.`),
      ...tools.filter((t) => t.installable && isLocal && role === 'control').map((t) => h('button', { class: 'btn', disabled: t.installing, onclick: guard(() => action('tools.install', { id: t.id })) },
        icon('download-simple', 15), t.installing ? `Instalando ${t.name}…` : `Instalar ${t.name}`)),
      h('button', { class: 'btn', onclick: () => go('/requisitos') }, 'Cómo instalarlo'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar el aviso', onclick: () => { dismissed.add(key); renderNotice(); } }, icon('x', 14)),
    ]);
    notice.hidden = false;
  }
  subscribe('tools', renderNotice);

  // ---- Aviso de actualización ----
  const update = h('div', { class: 'update-bar glass', role: 'alert', hidden: true });
  const restart = () => {
    const box = dialog('Reiniciar Manna',
      h('p', {}, 'Manna se cerrará y volverá a abrirse solo, ya con la versión nueva. La proyección se interrumpe unos segundos y los demás dispositivos se reconectan sin hacer nada.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: guard(async () => {
          await action('system.restart');
          box.close();
        }) }, 'Reiniciar ahora')));
  };
  watchBlocked({ isLocal });
  subscribe('system', ({ stale }) => {
    update.hidden = !stale;
    if (!stale || update.childNodes.length) return;
    update.replaceChildren(...[
      icon('warning', 18),
      h('p', {}, h('strong', {}, 'Manna se actualizó mientras estaba abierto. '),
        isLocal ? 'Reinícialo para terminar la actualización: hasta entonces, lo nuevo puede fallar.' : 'Hay que reiniciarlo desde el equipo principal: hasta entonces, lo nuevo puede fallar.'),
      isLocal && h('button', { class: 'btn', onclick: restart }, icon('arrow-clockwise', 15), 'Reiniciar ahora'),
    ].filter(Boolean));
  });
  // ---- Versión nueva en GitHub (server/modules/system/versions.js) ----
  // En el equipo principal, con «Actualizar ahora», que abre el instalador; en los demás, solo el aviso. La × lo
  // esconde en este dispositivo hasta que salga otra versión más nueva.
  const fresh = h('div', { class: 'update-bar glass', role: 'status', hidden: true });
  const install = () => {
    const box = dialog('Actualizar Manna',
      h('p', {}, 'Se abrirá el instalador: cierra Manna, descarga la versión nueva y lo vuelve a abrir. No toca las biblias, los himnos, los medios ni los datos de la iglesia. La proyección se interrumpe un momento y los demás dispositivos se reconectan solos.'),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: guard(async () => {
          await action('system.update');
          box.close();
          toast('Abriendo el instalador de Manna…');
        }) }, 'Actualizar ahora')));
  };
  subscribe('system', ({ update: next }) => {
    const version = next?.version;
    fresh.hidden = !version || prefs.get('version.descartada') === version;
    if (fresh.hidden || fresh.dataset.version === version) return;
    fresh.dataset.version = version;
    fresh.replaceChildren(...[
      icon('download-simple', 18),
      h('p', {}, h('strong', {}, `Hay una versión nueva de Manna (${version}). `), isLocal ? 'Se instala sin tocar el contenido ni los datos.' : 'Se actualiza desde el equipo principal.'),
      isLocal && h('button', { class: 'btn primary', onclick: install }, icon('download-simple', 15), 'Actualizar ahora'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar el aviso', title: 'Volverá a avisar con la próxima versión', onclick: () => {
        prefs.set('version.descartada', version);
        fresh.hidden = true;
      } }, icon('x', 14)),
    ].filter(Boolean));
  });
  // ---- Carpeta de contenido sin elegir (fase 29) ----
  // Donde se puede elegir (la función con Ajustes): si no se encuentra, o solo tiene lo que trae el instalador. La ×
  // lo esconde hasta volver a abrir la página.
  const content = h('div', { class: 'update-bar glass', role: 'status', hidden: true });
  let contentShown = null;
  let contentClosed = false;
  const TEXTS = {
    lost: ['No se encuentra la carpeta de contenido. ', 'Puede estar en un disco desconectado.'],
    unchosen: ['Falta elegir la carpeta de contenido: ', 'ahí están el himnario y las demás versiones de la Biblia.'],
    empty: ['La carpeta de contenido está vacía: ', 'no tiene himnario ni más versiones de la Biblia que la Reina-Valera 1909.'],
  };
  const showContent = () => {
    const missing = usable.some((m) => m.id === 'ajustes') && !contentClosed ? contentMissing() : null;
    content.hidden = !missing;
    if (!missing || contentShown === missing) return;
    contentShown = missing;
    content.replaceChildren(...[
      icon('folder-simple', 18),
      h('p', {}, h('strong', {}, TEXTS[missing][0]), TEXTS[missing][1], isLocal ? '' : ' Se elige en el equipo principal, en Ajustes.'),
      isLocal && h('button', { class: 'btn primary', onclick: () => chooseContent() }, icon('folder-simple', 15), 'Elegir la carpeta'),
      h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar el aviso', onclick: () => { contentClosed = true; content.hidden = true; } }, icon('x', 14)),
    ].filter(Boolean));
  };
  for (const ns of ['system', 'hymns', 'bible']) subscribe(ns, showContent);
  onServerUpdate(() => {
    allowLeaving();
    location.reload();
  });

  function show(id) {
    const module = usable.find((m) => m.id === id) || usable[0];
    if (!mounted.has(module.id)) {
      const el = h('section', { class: 'ws', dataset: { module: module.id } });
      work.append(el);
      const setPart = (part) => {
        parts.set(module.id, part);
        if (current?.id === module.id) renderNotice();
      };
      try {
        mounted.set(module.id, { el, api: module.mount(el, { ...ctx, setPart }) || {} });
      } catch (err) {
        el.remove(); // a medio dibujar se quedaría encima del módulo abierto, y otro más en cada intento
        throw err;
      }
    }
    // Sin escenario no hay barra de arriba: la marca va al principio de la cabecera del módulo a la vista.
    if (bare) mounted.get(module.id).el.querySelector('.ws-head')?.prepend(brand);
    for (const [mid, m] of mounted) m.el.hidden = mid !== module.id;
    current = { id: module.id, api: mounted.get(module.id).api };
    if (!bare) paintSize(preferredWide());
    drawerTitle.textContent = module.name;
    drawer.setAttribute('aria-label', module.name);
    document.title = `Manna · ${module.name}`;
    if (!bare) openDrawer();
    paintDock();
    history.replaceState(null, '', `#${module.id}`);
    prefs.set(`modulo.${role}`, module.id);
    renderNotice();
    current.api.onShow?.();
  }

  // ---- Atajos de teclado ----
  // Ctrl K (⌘ K) abre «Buscar en todo». ← → y Mayús+B / Mayús+C gobiernan lo que está al aire desde cualquier módulo;
  // Intro proyecta lo marcado; Esc cierra la capa de arriba (los mandos, la búsqueda o el cajón).
  // Escribe y busca (S50, 2026-10-29): en el computador, una letra o una cifra va al buscador del módulo abierto o, si
  // no tiene (o no hay ninguno abierto), a «Buscar en todo»; por eso Negro y Solo fondo llevan Mayús. En el buscador
  // vacío, ← → siguen pasando lo que está al aire. El resto lo decide el módulo abierto.
  const step = guard((delta) => stepAir(delta));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && scene?.search && !document.querySelector('.modal-backdrop')) {
      e.preventDefault();
      scene.search.open();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input, select, textarea')) {
      if (e.key === 'Escape') e.target.blur();
      const passing = e.target.matches('input[type=search]') && !e.target.value && ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key);
      if (!passing) return;
    }
    if (document.querySelector('.modal-backdrop, .menu')) return;
    if (e.key === 'Escape' && !bare) {
      if (!controlsLayer.hidden) closeControls();
      else if (scene.search?.isOpen()) scene.search.close();
      else if (isOpen()) closeDrawer();
      return;
    }
    if ((full || isOpen()) && current?.api.keys?.(e)) {
      e.preventDefault();
      return;
    }
    // Lo tecleado entra en el buscador: se le da el foco antes de que llegue la letra (sin preventDefault).
    if (!document.documentElement.classList.contains('touch') && e.key.length === 1 && /[\p{L}\p{N}]/u.test(e.key) && !(e.shiftKey && /^[bc]$/i.test(e.key))) {
      const own = (full || isOpen()) && current && mounted.get(current.id)?.el.querySelector('input[type=search]');
      if (own) {
        own.focus();
        own.select();
        return;
      }
      if (scene?.search) {
        scene.search.open();
        return;
      }
    }
    if (tabs) return; // sin proyección, no hay nada que pasar
    const global = {
      ArrowRight: () => step(1), PageDown: () => step(1),
      ArrowLeft: () => step(-1), PageUp: () => step(-1),
      ...(e.shiftKey && { B: () => scene?.toggleMode('black'), C: () => scene?.toggleMode('clear') }),
      Enter: () => scene?.projectPrepared(),
    }[e.key];
    if (!global) return;
    e.preventDefault();
    global();
  });

  document.body.classList.add('app', full ? 'full' : tabs ? 'pestanas' : 'escena');
  if (full) {
    document.body.append(h('div', { class: 'shell' }, work));
  } else if (tabs) {
    document.body.append(h('div', { class: 'shell' }, dockbar, work), scene.preview?.bar || '');
  } else if (inline) {
    document.body.classList.replace('escena', 'envivo');
    grip.remove();
    document.body.append(scene.compose({ brand, dockbar, drawer }), ...[update, fresh, content, controlsLayer, scene.search?.layer, scene.preview?.bar].filter(Boolean));
    addEventListener('resize', () => { if (isOpen()) paintSize(preferredWide()); });
    paintDock();
  } else {
    const place = () => {
      document.body.classList.toggle('narrow', narrow.matches);
      scene.place(narrow.matches);
      backdrop.hidden = !narrow.matches || !isOpen();
      paintSize(preferredWide());
      applySize();
    };
    narrow.addEventListener('change', place);
    landscape.addEventListener('change', place);
    // Tocar el fondo (la proyección) cierra el cajón también en el escritorio; la cola y la barra
    // de abajo siguen funcionando con el cajón abierto (decisión del dueño, 2026-10-15).
    // Con un cajón abierto, el toque solo lo cierra; con él cerrado, esconde (o trae) la barra de abajo.
    scene.bg.addEventListener('click', (e) => { if (isOpen()) closeDrawer(); else scene.tapBackground(e); });
    document.body.append(...[scene.bg, h('div', { class: 'scene-scrim', 'aria-hidden': 'true' }), top, update, fresh, content, scene.story,
      dockbar, scene.queue, backdrop, drawer, scene.transport, controlsLayer, scene.search?.layer, scene.preview?.bar].filter(Boolean));
    place();
  }
  mountConnectionBar();
  confirmBeforeClose();

  // Se abre el módulo de la dirección (#id); sin ella, el escenario queda a la vista y el cajón cerrado.
  const first = location.hash.slice(1);
  if (bare || first) show(first || prefs.get(`modulo.${role}`) || usable[0].id);
  window.addEventListener('hashchange', () => { if (location.hash.slice(1)) show(location.hash.slice(1)); });
  connect(role);

  return { show, ctx };
}
