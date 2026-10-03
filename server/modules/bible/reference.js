import { CANON, findBook } from './canon.js';

const REF = /^\s*((?:[1-3]|i{1,3})?\s*[a-záéíóúüñ.]+(?:\s+[a-záéíóúüñ.]+)*?)\s*(\d+)(?:\s*[:.,\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/i;

// "Juan 3:16-18", "1 co 13 4", "Gn 1", "Salmo 23" -> { book, chapter, verseStart, verseEnd } o null.
// Sin versículo, verseStart y verseEnd son null (capítulo completo).
export function parseReference(text) {
  const m = REF.exec(text);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const verseStart = m[3] ? Number(m[3]) : null;
  const verseEnd = m[4] ? Math.max(Number(m[4]), verseStart) : verseStart;
  return { book, chapter: Number(m[2]), verseStart, verseEnd };
}

export function formatReference(ref, bookName = CANON[ref.book - 1]?.name || '') {
  const range = ref.verseEnd > ref.verseStart ? `-${ref.verseEnd}` : '';
  return `${bookName} ${ref.chapter}:${ref.verseStart}${range}`;
}
