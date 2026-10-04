import { action, connect, subscribe } from './api.js';
import { mountConnectionBar } from './connection.js';
import { h, confirmBeforeClose, guard } from './dom.js';
import { icon } from './icons.js';
import { prefs } from './prefs.js';

// Estructura de la app: barra de módulos, espacio de trabajo y panel "Al aire".
// La usan todas las funciones de control; cada una le pasa los módulos que le corresponden.
//
// Un módulo es { id, name, icon, place?, soon?, mount(el, ctx) }:
//   place   'bottom' lo coloca al pie de la barra (ajustes)
//   soon    módulo previsto pero aún no construido: se muestra atenuado y no se puede abrir
//   mount   dibuja el módulo en el y puede devolver { onShow(), keys(evento) -> true si lo atendió }
// ctx (lo que recibe cada módulo): { role, isLocal, canEdit, go(id), setPreview(elemento | null) }
export function createShell({ role, isLocal, modules, extras = [], createDock }) {
  const canEdit = role === 'control';
  const usable = modules.filter((m) => !m.soon);
  const mounted = new Map(); // id -> { el, api }
  let current = null;

  const work = h('main', { class: 'work' });
  const dockEl = h('aside', { class: 'dock', 'aria-label': 'Al aire' });
  const rail = h('nav', { class: 'rail', 'aria-label': 'Módulos' });
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Módulos' });

  const ctx = { role, isLocal, canEdit, go: show, setPreview: (item) => dock.setPreview(item) };
  const dock = createDock(dockEl, ctx);

  // ---- Navegación entre módulos ----
  const railButton = (m) => h('button', {
    class: `rail-item${m.soon ? ' soon' : ''}`, dataset: { id: m.id }, disabled: m.soon,
    title: m.soon ? `${m.name}: próximamente` : m.name,
    onclick: () => (m.onclick ? m.onclick() : show(m.id)),
  }, icon(m.icon, 20), h('span', {}, m.name));

  const version = h('span', { class: 'rail-version' });
  subscribe('system', (s) => { version.textContent = s.version ? `v${s.version}` : ''; });

  const main = modules.filter((m) => m.place !== 'bottom');
  const bottom = modules.filter((m) => m.place === 'bottom');
  rail.append(...[
    h('a', { class: 'brand-mark', href: '/', title: 'Cambiar la función de este dispositivo' }, h('img', { src: '/logo.svg', alt: 'Manna' })),
    version,
    ...main.filter((m) => !m.soon).map(railButton),
    main.some((m) => m.soon) && h('div', { class: 'rail-sep' }),
    ...main.filter((m) => m.soon).map(railButton),
    h('div', { class: 'rail-fill' }),
    ...extras.map(railButton),
    ...bottom.map(railButton),
  ].filter(Boolean));

  tabbar.append(...usable.map((m) => h('button', { dataset: { id: m.id }, onclick: () => show(m.id) }, icon(m.icon, 22), h('span', {}, m.name))));
  if (usable.length < 2) tabbar.hidden = true;

  function show(id) {
    const module = usable.find((m) => m.id === id) || usable[0];
    if (current?.id === module.id) return;
    if (!mounted.has(module.id)) {
      const el = h('section', { class: 'ws', dataset: { module: module.id } });
      work.append(el);
      mounted.set(module.id, { el, api: module.mount(el, ctx) || {} });
    }
    for (const [mid, m] of mounted) m.el.hidden = mid !== module.id;
    current = { id: module.id, api: mounted.get(module.id).api };
    document.querySelectorAll('.rail-item, .tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.id === module.id));
    document.title = `Manna · ${module.name}`;
    dockEl.classList.remove('open');
    dock.setPreview(null);
    history.replaceState(null, '', `#${module.id}`);
    prefs.set(`modulo.${role}`, module.id);
    current.api.onShow?.();
  }

  // ---- Atajos de teclado ----
  // ← → y B / C gobiernan lo que está al aire desde cualquier módulo; el resto lo decide el módulo activo.
  const step = guard((delta) => action('projection.step', { delta }));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input, select, textarea')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (document.querySelector('.modal-backdrop, .menu')) return;
    if (current?.api.keys?.(e)) {
      e.preventDefault();
      return;
    }
    const global = {
      ArrowRight: () => step(1), PageDown: () => step(1),
      ArrowLeft: () => step(-1), PageUp: () => step(-1),
      b: () => dock.toggleMode('black'), B: () => dock.toggleMode('black'),
      c: () => dock.toggleMode('clear'), C: () => dock.toggleMode('clear'),
    }[e.key];
    if (!global) return;
    e.preventDefault();
    global();
  });

  document.body.classList.add('app');
  document.body.append(h('div', { class: 'shell' }, rail, work, dockEl), tabbar);
  mountConnectionBar();
  confirmBeforeClose();

  show(location.hash.slice(1) || prefs.get(`modulo.${role}`) || usable[0].id);
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  connect(role);

  return { show, ctx };
}
