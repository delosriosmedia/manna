import { action, state, subscribe } from '../../core/api.js';
import { h, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { IMAGE_ACCEPT } from '../../core/images.js';
import { kindBadge } from '../../core/kinds.js';
import { whenLabel } from '../../core/time.js';
import { centerOf, FULL_VIEW, visible } from '../projection/view.js';
import { askName, confirmRemove } from './dialogs.js';
import { createPreview } from './preview.js';
import { openUpload } from './upload.js';

// La pantalla de la vista previa, la misma de los mandos del encuadre (projection/picture.js).
const SCREEN = { W: 16, H: 9 };
const FITS = [['contain', 'Completa', 'Se ve entera; con bandas negras si no tiene la forma de la pantalla'], ['cover', 'Llenar', 'Llena la pantalla; se recorta lo que sobre']];

// Las imágenes de Medios: la rejilla, las acciones de la imagen elegida y su vista previa, con el ajuste a la pantalla. Devuelve
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
  const big = h('img', { alt: '' });
  big.draggable = false; // que el ratón no se la lleve como una imagen: arrastrarla la coloca
  const frame = h('div', { class: 'preview-frame' }, big);
  const note = h('small', { class: 'preview-note' });
  const preview = createPreview({ back: 'Imágenes', what: 'imagen', list: grid, refresh: () => render() });
  preview.body.append(frame,
    h('div', { class: 'fits', role: 'group', 'aria-label': 'Ajuste a la pantalla' }, ...fitButtons.map((f) => f.button)), note);

  // Con «Llenar», arrastrar la imagen elige qué parte se ve al proyectarla; se guarda al soltar. La cuenta es la de la
  // proyección (projection/view.js), en una pantalla 16:9.
  let grab = null;  // de dónde partió el arrastre
  let moved = null; // el punto mientras se arrastra, hasta que se guarda
  const screenOf = (image) => ({ ...SCREEN, iw: image.width, ih: image.height });
  const viewOf = (image) => ({ fit: 'cover', ...FULL_VIEW, ...(image.x != null && { x: image.x, y: image.y }), ...moved });
  function paintSpot(image) {
    const seen = visible(screenOf(image), viewOf(image));
    const share = (start, size) => (size < 1 ? (start / (1 - size)) * 100 : 50);
    const position = `${share(seen.left, seen.width)}% ${share(seen.top, seen.height)}%`;
    big.style.objectPosition = image.fit === 'cover' ? position : '';
    fitButtons.find((f) => f.id === 'cover').picture.style.objectPosition = position;
  }
  frame.addEventListener('pointerdown', (e) => {
    const image = current();
    if (image?.fit !== 'cover') return;
    grab = { id: image.id, px: e.clientX, py: e.clientY, center: centerOf(screenOf(image), viewOf(image)), seen: visible(screenOf(image), viewOf(image)) };
    // Así el arrastre sigue aunque el dedo se salga del recuadro. Si el navegador no puede, se sigue igual.
    try { frame.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
  });
  frame.addEventListener('pointermove', (e) => {
    const image = current();
    if (!grab || !image) return;
    const r = frame.getBoundingClientRect();
    moved = centerOf(screenOf(image), { ...viewOf(image), x: grab.center.x - ((e.clientX - grab.px) / r.width) * grab.seen.width, y: grab.center.y - ((e.clientY - grab.py) / r.height) * grab.seen.height });
    paintSpot(image);
  });
  const drop = guard(async () => {
    const id = grab?.id;
    grab = null;
    if (!id || !moved) return;
    try {
      await action('media.fit', { id, fit: 'cover', ...moved });
    } finally {
      moved = null;
      render();
    }
  });
  frame.addEventListener('pointerup', drop);
  frame.addEventListener('pointercancel', drop);
  const name = h('span', { class: 'sel-ref' });
  const add = guard(async () => {
    const image = current();
    await action('order.add', { kind: 'image', data: { id: image.id, fit: image.fit } });
    toast(`«${image.name}» añadida al orden del culto.`);
  });
  // Sin proyección (al preparar el culto en la nube), el doble clic y la tecla Intro añaden al orden.
  const project = guard(async () => {
    const image = current();
    if (image && !ctx.canProject) await add();
    else if (image) await action('projection.show', { kind: 'image', data: { id: image.id, fit: image.fit } });
  });
  const bar = h('div', { class: 'abar media-bar', hidden: true, dataset: { panel: 'imagenes' } },
    name, ctx.canProject && h('span', { class: 'hint' }, 'Doble clic para proyectar'), preview.see,
    h('button', { class: `btn${ctx.canProject ? '' : ' primary'}`, onclick: () => add() }, icon('plus', 16), 'Añadir al orden'),
    ctx.canProject && h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵')));

  // Lo recién subido puede no haber llegado aún con el estado (la respuesta de la subida se
  // adelanta al aviso del servidor): se recuerda, y queda elegido en cuanto aparece.
  let awaited = null;
  function select(id) {
    if (id) lib.picked();
    else preview.open = false; // sin nada elegido, la vista previa de la próxima solo se ve si se pide
    selected = id;
    awaited = id && !current() ? id : null;
    render();
  }

  function render() {
    const list = images();
    if (current()) awaited = null;
    else if (selected !== awaited) selected = null;
    const onAir = state.projection?.mode === 'live' && state.projection.item?.kind === 'image' ? state.projection.item.url : null;

    grid.replaceChildren(...list.map((image) => h('div', { class: `media-card${image.id === selected ? ' selected' : ''}${image.url === onAir ? ' live' : ''}`, dataset: { id: image.id, ...(ctx.can('media.edit') && { drag: image.id, name: image.name }) } },
      h('button', { class: 'media-pick', 'aria-pressed': image.id === selected, onclick: () => select(image.id), ondblclick: () => { select(image.id); project(); } },
        h('span', { class: 'media-thumb' }, h('img', { src: image.thumb || image.url, alt: '', loading: 'lazy' }), kindBadge('image'),
          image.url === onAir && h('span', { class: 'badge live' }, 'Al aire')),
        h('span', { class: 'item-text' }, h('strong', {}, image.name),
          h('small', { title: `${image.width} × ${image.height} · agregada el ${new Date(image.added).toLocaleString('es')}` }, image.atChurch ? 'Ya está en la iglesia' : `${whenLabel(image.added)} · ${image.width} × ${image.height}`))),
      ctx.can('media.edit') && h('button', { class: 'icon-btn sm media-more', 'aria-label': `Opciones de ${image.name}`, onclick: (e) => menu(e.currentTarget, [
        { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(image) },
        ...lib.menu(image, e.currentTarget),
        '-',
        { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(image, 'la imagen') },
      ]) }, icon('dots-three', 16)))));

    const image = current();
    bar.hidden = !image;
    preview.paint(image);
    if (image) name.textContent = image.name;
    // La imagen grande, solo si se pidió: al elegir, no se carga.
    if (image && preview.open) {
      if (big.getAttribute('src') !== (image.url || image.thumb)) big.src = image.url || image.thumb;
      frame.dataset.fit = image.fit;
      note.textContent = image.fit === 'cover' ? 'Arrastra la imagen para elegir qué parte se ve.' : 'Se ve entera; con bandas negras si no tiene la forma de la pantalla.';
      paintSpot(image);
      for (const f of fitButtons) {
        f.button.classList.toggle('on', f.id === image.fit);
        f.button.setAttribute('aria-pressed', f.id === image.fit);
        if (f.picture.getAttribute('src') !== (image.thumb || image.url)) f.picture.src = image.thumb || image.url;
      }
    }
  }
  subscribe('media', render);
  subscribe('projection', render);

  return {
    id: 'imagenes', label: 'Imágenes', kind: 'image', el, bar, side: preview.side,
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

