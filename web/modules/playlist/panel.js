import { action, subscribe } from '../../core/api.js';
import { h, guard } from '../../core/dom.js';

// Lista del guion de culto. Con editable=true se puede reordenar y quitar; sin él, solo proyectar.
export function createPlaylistPanel(container, { editable = false, onShow } = {}) {
  let liveKey = '';
  let items = [];

  const show = guard(async (item) => {
    const shown = await action('playlist.show', { id: item.id });
    onShow?.(shown);
  });
  const run = (type, payload) => guard(() => action(type, payload));

  function render() {
    if (!items.length) {
      container.replaceChildren(h('div', { class: 'empty' },
        editable ? 'El guion está vacío. Selecciona un pasaje y pulsa "+ Guion".' : 'El guion está vacío. Los pasajes se agregan desde el control completo.'));
      return;
    }
    container.replaceChildren(...[
      ...items.map((item, i) => h('div', { class: `pl-item${`${item.versionId}|${item.reference}` === liveKey ? ' live' : ''}` },
        h('button', { class: 'pl-main', onclick: () => show(item) },
          h('strong', {}, item.reference, item.version ? h('span', { class: 'muted' }, ` · ${item.version}`) : null),
          h('span', { class: 'pl-preview' }, item.preview)),
        editable && h('div', { class: 'pl-tools' },
          h('button', { class: 'icon-btn', disabled: i === 0, 'aria-label': 'Subir', onclick: run('playlist.move', { id: item.id, delta: -1 }) }, '↑'),
          h('button', { class: 'icon-btn', disabled: i === items.length - 1, 'aria-label': 'Bajar', onclick: run('playlist.move', { id: item.id, delta: 1 }) }, '↓'),
          h('button', { class: 'icon-btn', 'aria-label': 'Quitar del guion', onclick: run('playlist.remove', { id: item.id }) }, '×')))),
      editable && h('button', { class: 'btn danger', style: 'margin-top: 8px;', onclick: () => {
        if (confirm('¿Vaciar todo el guion?')) run('playlist.clear')();
      } }, 'Vaciar guion'),
    ].filter(Boolean));
  }

  subscribe('playlist', (p) => { items = p.items; render(); });
  subscribe('projection', ({ item, mode }) => {
    const key = item && mode === 'live' ? `${item.versionId}|${item.reference}` : '';
    if (key !== liveKey) { liveKey = key; render(); }
  });
}
