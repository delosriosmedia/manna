import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { createClipsPanel } from './clips.js';
import { createImagesPanel } from './images.js';

// Módulo Medios: la biblioteca de la iglesia, en pestañas (imágenes, videos, audios). YouTube
// llega en su fase y ya tiene su sitio. Cada pestaña es una pieza con la misma forma:
//   { id, label, uploadLabel, el, bar, pick(), accepts(archivo), upload(archivos), onShow(), keys(e) }
function mount(el, ctx) {
  const panels = [createImagesPanel(ctx), createClipsPanel(ctx, 'video'), createClipsPanel(ctx, 'audio')];
  let active = null;

  const tabs = h('div', { class: 'media-tabs', role: 'tablist' },
    ...panels.map((panel) => h('button', { class: 'chip', role: 'tab', dataset: { tab: panel.id }, onclick: () => show(panel.id) }, panel.label)),
    h('button', { class: 'chip', role: 'tab', disabled: true, title: 'YouTube: próximamente', dataset: { tab: 'youtube' } }, 'YouTube'));
  const uploadText = h('span', {});
  const uploader = ctx.canEdit && h('button', { class: 'btn', onclick: () => active.pick() }, icon('upload-simple', 16), uploadText);
  const body = h('div', { class: 'media-panels' });
  const bars = h('div', {});
  el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Medios'), tabs, h('span', { class: 'spacer' }), uploader), body, bars);
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
    uploadText.textContent = active.uploadLabel;
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
    { tools: ['ffmpeg'], feature: 'convertir los videos y audios que el navegador no reproduce (los MP4 y MP3 habituales sí funcionan)' },
    // Lo que pedirá la pestaña que aún no existe: la revisión del equipo ya lo cuenta, pero el
    // módulo no avisa por ello hasta que esté (soon).
    { tools: ['yt-dlp', 'ffmpeg'], feature: 'descargar videos de YouTube', soon: true },
  ],
};
