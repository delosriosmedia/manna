import { upload } from '../../core/api.js';
import { h, dialog, toast } from '../../core/dom.js';
import { isImageFile, prepareImage } from '../../core/images.js';

// Subir imágenes a la biblioteca: se les pone nombre y se envían de una en una, con su avance.
// Reducirlas y hacerles la miniatura es cosa de web/core/images.js.

// "IMG_2024-anuncios_octubre.jpg" -> "IMG 2024 anuncios octubre"
export const nameFromFile = (fileName) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Imagen';

// Ventana para poner nombre a lo elegido y subirlo, con el avance de cada imagen.
// onDone(ids) recibe las que quedaron en la biblioteca.
export function openUpload(files, { onDone = () => {} } = {}) {
  const list = [...files].filter(isImageFile);
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
        row.ready = await prepareImage(row.file);
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
