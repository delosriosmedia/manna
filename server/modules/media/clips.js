// Videos y audios: lo que no depende del servidor. Qué archivos se admiten, qué hay dentro de uno,
// si el navegador lo reproduce tal cual o hay que prepararlo, y con qué orden de ffmpeg.

export const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.mpg', '.mpeg', '.wmv', '.flv', '.3gp', '.ts', '.mts', '.m2ts'];
export const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.wma', '.aif', '.aiff', '.amr'];
export const SUBTITLE_EXTENSIONS = ['.vtt', '.srt'];

// Lo que un navegador reproduce sin tocarlo, a juzgar solo por la extensión. Se usa cuando el
// equipo no tiene ffmpeg para mirar dentro del archivo.
const PLAYS_AS_IS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac']);
export const playsAsIs = (ext) => PLAYS_AS_IS.has(String(ext).toLowerCase());

const extensionOf = (name) => (/\.[a-z0-9]+$/i.exec(String(name)) || [''])[0].toLowerCase();

// 'video', 'audio' o null, por la extensión del nombre.
export function clipKind(name) {
  const ext = extensionOf(name);
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  return null;
}

// Lo que dice ffprobe (-print_format json -show_format -show_streams), reducido a lo que importa.
// null si ahí dentro no hay ni imagen ni sonido.
export function readProbe(json) {
  let data;
  try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch { return null; }
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  // Las carátulas de un mp3 vienen como "video" de un solo cuadro: no cuentan.
  const video = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic) || null;
  const audio = streams.find((s) => s.codec_type === 'audio') || null;
  if (!video && !audio) return null;
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration);
  return {
    container: String(data.format?.format_name || '').toLowerCase(),
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : null,
    video: video && {
      codec: String(video.codec_name || '').toLowerCase(),
      width: Number(video.width) || 0,
      height: Number(video.height) || 0,
      pixFmt: String(video.pix_fmt || '').toLowerCase(),
    },
    audio: audio && { codec: String(audio.codec_name || '').toLowerCase(), channels: Number(audio.channels) || 0 },
  };
}

const MP4_FAMILY = /\b(mp4|mov|m4v|m4a)\b/;
const AUDIO_IN_MP4 = new Set(['aac', 'mp3']);
// Sonido que el navegador reproduce suelto, y en qué envoltorio.
const AUDIO_FILES = { mp3: /\bmp3\b/, aac: /\b(mp4|mov|m4a|aac)\b/, vorbis: /\bogg\b/, opus: /\b(ogg|webm)\b/, flac: /\bflac\b/, pcm: /\bwav\b/ };
const MAX_WIDTH = 1920;

// Qué hacer con un archivo para que se reproduzca en cualquier pantalla (MP4 con H.264 y AAC,
// que es lo que entienden todos los navegadores, también los de los celulares):
//   'direct'     nada: se usa tal cual
//   'remux'      cambiar el envoltorio sin recodificar la imagen (segundos)
//   'transcode'  conversión completa (minutos)
// Devuelve { action, video: 'copy' | 'encode' | null, audio: 'copy' | 'encode' | null }.
export function planFor(info, kind) {
  if (kind === 'audio') {
    const codec = info.audio?.codec || '';
    const family = codec.startsWith('pcm_') ? 'pcm' : codec;
    const fine = !info.video && AUDIO_FILES[family]?.test(info.container);
    return fine ? { action: 'direct', video: null, audio: 'copy' } : { action: 'transcode', video: null, audio: 'encode' };
  }
  const { video, audio } = info;
  // H.264 de 8 bits, que es el que todos reproducen; el de 10 bits o el HEVC de un iPhone, no.
  const videoFine = video?.codec === 'h264' && ['yuv420p', 'yuvj420p'].includes(video.pixFmt) && video.width <= 4096;
  const audioFine = !audio || AUDIO_IN_MP4.has(audio.codec);
  if (videoFine && audioFine && MP4_FAMILY.test(info.container)) return { action: 'direct', video: 'copy', audio: audio ? 'copy' : null };
  if (videoFine) return { action: 'remux', video: 'copy', audio: audio ? (audioFine ? 'copy' : 'encode') : null };
  return { action: 'transcode', video: 'encode', audio: audio ? 'encode' : null };
}

// Con qué se codifica la imagen. Los chips de video (los tres primeros) son mucho más rápidos;
// libx264 funciona en cualquier equipo.
export const ENCODERS = {
  h264_videotoolbox: ['-c:v', 'h264_videotoolbox', '-b:v', '6M', '-maxrate', '9M', '-bufsize', '12M'],
  h264_nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p4', '-b:v', '6M', '-maxrate', '9M', '-bufsize', '12M'],
  h264_qsv: ['-c:v', 'h264_qsv', '-b:v', '6M', '-maxrate', '9M', '-bufsize', '12M'],
  h264_amf: ['-c:v', 'h264_amf', '-b:v', '6M', '-maxrate', '9M', '-bufsize', '12M'],
  libx264: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21'],
};

// En qué orden probarlos en cada sistema, de los que el ffmpeg instalado dice tener
// (texto de `ffmpeg -encoders`). El último siempre es libx264.
export function encodersFor(platform, listing) {
  const wanted = platform === 'darwin' ? ['h264_videotoolbox'] : platform === 'win32' ? ['h264_nvenc', 'h264_qsv', 'h264_amf'] : [];
  return [...wanted.filter((name) => new RegExp(`\\b${name}\\b`).test(String(listing))), 'libx264'];
}

// La orden de ffmpeg para llevar `input` a `output` según el plan. `-progress pipe:1` hace que
// vaya diciendo por dónde va (ver readProgress).
export function ffmpegArgs(plan, { input, output, kind, encoder = 'libx264', width = 0 }) {
  const args = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', '-i', input];
  if (kind === 'audio') return [...args, '-vn', '-c:a', 'aac', '-b:a', '192k', '-f', 'mp4', output];
  args.push('-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn');
  if (plan.video === 'copy') args.push('-c:v', 'copy');
  else {
    args.push(...ENCODERS[encoder], '-pix_fmt', 'yuv420p');
    // Más de 1080p no se aprovecha en una proyección y cuesta reproducirlo. Alto siempre par.
    args.push('-vf', width > MAX_WIDTH ? `scale=${MAX_WIDTH}:-2` : 'scale=trunc(iw/2)*2:trunc(ih/2)*2');
  }
  if (plan.audio === 'copy') args.push('-c:a', 'copy');
  else if (plan.audio === 'encode') args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
  // El índice al principio: así el video empieza y salta sin haber llegado entero.
  return [...args, '-movflags', '+faststart', '-f', 'mp4', output];
}

// Por dónde va ffmpeg, en segundos, a partir de un trozo de lo que escribe con -progress.
// null si en ese trozo no lo dice.
export function readProgress(chunk) {
  const all = [...String(chunk).matchAll(/out_time_(?:us|ms)=(\d+)/g)];
  return all.length ? Number(all.at(-1)[1]) / 1_000_000 : null;
}

// Subtítulos .srt al formato que entiende el navegador (.vtt). Un .vtt se deja como está.
export function toVtt(text) {
  const clean = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT/.test(clean)) return `${clean}\n`;
  const cues = clean.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    // La primera línea de cada bloque de un .srt es su número: sobra.
    if (/^\d+$/.test(lines[0].trim()) && lines.length > 1) lines.shift();
    if (!/-->/.test(lines[0] || '')) return null;
    lines[0] = lines[0].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return lines.join('\n');
  }).filter(Boolean);
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

// "3:42", "1:02:05": para la línea de un video en el orden del culto.
export function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  const two = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}
