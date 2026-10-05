import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { createClipsPanel } from './clips.js';
import { createImagesPanel } from './images.js';

// Módulo Medios: la biblioteca de la iglesia, en pestañas (imágenes, videos, audios y YouTube).
// Cada pestaña es una pieza con la misma forma:
//   { id, label, uploadLabel, entry?, el, bar, pick(), accepts(archivo), upload(archivos), onShow(), keys(e) }
// `entry` es lo que la pestaña pone en la cabecera en lugar del botón de subir.
function mount(el, ctx) {
  const panels = [createImagesPanel(ctx), createClipsPanel(ctx, 'video'), createClipsPanel(ctx, 'audio'), createClipsPanel(ctx, 'youtube')];
  let active = null;

  const tabs = h('div', { class: 'media-tabs', role: 'tablist' },
    ...panels.map((panel) => h('button', { class: 'chip', role: 'tab', dataset: { tab: panel.id }, onclick: () => show(panel.id) }, panel.label)));
  const uploadText = h('span', {});
  const uploader = ctx.canEdit && h('button', { class: 'btn', onclick: () => active.pick() }, icon('upload-simple', 16), uploadText);
  const entries = h('div', { class: 'media-entry' });
  const body = h('div', { class: 'media-panels' });
  const bars = h('div', {});
  el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Medios'), tabs, h('span', { class: 'spacer' }), entries, uploader), body, bars);
  for (const panel of panels) {
    panel.el.hidden = true;
    body.append(panel.el);
    bars.append(panel.bar);
  }

  function show(id) {
    active = panels.find((panel) => panel.id === id) || panels[0];
    prefs.set('medios.pestana', active.id);
    for (const panel of panels) {
      panel.el.hidden = panel !== active;
      panel.bar.classList.toggle('off', panel !== active);
    }
    for (const tab of tabs.children) {
      tab.classList.toggle('on', tab.dataset.tab === active.id);
      tab.setAttribute('aria-selected', tab.dataset.tab === active.id);
    }
    uploadText.textContent = active.uploadLabel || '';
    if (uploader) uploader.hidden = !active.uploadLabel;
    entries.replaceChildren(...(active.entry ? [active.entry] : []));
    entries.hidden = !active.entry;
    ctx.setPart(active.id);
    active.onShow();
  }

  // Arrastrar archivos desde el escritorio: van a la pestaña que los admite.
  if (ctx.canEdit) {
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    el.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      el.classList.add('dropping');
    });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('dropping'); });
    el.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      el.classList.remove('dropping');
      const files = [...e.dataTransfer.files];
      const target = [active, ...panels].find((panel) => files.some((file) => panel.accepts(file)));
      if (!target) return;
      if (target !== active) show(target.id);
      target.upload(files.filter((file) => target.accepts(file)));
    });
  }

  show(prefs.get('medios.pestana'));
  return {
    onShow: () => active.onShow(),
    keys: (e) => active.keys(e),
  };
}

export default {
  id: 'medios', name: 'Medios', icon: 'image', mount,
  needs: [
    // Cada aviso sale solo en las pestañas a las que afecta.
    { tools: ['ffmpeg'], parts: ['videos', 'audios'], feature: 'convertir los videos y audios que el navegador no reproduce (los MP4 y MP3 habituales sí funcionan)' },
    { tools: ['yt-dlp', 'ffmpeg'], parts: ['youtube'], feature: 'descargar videos de YouTube' },
  ],
};
