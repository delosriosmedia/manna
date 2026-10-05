// Un orden del culto de ejemplo para demostraciones y auditorías. Incluye elementos de un tipo
// que todavía no existe (himno) y títulos largos, para ver cómo se comporta
// la interfaz con ellos. Esos elementos se ven, pero no se pueden proyectar.
// La imagen de prueba sí existe (lleva `data: {}`, que es todo lo que necesita), y también las
// imágenes: se crean dos carteles de ejemplo en la biblioteca de Medios. Con ffmpeg en el equipo se
// crean además un video, un audio y un video "de YouTube" de verdad (cortos y a bajo volumen; el de
// YouTube se fabrica aquí, no se descarga); sin él, quedan sus fichas con archivos vacíos, que
// sirven para ver la pantalla pero no se reproducen.
// Y una presentación de doce diapositivas en la biblioteca de Diapositivas, como queda una ya convertida.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { examplePoster } from './png.mjs';

// Escribe el ejemplo en dataDir (orden.json, medios.json y las imágenes) y devuelve los id de los
// elementos del orden que sí se pueden proyectar:
//   { live: un pasaje, testcard: la imagen de prueba, image: una imagen de la biblioteca, video: un video,
//     youtube: un video de YouTube con subtítulos en dos idiomas, slides: una presentación }
export function seedExample(dataDir) {
  const id = () => crypto.randomUUID();
  const verses = (title, book, chapter, a, b) => ({ id: id(), kind: 'verses', title, subtitle: 'Reina-Valera 1909', steps: b - a + 1, data: { versionId: 'reina-valera-1909', ref: { book, chapter, verseStart: a, verseEnd: b } } });
  const other = (kind, title, subtitle, steps) => ({ id: id(), kind, title, subtitle, steps, data: {} });
  const section = (title) => ({ id: id(), kind: 'section', title });
  const live = verses('Juan 3:16-17', 43, 3, 16, 17);
  const testcard = other('testcard', 'Imagen de prueba', 'Para encuadrar la pantalla', 1);
  // Dos imágenes en la biblioteca: una apaisada y un cartel vertical (sin miniatura: se ve la propia imagen).
  const posters = [
    { id: 'ejemplo-anuncios', name: 'Anuncios de la semana y calendario de actividades de octubre', width: 1600, height: 900, colors: [[29, 78, 216], [147, 51, 234]] },
    { id: 'ejemplo-cartel', name: 'Cartel de la semana de oración', width: 720, height: 1280, colors: [[15, 118, 110], [202, 138, 4]] },
  ];
  const folder = path.join(dataDir, 'media', 'imagenes');
  fs.mkdirSync(folder, { recursive: true });
  const images = posters.map(({ colors, ...poster }, i) => {
    const png = examplePoster(poster.width, poster.height, colors);
    fs.writeFileSync(path.join(folder, `${poster.id}.png`), png);
    return { ...poster, file: `imagenes/${poster.id}.png`, thumb: null, bytes: png.length, fit: 'contain', added: Date.now() - i * 1000 };
  });
  // Un video y un audio. `ffmpeg` los hace de verdad si está; si no, el archivo queda vacío.
  const media = path.join(dataDir, 'media');
  const made = (relative, args) => {
    const file = path.join(media, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const done = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, file]).status === 0;
    if (!done) fs.writeFileSync(file, '');
    return fs.statSync(file).size;
  };
  const tone = (frequency, seconds) => ['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${seconds}`, '-af', 'volume=0.15'];
  const clip = (id, kind, name, file, duration, bytes, more = {}) => ({
    id, kind, name, source: 'upload', file, bytes, added: Date.now() - 5000, duration, width: kind === 'audio' ? 0 : 1280, height: kind === 'audio' ? 0 : 720,
    status: 'ready', direct: true, converted: null, poster: null, subtitles: null, error: null, ...more,
  });
  const clips = [
    clip('ejemplo-video', 'video', 'Video de bienvenida a las visitas', 'videos/ejemplo-video.mp4', 24,
      made('videos/ejemplo-video.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=24', ...tone(330, 24), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'])),
    clip('ejemplo-antiguo', 'video', 'Testimonio grabado con una cámara antigua (formato sin convertir)', 'videos/ejemplo-antiguo.avi', null, made('videos/ejemplo-antiguo.avi', ['-f', 'lavfi', '-i', 'nullsrc', '-t', '0']),
      { status: 'error', direct: false, error: 'No se pudo convertir este archivo. Puede estar dañado o tener un formato poco común.' }),
    clip('ejemplo-audio', 'audio', 'Pista de piano para la ofrenda', 'audios/ejemplo-audio.mp3', 20, made('audios/ejemplo-audio.mp3', [...tone(440, 20), '-c:a', 'libmp3lame'])),
    // Como queda un video de YouTube ya descargado, con los subtítulos que trajo; y uno que no se pudo bajar.
    clip('ejemplo-youtube', 'youtube', 'Testimonio misionero: cómo Dios abrió puertas en las comunidades del Amazonas (parte 2 de 3)', 'youtube/ejemplo-youtube.mp4', 16,
      made('youtube/ejemplo-youtube.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=16', ...tone(262, 16), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']),
      { source: 'youtube', videoId: 'ejemplo0001', tracks: [['es', 'Español', 'Texto de ejemplo de los subtítulos'], ['en', 'Inglés', 'Sample subtitle text']].map(([lang, label, text]) => {
        const file = `subtitulos/ejemplo-youtube.${lang}.vtt`;
        fs.mkdirSync(path.join(media, 'subtitulos'), { recursive: true });
        fs.writeFileSync(path.join(media, file), `WEBVTT\n\n00:00:00.000 --> 00:00:16.000\n${text}\n`);
        return { lang, label, file };
      }) }),
    clip('ejemplo-privado', 'youtube', 'Video de YouTube', 'youtube/ejemplo-privado.mp4', null, 0,
      { source: 'youtube', videoId: 'ejemplo0002', status: 'error', direct: false, added: Date.now() - 9000, error: 'Ese video no está disponible: es privado o se quitó de YouTube.' }),
  ];
  fs.writeFileSync(path.join(dataDir, 'medios.json'), JSON.stringify({ images, clips }));
  const video = { id: id(), kind: 'video', title: clips[0].name, subtitle: 'Video · 0:24', steps: 1, data: { id: clips[0].id } };
  // Una presentación ya convertida: doce diapositivas (sin miniaturas: se usa la propia imagen).
  const SLIDE_COLORS = [[[29, 78, 216], [147, 51, 234]], [[15, 118, 110], [202, 138, 4]], [[190, 18, 60], [234, 88, 12]], [[30, 41, 59], [71, 85, 105]]];
  const deck = { id: 'ejemplo-informe', name: 'Informe de tesorería y presupuesto aprobado del tercer trimestre de 2026 (versión final)', source: 'pdf', pages: 12, ext: 'png', thumbs: false, width: 640, height: 360, added: Date.now() - 3000, status: 'ready', error: null };
  fs.mkdirSync(path.join(media, 'diapositivas', deck.id), { recursive: true });
  for (let n = 1; n <= deck.pages; n += 1) fs.writeFileSync(path.join(media, 'diapositivas', deck.id, `${n}.png`), examplePoster(deck.width, deck.height, SLIDE_COLORS[(n - 1) % SLIDE_COLORS.length]));
  fs.writeFileSync(path.join(dataDir, 'diapositivas.json'), JSON.stringify({ decks: [deck] }));
  const slides = { id: id(), kind: 'slides', title: deck.name, subtitle: 'PDF', steps: deck.pages, data: { id: deck.id } };
  const youtube = { id: id(), kind: 'youtube', title: clips[3].name, subtitle: 'YouTube · 0:16', steps: 1, data: { id: clips[3].id } };
  const image = { id: id(), kind: 'image', title: images[0].name, subtitle: 'Imagen · 1600 × 900', steps: 1, data: { id: images[0].id, fit: 'contain' } };
  const items = [
    section('Apertura'), verses('Salmos 100:1-5', 19, 100, 1, 5),
    other('song', 'Santo, Santo, Santo', 'Himnario n.º 1', 4),
    image,
    section('Mensaje'), live, verses('Romanos 8:28', 45, 8, 28, 28),
    video,
    youtube,
    slides,
    section('Cierre'), other('song', 'Cuán grande es Él', 'Himnario n.º 69', 4), testcard,
  ];
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'orden.json'), JSON.stringify({ items }));
  return { live: live.id, testcard: testcard.id, image: image.id, video: video.id, youtube: youtube.id, slides: slides.id };
}
