import { action, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ACCEPT, openUpload } from './upload.js';

// Módulo Medios: la biblioteca de la iglesia. Hoy, imágenes; videos, audios y YouTube llegan
// en sus fases y ya tienen su pestaña.
const TABS = [['imagenes', 'Imágenes'], ['videos', 'Videos'], ['audios', 'Audios'], ['youtube', 'YouTube']];
const FITS = [['contain', 'Completa', 'Se ve entera; con bandas negras si no tiene la forma de la pantalla'], ['cover', 'Llenar', 'Llena la pantalla; se recorta lo que sobre']];

function mount(el, ctx) {
  let selected = null; // id de la imagen elegida
  const images = () => state.media?.images || [];
  const current = () => images().find((i) => i.id === selected) || null;

  const picker = h('input', { type: 'file', accept: ACCEPT, multiple: true, hidden: true });
  const startUpload = (files) => openUpload(files, { onDone: (ids) => select(ids.at(-1)) });
  picker.addEventListener('change', () => {
    if (picker.files.length) startUpload(picker.files);
    picker.value = '';
  });
  const uploadButton = (primary) => h('button', { class: `btn${primary ? ' primary' : ''}`, onclick: () => picker.click() }, icon('upload-simple', 16), 'Subir imágenes');

  const grid = h('div', { class: 'media-grid' });
  const body = h('div', { class: 'media-body' }, grid);
  const fitButtons = FITS.map(([id, label, title]) => {
    const picture = h('img', { alt: '' });
    const button = h('button', { class: 'fit', dataset: { fit: id }, title, onclick: guard(() => current() && action('media.fit', { id: selected, fit: id })) },
      h('span', { class: `fit-thumb ${id}` }, picture), h('span', {}, label));
    return { id, button, picture };
  });
  const name = h('span', { class: 'sel-ref' });
  const add = h('button', { class: 'btn', onclick: guard(async () => {
    const image = current();
    await action('order.add', { kind: 'image', data: { id: image.id, fit: image.fit } });
    toast(`«${image.name}» añadida al orden del culto.`);
  }) }, icon('plus', 16), 'Añadir al orden');
  const show = h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const bar = h('div', { class: 'abar media-bar' },
    h('div', { class: 'fits', role: 'group', 'aria-label': 'Ajuste a la pantalla' }, ...fitButtons.map((f) => f.button)),
    name, h('span', { class: 'hint' }, 'Doble clic para proyectar'), add, show);

  el.replaceChildren(
    h('div', { class: 'ws-head' }, h('h1', {}, 'Medios'),
      h('div', { class: 'media-tabs', role: 'tablist' }, ...TABS.map(([id, label], i) =>
        h('button', { class: `chip${i === 0 ? ' on' : ''}`, role: 'tab', 'aria-selected': i === 0, disabled: i > 0, title: i > 0 ? `${label}: próximamente` : null, dataset: { tab: id } }, label))),
      h('span', { class: 'spacer' }),
      ctx.canEdit && uploadButton(false)),
    body, bar, picker);

  const project = guard(async () => {
    const image = current();
    if (image) await action('projection.show', { kind: 'image', data: { id: image.id, fit: image.fit } });
  });

  function select(id) {
    selected = id;
    render();
  }

  const rename = (image) => {
    const input = h('input', { class: 'input', value: image.name, maxLength: 80, 'aria-label': 'Nombre de la imagen' });
    const save = guard(async () => {
      await action('media.rename', { id: image.id, name: input.value });
      box.close();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const box = dialog('Cambiar el nombre', input,
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: save }, 'Guardar')));
    input.select();
  };
  const remove = (image) => {
    const box = dialog('Eliminar la imagen',
      h('p', {}, `«${image.name}» se quitará de la biblioteca. Si está en el orden del culto, ese elemento dejará de poder proyectarse.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('media.remove', { id: image.id });
          box.close();
        }) }, 'Eliminar')));
  };

  function render() {
    const list = images();
    if (selected && !current()) selected = null;
    const onAir = state.projection?.mode === 'live' && state.projection.item?.kind === 'image' ? state.projection.item.url : null;

    if (!list.length) {
      grid.replaceChildren();
      body.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, 'Aún no hay imágenes'),
        'Sube anuncios, carteles o fotos desde este equipo o desde la galería del celular. También puedes arrastrarlas hasta aquí.',
        ctx.canEdit && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' }, uploadButton(true))));
    } else {
      if (!grid.isConnected) body.replaceChildren(grid);
      grid.replaceChildren(...list.map((image) => h('div', { class: `media-card${image.id === selected ? ' selected' : ''}${image.url === onAir ? ' live' : ''}`, dataset: { id: image.id } },
        h('button', { class: 'media-pick', 'aria-pressed': image.id === selected, onclick: () => select(image.id), ondblclick: () => { select(image.id); project(); } },
          h('span', { class: 'media-thumb' }, h('img', { src: image.thumb || image.url, alt: '', loading: 'lazy' }),
            image.url === onAir && h('span', { class: 'badge live' }, 'Al aire')),
          h('span', { class: 'item-text' }, h('strong', {}, image.name), h('small', {}, `${image.width} × ${image.height}`))),
        ctx.canEdit && h('button', { class: 'icon-btn sm media-more', 'aria-label': `Opciones de ${image.name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => rename(image) },
          '-',
          { label: 'Eliminar', icon: 'trash', onclick: () => remove(image) },
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
    if (!el.hidden) ctx.setPreview(image ? { kind: 'image', title: image.name, url: image.url, width: image.width, height: image.height, fit: image.fit } : null);
  }
  subscribe('media', render);
  subscribe('projection', render);

  // Arrastrar archivos desde el escritorio.
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
      startUpload(e.dataTransfer.files);
    });
  }

  return {
    onShow: render,
    keys(e) {
      if (e.key !== 'Enter' || !current()) return false;
      project();
      return true;
    },
  };
}

export default {
  id: 'medios', name: 'Medios', icon: 'image', mount,
  // Lo que pedirán las pestañas que aún no existen: la revisión del equipo ya lo cuenta,
  // pero el módulo no avisa por ello hasta que estén (soon).
  needs: [
    { tools: ['ffmpeg'], feature: 'convertir los videos y audios que el navegador no reproduce', soon: true },
    { tools: ['yt-dlp', 'ffmpeg'], feature: 'descargar videos de YouTube', soon: true },
  ],
};
