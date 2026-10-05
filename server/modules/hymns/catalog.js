import { createTextIndex, findMarks, fold, prepareQuery } from '../../core/search.js';

// El himnario, armado a partir de lo que hay en la carpeta de la iglesia: los videos (uno por
// himno, con su número y su título en el nombre del archivo) y las letras (ver lyrics.js).
// Es lógica pura: no toca el disco ni el servidor.
//
// Los videos mandan: un himno existe si tiene video, y su número es el del archivo. La letra de
// un número solo se le pone al himno si su título es el mismo que el del video (sin contar tildes,
// mayúsculas ni signos). Así una letra mal numerada nunca aparece en el himno equivocado.

export const VIDEO_EXTENSIONS = ['.mp4', '.m4v'];
export const TRACKS = ['vocal', 'instrumental'];
export const TRACK_NAMES = { vocal: 'Cantado', instrumental: 'Pista' };

// "001 Cantad alegres al Señor.mp4" -> { number: 1, title: 'Cantad alegres al Señor' }.
// null si el nombre no empieza por un número.
export function fromFileName(name) {
  const found = /^\s*(\d{1,4})(?:[\s._-]+(.*?))?\.[^.]+$/.exec(String(name));
  if (!found) return null;
  const number = Number(found[1]);
  const title = (found[2] || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return number > 0 ? { number, title: title || `Himno ${number}` } : null;
}

export const sameTitle = (a, b) => fold(a) === fold(b);

// [5, 12, 13, 14, 30] -> "5, 12-14, 30": para decir qué números faltan sin una lista interminable.
export function ranges(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (sorted[j + 1] === sorted[j] + 1) j += 1;
    out.push(j === i ? String(sorted[i]) : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return out.join(', ');
}

// files: [{ name, size, modified }] de la carpeta de videos. lyrics: lo que devuelve parseLyrics (o null).
// Devuelve:
//   hymns       [{ number, title, file, size, modified, category, parts }], por número.
//               category: posición en `categories`, o null. parts: su letra, o null si no la tiene.
//   categories  nombres, en el orden del archivo de letras
//   report      lo que conviene que sepa quien cuida el himnario:
//     missing        números que faltan entre el primero y el último video
//     repeated       números con más de un video (se usa el primero)
//     unnumbered     archivos cuyo nombre no empieza por un número (no se usan)
//     mismatched     números cuya letra tiene otro título que el video (esa letra no se usa)
//     withoutLyrics  himnos sin letra (por lo anterior o porque no viene)
//     withoutVideo   números que tienen letra pero no video (no se pueden proyectar)
export function buildCatalog(files, lyrics = null) {
  const byNumber = new Map();
  const repeated = [];
  const unnumbered = [];
  for (const file of files) {
    const named = fromFileName(file.name);
    if (!named) { unnumbered.push(file.name); continue; }
    if (byNumber.has(named.number)) { repeated.push(named.number); continue; }
    byNumber.set(named.number, { number: named.number, title: named.title, file: file.name, size: file.size, modified: file.modified, category: null, parts: null });
  }

  const categories = [];
  const mismatched = [];
  const withoutVideo = [];
  for (const written of lyrics?.hymns || []) {
    const hymn = byNumber.get(written.number);
    if (!hymn) { withoutVideo.push(written.number); continue; }
    if (hymn.parts) continue; // letra repetida para el mismo número: vale la primera
    if (!sameTitle(written.title, hymn.title)) { mismatched.push(written.number); continue; }
    // El título de la letra lleva las tildes y los signos que el nombre de un archivo no suele llevar.
    hymn.title = written.title;
    if (written.parts.length) hymn.parts = written.parts;
  }
  for (const category of lyrics?.categories || []) {
    const inside = category.numbers.filter((n) => byNumber.has(n));
    if (!inside.length) continue;
    categories.push(category.name);
    for (const n of inside) byNumber.get(n).category ??= categories.length - 1;
  }

  const hymns = [...byNumber.values()].sort((a, b) => a.number - b.number);
  // Un himno que no viene en el archivo de letras, entre dos de la misma categoría, es de esa categoría.
  hymns.forEach((hymn, i) => {
    if (hymn.category != null) return;
    const before = hymns.slice(0, i).findLast((h) => h.category != null);
    const after = hymns.slice(i + 1).find((h) => h.category != null);
    if (before && after && before.category === after.category) hymn.category = before.category;
  });
  const numbers = hymns.map((h) => h.number);
  const missing = [];
  for (let n = numbers[0] ?? 1; n < (numbers.at(-1) ?? 0); n += 1) if (!byNumber.has(n)) missing.push(n);
  return {
    hymns,
    categories,
    report: {
      total: hymns.length,
      withLyrics: hymns.filter((h) => h.parts).length,
      missing, repeated: [...new Set(repeated)], unnumbered, mismatched,
      withoutLyrics: hymns.filter((h) => !h.parts).map((h) => h.number),
      withoutVideo,
    },
  };
}

// ---- Búsqueda ----
// Por número ("25"), por título y por letra, con los mismos niveles que la Biblia (core/search.js).
// Cada himno es un texto por su título y otro por cada parte de su letra; en los resultados sale
// una vez por nivel, con el renglón donde se encontró.

const SEPARATOR = ' / '; // entre renglones de una parte, al buscar y al mostrar lo encontrado
const LEVELS = [['exact', 'Frase exacta'], ['words', 'Todas las palabras'], ['similar', 'Parecidas']];

export function createHymnSearch(hymns) {
  const texts = [];
  const owner = []; // de qué himno es cada texto
  const where = []; // -1 = su título; si no, la posición de la parte en su letra
  hymns.forEach((hymn, at) => {
    texts.push(hymn.title);
    owner.push(at);
    where.push(-1);
    (hymn.parts || []).forEach((part, p) => {
      texts.push(part.lines.join(SEPARATOR));
      owner.push(at);
      where.push(p);
    });
  });
  const index = createTextIndex(texts);

  // El renglón (o los renglones) de la parte donde cae lo encontrado, con sus marcas recolocadas.
  function excerpt(text, marks) {
    if (!marks.length) return { text: text.split(SEPARATOR)[0], marks: [] };
    const [first] = marks[0];
    const last = marks.reduce((end, mark) => (mark[0] - first < 120 ? Math.max(end, mark[1]) : end), marks[0][1]);
    const start = text.lastIndexOf(SEPARATOR, first) < 0 ? 0 : text.lastIndexOf(SEPARATOR, first) + SEPARATOR.length;
    const stop = text.indexOf(SEPARATOR, last) < 0 ? text.length : text.indexOf(SEPARATOR, last);
    return { text: text.slice(start, stop), marks: marks.filter(([a, b]) => a >= start && b <= stop).map(([a, b]) => [a - start, b - start]) };
  }

  return function search(query, { limit = 30 } = {}) {
    const typed = String(query ?? '').trim().slice(0, 200);
    // Un número: ese himno primero, y después los que empiezan por esas cifras.
    if (/^\d{1,4}$/.test(typed)) {
      const exact = hymns.filter((h) => h.number === Number(typed));
      const others = hymns.filter((h) => h.number !== Number(typed) && String(h.number).startsWith(String(Number(typed))));
      const found = [...exact, ...others];
      return { type: 'number', total: found.length, results: found.slice(0, limit).map((h) => ({ number: h.number, title: h.title, label: null, text: null, marks: [] })) };
    }
    const prepared = prepareQuery(typed);
    if (prepared.empty) return { type: 'text', levels: [], total: 0 };
    const found = index.find(prepared);
    const shown = new Set(); // un himno sale una sola vez: en el nivel más alto en que aparece
    const levels = LEVELS.map(([id, label]) => {
      const results = [];
      const here = new Set();
      for (const doc of found[id]) {
        const at = owner[doc];
        if (shown.has(at) || here.has(at)) continue;
        here.add(at);
        const hymn = hymns[at];
        const marks = findMarks(texts[doc], prepared, id);
        const part = where[doc] < 0 ? null : hymn.parts[where[doc]];
        results.push({ number: hymn.number, title: hymn.title, label: part ? part.label || 'Letra' : null, ...(part ? excerpt(texts[doc], marks) : { text: null, marks }) });
      }
      for (const at of here) shown.add(at);
      // Dentro de un nivel, primero los himnos que lo llevan en el título.
      results.sort((a, b) => (a.label === null ? 0 : 1) - (b.label === null ? 0 : 1));
      return { id, label, total: results.length, results: results.slice(0, limit) };
    }).filter((level) => level.total);
    return { type: 'text', levels, total: levels.reduce((sum, level) => sum + level.total, 0) };
  };
}
