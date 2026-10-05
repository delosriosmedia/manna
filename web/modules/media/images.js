import { action, state, subscribe } from '../../core/api.js';
import { h, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { IMAGE_ACCEPT } from '../../core/images.js';
import { whenLabel } from '../../core/time.js';
import { askName, confirmRemove } from './dialogs.js';
import { openUpload } from './upload.js';

const FITS = [['contain', 'Completa', 'Se ve entera; con bandas negras si no tiene la forma de la pantalla'], ['cover', 'Llenar', 'Llena la pantalla; se recorta lo que sobre']];

// Pestaña Imágenes de Medios: la rejilla, el ajuste a la pantalla y las acciones de la imagen elegida.
// Devuelve lo que la pantalla de Medios necesita de una pestaña (ver workspace.js).
export function createImagesPanel(ctx) {
  let selected = null; // id de la imagen elegida
  const images = () => state.media?.images || [];
  const current = () => images().find((i) => i.id === selected) || null;

  const picker = h('input', { type: 'file', accept: IMAGE_ACCEPT, multiple: true, hidden: true });
  const startUpload = (files) => openUpload(files, { onDone: (ids) => select(ids.at(-1)) });
  picker.addEventListener('change', () => {
    if (picker.files.length) startUpload(picker.files);
    picker.value = '';
  });

  const grid = h('div', { class: 'media-grid' });
  const el = h('div', { class: 'media-body', dataset: { panel: 'imagenes' } }, grid, picker);
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
    selected = id;
    awaited = id && !current() ? id : null;
    render();
  }

  function render() {
    const list = images();
    if (current()) awaited = null;
    else if (selected !== awaited) selected = null;
    const onAir = state.projection?.mode === 'live' && state.projection.item?.kind === 'image' ? state.projection.item.url : null;

    if (!list.length) {
      el.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, 'Aún no hay imágenes'),
        'Sube anuncios, carteles o fotos desde este equipo o desde la galería del celular. También puedes arrastrarlas hasta aquí.',
        ctx.canEdit && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: () => picker.click() }, icon('upload-simple', 16), 'Subir imágenes'))), picker);
    } else {
      if (!grid.isConnected) el.replaceChildren(grid, picker);
      grid.replaceChildren(...list.map((image) => h('div', { class: `media-card${image.id === selected ? ' selected' : ''}${image.url === onAir ? ' live' : ''}`, dataset: { id: image.id } },
        h('button', { class: 'media-pick', 'aria-pressed': image.id === selected, onclick: () => select(image.id), ondblclick: () => { select(image.id); project(); } },
          h('span', { class: 'media-thumb' }, h('img', { src: image.thumb || image.url, alt: '', loading: 'lazy' }),
            image.url === onAir && h('span', { class: 'badge live' }, 'Al aire')),
          h('span', { class: 'item-text' }, h('strong', {}, image.name),
            h('small', { title: `${image.width} × ${image.height} · agregada el ${new Date(image.added).toLocaleString('es')}` }, `${whenLabel(image.added)} · ${image.width} × ${image.height}`))),
        ctx.canEdit && h('button', { class: 'icon-btn sm media-more', 'aria-label': `Opciones de ${image.name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(image) },
          '-',
          { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(image, 'la imagen') },
        ]) }, icon('dots-three', 16)))));
    }

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
    id: 'imagenes', label: 'Imágenes', uploadLabel: 'Subir imágenes', el, bar,
    pick: () => picker.click(),
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

