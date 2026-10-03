// Utilidades mínimas de interfaz, compartidas por todas las páginas.

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
export function toast(message, kind = 'info') {
  let el = $('#toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'error' ? 4500 : 2500);
}

// Envuelve una acción para mostrar el error en pantalla en lugar de dejarlo en la consola.
export function guard(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      // Sin sesión, o la sesión de este navegador cambió de función en otra pestaña.
      if (err.status === 401 || err.status === 403) location.href = `/?volver=${encodeURIComponent(location.pathname)}`;
      else toast(err.message, 'error');
      return undefined;
    }
  };
}

// Ventana modal sencilla. Devuelve { el, close }.
export function dialog(title, ...content) {
  const close = () => backdrop.remove();
  const backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-header' },
        h('h2', {}, title),
        h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Cerrar' }, '×')),
      h('div', { class: 'modal-body' }, ...content)));
  document.body.append(backdrop);
  return { el: backdrop, close };
}
