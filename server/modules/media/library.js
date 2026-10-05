import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { readImageInfo } from '../../core/images.js';
import { listFiles, watchFolder } from '../../core/folders.js';
import { applyClock, createClock, freezeClock } from '../../core/playback.js';
import { AUDIO_EXTENSIONS, SUBTITLE_EXTENSIONS, VIDEO_EXTENSIONS, clipKind, clock, originalMayPlay, planFor, playsAsIs, toVtt } from './clips.js';
import { createConverter } from './convert.js';
import { cleanName } from './images.js';

// Videos y audios de Medios. Llegan de dos sitios:
//   - subidos desde la app: el archivo queda en data/media/videos o data/media/audios;
//   - copiados a mano en Contenido/Medios/ del equipo principal: aparecen solos (para archivos
//     grandes es lo más cómodo).
// Lo que cualquier navegador reproduce tal cual se usa como está. Lo demás se convierte una sola
// vez, en segundo plano, y el resultado (una copia ligera, en MP4 y a 1080p como mucho) se guarda
// en data/media/convertidos.
//
// Mientras tanto no hay que esperar: si el navegador del equipo principal reproduce el archivo
// original (lo comprueba él mismo, ver web/modules/media/probe.js), las pantallas de ese equipo lo
// usan directamente, desde el primer momento y también después. La copia ligera es para las demás
// pantallas (celulares, equipos remotos), que la usan en cuanto está.
//
// Ficha de cada uno (en data/medios.json):
//   { id, kind, name, source: 'upload' | 'folder', file, bytes, added, duration, width, height,
//     status: 'ready' | 'converting' | 'needs-ffmpeg' | 'error', direct, converted, poster, subtitles, error }
//   file       subido: ruta dentro de data/media. De carpeta: nombre del archivo en Contenido/Medios
//   direct     cualquier navegador reproduce el propio archivo
//   converted  ruta de la copia ligera dentro de data/media
//   original   ¿reproduce el equipo principal el archivo tal cual? true, false, o null si aún no se
//              sabe. 'no' si ni se intenta (su sonido no lo entendería). originalBy: qué pantalla lo dijo

const FOLDERS = { video: 'videos', audio: 'audios' };
const LIMITS = { video: 8 * 1024 ** 3, audio: 1024 ** 3 };
const THUMB_LIMIT = 600 * 1024;
const SUBTITLE_LIMIT = 2 * 1024 * 1024;
const MAX_DURATION = 24 * 3600;
const LABELS = { video: 'Video', audio: 'Audio' };

const stripExtension = (name) => name.replace(/\.[^.]+$/, '');
const nameFromFile = (name) => cleanName(stripExtension(name).replace(/[_]+/g, ' ')) || 'Sin nombre';

export function registerClips(app, { saved, commit }) {
  const { store } = app;
  const base = app.uploadsDir;
  const folder = app.mediaDir || null;
  // MANNA_CONVERSION_LENTA (solo para pruebas): milisegundos que espera cada conversión antes de empezar.
  const converter = createConverter(app, { delay: Number(process.env.MANNA_CONVERSION_LENTA) || 0 });
  saved.data.clips ||= [];
  const clips = () => saved.data.clips;

  const inputOf = (clip) => (clip.source === 'folder' ? path.join(folder, clip.file) : path.join(base, clip.file));
  const sourceUrl = (clip) => (clip.source === 'folder' ? `/medios/${encodeURIComponent(clip.file)}` : `/media/${clip.file}`);
  // Lo que reproduce cualquier pantalla: la copia ligera o, si no hizo falta, el propio archivo.
  const urlOf = (clip) => {
    if (clip.status !== 'ready') return null;
    return clip.converted ? `/media/${clip.converted}` : sourceUrl(clip);
  };
  // Lo que reproducen las pantallas del equipo principal cuando su navegador puede con el original.
  const localUrl = (clip) => (!clip.direct && clip.original === true ? sourceUrl(clip) : null);
  const usable = (clip) => clip.status === 'ready' || Boolean(localUrl(clip));
  // El sello al final hace que el navegador pida la imagen o los subtítulos de nuevo si cambian.
  const stamped = (file, at) => (file ? `/media/${file}?v=${at || 0}` : null);
  const view = (clip) => ({
    id: clip.id, kind: clip.kind, name: clip.name, source: clip.source, url: urlOf(clip), poster: stamped(clip.poster, clip.posterAt),
    duration: clip.duration ?? null, width: clip.width || 0, height: clip.height || 0, bytes: clip.bytes || 0, added: clip.added,
    status: clip.status, error: clip.error || null, subtitles: Boolean(clip.subtitles), converted: Boolean(clip.converted),
    // usable: ya se puede proyectar (aunque la copia para las demás pantallas esté en camino).
    // original: solo en lo que hay que convertir. playable = lo dicho por el equipo principal
    // (null: aún no lo ha comprobado), by = qué pantalla suya lo comprobó.
    usable: usable(clip),
    original: clip.direct || clip.original === 'no' ? null : { url: sourceUrl(clip), playable: clip.original ?? null, by: clip.originalBy || null },
  });
  const find = (id) => {
    const clip = clips().find((c) => c.id === id);
    if (!clip) throw new HttpError(404, 'Ese archivo ya no está en la biblioteca.');
    return clip;
  };
  const removeFile = (relative) => { if (relative) fs.rmSync(path.join(base, relative), { force: true }); };
  // Lo que Manna hizo a partir del archivo (convertido, miniatura, subtítulos), no el archivo.
  function dropDerived(clip) {
    converter.cancel(clip.id);
    for (const key of ['converted', 'poster', 'subtitles']) {
      removeFile(clip[key]);
      clip[key] = null;
    }
  }

  // ---- Qué hacer con un archivo ----
  async function ensurePoster(clip) {
    if (clip.kind !== 'video' || clip.poster) return;
    const file = `miniaturas/${clip.id}.jpg`;
    fs.mkdirSync(path.join(base, 'miniaturas'), { recursive: true });
    const source = clip.converted ? path.join(base, clip.converted) : inputOf(clip);
    if (await converter.poster(source, path.join(base, file), Math.min(2, (clip.duration || 0) / 4))) Object.assign(clip, { poster: file, posterAt: Date.now() });
  }

  // Mira el archivo y lo deja listo o en camino. false: no es un video ni un audio.
  async function analyze(clip) {
    const input = inputOf(clip);
    const info = await converter.probe(input);
    if (info === undefined) {
      // Sin ffmpeg no se puede mirar dentro: se confía en la extensión.
      clip.direct = playsAsIs(path.extname(clip.file));
      Object.assign(clip, clip.direct
        ? { status: 'ready', error: null }
        : { status: 'needs-ffmpeg', error: 'Este formato hay que convertirlo, y para eso hace falta ffmpeg en el equipo principal.' });
      return true;
    }
    if (!info || (clip.kind === 'audio' && !info.audio)) return false;
    if (clip.kind === 'video' && !info.video) clip.kind = 'audio'; // un "video" que solo trae sonido
    Object.assign(clip, { duration: info.duration ?? clip.duration ?? null, width: info.video?.width || 0, height: info.video?.height || 0 });
    const plan = planFor(info, clip.kind);
    if (plan.action === 'direct') {
      Object.assign(clip, { direct: true, status: 'ready', error: null });
      await ensurePoster(clip);
      return true;
    }
    // Hay que hacerle una copia. Entre tanto, quizá el equipo principal pueda con el original.
    if (!originalMayPlay(info, clip.kind)) clip.original = 'no';
    else if (clip.original === 'no') clip.original = null;
    await ensurePoster(clip);
    const converted = `convertidos/${clip.id}${clip.kind === 'audio' ? '.m4a' : '.mp4'}`;
    fs.mkdirSync(path.join(base, 'convertidos'), { recursive: true });
    Object.assign(clip, { direct: false, status: 'converting', error: null });
    converter.enqueue({
      id: clip.id, name: clip.name, input, output: path.join(base, converted), kind: clip.kind, plan, duration: clip.duration, width: clip.width,
      async onDone(result) {
        // Pudo eliminarse mientras se convertía.
        if (!clips().includes(clip)) { removeFile(converted); return; }
        if (result.ok) {
          Object.assign(clip, { converted, status: 'ready', error: null });
          await ensurePoster(clip);
        } else if (!result.cancelled) {
          Object.assign(clip, { status: 'error', error: 'No se pudo convertir este archivo. Puede estar dañado o tener un formato poco común.' });
        }
        commit();
      },
    });
    return true;
  }

  // ---- Carpeta Contenido/Medios ----
  // Subtítulos con el mismo nombre que el video (.vtt o .srt): se convierten y se guardan.
  function siblingSubtitles(clip) {
    for (const ext of SUBTITLE_EXTENSIONS) {
      const source = path.join(folder, stripExtension(clip.file) + ext);
      let stat = null;
      try { stat = fs.statSync(source); } catch { continue; }
      if (clip.subtitles && clip.subtitlesAt >= stat.mtimeMs) return;
      if (stat.size > SUBTITLE_LIMIT) return;
      saveSubtitles(clip, fs.readFileSync(source, 'utf8'), stat.mtimeMs);
      return;
    }
  }
  function saveSubtitles(clip, text, at = Date.now()) {
    const vtt = toVtt(text);
    if (!vtt.includes('-->')) return false;
    const file = `subtitulos/${clip.id}.vtt`;
    fs.mkdirSync(path.join(base, 'subtitulos'), { recursive: true });
    fs.writeFileSync(path.join(base, file), vtt);
    Object.assign(clip, { subtitles: file, subtitlesAt: at });
    return true;
  }

  let scanning = false;
  let again = false;
  async function scan() {
    if (!folder) return;
    if (scanning) { again = true; return; }
    scanning = true;
    try {
      const present = new Set();
      for (const file of listFiles(folder, [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS])) {
        const id = `c${crypto.createHash('sha1').update(file.name).digest('hex').slice(0, 11)}`;
        present.add(id);
        let clip = clips().find((c) => c.id === id);
        const same = clip && clip.bytes === file.size && clip.modified === file.modified;
        if (!same) {
          // El archivo cambió: lo que se sabía de él (también si se reproduce tal cual) ya no vale.
          if (clip) {
            dropDerived(clip);
            Object.assign(clip, { original: null, originalBy: null });
          } else {
            clip = { id, kind: clipKind(file.name), name: nameFromFile(file.name), source: 'folder', file: file.name, added: Math.round(file.modified) };
            clips().push(clip);
          }
          Object.assign(clip, { bytes: file.size, modified: file.modified, duration: null, converted: null, poster: null });
          if (!(await analyze(clip))) Object.assign(clip, { status: 'error', error: 'Manna no puede reproducir este archivo.' });
        }
        if (clip.kind === 'video') siblingSubtitles(clip);
      }
      for (const gone of clips().filter((c) => c.source === 'folder' && !present.has(c.id))) dropDerived(gone);
      saved.data.clips = clips().filter((c) => c.source !== 'folder' || present.has(c.id));
      commit();
    } finally {
      scanning = false;
      if (again) { again = false; scan(); }
    }
  }

  // Lo que quedó a medias al apagar, y lo que esperaba a que hubiera ffmpeg.
  async function resume() {
    saved.data.clips = clips().filter((clip) => clip.source === 'folder' || fs.existsSync(path.join(base, clip.file)));
    for (const clip of clips()) {
      const lost = clip.status === 'ready' && clip.converted && !fs.existsSync(path.join(base, clip.converted));
      const waiting = clip.status === 'needs-ffmpeg' && app.tools.has('ffmpeg');
      if ((clip.status === 'converting' && !converter.busy(clip.id)) || lost || waiting) {
        if (lost) clip.converted = null;
        if (!(await analyze(clip))) Object.assign(clip, { status: 'error', error: 'Manna no puede reproducir este archivo.' });
      } else if (clip.status === 'ready') {
        // Se subió en un equipo sin ffmpeg, o se copió de otro: la imagen se le saca ahora.
        await ensurePoster(clip);
      }
    }
    commit();
    await scan();
  }

  // Mientras algo se reproduce en pantalla, las conversiones ceden el paso: la proyección es lo primero.
  const playingNow = () => store.get('projection')?.mode === 'live' && store.get('live')?.state?.clock?.playing === true;
  store.on('change', (ns) => { if (ns === 'live' || ns === 'projection') converter.hold(playingNow()); });

  let stopWatching = () => {};
  if (folder) {
    fs.mkdirSync(folder, { recursive: true });
    app.mount('/medios/', folder);
    stopWatching = watchFolder(folder, () => scan().catch(() => {}));
  }
  store.on('listening', () => resume().catch((err) => console.error('Medios:', err?.message || err)));
  // Al instalarse ffmpeg, lo que esperaba por él se pone en marcha.
  let hadFfmpeg = app.tools.has('ffmpeg');
  store.on('change', (ns) => {
    if (ns !== 'tools' || hadFfmpeg === app.tools.has('ffmpeg')) return;
    hadFfmpeg = app.tools.has('ffmpeg');
    if (hadFfmpeg) resume().catch(() => {});
  });
  app.onClose(() => {
    stopWatching();
    converter.close();
  });

  // ---- Tipos de contenido: video y audio ----
  // data = { id }. Los mandos en vivo son el reloj de reproducción (pausa, salto, reinicio) y los
  // subtítulos. El volumen es el general de Manna (projection.volume), no de cada elemento.
  // Lo que se proyecta:
  //   url     lo que reproduce cualquier pantalla (null mientras su copia ligera no esté lista)
  //   local   lo que reproducen las pantallas del equipo principal, si pueden con el original
  //   waiting por qué una pantalla sin nada que reproducir todavía solo muestra la imagen
  const content = (clip) => {
    const shared = { id: clip.id, title: clip.name, poster: stamped(clip.poster, clip.posterAt), duration: clip.duration ?? null };
    if (!usable(clip)) {
      // Existe, pero aún no se puede poner en pantalla: la proyección lo dice en vez de fallar.
      return { ...shared, unavailable: clip.status === 'converting' ? `«${clip.name}» aún se está convirtiendo. Estará listo en un momento.` : clip.error || 'Este archivo no se puede reproducir.' };
    }
    return {
      ...shared, url: urlOf(clip), local: localUrl(clip), subtitles: stamped(clip.subtitles, clip.subtitlesAt),
      waiting: clip.status === 'ready' ? null : clip.status === 'converting' ? 'Este video se verá aquí cuando termine de prepararse para este dispositivo.' : 'Este video solo se ve en la pantalla del equipo principal.',
    };
  };
  for (const kind of ['video', 'audio']) {
    app.kind(kind, {
      label: LABELS[kind],
      describe(data) {
        const clip = clips().find((c) => c.id === data?.id);
        return clip ? { title: clip.name, subtitle: [LABELS[clip.kind], clock(clip.duration)].filter(Boolean).join(' · '), steps: 1, data: { id: clip.id } } : null;
      },
      resolve(data) {
        const clip = clips().find((c) => c.id === data?.id);
        return clip ? content(clip) : null;
      },
      live(item, previous) {
        const before = previous?.state;
        // Tras un reinicio del servidor queda en pausa donde iba; al proyectarlo, empieza a reproducirse.
        if (before?.clock) return { clock: freezeClock({ ...before.clock, duration: item.duration ?? before.clock.duration ?? null }, previous.at), subtitles: Boolean(before.subtitles) };
        return { clock: { ...createClock({ duration: item.duration }), playing: true }, subtitles: false };
      },
      control(state, patch, { content: item, now }) {
        let { clock: time } = state;
        // En un equipo sin ffmpeg no se sabe cuánto dura hasta que una pantalla lo reproduce y lo dice.
        if (time.duration == null && Number.isFinite(patch.duration) && patch.duration > 0 && patch.duration < MAX_DURATION) {
          time = { ...time, duration: Math.round(patch.duration * 1000) / 1000 };
          const clip = clips().find((c) => c.id === item.source?.data?.id);
          if (clip && clip.duration == null) {
            clip.duration = time.duration;
            commit();
          }
        }
        return { clock: applyClock(time, patch, now), subtitles: patch.subtitles === undefined ? Boolean(state.subtitles) : Boolean(patch.subtitles) };
      },
      // Al ponerse la pantalla en negro o en solo fondo, deja de sonar: queda en pausa donde iba.
      hide: (state, { now }) => ({ ...state, clock: applyClock(state.clock, { playing: false }, now) }),
      // Al terminar, la proyección pasa sola a "Solo fondo".
      endsAt: ({ clock: time }) => (time.playing && time.duration != null ? time.at + (time.duration - time.position) * 1000 : null),
    });
  }

  // ---- Subir ----
  app.route('POST', '/api/media/clips', async (ctx) => {
    ctx.require('media.edit');
    const ext = String(ctx.query.get('ext') || '').toLowerCase();
    const kind = /^\.[a-z0-9]{2,5}$/.test(ext) ? clipKind(`x${ext}`) : null;
    if (!kind) throw new HttpError(415, 'Manna no reconoce ese tipo de archivo. Sube un video (MP4, MOV, AVI…) o un audio (MP3, M4A, WAV…).');
    const id = crypto.randomBytes(6).toString('hex');
    const file = `${FOLDERS[kind]}/${id}${ext}`;
    const bytes = await ctx.save(path.join(base, file), LIMITS[kind]);
    const hinted = Number(ctx.query.get('duration'));
    const clip = {
      id, kind, name: cleanName(ctx.query.get('name')) || LABELS[kind], source: 'upload', file, bytes, added: Date.now(),
      duration: hinted > 0 && hinted < MAX_DURATION ? Math.round(hinted * 1000) / 1000 : null,
      width: 0, height: 0, status: 'ready', direct: false, converted: null, poster: null, subtitles: null, error: null,
    };
    if (!(await analyze(clip))) {
      removeFile(file);
      throw new HttpError(415, kind === 'video' ? 'Ese archivo no contiene un video que Manna pueda reproducir.' : 'Ese archivo no contiene sonido que Manna pueda reproducir.');
    }
    clips().push(clip);
    commit();
    return view(clip);
  });

  // La imagen de un video la saca ffmpeg; si el equipo no lo tiene, vale la que manda quien lo subió.
  app.route('POST', '/api/media/clips/:id/thumb', async (ctx) => {
    ctx.require('media.edit');
    const clip = find(ctx.params.id);
    if (clip.poster) return view(clip);
    const file = `miniaturas/${clip.id}.jpg`;
    const target = path.join(base, file);
    await ctx.save(target, THUMB_LIMIT);
    if (readImageInfo(target)?.type !== 'jpeg') {
      fs.rmSync(target, { force: true });
      throw new HttpError(415, 'La miniatura debe ser un JPG.');
    }
    Object.assign(clip, { poster: file, posterAt: Date.now() });
    commit();
    return view(clip);
  });

  app.route('POST', '/api/media/clips/:id/subtitles', async (ctx) => {
    ctx.require('media.edit');
    const clip = find(ctx.params.id);
    if (clip.kind !== 'video') throw new HttpError(400, 'Los subtítulos son para los videos.');
    const text = (await ctx.raw(SUBTITLE_LIMIT)).toString('utf8');
    if (!saveSubtitles(clip, text)) throw new HttpError(415, 'Ese archivo no tiene subtítulos que Manna entienda. Usa un archivo .srt o .vtt.');
    commit();
    return view(clip);
  });

  // El equipo principal dice si su navegador reproduce el archivo original tal cual. Lo comprueba
  // su pantalla de proyección o, si no hay, su control; lo que diga la de proyección manda, porque
  // es la que ve el público.
  app.route('POST', '/api/media/clips/:id/original', async (ctx) => {
    if (!ctx.isLocal) throw new HttpError(403, 'Eso solo lo puede decir el equipo principal.');
    const clip = find(ctx.params.id);
    const { ok, by: who } = await ctx.json();
    const by = who === 'proyeccion' ? 'proyeccion' : 'control';
    if (clip.direct || clip.original === 'no' || (clip.originalBy === 'proyeccion' && by !== 'proyeccion')) return view(clip);
    Object.assign(clip, { original: Boolean(ok), originalBy: by });
    commit();
    return view(clip);
  });

  return {
    views: (kind) => clips().filter((c) => c.kind === kind).sort((a, b) => b.added - a.added).map(view),
    has: (id) => clips().some((c) => c.id === id),
    rename(id, name) {
      const clip = find(id);
      clip.name = name;
      commit();
    },
    remove(id) {
      const clip = find(id);
      if (clip.source === 'folder') throw new HttpError(409, 'Este archivo está en la carpeta Contenido/Medios del equipo principal. Para quitarlo, bórralo de esa carpeta.');
      dropDerived(clip);
      removeFile(clip.file);
      saved.data.clips = clips().filter((c) => c.id !== id);
      commit();
    },
    removeSubtitles(id) {
      const clip = find(id);
      removeFile(clip.subtitles);
      Object.assign(clip, { subtitles: null, subtitlesAt: 0 });
      commit();
    },
    // Vuelve a intentarlo con un archivo que falló o que esperaba a ffmpeg.
    async retry(id) {
      const clip = find(id);
      if (!['error', 'needs-ffmpeg'].includes(clip.status)) return;
      if (!(await analyze(clip))) Object.assign(clip, { status: 'error', error: 'Manna no puede reproducir este archivo.' });
      commit();
    },
    rescan: resume,
  };
}
