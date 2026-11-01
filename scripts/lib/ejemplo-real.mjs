// El ejemplo de las capturas de los manuales (scripts/sitio.mjs): los himnos de verdad y los medios libres de sitio/medios,
// sin los títulos larguísimos ni las capas que la auditoría usa para buscar defectos.
// Ninguna letra real: el himnario de las capturas es la carpeta de videos y un archivo con los títulos y una línea neutra.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function seedReal(dataDir, root, himnario) {
  const medios = path.join(root, 'sitio', 'medios');
  const media = path.join(dataDir, 'media');
  const copiar = (origen, destino) => {
    fs.mkdirSync(path.dirname(path.join(media, destino)), { recursive: true });
    fs.copyFileSync(path.join(medios, origen), path.join(media, destino));
    return fs.statSync(path.join(media, destino)).size;
  };
  const id = () => crypto.randomUUID();
  const ahora = Date.now();

  const hymnal = path.join(dataDir, 'himnario');
  fs.mkdirSync(path.join(hymnal, 'letras'), { recursive: true });
  fs.symlinkSync(path.join(himnario, 'videos'), path.join(hymnal, 'videos'));
  const himnos = JSON.parse(fs.readFileSync(path.join(root, 'sitio', 'himnos.json'), 'utf8'));
  let categoria = null;
  const lineas = ['# Himnario'];
  for (const h of himnos) {
    if (h.c !== categoria) lineas.push(`## ${h.c}`);
    categoria = h.c;
    lineas.push(`### ${h.n}. ${h.t}`, '**Estrofa 1**', 'La letra del himno se lee aquí.');
  }
  fs.writeFileSync(path.join(hymnal, 'letras', 'Titulos.md'), `${lineas.join('\n')}\n`);

  const images = [{ id: 'ejemplo-vigilia', name: 'Vigilia de oración', width: 1280, height: 720, file: 'imagenes/ejemplo-vigilia.jpg', thumb: null, bytes: copiar('cartel-vigilia.jpg', 'imagenes/ejemplo-vigilia.jpg'), fit: 'contain', added: ahora - 1000 }];
  const clips = [{ id: 'ejemplo-video', kind: 'video', name: 'Video de bienvenida', source: 'upload', file: 'videos/ejemplo-video.mp4', bytes: copiar('video-bienvenida.mp4', 'videos/ejemplo-video.mp4'), added: ahora - 2000, duration: 14, width: 960, height: 540, status: 'ready', direct: true, converted: null, poster: null, subtitles: null, error: null }];
  fs.writeFileSync(path.join(dataDir, 'medios.json'), JSON.stringify({ images, clips, categories: [] }));

  const deck = { id: 'ejemplo-anuncios', name: 'Anuncios de la semana', source: 'pdf', pages: 4, ext: 'jpg', thumbs: false, width: 1280, height: 720, added: ahora - 3000, status: 'ready', error: null };
  for (let n = 1; n <= deck.pages; n += 1) copiar(`lamina-${n}.jpg`, `diapositivas/${deck.id}/${n}.jpg`);
  fs.writeFileSync(path.join(dataDir, 'diapositivas.json'), JSON.stringify({ decks: [deck] }));

  fs.writeFileSync(path.join(dataDir, 'textos.json'), JSON.stringify({ texts: [
    { id: 'ejemplo-aviso', style: 'normal', text: 'Bienvenidos al culto de esta mañana\n\nAl terminar, los esperamos en el salón para compartir un desayuno', author: '', added: ahora },
  ] }));

  const verses = (title, book, chapter, a, b) => ({ id: id(), kind: 'verses', title, subtitle: 'Reina-Valera 1909', steps: b - a + 1, data: { versionId: 'reina-valera-1909', ref: { book, chapter, verseStart: a, verseEnd: b } } });
  const section = (title) => ({ id: id(), kind: 'section', title });
  const titulo = (n) => himnos.find((h) => h.n === n).t;
  const song = (number) => ({ id: id(), kind: 'song', title: titulo(number), subtitle: `N.º ${number} · Cantado`, steps: 1, data: { number, track: 'vocal' } });
  const opening = song(1);
  const live = verses('Juan 3:16-17', 43, 3, 16, 17);
  const image = { id: id(), kind: 'image', title: images[0].name, subtitle: 'Imagen · 1280 × 720', steps: 1, data: { id: images[0].id, fit: 'contain' } };
  const video = { id: id(), kind: 'video', title: clips[0].name, subtitle: 'Video · 0:14', steps: 1, data: { id: clips[0].id } };
  const slides = { id: id(), kind: 'slides', title: deck.name, subtitle: 'PDF', steps: deck.pages, data: { id: deck.id } };
  const items = [
    section('Apertura'), verses('Salmos 100:1-5', 19, 100, 1, 5), opening, image,
    section('Mensaje'), live, verses('Romanos 8:28', 45, 8, 28, 28), video, slides,
    section('Cierre'), song(6),
  ];
  fs.writeFileSync(path.join(dataDir, 'orden.json'), JSON.stringify({ items }));
  return { live: live.id, image: image.id, video: video.id, slides: slides.id, song: opening.id, hymnal };
}
