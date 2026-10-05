import { upload } from '../../core/api.js';
import { h, dialog, toast } from '../../core/dom.js';
import { nameFromFile } from './upload.js';

// Subir videos y audios. A diferencia de las imágenes, el archivo se envía tal cual: convertirlo,
// si hace falta, es cosa del equipo principal. Antes de enviar se le pregunta al navegador cuánto
// dura y, si es un video, se le saca una imagen: así el equipo principal lo tiene aunque no tenga ffmpeg.
const VIDEO_TYPES = ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.mpg', '.mpeg', '.wmv', '.flv', '.3gp', '.ts', '.mts', '.m2ts'];
const AUDIO_TYPES = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.wma', '.aif', '.aiff', '.amr'];
export const CLIP_TYPES = { video: VIDEO_TYPES, audio: AUDIO_TYPES };
// En el celular, "video/*" abre la galería; las extensiones sueltas permiten los formatos que el
// navegador no conoce.
export const CLIP_ACCEPT = { video: `video/*,${VIDEO_TYPES.join(',')}`, audio: `audio/*,${AUDIO_TYPES.join(',')}` };

export const extensionOf = (fileName) => (/\.[a-z0-9]+$/i.exec(fileName) || [''])[0].toLowerCase();
export const megabytes = (bytes) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`);

const once = (target, events, ms) => new Promise((resolve) => {
  const done = (e) => {
    clearTimeout(timer);
    resolve(e?.type || null);
  };
  const timer = setTimeout(done, ms);
  for (const name of events) target.addEventListener(name, done, { once: true });
});

// Lo que este navegador sabe del archivo sin subirlo: { duration, thumb }. Con un formato que no
// reproduce (un AVI) no sabe nada, y no pasa nada: lo averiguará el equipo principal.
export async function inspect(file, kind) {
  const media = document.createElement(kind);
  const source = URL.createObjectURL(file);
  try {
    media.preload = 'metadata';
    media.muted = true;
    media.src = source;
    if (await once(media, ['loadedmetadata', 'error'], 5000) !== 'loadedmetadata') return { duration: null, thumb: null };
    const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : null;
    if (kind !== 'video' || !media.videoWidth) return { duration, thumb: null };
    media.currentTime = Math.min(2, (duration || 0) / 4);
    await once(media, ['seeked', 'error'], 4000);
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = Math.max(2, Math.round(480 * media.videoHeight / media.videoWidth));
    canvas.getContext('2d').drawImage(media, 0, 0, canvas.width, canvas.height);
    const thumb = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return { duration, thumb };
  } catch {
    return { duration: null, thumb: null };
  } finally {
    media.removeAttribute('src');
    media.load();
    URL.revokeObjectURL(source);
  }
}

// kind: 'video' | 'audio'. onDone(ids) recibe los que quedaron en la biblioteca.
export function openClipUpload(files, kind, { onDone = () => {} } = {}) {
  const word = kind === 'video' ? 'video' : 'audio';
  const list = [...files].filter((f) => CLIP_TYPES[kind].includes(extensionOf(f.name)));
  if (!list.length) {
    toast(kind === 'video' ? 'Elige archivos de video (MP4, MOV, AVI, MKV…).' : 'Elige archivos de audio (MP3, M4A, WAV…).', 'error');
    return;
  }
  const rows = list.map((file) => {
    const name = h('input', { class: 'input', value: nameFromFile(file.name), maxLength: 80, 'aria-label': `Nombre del ${word}` });
    const fill = h('span', { style: 'width: 0%;' });
    const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, fill);
    const status = h('small', {}, megabytes(file.size));
    const el = h('div', { class: 'up-row plain' }, h('div', { class: 'up-main' }, name, bar, status));
    return { file, name, fill, bar, status, el, done: false };
  });
  const send = h('button', { class: 'btn primary' }, 'Subir');
  const cancel = h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar');
  const box = dialog(list.length === 1 ? `Subir un ${word}` : `Subir ${list.length} ${word}s`,
    h('p', { class: 'muted' }, `El nombre es el que se verá en la biblioteca y en el orden del culto. Si el formato no es de los habituales, Manna lo convierte después de subirlo.`),
    h('div', { class: 'up-list' }, ...rows.map((r) => r.el)),
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, cancel, send));

  const progress = (row, fraction) => {
    const percent = Math.round(fraction * 100);
    row.fill.style.width = `${percent}%`;
    row.bar.setAttribute('aria-valuenow', percent);
    row.status.textContent = `Subiendo… ${percent} % de ${megabytes(row.file.size)}`;
  };

  send.onclick = async () => {
    send.disabled = true;
    cancel.disabled = true;
    const ids = [];
    for (const row of rows.filter((r) => !r.done)) {
      row.name.disabled = true;
      row.el.classList.remove('error');
      row.status.textContent = 'Preparando…';
      try {
        const known = await inspect(row.file, kind);
        const query = new URLSearchParams({ name: row.name.value.trim() || nameFromFile(row.file.name), ext: extensionOf(row.file.name) });
        if (known.duration) query.set('duration', known.duration.toFixed(3));
        const clip = await upload(`/api/media/clips?${query}`, row.file, { headers: { 'Content-Type': 'application/octet-stream' }, onProgress: (f) => progress(row, f) });
        if (known.thumb && !clip.poster) await upload(`/api/media/clips/${clip.id}/thumb`, known.thumb, { headers: { 'Content-Type': 'image/jpeg' } }).catch(() => {});
        row.done = true;
        row.fill.style.width = '100%';
        row.status.textContent = clip.status === 'converting' ? 'Subido. Manna lo está convirtiendo.' : 'Subido';
        row.el.classList.add('done');
        ids.push(clip.id);
      } catch (err) {
        row.status.textContent = err.message;
        row.el.classList.add('error');
        row.name.disabled = false;
      }
    }
    cancel.disabled = false;
    if (ids.length) onDone(ids);
    if (rows.every((r) => r.done)) {
      box.close();
      toast(ids.length === 1 ? `${word[0].toUpperCase()}${word.slice(1)} subido.` : `${ids.length} ${word}s subidos.`);
    } else {
      send.disabled = false;
      send.textContent = 'Reintentar';
    }
  };
}
