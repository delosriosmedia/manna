// Un orden del culto de ejemplo para demostraciones y auditorías. Incluye elementos de tipos
// que todavía no existen (himno, video, diapositivas) y títulos largos, para ver cómo se comporta
// la interfaz con ellos. Esos elementos se ven, pero no se pueden proyectar.
// La imagen de prueba sí existe (lleva `data: {}`, que es todo lo que necesita), y también las
// imágenes: se crean dos carteles de ejemplo en la biblioteca de Medios.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { examplePoster } from './png.mjs';

// Escribe el ejemplo en dataDir (orden.json, medios.json y las imágenes) y devuelve los id de los
// elementos del orden que sí se pueden proyectar:
//   { live: un pasaje, testcard: la imagen de prueba, image: una imagen de la biblioteca }
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
  fs.writeFileSync(path.join(dataDir, 'medios.json'), JSON.stringify({ images }));
  const image = { id: id(), kind: 'image', title: images[0].name, subtitle: 'Imagen · 1600 × 900', steps: 1, data: { id: images[0].id, fit: 'contain' } };
  const items = [
    section('Apertura'), verses('Salmos 100:1-5', 19, 100, 1, 5),
    other('song', 'Santo, Santo, Santo', 'Himnario n.º 1', 4),
    image,
    section('Mensaje'), live, verses('Romanos 8:28', 45, 8, 28, 28),
    other('video', 'Testimonio misionero: cómo Dios abrió puertas en las comunidades del Amazonas (parte 2 de 3)', 'YouTube · 3:42', 0),
    other('slides', 'Informe de tesorería y presupuesto aprobado del tercer trimestre de 2026 (versión final).pdf', 'PDF', 12),
    section('Cierre'), other('song', 'Cuán grande es Él', 'Himnario n.º 69', 4), testcard,
  ];
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'orden.json'), JSON.stringify({ items }));
  return { live: live.id, testcard: testcard.id, image: image.id };
}
