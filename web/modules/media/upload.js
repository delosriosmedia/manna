import { upload } from '../../core/api.js';
import { h, dialog, toast } from '../../core/dom.js';

// Subir imágenes a la biblioteca. Cada imagen se reduce en el propio dispositivo antes de
// enviarla (una foto de celular pesa varias veces lo que hace falta para una pantalla) y se
// acompaña de su miniatura, porque el servidor no sabe encoger imágenes.
const MAX_SIDE = 2560;        // lado mayor de lo que se guarda: alcanza para acercar en una pantalla de 1080
const THUMB_SIDE = 480;
const PNG_LIMIT = 6 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

// "IMG_2024-anuncios_octubre.jpg" -> "IMG 2024 anuncios octubre"
export const nameFromFile = (fileName) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Imagen';

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

function draw(image, side, background) {
  const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Deja un archivo listo para subir: { blob, type, thumb, preview }.
export async function prepare(file) {
  const image = new Image();
  const source = URL.createObjectURL(file);
  try {
    image.src = source;
    await image.decode();
    const thumb = await toBlob(draw(image, THUMB_SIDE, '#000'), 'image/jpeg', 0.8);
    // Un GIF puede estar animado: se sube tal cual.
    if (file.type === 'image/gif') return { blob: file, type: file.type, thumb, preview: URL.createObjectURL(thumb) };
    // El PNG se conserva (puede tener transparencia) salvo que pese demasiado; lo demás, JPG.
    let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    let blob = await toBlob(draw(image, MAX_SIDE, type === 'image/jpeg' ? '#000' : null), type, 0.9);
    if (type === 'image/png' && blob.size > PNG_LIMIT) {
      type = 'image/jpeg';
      blob = await toBlob(draw(image, MAX_SIDE, '#000'), type, 0.9);
    }
    if (!blob || !thumb) throw new Error('Este navegador no pudo preparar la imagen.');
    return { blob, type, thumb, preview: URL.createObjectURL(thumb) };
  } finally {
    URL.revokeObjectURL(source);
  }
}

// Ventana para poner nombre a lo elegido y subirlo, con el avance de cada imagen.
// onDone(ids) recibe las que quedaron en la biblioteca.
export function openUpload(files, { onDone = () => {} } = {}) {
  const list = [...files].filter((f) => ACCEPT.split(',').includes(f.type));
  if (!list.length) {
    toast('Elige imágenes JPG, PNG, WebP o GIF.', 'error');
    return;
  }
  const rows = list.map((file) => {
    const name = h('input', { class: 'input', value: nameFromFile(file.name), maxLength: 80, 'aria-label': 'Nombre de la imagen' });
    const picture = h('div', { class: 'up-thumb' });
    const fill = h('span', { style: 'width: 0%;' });
    const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, fill);
    const status = h('small', {}, 'Preparando…');
    const el = h('div', { class: 'up-row' }, picture, h('div', { class: 'up-main' }, name, bar, status));
    return { file, name, picture, fill, bar, status, el, ready: null, done: false, failed: false };
  });
  const send = h('button', { class: 'btn primary', disabled: true }, 'Subir');
  const cancel = h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar');
  const box = dialog(list.length === 1 ? 'Subir una imagen' : `Subir ${list.length} imágenes`,
    h('p', { class: 'muted' }, 'El nombre es el que se verá en la biblioteca y en el orden del culto.'),
    h('div', { class: 'up-list' }, ...rows.map((r) => r.el)),
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, cancel, send));

  const progress = (row, fraction) => {
    const percent = Math.round(fraction * 100);
    row.fill.style.width = `${percent}%`;
    row.bar.setAttribute('aria-valuenow', percent);
  };
  const fail = (row, message) => {
    row.failed = true;
    row.status.textContent = message;
    row.el.classList.add('error');
  };

  // Se preparan de una en una: varias fotos grandes a la vez agotan la memoria de un celular.
  (async () => {
    for (const row of rows) {
      try {
        row.ready = await prepare(row.file);
        row.picture.replaceChildren(h('img', { src: row.ready.preview, alt: '' }));
        row.status.textContent = `Lista · ${(row.ready.blob.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
      } catch {
        fail(row, 'No se pudo leer esta imagen.');
      }
    }
    send.disabled = !rows.some((r) => r.ready);
  })();

  send.onclick = async () => {
    send.disabled = true;
    cancel.disabled = true;
    const ids = [];
    for (const row of rows.filter((r) => r.ready && !r.done)) {
      row.name.disabled = true;
      row.el.classList.remove('error');
      row.status.textContent = 'Subiendo…';
      try {
        const image = await upload(`/api/media/images?name=${encodeURIComponent(row.name.value.trim() || nameFromFile(row.file.name))}`, row.ready.blob,
          { headers: { 'Content-Type': row.ready.type }, onProgress: (f) => progress(row, f) });
        // Sin miniatura la biblioteca muestra la imagen entera: no es motivo para dar la subida por mala.
        await upload(`/api/media/images/${image.id}/thumb`, row.ready.thumb, { headers: { 'Content-Type': 'image/jpeg' } }).catch(() => {});
        progress(row, 1);
        row.done = true;
        row.status.textContent = 'Subida';
        row.el.classList.add('done');
        ids.push(image.id);
      } catch (err) {
        fail(row, err.message);
        row.name.disabled = false;
      }
    }
    cancel.disabled = false;
    if (ids.length) onDone(ids);
    const pending = rows.filter((r) => r.ready && !r.done);
    if (!pending.length) {
      for (const row of rows) if (row.ready) URL.revokeObjectURL(row.ready.preview);
      if (rows.every((r) => r.done)) box.close();
      else cancel.textContent = 'Cerrar';
      if (ids.length) toast(ids.length === 1 ? 'Imagen subida.' : `${ids.length} imágenes subidas.`);
    } else {
      send.disabled = false;
      send.textContent = 'Reintentar';
    }
  };
}
