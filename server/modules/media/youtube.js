import fs from 'node:fs';
import path from 'node:path';

// Videos de YouTube: se descargan una vez con yt-dlp y quedan en la biblioteca como un video más,
// para proyectarlos sin anuncios, sin cortes y sin internet. Aquí está lo que no depende del
// servidor (reconocer el enlace, armar la orden, leer lo que yt-dlp va diciendo, limpiar los
// subtítulos automáticos) y, al final, quien lanza la descarga.
//
// Del enlace que escribe la persona solo se toma el identificador del video (11 letras o cifras):
// la dirección que se le pasa a yt-dlp la escribe Manna.

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

// El identificador del video de un enlace de YouTube, o null si no lo es.
export function youtubeId(link) {
  const text = String(link ?? '').trim();
  if (!text || /\s/.test(text) || text.length > 300) return null;
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || !HOSTS.has(host) || url.username || url.password) return null;
  let id = null;
  if (host === 'youtu.be') [id] = url.pathname.slice(1).split('/');
  else if (url.pathname === '/watch') id = url.searchParams.get('v');
  else id = /^\/(?:shorts|live|embed|v)\/([^/]+)/.exec(url.pathname)?.[1] || null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

// Imagen H.264 y sonido AAC hasta 1080p: es lo que reproduce cualquier navegador y solo hay que
// unirlo. Si el video no lo ofrece así, lo mejor que haya hasta 1080p (Manna lo convertirá después).
const FORMAT = 'bv*[height<=1080][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=1080][vcodec^=avc1]/bv*[height<=1080]+ba/b[height<=1080]/b';
// Subtítulos que se piden: español e inglés, los del autor o, si no hay, los automáticos.
export const SUBTITLE_LANGS = [['es', 'Español'], ['en', 'Inglés']];
const MARK = 'MANNA';

// Las órdenes de yt-dlp. dir: carpeta donde deja los archivos, con nombre fijo ("video.mp4").
// ffmpegDir: dónde está ffmpeg, para unir imagen y sonido.
export function downloadArgs({ id, dir, ffmpegDir = null }) {
  return [
    '--ignore-config', '--no-playlist', '--no-warnings', '--newline', '--no-simulate', '--socket-timeout', '20', '--retries', '3',
    // Un directo no tiene final: no se puede guardar.
    '--match-filter', '!is_live',
    ...(ffmpegDir ? ['--ffmpeg-location', ffmpegDir] : []),
    '-f', FORMAT, '--merge-output-format', 'mp4',
    '--write-thumbnail', '--convert-thumbnails', 'jpg',
    // Lo que se sabe del video, antes de empezar; y el avance, una línea cada vez.
    '--print', `before_dl:${MARK}\ttitle\t%(title)s`,
    '--print', `before_dl:${MARK}\tduration\t%(duration)s`,
    '--progress', '--progress-template', `download:${MARK}\tprogress\t%(progress.downloaded_bytes)s\t%(progress.total_bytes)s\t%(progress.total_bytes_estimate)s`,
    '-o', path.join(dir, 'video.%(ext)s'),
    '--', watchUrl(id),
  ];
}

// Los subtítulos se piden aparte: si YouTube no los da (pasa a menudo), el video ya está a salvo.
export function subtitleArgs({ id, dir }) {
  const langs = SUBTITLE_LANGS.flatMap(([lang]) => [lang, `${lang}-orig`]);
  return [
    '--ignore-config', '--no-playlist', '--no-warnings', '--skip-download', '--socket-timeout', '20',
    '--write-subs', '--write-auto-subs', '--sub-langs', langs.join(','), '--sub-format', 'vtt',
    '-o', path.join(dir, 'video.%(ext)s'),
    '--', watchUrl(id),
  ];
}

// Lo que dice una línea de yt-dlp: { title }, { duration }, { downloaded, total } o null.
export function readLine(line) {
  const [mark, what, ...rest] = String(line).trim().split('\t');
  if (mark !== MARK) return null;
  if (what === 'title') return { title: rest.join(' ').trim().slice(0, 200) };
  if (what === 'duration') {
    const seconds = Number(rest[0]);
    return Number.isFinite(seconds) && seconds > 0 ? { duration: seconds } : null;
  }
  if (what === 'progress') {
    const downloaded = Number(rest[0]);
    const total = Number(rest[1]) || Number(rest[2]);
    return Number.isFinite(downloaded) && total > 0 ? { downloaded, total } : null;
  }
  return null;
}

// Avance global. yt-dlp baja primero la imagen y luego el sonido, cada uno de 0 a 100 %: la
// imagen es casi todo, así que cuenta el 90 %.
export function createProgress() {
  let part = 0;
  let last = 0;
  return ({ downloaded, total }) => {
    const fraction = Math.min(1, downloaded / total);
    if (fraction < last - 0.5) part += 1; // volvió a empezar: es el archivo siguiente
    last = fraction;
    return part === 0 ? fraction * 0.9 : Math.min(0.99, 0.9 + fraction * 0.09);
  };
}

// Por qué falló, dicho para quien usa Manna, a partir de lo que escribió yt-dlp.
export function explain(stderr) {
  const text = String(stderr || '');
  if (/private video|video unavailable|has been removed|no longer available|This video is not available/i.test(text)) return 'Ese video no está disponible: es privado o se quitó de YouTube.';
  if (/confirm you.re not a bot|sign in to confirm/i.test(text)) return 'YouTube no dejó descargarlo ahora (pide iniciar sesión). Inténtalo más tarde.';
  if (/age.restricted|confirm your age/i.test(text)) return 'Ese video tiene restricción de edad y no se puede descargar.';
  if (/does not pass filter|is_live/i.test(text)) return 'Es una emisión en directo: se podrá descargar cuando termine.';
  if (/getaddrinfo|network is unreachable|timed out|Unable to download webpage|Temporary failure in name resolution|nodename nor servname/i.test(text)) return 'No hay conexión a internet en el equipo principal. Hace falta para descargar; después ya no.';
  return 'No se pudo descargar ese video. Si pasa con todos, actualiza yt-dlp desde Ajustes: YouTube cambia a menudo.';
}

// Los subtítulos automáticos de YouTube llegan "rodando": cada bloque repite la línea anterior y
// añade la nueva, con marcas de tiempo palabra a palabra, y entre bloque y bloque hay otro de
// una centésima. Aquí se dejan como los escribiría una persona: cada línea, una sola vez.
export function cleanVtt(text) {
  const blocks = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const seconds = (stamp) => stamp.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const cues = [];
  let shown = []; // líneas del bloque anterior: las que se repitan aquí ya se vieron
  for (const block of blocks) {
    const lines = block.split('\n');
    const at = lines.findIndex((line) => line.includes('-->'));
    if (at < 0) continue;
    const times = /(\d+(?::\d+){1,2}\.\d+)\s*-->\s*(\d+(?::\d+){1,2}\.\d+)/.exec(lines[at]);
    if (!times) continue;
    const all = lines.slice(at + 1).map((line) => line.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const fresh = all.filter((line) => !shown.includes(line));
    shown = all;
    if (!fresh.length || seconds(times[2]) - seconds(times[1]) < 0.05) continue;
    const previous = cues.at(-1);
    if (previous && previous.text === fresh.join('\n')) previous.end = times[2];
    else cues.push({ start: times[1], end: times[2], text: fresh.join('\n') });
  }
  // Cada línea se queda hasta que entra la siguiente (los bloques originales se pisan).
  cues.forEach((cue, i) => { if (cues[i + 1] && seconds(cues[i + 1].start) < seconds(cue.end)) cue.end = cues[i + 1].start; });
  return `WEBVTT\n\n${cues.map((cue) => `${cue.start} --> ${cue.end}\n${cue.text}`).join('\n\n')}\n`;
}

// Qué subtítulos dejó yt-dlp en dir: [{ lang, label, file }], uno por idioma. Los del idioma
// original ("es-orig") valen si no hay otros de ese idioma.
export function findSubtitles(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  return SUBTITLE_LANGS.map(([lang, label]) => {
    const name = [`video.${lang}.vtt`, `video.${lang}-orig.vtt`].find((candidate) => names.includes(candidate));
    return name ? { lang, label, file: path.join(dir, name) } : null;
  }).filter(Boolean);
}

// Lanza las descargas, de una en una, como tareas con avance.
//   download({ id, videoId, name, dir, onInfo({ title, duration }) -> nombre, onDone({ ok, error, cancelled }) })
export function createDownloader(app) {
  const queue = [];
  let running = null; // { task, job, child, cancelled }
  let closed = false;

  function run(args, onLine) {
    return new Promise((resolve) => {
      let child;
      try { child = app.tools.spawn('yt-dlp', args); } catch (err) { resolve({ code: -1, err: err.message }); return; }
      if (running) running.child = child;
      let err = '';
      let pending = '';
      child.stdout.on('data', (chunk) => {
        const lines = (pending + chunk).split('\n');
        pending = lines.pop();
        lines.forEach(onLine);
      });
      child.stderr.on('data', (chunk) => { err = (err + chunk).slice(-3000); });
      child.on('error', (e) => resolve({ code: -1, err: e.message }));
      child.on('close', (code) => resolve({ code, err }));
    });
  }

  async function next() {
    if (running || closed || !queue.length) return;
    running = queue.shift();
    const { task, job } = running;
    const current = running;
    job.update({ detail: 'Descargando de YouTube' });
    fs.rmSync(task.dir, { recursive: true, force: true });
    fs.mkdirSync(task.dir, { recursive: true });
    const progress = createProgress();
    const ffmpeg = app.tools.path('ffmpeg');
    const result = await run(downloadArgs({ id: task.videoId, dir: task.dir, ffmpegDir: ffmpeg && path.dirname(ffmpeg) }), (line) => {
      const said = readLine(line);
      if (!said) return;
      if (said.title || said.duration) {
        // onInfo devuelve el nombre con el que queda el video: la tarea pasa a llamarse así.
        const name = task.onInfo(said);
        if (name) job.update({ title: `Descargando «${name}»` });
      }
      if (said.total) job.update({ progress: progress(said) });
    });
    const video = path.join(task.dir, 'video.mp4');
    const ok = result.code === 0 && fs.existsSync(video) && !current.cancelled;
    if (ok) {
      // Los subtítulos, si los hay. Que fallen no estropea nada.
      job.update({ progress: 0.99, detail: 'Buscando subtítulos' });
      await run(subtitleArgs({ id: task.videoId, dir: task.dir }), () => {});
    }
    running = null;
    if (ok) job.done('Listo');
    else if (current.cancelled || closed) job.done('Cancelado');
    else job.fail(explain(result.err));
    task.onDone({ ok, cancelled: current.cancelled || closed, error: ok ? null : explain(result.err) });
    next();
  }

  // Quita los avisos que dejaron las descargas de ese video que ya terminaron.
  const forget = (id) => {
    for (const old of app.jobs.list()) if (old.owner === 'media' && old.ref === id && old.state !== 'running') app.jobs.dismiss(old.id);
  };

  return {
    forget,
    download(task) {
      // Un intento anterior que falló deja su aviso: se retira al volver a intentarlo.
      forget(task.id);
      const job = app.jobs.start({ title: `Descargando «${task.name}»`, detail: 'En cola', owner: 'media', ref: task.id });
      queue.push({ task, job });
      next();
      return job;
    },
    cancel(id) {
      const waiting = queue.findIndex((entry) => entry.task.id === id);
      if (waiting >= 0) queue.splice(waiting, 1)[0].job.done('Cancelado');
      if (running?.task.id === id) {
        running.cancelled = true;
        running.child?.kill();
      }
    },
    busy: (id) => running?.task.id === id || queue.some((entry) => entry.task.id === id),
    close() {
      closed = true;
      running?.child?.kill();
    },
  };
}
