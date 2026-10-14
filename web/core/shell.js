import { action, connect, onServerUpdate, state, subscribe } from './api.js';
import { mountConnectionBar } from './connection.js';
import { h, allowLeaving, confirmBeforeClose, dialog, go, guard, menu } from './dom.js';
import { icon } from './icons.js';
import { joinNames, missingFor, toolsOf } from './needs.js';
import { prefs } from './prefs.js';

// Estructura de las funciones de control: el «Escenario» (fase 13 de docs/PLAN.md).
// Lo que está al aire ocupa el fondo; encima flotan la barra de arriba, el dock de módulos, el cajón
// del módulo abierto, la cola del culto, la tarjeta «Preparado» y la barra de transporte. Esas piezas
// las hace createScene (modules/projection/escenario.js), que cada función le pasa. En el celular
// (< 860 px) es «Historias»: la proyección en un recuadro arriba, y los módulos en cajones que suben.
//
// Un módulo es { id, name, icon, place?, soon?, needs?, mount(el, ctx) }:
//   place   'bottom' lo coloca al final del dock (ajustes)
//   soon    previsto pero aún no construido: no sale
//   hidden  en pausa: existe y se abre por su dirección (#id), pero no sale en el dock
//   needs   programas del equipo principal que necesita (ver core/needs.js)
//   mount   dibuja el módulo en el y puede devolver { onShow(), keys(evento) -> true si lo atendió }
// ctx (lo que recibe cada módulo): { role, isLocal, canEdit, go(id), setPreview(elemento | null), prepare(...), setPart(id) }
//   prepare  { item?, kind?, title, subtitle?, project(), add?() }: lo deja en la tarjeta «Preparado»
//   setPart  un módulo con pestañas dice en cuál está, para avisar solo de lo que le falta a esa
//
// layout 'full' (Presentador): el único módulo ocupa la pantalla entera, sin escenario.
export function createShell({ role, isLocal, modules, extras = [], createScene, layout = 'escena' }) {
  const canEdit = role === 'control' || role === 'alabanza';
  const usable = modules.filter((m) => !m.soon);
  const listed = usable.filter((m) => !m.hidden);
  const mounted = new Map(); // id -> { el, api }
  let current = null;
  const full = layout === 'full';
  const narrow = matchMedia('(max-width: 859px)');

  const notice = h('div', { class: 'ws-notice', role: 'status', hidden: true });
  const work = h('div', { class: 'work' });
  const ctx = { role, isLocal, canEdit, go: show };
  const scene = full ? null : createScene({ ...ctx, openControls: () => openControls() });
  ctx.setPreview = (item) => scene?.setPreview(item);
  ctx.prepare = (next) => scene?.prepare(next);

  // ---- Barra de arriba: estado, función y versión ----
  const version = h('small', { class: 'role-version' });
  subscribe('system', (s) => { version.textContent = s.version ? `Manna ${s.version}` : ''; });
  const ROLE_NAMES = { control: 'Control completo', alabanza: 'Servicio de alabanza', orden: 'Control del orden', presentador: 'Presentador' };
  const roleChip = h('button', { class: 'role-chip glass', 'aria-haspopup': 'menu', title: ROLE_NAMES[role] || role, onclick: (e) => menu(e.currentTarget, [
    ...extras.map((x) => ({ label: x.name, icon: x.icon, onclick: x.onclick })),
    extras.length && '-',
    { label: 'Cambiar de función', icon: 'arrows-left-right', onclick: () => go('/') },
  ].filter(Boolean)) }, h('span', { class: 'role-dot', 'aria-hidden': 'true' }), h('span', { class: 'role-text' }, h('strong', {}, ROLE_NAMES[role] || role), version));
  scene?.status.prepend(h('a', { class: 'brand-mark', href: '/', title: 'Cambiar la función de este dispositivo' }, h('img', { src: '/logo.svg', alt: 'Manna' })));
  const top = h('header', { class: 'topbar' }, scene?.status, h('span', { class: 'spacer' }), roleChip);

  // ---- Dock de módulos y cajón ----
  const dockbar = h('nav', { class: 'dockbar glass', 'aria-label': 'Módulos' });
  const dockButton = (m) => h('button', { class: 'dock-item', dataset: { id: m.id }, title: m.name, 'aria-label': m.name, 'aria-pressed': 'false', onclick: () => (current?.id === m.id && isOpen() ? closeDrawer() : show(m.id)) },
    icon(m.icon, 20), h('span', { class: 'dock-name' }, m.name));
  dockbar.append(...listed.filter((m) => m.place !== 'bottom').map(dockButton), h('span', { class: 'dock-fill' }), ...listed.filter((m) => m.place === 'bottom').map(dockButton));
  if (listed.length < 2 && !full) dockbar.classList.add('single');

  const drawerTitle = h('h2', {});
  const wideButton = h('button', { class: 'icon-btn sm drawer-wide', onclick: () => setWide(!drawer.classList.contains('wide')) });
  const drawer = h('section', { class: 'drawer glass', hidden: true, 'aria-labelledby': 'drawer-title' },
    h('div', { class: 'drawer-head' }, Object.assign(drawerTitle, { id: 'drawer-title' }), scene?.mini, h('span', { class: 'spacer' }), wideButton,
      h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar el cajón', title: 'Cerrar (Esc)', onclick: () => closeDrawer() }, icon('x', 16))),
    notice, work);
  // En el celular el cajón sube desde abajo y se cierra al tocar fuera.
  const backdrop = h('div', { class: 'drawer-backdrop', hidden: true, onclick: () => closeDrawer() });
  const isOpen = () => !drawer.hidden;
  // Cada disposición recuerda lo suyo: en el escritorio, cajón ancho o estrecho; en el celular, a media
  // altura (se ve lo que está al aire encima) o a pantalla completa.
  const wideKey = () => (narrow.matches ? 'cajon.completo' : 'cajon.ancho');
  function setWide(wide) {
    drawer.classList.toggle('wide', wide);
    prefs.set(wideKey(), wide);
    wideButton.replaceChildren(icon(wide ? 'arrows-in' : 'arrows-out', 16));
    const label = narrow.matches ? (wide ? 'Reducir el cajón' : 'Ampliar a pantalla completa') : (wide ? 'Hacer el cajón más estrecho' : 'Ampliar el cajón');
    wideButton.setAttribute('aria-label', label);
    wideButton.title = label;
  }
  function openDrawer() {
    drawer.hidden = false;
    backdrop.hidden = !narrow.matches;
    document.body.classList.add('drawer-open');
  }
  function closeDrawer() {
    drawer.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('drawer-open');
    paintDock();
    scene?.setPreview(null);
    document.title = 'Manna';
    history.replaceState(null, '', location.pathname);
  }
  function paintDock() {
    dockbar.querySelectorAll('.dock-item').forEach((b) => {
      const on = isOpen() && b.dataset.id === current?.id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  // ---- Mandos de lo que está al aire: una capa que se cierra al tocar fuera ----
  const controlsLayer = h('div', { class: 'controls-layer', hidden: true, onclick: (e) => { if (e.target === controlsLayer) closeControls(); } },
    h('section', { class: 'controls-pop glass', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mandos de lo que está al aire' },
      h('div', { class: 'drawer-head' }, h('h2', {}, 'Mandos'), h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn sm', 'aria-label': 'Cerrar', onclick: () => closeControls() }, icon('x', 16))),
      scene?.controls));
  function openControls() {
    controlsLayer.hidden = false;
  }
  function closeControls() {
    controlsLayer.hidden = true;
  }

  // ---- Aviso de lo que le falta al módulo abierto ----
  // Nada impide usar el módulo: solo se dice qué parte no funcionará y cómo resolverlo.
  const dismissed = new Set();
  const parts = new Map();
  function renderNotice() {
    const module = usable.find((m) => m.id === current?.id);
    const missing = module ? missingFor(module, state.tools?.list || [], parts.get(module.id)).filter((m) => !m.soon && m.tools.some((t) => t.level !== 'optional')) : [];
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
      mounted.set(module.id, { el, api: module.mount(el, { ...ctx, setPart }) || {} });
    }
    const changed = current?.id !== module.id;
    for (const [mid, m] of mounted) m.el.hidden = mid !== module.id;
    current = { id: module.id, api: mounted.get(module.id).api };
    drawerTitle.textContent = module.name;
    document.title = `Manna · ${module.name}`;
    if (!full) openDrawer();
    paintDock();
    if (changed) scene?.setPreview(null);
    history.replaceState(null, '', `#${module.id}`);
    prefs.set(`modulo.${role}`, module.id);
    renderNotice();
    current.api.onShow?.();
  }

  // ---- Atajos de teclado ----
  // ← → y B / C gobiernan lo que está al aire desde cualquier módulo; Intro proyecta lo preparado;
  // Esc cierra la capa de arriba (los mandos o el cajón). El resto lo decide el módulo abierto.
  const step = guard((delta) => action('projection.step', { delta }));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input, select, textarea')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (document.querySelector('.modal-backdrop, .menu')) return;
    if (e.key === 'Escape' && !full) {
      if (!controlsLayer.hidden) closeControls();
      else if (isOpen()) closeDrawer();
      return;
    }
    if ((full || isOpen()) && current?.api.keys?.(e)) {
      e.preventDefault();
      return;
    }
    const global = {
      ArrowRight: () => step(1), PageDown: () => step(1),
      ArrowLeft: () => step(-1), PageUp: () => step(-1),
      b: () => scene?.toggleMode('black'), B: () => scene?.toggleMode('black'),
      c: () => scene?.toggleMode('clear'), C: () => scene?.toggleMode('clear'),
      Enter: () => scene?.projectPrepared(),
    }[e.key];
    if (!global) return;
    e.preventDefault();
    global();
  });

  document.body.classList.add('app', full ? 'full' : 'escena');
  if (full) {
    document.body.append(h('div', { class: 'shell' }, work));
  } else {
    const place = () => {
      document.body.classList.toggle('narrow', narrow.matches);
      scene.place(narrow.matches);
      backdrop.hidden = !narrow.matches || !isOpen();
      // Hasta que cada módulo quepa en el cajón estrecho (parte 4 de la fase 13), en el escritorio se abre
      // ancho; en un celular bajo no cabe a media altura y se abre completo.
      setWide(prefs.get(wideKey(), !narrow.matches || innerHeight < 700));
    };
    narrow.addEventListener('change', place);
    document.body.append(scene.bg, h('div', { class: 'scene-scrim', 'aria-hidden': 'true' }), top, update, scene.story,
      dockbar, scene.queue, backdrop, drawer, scene.prep, scene.transport, controlsLayer);
    place();
  }
  mountConnectionBar();
  confirmBeforeClose();

  // Se abre el módulo de la dirección (#id); sin ella, el escenario queda a la vista y el cajón cerrado.
  const first = location.hash.slice(1);
  if (full || first) show(first || prefs.get(`modulo.${role}`) || usable[0].id);
  window.addEventListener('hashchange', () => { if (location.hash.slice(1)) show(location.hash.slice(1)); });
  connect(role);

  return { show, ctx };
}
