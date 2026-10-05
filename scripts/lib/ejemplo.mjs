// Un orden del culto de ejemplo para demostraciones y auditorías. Incluye elementos de tipos
// que todavía no existen (himno, video, diapositivas) y títulos largos, para ver cómo se comporta
// la interfaz con ellos. Esos elementos se ven, pero no se pueden proyectar.
// La imagen de prueba sí existe (lleva `data: {}`, que es todo lo que necesita), y también las
// imágenes: se crean dos carteles de ejemplo en la biblioteca de Medios. Con ffmpeg en el equipo se
// crean además un video y un audio de verdad (cortos y a bajo volumen); sin él, quedan sus fichas
// con archivos vacíos, que sirven para ver la pantalla pero no se reproducen.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { examplePoster } from './png.mjs';

// Escribe el ejemplo en dataDir (orden.json, medios.json y las imágenes) y devuelve los id de los
// elementos del orden que sí se pueden proyectar:
//   { live: un pasaje, testcard: la imagen de prueba, image: una imagen de la biblioteca, video: un video }
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
    id, kind, name, source: 'upload', file, bytes, added: Date.now() - 5000, duration, width: kind === 'video' ? 1280 : 0, height: kind === 'video' ? 720 : 0,
    status: 'ready', direct: true, converted: null, poster: null, subtitles: null, error: null, ...more,
  });
  const clips = [
    clip('ejemplo-video', 'video', 'Video de bienvenida a las visitas', 'videos/ejemplo-video.mp4', 24,
      made('videos/ejemplo-video.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=24', ...tone(330, 24), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'])),
    clip('ejemplo-antiguo', 'video', 'Testimonio grabado con una cámara antigua (formato sin convertir)', 'videos/ejemplo-antiguo.avi', null, made('videos/ejemplo-antiguo.avi', ['-f', 'lavfi', '-i', 'nullsrc', '-t', '0']),
      { status: 'error', direct: false, error: 'No se pudo convertir este archivo. Puede estar dañado o tener un formato poco común.' }),
    clip('ejemplo-audio', 'audio', 'Pista de piano para la ofrenda', 'audios/ejemplo-audio.mp3', 20, made('audios/ejemplo-audio.mp3', [...tone(440, 20), '-c:a', 'libmp3lame'])),
  ];
  fs.writeFileSync(path.join(dataDir, 'medios.json'), JSON.stringify({ images, clips }));
  const video = { id: id(), kind: 'video', title: clips[0].name, subtitle: 'Video · 0:24', steps: 1, data: { id: clips[0].id } };
  const image = { id: id(), kind: 'image', title: images[0].name, subtitle: 'Imagen · 1600 × 900', steps: 1, data: { id: images[0].id, fit: 'contain' } };
  const items = [
    section('Apertura'), verses('Salmos 100:1-5', 19, 100, 1, 5),
    other('song', 'Santo, Santo, Santo', 'Himnario n.º 1', 4),
    image,
    section('Mensaje'), live, verses('Romanos 8:28', 45, 8, 28, 28),
    video,
    other('youtube', 'Testimonio misionero: cómo Dios abrió puertas en las comunidades del Amazonas (parte 2 de 3)', 'YouTube · 3:42', 0),
    other('slides', 'Informe de tesorería y presupuesto aprobado del tercer trimestre de 2026 (versión final).pdf', 'PDF', 12),
    section('Cierre'), other('song', 'Cuán grande es Él', 'Himnario n.º 69', 4), testcard,
  ];
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'orden.json'), JSON.stringify({ items }));
  return { live: live.id, testcard: testcard.id, image: image.id, video: video.id };
}
