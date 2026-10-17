import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createCategories } from './categories.js';
import { createClipsPanel } from './clips.js';
import { acceptDrops } from './drop.js';

// Pantalla Videos (fase 16 de docs/PLAN.md): todos los videos en una lista (subidos, de la carpeta
// Contenido/Medios y descargados de YouTube), con la casilla para pegar un enlace de YouTube en la cabecera
// y las categorías que crea la iglesia. Es una segunda pantalla del módulo de medios (como el Presentador en
// Diapositivas): su servidor es server/modules/media.
function mount(el, ctx) {
  let panel = null;
  const categories = createCategories(ctx, () => panel.onShow());
  panel = createClipsPanel(ctx, 'video', { categories });
  // En pantallas chicas o bajas va solo con el icono (media.css): su nombre lo lleva aria-label.
  const uploader = ctx.canEdit && h('button', { class: 'btn video-upload', 'aria-label': panel.uploadLabel, title: panel.uploadLabel, onclick: () => panel.pick() }, icon('upload-simple', 16), h('span', {}, panel.uploadLabel));
  // Las categorías van dentro de la cabecera: debajo de lo demás o, en una pantalla baja, en su misma fila.
  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Videos'), h('span', { class: 'spacer' }), panel.entry && h('div', { class: 'media-entry' }, panel.entry), uploader, categories.el),
    h('div', { class: 'media-panels' }, panel.el), panel.bar);
  if (ctx.canEdit) {
    acceptDrops(el, (files) => {
      const videos = files.filter((file) => panel.accepts(file));
      if (videos.length) panel.upload(videos);
    });
  }
  panel.onShow();
  return { onShow: () => panel.onShow(), keys: (e) => panel.keys(e) };
}

export default {
  id: 'videos', name: 'Videos', icon: 'video', mount,
  needs: [
    { tools: ['ffmpeg'], feature: 'convertir los videos que el navegador no reproduce (los MP4 habituales sí funcionan)' },
    { tools: ['yt-dlp', 'ffmpeg', 'node'], feature: 'descargar videos de YouTube' },
  ],
};
