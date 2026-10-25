import { state, subscribe } from '../../core/api.js';
import { h, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { IMAGE_ACCEPT } from '../../core/images.js';
import { kindBadge } from '../../core/kinds.js';
import { createCategories } from './categories.js';
import { createClipsPanel } from './clips.js';
import { attachDrag } from './drag.js';
import { acceptDrops } from './drop.js';
import { createImagesPanel } from './images.js';
import { CLIP_ACCEPT } from './upload-clips.js';
// La excepción a que un módulo no importe archivos de otro (decisión 40): las presentaciones son del módulo de
// diapositivas (su servidor, sus órdenes y su permiso), pero se ven dentro de Medios.
import { createSlidesPanel } from '../slides/panel.js';
import { DECK_ACCEPT } from '../slides/upload.js';

const ACCEPT = [IMAGE_ACCEPT, CLIP_ACCEPT.video, CLIP_ACCEPT.audio, DECK_ACCEPT].join(',');

// Módulo Medios (fase 22 de docs/PLAN.md): toda la biblioteca de la iglesia en un mismo cajón, venga de donde
// venga. Separada por tipo (imágenes, videos con los de YouTube, audios y presentaciones) y, dentro de cada
// grupo, del más antiguo al más reciente. Arriba, las categorías (categories.js): «Principal» tiene lo que no
// está en ninguna, y lo que se arrastra hasta una (drag.js) pasa a ella. Cada grupo es una pieza con la forma
//   { id, label, kind, el, bar, items(), clear(), render(), accepts(archivo), upload(archivos), keys(e) }
// y solo uno tiene algo elegido a la vez: el suyo es el que se prepara y su barra de acciones la que se ve.
function mount(el, ctx) {
  let active = null; // el grupo con algo elegido
  const categories = createCategories(ctx, () => render(true));
  const lib = (id) => ({
    filter: categories.filter,
    menu: categories.items,
    added: categories.adopt,
    picked() {
      active = groups.find((g) => g.id === id);
      for (const g of groups) if (g !== active) g.clear();
      // El aviso de lo que falta, solo si toca a lo elegido (sin nada elegido, todos).
      ctx.setPart(id);
    },
  });
  const groups = [
    createImagesPanel(ctx, lib('imagenes')),
    createClipsPanel(ctx, 'video', lib('videos')),
    createClipsPanel(ctx, 'audio', lib('audios')),
    createSlidesPanel(ctx, lib('diapositivas')),
  ];
  const videos = groups[1];

  const picker = h('input', { type: 'file', accept: ACCEPT, multiple: true, hidden: true });
  picker.addEventListener('change', () => {
    if (picker.files.length) send([...picker.files]);
    picker.value = '';
  });
  // Los archivos van al grupo que los admite; si se eligen de varios tipos, se sube el primero.
  function send(files) {
    const target = groups.find((g) => files.some((file) => g.accepts(file)));
    if (!target) {
      toast('Manna no sabe usar ese archivo. Sube imágenes, videos, audios, PDF o PowerPoint.');
      return;
    }
    const mine = files.filter((file) => target.accepts(file));
    target.upload(mine);
    if (mine.length < files.length) toast('Sube los archivos de otro tipo por separado.');
  }

  const uploader = ctx.canEdit && h('button', { class: 'btn media-upload', 'aria-label': 'Subir', title: 'Subir imágenes, videos, audios o presentaciones', onclick: () => picker.click() },
    icon('upload-simple', 16), h('span', {}, 'Subir'));
  const counts = new Map();
  const sections = groups.map((g) => {
    const count = h('small', {});
    counts.set(g, count);
    return h('section', { class: 'media-group', dataset: { group: g.id } },
      h('div', { class: 'media-group-head' }, kindBadge(g.kind), h('h2', {}, g.label), count), g.el);
  });
  const empty = h('div', {});
  const body = h('div', { class: 'media-body' }, empty, ...sections);
  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Medios'), h('span', { class: 'spacer' }),
      videos.entry && h('div', { class: 'media-entry' }, videos.entry), uploader, categories.el),
    body, ...groups.map((g) => g.bar), picker);

  // Qué grupos se ven y cuántos tiene cada uno. Con `all`, cada grupo se vuelve a dibujar (otra categoría).
  function render(all = false) {
    categories.render();
    if (all) for (const g of groups) g.render();
    let shown = 0;
    groups.forEach((g, i) => {
      const n = g.items().length;
      sections[i].hidden = !n;
      counts.get(g).textContent = String(n);
      shown += n;
    });
    const library = [state.media?.images, state.media?.videos, state.media?.youtube, state.media?.audios, state.slides?.decks].some((list) => list?.length);
    empty.replaceChildren(shown ? '' : library ? categories.empty()
      : h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay nada en Medios'),
        'Sube imágenes, videos, audios o presentaciones (PDF o PowerPoint) desde este equipo o desde el celular, o pega arriba el enlace de un video de YouTube. También puedes arrastrar los archivos hasta aquí.',
        ctx.canEdit && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: () => picker.click() }, icon('upload-simple', 16), 'Subir'))));
  }
  // Las categorías están en `media`: las presentaciones, que se dibujan con `slides`, también dependen de él.
  subscribe('media', () => { groups[3].render(); render(); });
  subscribe('slides', () => render());

  if (ctx.canEdit) {
    // Arrastrar archivos desde el escritorio, o un elemento hasta el nombre de una categoría.
    acceptDrops(el, send);
    attachDrag(body, { drop: categories.drop });
  }

  render(true);
  return {
    onShow: () => render(true),
    keys: (e) => active?.keys(e) ?? false,
    // Abrir un grupo desde otro módulo: ctx.go('medios', 'diapositivas').
    part: (id) => sections[groups.findIndex((g) => g.id === id)]?.scrollIntoView({ block: 'start' }),
  };
}

export default {
  id: 'medios', name: 'Medios', icon: 'image', mount,
  needs: [
    { tools: ['ffmpeg'], parts: ['videos', 'audios'], feature: 'convertir los videos y audios que el navegador no reproduce (los MP4 y MP3 habituales sí funcionan)' },
    { tools: ['yt-dlp', 'ffmpeg', 'node'], parts: ['videos'], feature: 'descargar videos de YouTube' },
    // Opcional: sin él convierte el PowerPoint del equipo, si está; si no, se suben los PDF, y Medios lo explica al elegir
    // un PowerPoint.
    { tools: ['deckcraft'], parts: ['diapositivas'], feature: 'abrir presentaciones de PowerPoint sin PowerPoint (los PDF sí funcionan)' },
  ],
};
