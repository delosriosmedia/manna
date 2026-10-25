import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { listFiles, watchFolder } from '../../core/folders.js';
import { applyClock, createClock, freezeClock } from '../../core/playback.js';
import { readImageInfo } from '../../core/images.js';
import { applyView, initialView } from '../../core/view.js';
import { buildCatalog, createHymnSearch, ranges, TRACK_NAMES, TRACKS, VIDEO_EXTENSIONS } from './catalog.js';
import { parseLyrics } from './lyrics.js';

// Módulo Himnario: los himnos en video de la carpeta de la iglesia (Contenido/Himnario/videos),
// con sus letras y categorías (Contenido/Himnario/letras). Nada de eso viene con Manna ni se publica.
//
// Cada video trae dos pistas de sonido: la primera, cantada; la segunda, solo instrumental. El
// navegador reproduce siempre la primera, así que para la "pista" se le hace al video, con ffmpeg
// y sin recodificar (décimas de segundo), una copia que solo lleva la segunda. Va a la carpeta de
// paso y se rehace cuando haga falta.
//
// La lista de himnos no va en el estado (son cientos): la interfaz la pide a /api/hymns y vuelve a
// pedirla cuando cambia `hymns.version`.
//
// «Letras sin música» (Contenido/Himnario/diapositivas): las diapositivas del himnario original, una carpeta por
// himno con el nombre de su video («001 Título») y dentro 01.jpg (la portada), 02.jpg… en el orden en que se canta.
// Se proyectan como un tipo propio, `lyrics`, que se pasa a mano y no sale del himno (ver abajo).

const LYRICS_EXTENSIONS = ['.md', '.txt', '.markdown'];
const MAX_DURATION = 6 * 3600;
const PROBE_PAUSE_MS = 2000;

export default function setup(app) {
  const { store } = app;
  store.register('hymns', { ready: false, version: 0, count: 0, issues: 0, favorites: [] });
  if (!app.hymnsDir) return;

  // Las carpetas del himnario: cambian si cambia la carpeta de contenido con Manna abierto (fase 29).
  let videosDir, lyricsDir, slidesDir;
  const point = () => {
    videosDir = path.join(app.hymnsDir, 'videos');
    lyricsDir = path.join(app.hymnsDir, 'letras');
    slidesDir = path.join(app.hymnsDir, 'diapositivas');
    for (const dir of [videosDir, lyricsDir]) fs.mkdirSync(dir, { recursive: true });
  };
  point();
  const tracksDir = path.join(app.tmpDir, 'himnos');
  // Lo que se sabe de cada archivo de video (cuánto dura, cuántas pistas de sonido trae), para no
  // mirarlo con ffprobe cada vez: { [nombre]: { size, modified, duration, tracks } }.
  // Y los favoritos: números de himno, los mismos para todos los dispositivos.
  const saved = app.storage('himnario', { files: {}, favorites: [] });
  saved.data.files ||= {};
  saved.data.favorites ||= [];
  store.set('hymns', { favorites: [...saved.data.favorites] });

  let catalog = buildCatalog([]);
  let search = createHymnSearch([]);
  let byNumber = new Map();
  let version = 0;
  let closed = false;

  const known = (hymn) => {
    const info = saved.data.files[hymn.file];
    return info && info.size === hymn.size && info.modified === hymn.modified ? info : null;
  };
  const durationOf = (hymn) => known(hymn)?.duration ?? null;
  // ¿Tiene pista instrumental? null: aún no se ha mirado el archivo.
  const hasTrack = (hymn) => (known(hymn)?.tracks == null ? null : known(hymn).tracks >= 2);
  const urlOf = (hymn) => `/himnos/${encodeURIComponent(hymn.file)}`;
  const trackUrl = (hymn) => `/api/hymns/${hymn.number}/pista.mp4?v=${Math.round(hymn.modified)}`;
  const find = (number) => {
    const hymn = byNumber.get(Number(number));
    if (!hymn) throw new HttpError(404, 'Ese himno no está en la carpeta del himnario.');
    return hymn;
  };

  // Lo que conviene que sepa quien cuida el himnario, dicho en frases.
  const count = (n) => (n === 1 ? 'un himno' : `${n} himnos`);
  function notes() {
    const r = catalog.report;
    const unexplained = r.withoutLyrics.filter((n) => !r.mismatched.includes(n));
    return [
      r.missing.length && `Faltan los videos de ${count(r.missing.length)}: ${ranges(r.missing)}.`,
      r.mismatched.length && `La letra de ${count(r.mismatched.length)} lleva otro título que su video, así que no se usa: ${ranges(r.mismatched)}. Revisa esos números en el archivo de letras: se buscan solo por número y por título.`,
      unexplained.length && r.withLyrics > 0 && `No hay letra para ${count(unexplained.length)}: ${ranges(unexplained)}. Se buscan solo por número y por título.`,
      r.withoutVideo.length && `Hay letra de ${count(r.withoutVideo.length)} sin video, así que no se ${r.withoutVideo.length === 1 ? 'puede' : 'pueden'} proyectar: ${ranges(r.withoutVideo)}.`,
      r.repeated.length && `Hay más de un video para ${count(r.repeated.length)} (se usa el primero): ${ranges(r.repeated)}.`,
      r.unnumbered.length && `${r.unnumbered.length === 1 ? 'Un archivo no empieza' : `${r.unnumbered.length} archivos no empiezan`} por el número del himno y no se ${r.unnumbered.length === 1 ? 'usa' : 'usan'}: ${r.unnumbered.slice(0, 4).join(', ')}${r.unnumbered.length > 4 ? '…' : ''}.`,
      r.total > 0 && r.withLyrics === 0 && 'No hay letras: copia el archivo de letras a la carpeta Contenido/Himnario/letras para buscar también por la letra.',
    ].filter(Boolean);
  }
  const publish = () => {
    version += 1;
    store.set('hymns', { ready: true, version, count: catalog.hymns.length, issues: notes().length });
  };

  // ---- Leer la carpeta ----
  function readLyrics() {
    const merged = { book: null, categories: [], hymns: [], warnings: [] };
    for (const file of listFiles(lyricsDir, LYRICS_EXTENSIONS)) {
      if (/^leeme\./i.test(file.name)) continue;
      let parsed;
      try { parsed = parseLyrics(fs.readFileSync(file.file, 'utf8')); } catch { continue; }
      merged.book ||= parsed.book;
      merged.hymns.push(...parsed.hymns);
      merged.warnings.push(...parsed.warnings);
      for (const category of parsed.categories) {
        const same = merged.categories.find((c) => c.name === category.name);
        if (same) same.numbers.push(...category.numbers);
        else merged.categories.push({ name: category.name, numbers: [...category.numbers] });
      }
    }
    return merged;
  }

  // Las diapositivas de cada himno: número → { dir, files } (las imágenes, en orden). Las de un número sin video no
  // se usan: el himno no existe.
  let slidesOf = new Map();
  const sizes = new Map(); // número → { width, height } de su portada, mirado una vez
  function readSlides() {
    const found = new Map();
    let dirs = [];
    try { dirs = fs.readdirSync(slidesDir, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return found; }
    for (const d of dirs) {
      const number = Number(/^(\d+)\s/.exec(d.name)?.[1]);
      if (!number || found.has(number)) continue;
      let files = [];
      try { files = fs.readdirSync(path.join(slidesDir, d.name)).filter((f) => /^\d+\.(jpe?g|png)$/i.test(f)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)); } catch { continue; }
      if (files.length) found.set(number, { dir: d.name, files });
    }
    return found;
  }

  function load() {
    slidesOf = readSlides();
    sizes.clear();
    catalog = buildCatalog(listFiles(videosDir, VIDEO_EXTENSIONS), readLyrics());
    byNumber = new Map(catalog.hymns.map((h) => [h.number, h]));
    search = createHymnSearch(catalog.hymns);
    // Lo anotado de archivos que ya no están se olvida.
    const present = new Set(catalog.hymns.map((h) => h.file));
    for (const name of Object.keys(saved.data.files)) if (!present.has(name)) delete saved.data.files[name];
    publish();
    app.services.projection?.refresh();
    probeSoon();
  }

  // ---- Mirar los videos con ffprobe, poco a poco y sin estorbar ----
  let probing = false;
  const playingNow = () => store.get('projection')?.mode === 'live' && store.get('live')?.state?.clock?.playing === true;
  const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms).unref(); });
  function probe(file) {
    return new Promise((resolve) => {
      let child;
      try {
        child = app.tools.spawn('ffmpeg', ['-v', 'error', '-print_format', 'json', '-show_entries', 'format=duration:stream=codec_type', file], { binary: 'ffprobe' });
      } catch { resolve(null); return; }
      try { os.setPriority(child.pid, os.constants.priority.PRIORITY_LOW); } catch { /* el sistema no deja: sigue con la normal */ }
      let out = '';
      child.stdout.on('data', (chunk) => { out += chunk; });
      child.on('error', () => resolve(null));
      child.on('close', (code) => {
        if (code !== 0) { resolve(null); return; }
        try {
          const data = JSON.parse(out);
          const duration = Number(data.format?.duration);
          resolve({ duration: duration > 0 && duration < MAX_DURATION ? Math.round(duration * 1000) / 1000 : null, tracks: (data.streams || []).filter((s) => s.codec_type === 'audio').length });
        } catch { resolve(null); }
      });
    });
  }
  async function probeSoon() {
    if (probing || !app.tools.has('ffmpeg')) return;
    probing = true;
    let changed = 0;
    const failed = new Set(); // archivos que ffprobe no entiende: no se insiste
    try {
      // La carpeta puede cambiar mientras tanto: se sigue hasta que no quede ninguno por mirar.
      for (let hymn; (hymn = catalog.hymns.find((h) => !known(h) && !failed.has(h.file)));) {
        if (closed) return;
        // Lo que suena en pantalla es lo primero.
        while (playingNow() && !closed) await wait(PROBE_PAUSE_MS);
        const info = await probe(path.join(videosDir, hymn.file));
        if (!info) { failed.add(hymn.file); continue; }
        saved.data.files[hymn.file] = { size: hymn.size, modified: hymn.modified, ...info };
        changed += 1;
        if (changed % 100 === 0) saved.save();
      }
    } finally {
      probing = false;
      if (changed && !closed) {
        saved.save();
        publish();
      }
    }
  }

  // ---- La pista instrumental ----
  const preparing = new Map(); // archivo de salida -> promesa
  let queue = Promise.resolve(); // una copia a la vez: muchas peticiones juntas no lanzan cientos de ffmpeg
  function ensureTrack(hymn) {
    const out = path.join(tracksDir, `${hymn.number}-${Math.round(hymn.modified)}.mp4`);
    if (fs.existsSync(out)) return Promise.resolve(out);
    if (preparing.has(out)) return preparing.get(out);
    const work = queue.then(() => new Promise((resolve, reject) => {
      fs.mkdirSync(tracksDir, { recursive: true });
      const partial = `${out}.parcial`;
      let child;
      try {
        // Copia la imagen y la segunda pista de sonido tal cual, sin recodificar.
        child = app.tools.spawn('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-i', path.join(videosDir, hymn.file),
          '-map', '0:v:0', '-map', '0:a:1', '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', partial]);
      } catch (err) { reject(err); return; }
      child.on('error', () => reject(new HttpError(500, 'No se pudo preparar la pista instrumental.')));
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(partial)) {
          fs.renameSync(partial, out);
          resolve(out);
        } else {
          fs.rmSync(partial, { force: true });
          reject(new HttpError(409, 'Este himno no trae pista instrumental.'));
        }
      });
    })).finally(() => preparing.delete(out));
    queue = work.catch(() => {});
    preparing.set(out, work);
    return work;
  }

  // ---- Arranque y vigilancia ----
  if (app.r2) {
    // En la nube (fase 36), los videos y las diapositivas están en R2: quien entró recibe un enlace que caduca en una hora.
    const toR2 = (ctx, key) => {
      ctx.require('hymns.read');
      ctx.res.writeHead(302, { Location: app.r2.link(key), 'Cache-Control': 'no-store' });
      ctx.res.end();
    };
    app.route('GET', '/himnos/:file', (ctx) => toR2(ctx, `Himnario/videos/${ctx.params.file}`));
    app.route('GET', '/himnos-letras/:dir/:file', (ctx) => toR2(ctx, `Himnario/diapositivas/${ctx.params.dir}/${ctx.params.file}`));
  } else {
    app.mount('/himnos/', () => videosDir);
    app.mount('/himnos-letras/', () => slidesDir);
  }
  const watch = () => [watchFolder(videosDir, load), watchFolder(lyricsDir, load), watchFolder(slidesDir, load)];
  let stops = watch();
  app.onContent(() => {
    for (const stop of stops) stop();
    point();
    fs.rmSync(tracksDir, { recursive: true, force: true }); // las pistas sacadas de los videos de la carpeta anterior
    stops = watch();
    load();
  });
  store.on('listening', load);
  // Al instalarse ffmpeg ya se puede mirar cuánto dura cada himno y ofrecer la pista.
  let hadFfmpeg = app.tools.has('ffmpeg');
  store.on('change', (ns) => {
    if (ns !== 'tools' || hadFfmpeg === app.tools.has('ffmpeg')) return;
    hadFfmpeg = app.tools.has('ffmpeg');
    publish();
    probeSoon();
  });
  app.onClose(() => {
    closed = true;
    for (const stop of stops) stop();
  });
  app.services.hymns = { reload: load };

  // ---- Lo que pide la interfaz ----
  // Con sus archivos (el video y, si se puede sacar, la pista), para escucharlo en un celular antes de añadirlo.
  const view = (hymn) => ({ number: hymn.number, title: hymn.title, category: hymn.category, duration: durationOf(hymn), lyrics: Boolean(hymn.parts), instrumental: hasTrack(hymn),
    slides: slidesOf.get(hymn.number)?.files.length || 0, slidesBase: slidesOf.has(hymn.number) ? `/himnos-letras/${encodeURIComponent(slidesOf.get(hymn.number).dir)}/` : null, slideFiles: slidesOf.get(hymn.number)?.files || [],
    url: urlOf(hymn), instrumentalUrl: whyNoTrack(hymn) ? null : trackUrl(hymn) });

  // Favoritos: los himnos que más se cantan, a un toque. Un número que deja de estar en la carpeta se conserva,
  // por si vuelve; la interfaz solo muestra los que hay.
  app.action('hymns.favorite', { permission: 'hymns.favorite' }, ({ number, on }) => {
    const { number: n } = find(number);
    const rest = saved.data.favorites.filter((x) => x !== n);
    saved.data.favorites = on ? [...rest, n].sort((a, b) => a - b) : rest;
    saved.data.favoritesUpdated = Date.now();
    saved.save();
    store.set('hymns', { favorites: [...saved.data.favorites] });
  });
  // La sincronización con la nube (fase 37, parte 4): la lista entera, con la hora de su último cambio.
  app.services.hymns.sync = {
    export: () => ({ records: [{ id: 'favoritos', list: [...saved.data.favorites], updated: saved.data.favoritesUpdated || 0 }], deleted: [] }),
    apply({ records }) {
      const r = records.find((x) => x.id === 'favoritos');
      if (!r || !Array.isArray(r.list)) return;
      saved.data.favorites = r.list.filter(Number.isInteger).sort((a, b) => a - b);
      saved.data.favoritesUpdated = r.updated;
      saved.save();
      store.set('hymns', { favorites: [...saved.data.favorites] });
    },
  };

  // Leer el himnario (la lista, buscar, la letra) es de quien proyecta y de quien prepara el culto (fase 36): hymns.read.
  app.route('GET', '/api/hymns', (ctx) => {
    ctx.require('hymns.read');
    return { version, hymns: catalog.hymns.map(view), categories: catalog.categories, report: { ...catalog.report, notes: notes() } };
  });

  app.route('GET', '/api/hymns/search', (ctx) => {
    ctx.require('hymns.read');
    const limit = Math.min(100, Math.max(1, Number(ctx.query.get('limite')) || 30));
    return search(ctx.query.get('q') || '', { limit });
  });

  // La letra de un himno, para leerla en el control. Solo sale de la carpeta de la iglesia.
  app.route('GET', '/api/hymns/:number', (ctx) => {
    ctx.require('hymns.read');
    const hymn = find(ctx.params.number);
    return { ...view(hymn), parts: hymn.parts || [] };
  });

  // El video con la pista instrumental. Se prepara la primera vez que alguien lo pide.
  app.route('GET', '/api/hymns/:number/pista.mp4', async (ctx) => {
    const hymn = find(ctx.params.number);
    if (!app.tools.has('ffmpeg')) throw new HttpError(409, 'Para la pista instrumental hace falta ffmpeg en el equipo principal.');
    ctx.file(await ensureTrack(hymn));
  });

  // ---- Tipo de contenido ----
  // data = { number, track }: qué himno y con qué sonido ('vocal' = cantado, 'instrumental' = pista).
  // El sonido se elige antes de proyectar y queda en el elemento del orden; al aire se puede cambiar.
  const validTrack = (track) => (TRACKS.includes(track) ? track : 'vocal');
  const whyNoTrack = (hymn) => (!app.tools.has('ffmpeg')
    ? 'Para la pista instrumental hace falta ffmpeg en el equipo principal. Proyecta el himno cantado, o instala ffmpeg desde Ajustes.'
    : hasTrack(hymn) === false ? `El himno ${hymn.number} no trae pista instrumental.` : null);
  app.kind('song', {
    label: 'Himno',
    describe(data) {
      const hymn = byNumber.get(Number(data?.number));
      if (!hymn) return null;
      const track = validTrack(data.track);
      return { title: hymn.title, subtitle: `N.º ${hymn.number} · ${TRACK_NAMES[track]}`, steps: 1, data: { number: hymn.number, track } };
    },
    resolve(data) {
      const hymn = byNumber.get(Number(data?.number));
      if (!hymn) return null;
      const track = validTrack(data.track);
      const shared = { number: hymn.number, title: hymn.title, duration: durationOf(hymn) };
      if (track === 'instrumental' && whyNoTrack(hymn)) return { ...shared, unavailable: whyNoTrack(hymn) };
      // url: el video tal cual (cantado). instrumental: el mismo con la otra pista, o null si no se puede.
      return { ...shared, track, url: urlOf(hymn), instrumental: whyNoTrack(hymn) ? null : trackUrl(hymn) };
    },
    live(item, previous) {
      const before = previous?.state;
      const track = item.instrumental && before?.track === 'instrumental' ? 'instrumental' : item.track;
      // Tras un reinicio del servidor queda en pausa donde iba; al proyectarlo, empieza a reproducirse.
      if (before?.clock) return { clock: freezeClock({ ...before.clock, duration: item.duration ?? before.clock.duration ?? null }, previous.at), track };
      return { clock: { ...createClock({ duration: item.duration }), playing: true }, track };
    },
    control(state, patch, { content: item, now }) {
      let { clock } = state;
      // Sin ffmpeg no se sabe cuánto dura hasta que una pantalla lo reproduce y lo dice.
      if (clock.duration == null && Number.isFinite(patch.duration) && patch.duration > 0 && patch.duration < MAX_DURATION) {
        clock = { ...clock, duration: Math.round(patch.duration * 1000) / 1000 };
      }
      let { track } = state;
      if (patch.track !== undefined) {
        if (!TRACKS.includes(patch.track)) throw new HttpError(400, 'Ese sonido no existe: elige cantado o pista.');
        if (patch.track === 'instrumental' && !item.instrumental) {
          throw new HttpError(409, whyNoTrack(byNumber.get(item.number) || { number: item.number }) || 'Este himno no tiene pista instrumental.');
        }
        track = patch.track;
      }
      return { clock: applyClock(clock, patch, now), track };
    },
    // Al ponerse la pantalla en negro o en solo fondo, deja de sonar: queda en pausa donde iba.
    hide: (state, { now }) => ({ ...state, clock: applyClock(state.clock, { playing: false }, now) }),
    // Al terminar, la proyección pasa sola a "Solo fondo".
    endsAt: ({ clock }) => (clock.playing && clock.duration != null ? clock.at + (clock.duration - clock.position) * 1000 : null),
  });

  // ---- Letras sin música ----
  // data = { number }. Cada diapositiva es un paso (la primera, la portada) y se proyecta como una imagen (acercar,
  // desplazar). Se pasa a mano y no sale del himno (decisión 37): desde la última, «Siguiente» vuelve a la portada;
  // desde la portada, «Anterior» se queda. Ni en el orden del culto pasa al elemento siguiente: eso se toca en la cola.
  const slideUrl = (s, i) => `/himnos-letras/${encodeURIComponent(s.dir)}/${encodeURIComponent(s.files[i])}`;
  const sizeOf = (number, s) => {
    if (!sizes.has(number)) sizes.set(number, readImageInfo(path.join(slidesDir, s.dir, s.files[0])) || { width: 4, height: 3 });
    return sizes.get(number);
  };
  app.kind('lyrics', {
    label: 'Letra del himno',
    describe(data) {
      const hymn = byNumber.get(Number(data?.number));
      const s = hymn && slidesOf.get(hymn.number);
      if (!s) return null;
      return { title: hymn.title, subtitle: `N.º ${hymn.number} · Letra sin música`, steps: s.files.length, data: { number: hymn.number } };
    },
    resolve(data, step) {
      const hymn = byNumber.get(Number(data?.number));
      const s = hymn && slidesOf.get(hymn.number);
      if (!s) return null;
      const i = Math.max(0, Math.min(s.files.length - 1, Number.isInteger(step) ? step : 0));
      const next = (i + 1) % s.files.length;
      const { width, height } = sizeOf(hymn.number, s);
      return {
        number: hymn.number, title: hymn.title, reference: i === 0 ? 'Portada' : `Diapositiva ${i + 1}`, index: i + 1, pages: s.files.length,
        url: slideUrl(s, i), thumb: slideUrl(s, i), width, height, fit: 'contain',
        // La que viene: tras la última, otra vez la portada.
        next: s.files.length > 1 ? { index: next + 1, thumb: slideUrl(s, next) } : null,
      };
    },
    live: (item, previous) => initialView('contain', previous?.state),
    control: (state, patch) => applyView(state, { ...patch, fit: 'contain' }),
    // El paso lo da el propio tipo: projection.step se lo pregunta antes que al orden del culto.
    step(item, delta) {
      const target = delta > 0 ? item.index % item.pages : item.index - 2;
      if (target >= 0) app.services.projection.present({ kind: 'lyrics', data: item.source.data, step: target, orderId: item.source.orderId });
      return true;
    },
  });
}
