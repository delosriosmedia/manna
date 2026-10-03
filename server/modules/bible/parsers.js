import { CANON, findBook } from './canon.js';

// Dos formatos soportados:
//   .xmm (OpenLP):  <b n="Génesis"><c n="1"><v n="1">texto</v>
//   .xml (Zefania-like): <book number="1"><chapter number="1"><verse number="1">texto</verse>
const FORMATS = [
  {
    test: /<v\b[^>]*\bn="/,
    rx: /<b\b[^>]*?\bn="([^"]*)"[^>]*>|<c\b[^>]*?\bn="(\d+)"[^>]*>|<v\b[^>]*?\bn="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/v>)/g,
  },
  {
    test: /<verse\b[^>]*\bnumber="/,
    rx: /<book\b[^>]*?\bnumber="(\d+)"[^>]*>|<chapter\b[^>]*?\bnumber="(\d+)"[^>]*>|<verse\b[^>]*?\bnumber="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/verse>)/g,
  },
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(text) {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

const isHeadingLine = (line) =>
  /^(\d+|[IVXLC]+)\.\s/.test(line)        // "1. LA CREACIÓN", "I. Orígenes..."
  || line === line.toUpperCase()           // "SALMO 1"
  || (line.length < 70 && /\*\.?$/.test(line)); // "Los dos caminos*."

// Algunas biblias (p. ej. Biblia de Jerusalén) meten títulos de sección dentro del versículo,
// en un bloque que empieza con una línea en blanco. Se quitan esas líneas de título.
function stripHeadings(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) lines.shift();
  while (lines.length > 1 && isHeadingLine(lines[0])) lines.shift();
  return lines.join(' ');
}

export function cleanVerse(raw) {
  let text = /^[ \t]*\r?\n[ \t]*\r?\n/.test(raw) ? stripHeadings(raw) : raw;
  text = decodeEntities(text.replace(/<[^>]+>/g, ''));
  return text
    .replace(/\[\d+\]/g, '')   // llamadas de nota: [1]
    .replace(/\*/g, '')        // marcas de glosario o nota: palabra*
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?»”)])/g, '$1')
    .trim();
}

// Marcadores de versículo omitido o unido al anterior: "--" o "(TEXT OMITTED)". No se proyectan.
const isOmitted = (text) => !/[^\s\-–—]/.test(text) || /^\(text omitted\)$/i.test(text);

// Devuelve { books: [{ n, name, abbr, chapters: [{ n, verses: [{ n, text }] }] }] } ordenado por libro.
export function parseBible(source) {
  const format = FORMATS.find((f) => f.test.test(source));
  if (!format) throw new Error('Formato de biblia no reconocido (se esperaba .xmm o .xml).');

  const byNumber = new Map();
  let book = null;
  let chapter = null;
  let position = 0;
  format.rx.lastIndex = 0;

  for (let m; (m = format.rx.exec(source));) {
    if (m[1] !== undefined) {
      position += 1;
      const label = decodeEntities(m[1]).trim();
      let n = /^\d+$/.test(label) ? Number(label) : findBook(label);
      if (!n || byNumber.has(n)) n = byNumber.has(position) ? 66 + position : position;
      const canon = CANON[n - 1];
      book = { n, name: canon?.name || label, abbr: canon?.abbr || label.slice(0, 4), chapters: [] };
      byNumber.set(n, book);
      chapter = null;
    } else if (m[2] !== undefined) {
      if (!book) continue;
      chapter = { n: Number(m[2]), verses: [] };
      book.chapters.push(chapter);
    } else if (chapter) {
      const n = Number(m[3]);
      let text = cleanVerse(m[4] || '');
      // Algunas versiones repiten el número del versículo al inicio del texto.
      if (text.startsWith(`${n} `)) text = text.slice(String(n).length + 1);
      if (!isOmitted(text)) chapter.verses.push({ n, text });
    }
  }

  const books = [...byNumber.values()]
    .map((b) => ({ ...b, chapters: b.chapters.filter((c) => c.verses.length) }))
    .filter((b) => b.chapters.length)
    .sort((a, b) => a.n - b.n);
  if (!books.length) throw new Error('El archivo no contiene libros ni versículos.');
  return { books };
}
