import { state, subscribe } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { prefs } from '../../core/prefs.js';
import { mountPassages } from './passages.js';

// Pantalla Biblia: elegir un pasaje en una versión y proyectarlo o añadirlo al orden del culto.
function mount(el, ctx) {
  const versionSelect = h('select', { class: 'select', 'aria-label': 'Versión de la Biblia', onchange: () => browser.setVersion(versionSelect.value) });
  const abbr = (id) => state.bible?.versions.find((v) => v.id === id)?.abbr || '';

  const browser = mountPassages(el, ctx, {
    title: 'Biblia',
    controls: [versionSelect],
    toItem: (p) => ({
      kind: 'verses',
      data: { versionId: p.versionId, ref: p.ref },
      preview: { kind: 'verses', versionId: p.versionId, ref: p.ref, reference: p.reference, version: abbr(p.versionId), verses: p.verses },
    }),
    liveRef: (item) => (item.kind === 'verses' && item.versionId === browser.versionId() ? item.ref : null),
    onVersion(id) {
      versionSelect.value = id;
      prefs.set('version', id);
    },
  });

  subscribe('bible', ({ versions }) => {
    versionSelect.replaceChildren(...versions.map((v) => h('option', { value: v.id }, v.abbr ? `${v.name} (${v.abbr})` : v.name)));
    if (!versions.length) {
      browser.empty('No hay biblias instaladas', 'Copia archivos .xmm o .xml en la carpeta "Contenido/Biblias" del equipo principal. Aparecerán aquí solos.');
      return;
    }
    const keep = versions.find((v) => v.id === browser.versionId()) || versions.find((v) => v.id === prefs.get('version')) || versions[0];
    if (keep.id !== browser.versionId()) browser.setVersion(keep.id);
    else versionSelect.value = keep.id;
  });

  return browser.api;
}

export default { id: 'biblia', name: 'Biblia', icon: 'book-open-text', mount };
