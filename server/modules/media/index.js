import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { EXTENSIONS, IMAGE_TYPES, readImageInfo } from '../../core/images.js';
import { applyView, cleanName, initialView, validFit } from './images.js';
import { registerClips } from './library.js';

// Módulo Medios: la biblioteca de lo que la iglesia proyecta. Imágenes (aquí), videos y audios
// (library.js); YouTube llega en su fase (docs/PLAN.md).
//
// Cada imagen es un archivo en data/media/imagenes/ más una ficha (nombre, medidas, ajuste).
// La miniatura la hace y la envía el dispositivo que sube: el servidor no sabe encoger imágenes.

const IMAGE_LIMIT = 30 * 1024 * 1024;
const THUMB_LIMIT = 600 * 1024;
const FOLDER = 'imagenes';

export default function setup(app) {
  const { store } = app;
  const dir = path.join(app.uploadsDir, FOLDER);
  const saved = app.storage('medios', { images: [] });
  // Fichas cuyo archivo ya no está (alguien lo borró a mano) se quitan al arrancar.
  saved.data.images = saved.data.images.filter((image) => fs.existsSync(path.join(app.uploadsDir, image.file)));

  const url = (file) => `/media/${file}`;
  const view = (image) => ({
    id: image.id, name: image.name, url: url(image.file), thumb: image.thumb ? url(image.thumb) : null,
    width: image.width, height: image.height, bytes: image.bytes, fit: validFit(image.fit), added: image.added,
  });
  let library = null; // videos y audios: se crea más abajo
  // Las más recientes, primero.
  const publish = () => store.set('media', {
    images: [...saved.data.images].sort((a, b) => b.added - a.added).map(view),
    videos: library?.views('video') || [],
    audios: library?.views('audio') || [],
  });
  const find = (id) => {
    const image = saved.data.images.find((i) => i.id === id);
    if (!image) throw new HttpError(404, 'Esa imagen ya no está en la biblioteca.');
    return image;
  };
  const commit = () => {
    saved.save();
    publish();
    // Si lo que cambió está al aire (terminó su copia ligera, se le puso otro nombre), las pantallas
    // lo reciben sin que la reproducción se entere.
    app.services.projection?.refresh();
  };

  store.register('media', { images: [], videos: [], audios: [] });
  library = registerClips(app, { saved, commit });
  app.services.media = { rescan: library.rescan };
  publish();

  // ---- Tipo de contenido ----
  // data = { id, fit }: qué imagen y con qué ajuste. El ajuste se elige antes de proyectar y
  // queda guardado en el elemento del orden; al aire se puede cambiar, acercar y desplazar.
  app.kind('image', {
    label: 'Imagen',
    describe(data) {
      const image = saved.data.images.find((i) => i.id === data?.id);
      if (!image) return null;
      return { title: image.name, subtitle: `Imagen · ${image.width} × ${image.height}`, steps: 1, data: { id: image.id, fit: validFit(data.fit ?? image.fit) } };
    },
    resolve(data) {
      const image = saved.data.images.find((i) => i.id === data?.id);
      if (!image) return null;
      return { title: image.name, url: url(image.file), width: image.width, height: image.height, fit: validFit(data.fit ?? image.fit) };
    },
    live: (content, previous) => initialView(content.fit, previous?.state),
    control: (state, patch) => applyView(state, patch),
  });

  // ---- Subir ----
  app.route('POST', '/api/media/images', async (ctx) => {
    ctx.require('media.edit');
    const declared = IMAGE_TYPES[(ctx.req.headers['content-type'] || '').split(';')[0].trim()];
    if (!declared) throw new HttpError(415, 'Usa una imagen JPG, PNG, WebP o GIF.');
    const id = crypto.randomBytes(6).toString('hex');
    const incoming = path.join(dir, `${id}${declared}`);
    const bytes = await ctx.save(incoming, IMAGE_LIMIT);
    const info = readImageInfo(incoming);
    if (!info) {
      fs.rmSync(incoming, { force: true });
      throw new HttpError(415, 'Ese archivo no es una imagen que Manna pueda mostrar. Usa JPG, PNG, WebP o GIF.');
    }
    // La extensión la decide lo que el archivo es, no lo que se dijo al enviarlo.
    const file = `${FOLDER}/${id}${EXTENSIONS[info.type]}`;
    if (path.join(app.uploadsDir, file) !== incoming) fs.renameSync(incoming, path.join(app.uploadsDir, file));
    const image = {
      id, file, thumb: null, bytes, width: info.width, height: info.height,
      name: cleanName(ctx.query.get('name')) || 'Imagen', fit: 'contain', added: Date.now(),
    };
    saved.data.images.push(image);
    commit();
    return view(image);
  });

  app.route('POST', '/api/media/images/:id/thumb', async (ctx) => {
    ctx.require('media.edit');
    const image = find(ctx.params.id);
    const file = `${FOLDER}/${image.id}.mini.jpg`;
    const target = path.join(app.uploadsDir, file);
    await ctx.save(target, THUMB_LIMIT);
    if (readImageInfo(target)?.type !== 'jpeg') {
      fs.rmSync(target, { force: true });
      throw new HttpError(415, 'La miniatura debe ser un JPG.');
    }
    image.thumb = file;
    commit();
    return view(image);
  });

  // ---- Órdenes ----
  // Cambiar el nombre y eliminar valen para todo lo de la biblioteca: imágenes, videos y audios.
  app.action('media.rename', { permission: 'media.edit' }, ({ id, name }) => {
    const clean = cleanName(name);
    if (!clean) throw new HttpError(400, 'Escribe un nombre.');
    if (library.has(id)) { library.rename(id, clean); return; }
    find(id).name = clean;
    commit();
  });

  // El ajuste con el que se propone proyectar esa imagen la próxima vez.
  app.action('media.fit', { permission: 'media.edit' }, ({ id, fit }) => {
    const image = find(id);
    if (validFit(fit) !== fit) throw new HttpError(400, 'Ajuste no válido.');
    image.fit = fit;
    commit();
  });

  app.action('media.retry', { permission: 'media.edit' }, ({ id }) => library.retry(id));
  app.action('media.subtitlesRemove', { permission: 'media.edit' }, ({ id }) => library.removeSubtitles(id));

  app.action('media.remove', { permission: 'media.edit' }, ({ id }) => {
    if (library.has(id)) { library.remove(id); return; }
    const image = find(id);
    for (const file of [image.file, image.thumb].filter(Boolean)) fs.rmSync(path.join(app.uploadsDir, file), { force: true });
    saved.data.images = saved.data.images.filter((i) => i.id !== id);
    commit();
  });
}
