import { action, state, subscribe } from '../../core/api.js';
import { h, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { IMAGE_ACCEPT } from '../../core/images.js';
import { kindBadge } from '../../core/kinds.js';
import { whenLabel } from '../../core/time.js';
import { askName, confirmRemove } from './dialogs.js';
import { openUpload } from './upload.js';

const FITS = [['contain', 'Completa', 'Se ve entera; con bandas negras si no tiene la forma de la pantalla'], ['cover', 'Llenar', 'Llena la pantalla; se recorta lo que sobre']];

// Las imágenes de Medios: la rejilla, el ajuste a la pantalla y las acciones de la imagen elegida. Devuelve
// lo que la pantalla de Medios necesita de cada grupo; lib es lo que ella le da (ver workspace.js).
export function createImagesPanel(ctx, lib) {
  let selected = null; // id de la imagen elegida
  const images = () => lib.filter([...(state.media?.images || [])].sort((a, b) => a.added - b.added));
  const current = () => images().find((i) => i.id === selected) || null;
  const startUpload = (files) => openUpload(files, { onDone: (ids) => { lib.added(ids); select(ids.at(-1)); } });

  const grid = h('div', { class: 'media-grid' });
  const el = h('div', { class: 'media-list', dataset: { panel: 'imagenes' } }, grid);
  const fitButtons = FITS.map(([id, label, title]) => {
    const picture = h('img', { alt: '' });
    const button = h('button', { class: 'fit', dataset: { fit: id }, title, onclick: guard(() => current() && action('media.fit', { id: selected, fit: id })) },
      h('span', { class: `fit-thumb ${id}` }, picture), h('span', {}, label));
    return { id, button, picture };
  });
  const name = h('span', { class: 'sel-ref' });
  const project = guard(async () => {
    const image = current();
    if (image) await action('projection.show', { kind: 'image', data: { id: image.id, fit: image.fit } });
  });
  const bar = h('div', { class: 'abar media-bar', hidden: true, dataset: { panel: 'imagenes' } },
    h('div', { class: 'fits', role: 'group', 'aria-label': 'Ajuste a la pantalla' }, ...fitButtons.map((f) => f.button)),
    name, h('span', { class: 'hint' }, 'Doble clic para proyectar'),
    h('button', { class: 'btn', onclick: guard(async () => {
      const image = current();
      await action('order.add', { kind: 'image', data: { id: image.id, fit: image.fit } });
      toast(`«${image.name}» añadida al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵')));

  // Lo recién subido puede no haber llegado aún con el estado (la respuesta de la subida se
  // adelanta al aviso del servidor): se recuerda, y queda elegido en cuanto aparece.
  let awaited = null;
  function select(id) {
    if (id) lib.picked();
    selected = id;
    awaited = id && !current() ? id : null;
    render();
  }

  function render() {
    const list = images();
    if (current()) awaited = null;
    else if (selected !== awaited) selected = null;
    const onAir = state.projection?.mode === 'live' && state.projection.item?.kind === 'image' ? state.projection.item.url : null;

    grid.replaceChildren(...list.map((image) => h('div', { class: `media-card${image.id === selected ? ' selected' : ''}${image.url === onAir ? ' live' : ''}`, dataset: { id: image.id, ...(ctx.canEdit && { drag: image.id, name: image.name }) } },
      h('button', { class: 'media-pick', 'aria-pressed': image.id === selected, onclick: () => select(image.id), ondblclick: () => { select(image.id); project(); } },
        h('span', { class: 'media-thumb' }, h('img', { src: image.thumb || image.url, alt: '', loading: 'lazy' }), kindBadge('image'),
          image.url === onAir && h('span', { class: 'badge live' }, 'Al aire')),
        h('span', { class: 'item-text' }, h('strong', {}, image.name),
          h('small', { title: `${image.width} × ${image.height} · agregada el ${new Date(image.added).toLocaleString('es')}` }, `${whenLabel(image.added)} · ${image.width} × ${image.height}`))),
      ctx.canEdit && h('button', { class: 'icon-btn sm media-more', 'aria-label': `Opciones de ${image.name}`, onclick: (e) => menu(e.currentTarget, [
        { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(image) },
        ...lib.menu(image, e.currentTarget),
        '-',
        { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(image, 'la imagen') },
      ]) }, icon('dots-three', 16)))));

    const image = current();
    bar.hidden = !image;
    if (image) {
      name.textContent = image.name;
      for (const f of fitButtons) {
        f.button.classList.toggle('on', f.id === image.fit);
        f.button.setAttribute('aria-pressed', f.id === image.fit);
        if (f.picture.getAttribute('src') !== (image.thumb || image.url)) f.picture.src = image.thumb || image.url;
      }
    }
    if (el.isConnected && !el.hidden) ctx.setPreview(image ? { kind: 'image', title: image.name, url: image.url, width: image.width, height: image.height, fit: image.fit } : null);
  }
  subscribe('media', render);
  subscribe('projection', render);

  return {
    id: 'imagenes', label: 'Imágenes', kind: 'image', el, bar,
    items: images,
    clear: () => select(null),
    render,
    accepts: (file) => IMAGE_ACCEPT.split(',').includes(file.type),
    upload: startUpload,
    onShow: render,
    keys(e) {
      if (e.key !== 'Enter' || !current()) return false;
      project();
      return true;
    },
  };
}

