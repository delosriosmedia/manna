// Utilidades mínimas de interfaz, compartidas por todas las páginas.
import { icon } from './icons.js';

export const $ = (selector, root = document) => root.querySelector(selector);

// h('button', { class: 'btn', onclick: fn }, 'Texto', otroNodo)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

let toastTimer;
// El aviso existe desde que carga la página: un lector de pantalla solo anuncia lo que cambia en algo que ya estaba.
if (document.body && !$('#toast')) document.body.append(h('div', { id: 'toast', role: 'status' }));
export function toast(message, kind = 'info') {
  let el = $('#toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status' });
    document.body.append(el);
  }
  // Un error se anuncia en el acto.
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'error' ? 4500 : 2500);
}

let leaving = false;

// Navegación interna deliberada (cambiar de función, volver al inicio): no pide confirmación.
export function go(url) {
  leaving = true;
  location.href = url;
}

// Deja de pedir confirmación al cerrar (por ejemplo, cuando Manna ya se apagó).
export function allowLeaving() {
  leaving = true;
}

// Pide confirmación al cerrar o recargar la pestaña, para no perder el control por un clic
// equivocado. El texto del aviso lo pone el navegador y no se puede cambiar.
export function confirmBeforeClose() {
  window.addEventListener('beforeunload', (e) => {
    if (leaving) return;
    e.preventDefault();
    e.returnValue = '';
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('a[href]')) leaving = true;
  }, true);
}

// Envuelve una acción para mostrar el error en pantalla en lugar de dejarlo en la consola.
export function guard(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      // Sin sesión, o la sesión de este navegador cambió de función en otra pestaña.
      if (err.status === 401 || err.status === 403) go(`/?volver=${encodeURIComponent(location.pathname)}`);
      else toast(err.message, 'error');
      return undefined;
    }
  };
}

// Ventana modal sencilla. Devuelve { el, close }. El foco entra en ella (su primer campo o, si no tiene, la
// propia ventana) y vuelve al cerrar a donde estaba.
export function dialog(title, ...content) {
  const opener = document.activeElement;
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (opener?.isConnected) opener.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-header' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn sm', onclick: close, 'aria-label': 'Cerrar' }, icon('x', 16))),
      h('div', { class: 'modal-body' }, ...content)));
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  const box = backdrop.querySelector('.modal');
  box.tabIndex = -1;
  (box.querySelector('.modal-body :is(input, textarea, select)') || box).focus();
  return { el: backdrop, close };
}

// Menú desplegable junto a un botón. items: [{ label, icon?, note?, disabled?, onclick }] o '-' (separador).
// Con el teclado: el foco entra en el primero, ↑ ↓ lo mueven, Esc cierra y el foco vuelve al botón.
export function menu(anchor, items) {
  document.querySelector('.menu')?.remove();
  const el = h('div', { class: 'menu', role: 'menu' }, ...items.map((item) => (item === '-'
    ? h('hr')
    : h('button', {
      role: 'menuitem', disabled: item.disabled,
      onclick: () => { close(true); item.onclick?.(); },
    }, item.icon && icon(item.icon, 16), item.label, item.note && h('small', {}, item.note)))));
  // back: devolver el foco al botón que lo abrió (no al tocar fuera: ahí va adonde se tocó).
  const close = (back = false) => {
    el.remove();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', onKey);
    if (back && anchor.isConnected) anchor.focus();
  };
  const outside = (e) => { if (!el.contains(e.target)) close(); };
  const options = () => [...el.querySelectorAll('button:not(:disabled)')];
  const onKey = (e) => {
    if (e.key === 'Escape') close(true);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = options();
      const at = list.indexOf(document.activeElement);
      list[(at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
  };
  document.body.append(el);
  // Se abre bajo el botón, sin salirse de la pantalla.
  const a = anchor.getBoundingClientRect();
  const m = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(a.right - m.width, innerWidth - m.width - 8))}px`;
  el.style.top = `${a.bottom + m.height + 8 > innerHeight ? Math.max(8, a.top - m.height - 4) : a.bottom + 4}px`;
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKey);
    options()[0]?.focus();
  });
  return close;
}

// Un texto con lo encontrado resaltado. marks: tramos [inicio, fin) que da el servidor (core/search.js).
// Devuelve una lista de trozos de texto y elementos <mark>, para pasarla a h().
export function marked(text, marks = []) {
  const out = [];
  let at = 0;
  for (const [start, end] of marks) {
    if (end <= at) continue;
    const from = Math.max(start, at);
    if (from > at) out.push(text.slice(at, from));
    out.push(h('mark', {}, text.slice(from, end)));
    at = end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
