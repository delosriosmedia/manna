// Un orden del culto de ejemplo para demostraciones y auditorías. Incluye elementos de tipos
// que todavía no existen (himno, imagen, video, diapositivas) y títulos largos, para ver cómo
// se comporta la interfaz con ellos. Esos elementos se ven, pero no se pueden proyectar.
// La imagen de prueba sí existe: lleva `data: {}`, que es todo lo que necesita.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Escribe el ejemplo en dataDir/orden.json y devuelve los id de dos elementos que sí se pueden
// proyectar: { live: un pasaje, testcard: uno con mandos en vivo (la imagen de prueba) }.
export function seedExample(dataDir) {
  const id = () => crypto.randomUUID();
  const verses = (title, book, chapter, a, b) => ({ id: id(), kind: 'verses', title, subtitle: 'Reina-Valera 1909', steps: b - a + 1, data: { versionId: 'reina-valera-1909', ref: { book, chapter, verseStart: a, verseEnd: b } } });
  const other = (kind, title, subtitle, steps) => ({ id: id(), kind, title, subtitle, steps, data: {} });
  const section = (title) => ({ id: id(), kind: 'section', title });
  const live = verses('Juan 3:16-17', 43, 3, 16, 17);
  const testcard = other('testcard', 'Imagen de prueba', 'Para encuadrar la pantalla', 1);
  const items = [
    section('Apertura'), verses('Salmos 100:1-5', 19, 100, 1, 5),
    other('song', 'Santo, Santo, Santo', 'Himnario n.º 1', 4),
    other('image', 'Anuncios de la semana y calendario de actividades de octubre', 'anuncios-octubre.jpg', 1),
    section('Mensaje'), live, verses('Romanos 8:28', 45, 8, 28, 28),
    other('video', 'Testimonio misionero: cómo Dios abrió puertas en las comunidades del Amazonas (parte 2 de 3)', 'YouTube · 3:42', 0),
    other('slides', 'Informe de tesorería y presupuesto aprobado del tercer trimestre de 2026 (versión final).pdf', 'PDF', 12),
    section('Cierre'), other('song', 'Cuán grande es Él', 'Himnario n.º 69', 4), testcard,
  ];
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'orden.json'), JSON.stringify({ items }));
  return { live: live.id, testcard: testcard.id };
}
