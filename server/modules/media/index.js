import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { EXTENSIONS, IMAGE_TYPES, readImageInfo } from '../../core/images.js';
import { cleanName } from '../../core/names.js';
import { applyView, initialView, validFit } from '../../core/view.js';
import { registerClips } from './library.js';
import { youtubeId, youtubeLinks } from './youtube.js';

// Módulo Medios: la biblioteca de lo que la iglesia proyecta. Imágenes (aquí), videos, audios y
// YouTube (library.js), y las categorías (aquí). En la web es una sola pantalla, con todo junto y
// separado por tipo, que también muestra las presentaciones del módulo de diapositivas.
//
// Cada imagen es un archivo en data/media/imagenes/ más una ficha (nombre, medidas, ajuste).
// La miniatura la hace y la envía el dispositivo que sube: el servidor no sabe encoger imágenes.
//
// Categorías (data/medios.json): [{ id, name, items: [ids] }], con el nombre que les pone la iglesia. Valen
// para cualquier elemento: imágenes, videos, audios y presentaciones. Cada uno está en una sola, y lo que no
// está en ninguna es el cajón «Principal». Borrar una categoría devuelve sus elementos al principal.

const IMAGE_LIMIT = 30 * 1024 * 1024;
const THUMB_LIMIT = 600 * 1024;
const FOLDER = 'imagenes';

export default function setup(app) {
  const { store } = app;
  const dir = path.join(app.uploadsDir, FOLDER);
  const saved = app.storage('medios', { images: [] });
  saved.data.categories ||= [];
  // Hasta la 1.25 eran solo de videos (`videos`) y uno podía estar en varias: se queda en la primera.
  const seen = new Set();
  for (const c of saved.data.categories) {
    c.items = (c.items || c.videos || []).filter((id) => !seen.has(id) && seen.add(id));
    delete c.videos;
  }
  // Fichas cuyo archivo ya no está (alguien lo borró a mano) se quitan al arrancar. En la nube, de lo que ya llegó a la
  // iglesia queda solo la miniatura (atChurch, abajo).
  saved.data.images = saved.data.images.filter((image) => fs.existsSync(path.join(app.uploadsDir, image.atChurch ? image.thumb || '' : image.file)));

  const url = (file) => `/media/${file}`;
  const view = (image) => ({
    id: image.id, name: image.name, url: url(image.atChurch ? image.thumb : image.file), thumb: image.thumb ? url(image.thumb) : null,
    width: image.width, height: image.height, bytes: image.bytes, fit: validFit(image.fit), added: image.added, ...(image.atChurch && { atChurch: true }),
  });
  let library = null; // videos y audios: se crea más abajo
  // Las más recientes, primero.
  const publish = () => store.set('media', {
    images: [...saved.data.images].sort((a, b) => b.added - a.added).map(view),
    videos: library?.views('video') || [],
    audios: library?.views('audio') || [],
    youtube: library?.views('youtube') || [],
    // Con lo que ya no está, que la interfaz no muestra: uno de la carpeta que se borró a mano vuelve a su
    // categoría si regresa.
    categories: saved.data.categories.map((c) => ({ id: c.id, name: c.name, items: [...c.items] })),
  });
  const exists = (id) => saved.data.images.some((i) => i.id === id) || library.has(id) || Boolean(app.services.slides?.has(id));
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

  store.register('media', { images: [], videos: [], audios: [], youtube: [], categories: [] });
  library = registerClips(app, { saved, commit });
  // De la nube al equipo de la iglesia (decisión 64): lo que se sube desde casa espera en la nube (pending) a que el
  // equipo lo baje y lo adopte con el mismo identificador (así los órdenes que lo usan no cambian); al recibirlo, la
  // nube borra el archivo grande y se queda con la ficha y la miniatura (delivered: atChurch). Las rutas de los
  // archivos, dentro de data/. Los videos y audios, en library.js.
  const rel = (file) => file && path.join(path.relative(app.dataDir, app.uploadsDir), file);
  const images = {
    pending: () => saved.data.images.filter((i) => !i.atChurch).map((i) => ({
      type: 'image', id: i.id, entry: { name: i.name, fit: i.fit, bytes: i.bytes }, files: { main: rel(i.file), thumb: rel(i.thumb) },
    })),
    delivered(id) {
      const image = saved.data.images.find((i) => i.id === id);
      if (!image || image.atChurch || !image.thumb) return;
      fs.rmSync(path.join(app.uploadsDir, image.file), { force: true });
      image.atChurch = true;
      commit();
    },
    adopt({ id, entry }, files) {
      const info = readImageInfo(files.main);
      if (!info) throw new Error('No llegó una imagen.');
      const file = `${FOLDER}/${id}${EXTENSIONS[info.type]}`;
      fs.mkdirSync(dir, { recursive: true });
      fs.renameSync(files.main, path.join(app.uploadsDir, file));
      const thumb = files.thumb && readImageInfo(files.thumb)?.type === 'jpeg' ? `${FOLDER}/${id}.mini.jpg` : null;
      if (thumb) fs.renameSync(files.thumb, path.join(app.uploadsDir, thumb));
      saved.data.images.push({ id, file, thumb, bytes: Number(entry.bytes) || 0, width: info.width, height: info.height, name: cleanName(entry.name) || 'Imagen', fit: validFit(entry.fit), added: Date.now() });
      commit();
    },
  };
  app.services.media = {
    rescan: library.rescan,
    transfer: {
      types: ['image', 'video', 'audio'],
      has: (id) => saved.data.images.some((i) => i.id === id) || library.has(id),
      pending: () => [...images.pending(), ...library.transfer.pending()],
      delivered: (id) => (library.has(id) ? library.transfer.delivered(id) : images.delivered(id)),
      adopt: (item, files) => (item.type === 'image' ? images.adopt(item, files) : library.transfer.adopt(item, files)),
    },
  };
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

  // Un video de YouTube por su enlace (fase 36): lo añade al orden quien prepara desde la nube, y lo descargará el equipo
  // de la iglesia (fase 37 o 38). Hasta entonces no se proyecta. data = { link } al añadirlo (lo que acompaña al enlace
  // en su línea es su nombre) y { videoId, title } guardado.
  app.kind('ytlink', {
    label: 'Video de YouTube',
    describe(data) {
      const [found] = youtubeLinks(String(data?.link ?? '')).found;
      const videoId = found?.videoId || (youtubeId(`https://youtu.be/${data?.videoId}`) && data.videoId);
      if (!videoId) return null;
      const title = cleanName(found ? found.label : data.title, 120) || 'Video de YouTube';
      return { title, subtitle: 'Se descarga en la iglesia', steps: 1, data: { videoId, title } };
    },
    resolve: () => ({ unavailable: 'Este video se descarga en el equipo de la iglesia y aún no está.' }),
  });

  // ---- Subir ----
  app.route('POST', '/api/media/images', async (ctx) => {
    ctx.require('media.edit');
    // En la nube, lo que se sube desde casa cabe en el espacio que dio el superadministrador (fase 39).
    if (app.cloud) app.services.church?.room(Number(ctx.req.headers['content-length']) || 0);
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

  // Añade un video de YouTube a la biblioteca: lo descarga en segundo plano. Devuelve su id.
  app.action('media.youtube', { permission: 'media.edit' }, ({ link }) => library.addYoutube(link));
  // Varios de una vez (fase 28): primero los enlaces de un texto pegado, para revisarlos; después, los elegidos.
  app.route('POST', '/api/media/youtube/enlaces', async (ctx) => {
    ctx.require('media.edit');
    return library.findLinks((await ctx.raw(256 * 1024)).toString('utf8'));
  });
  app.action('media.youtubeMany', { permission: 'media.edit' }, ({ videoIds } = {}) => library.addYoutubeMany(videoIds));

  app.action('media.retry', { permission: 'media.edit' }, ({ id }) => library.retry(id));
  app.action('media.subtitlesRemove', { permission: 'media.edit' }, ({ id }) => library.removeSubtitles(id));

  app.action('media.remove', { permission: 'media.edit' }, ({ id }) => {
    for (const c of saved.data.categories) c.items = c.items.filter((v) => v !== id);
    if (library.has(id)) {
      library.remove(id);
      return;
    }
    const image = find(id);
    for (const file of [image.file, image.thumb].filter(Boolean)) fs.rmSync(path.join(app.uploadsDir, file), { force: true });
    saved.data.images = saved.data.images.filter((i) => i.id !== id);
    commit();
  });

  // ---- Categorías ----
  const category = (id) => {
    const found = saved.data.categories.find((c) => c.id === id);
    if (!found) throw new HttpError(404, 'Esa categoría ya no existe.');
    return found;
  };
  const categoryName = (name, except = null) => {
    const clean = cleanName(name, 40);
    if (!clean) throw new HttpError(400, 'Escribe un nombre para la categoría.');
    if (saved.data.categories.some((c) => c !== except && c.name.toLowerCase() === clean.toLowerCase())) throw new HttpError(409, `Ya hay una categoría «${clean}».`);
    return clean;
  };
  app.action('media.categoryAdd', { permission: 'media.edit' }, ({ name }) => {
    const created = { id: crypto.randomBytes(4).toString('hex'), name: categoryName(name), items: [] };
    saved.data.categories.push(created);
    commit();
    return { id: created.id };
  });
  app.action('media.categoryRename', { permission: 'media.edit' }, ({ id, name }) => {
    const found = category(id);
    found.name = categoryName(name, found);
    commit();
  });
  app.action('media.categoryRemove', { permission: 'media.edit' }, ({ id }) => {
    category(id);
    saved.data.categories = saved.data.categories.filter((c) => c.id !== id);
    commit();
  });
  // Lleva el elemento a la categoría `to` (y lo saca de la que tuviera); con `to` vacío, al principal.
  app.action('media.categoryMove', { permission: 'media.edit' }, ({ item, to }) => {
    const target = to ? category(to) : null;
    if (typeof item !== 'string' || !exists(item)) throw new HttpError(404, 'Eso ya no está en la biblioteca.');
    for (const c of saved.data.categories) c.items = c.items.filter((v) => v !== item);
    target?.items.push(item);
    commit();
  });
}
