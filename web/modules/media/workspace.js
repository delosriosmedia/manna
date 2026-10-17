import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { createClipsPanel } from './clips.js';
import { acceptDrops } from './drop.js';
import { createImagesPanel } from './images.js';
// La excepción a que un módulo no importe archivos de otro (decisión 40): la pestaña Diapositivas es del módulo
// de diapositivas (su servidor, sus órdenes y su permiso), pero se ve dentro de Medios.
import { createSlidesPanel } from '../slides/panel.js';

// Módulo Medios: la biblioteca de la iglesia, en pestañas (imágenes, audios y diapositivas). Los videos tienen
// su propia pantalla (videos.js). Cada pestaña es una pieza con la misma forma:
//   { id, label, uploadLabel, el, bar, pick(), accepts(archivo), upload(archivos), onShow(), keys(e) }
function mount(el, ctx) {
  const panels = [createImagesPanel(ctx), createClipsPanel(ctx, 'audio'), createSlidesPanel(ctx)];
  let active = null;

  const tabs = h('div', { class: 'media-tabs', role: 'tablist' },
    ...panels.map((panel) => h('button', { class: 'chip', role: 'tab', dataset: { tab: panel.id }, onclick: () => show(panel.id) }, panel.label)));
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
    uploadText.textContent = active.uploadLabel || '';
    ctx.setPart(active.id);
    active.onShow();
  }

  // Arrastrar archivos desde el escritorio: van a la pestaña que los admite.
  if (ctx.canEdit) {
    acceptDrops(el, (files) => {
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
    // Abrir una pestaña desde otro módulo: ctx.go('medios', 'diapositivas').
    part: (id) => show(id),
  };
}

export default {
  id: 'medios', name: 'Medios', icon: 'image', mount,
  // Cada aviso sale solo en la pestaña a la que afecta. PowerPoint es opcional: sin él se suben los PDF, y la
  // pestaña lo explica al elegir un archivo.
  needs: [
    { tools: ['ffmpeg'], parts: ['audios'], feature: 'convertir los audios que el navegador no reproduce (los MP3 habituales sí funcionan)' },
    { tools: ['powerpoint'], parts: ['diapositivas'], feature: 'abrir presentaciones de PowerPoint (los PDF sí funcionan)' },
  ],
};
