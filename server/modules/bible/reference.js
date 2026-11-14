import { CANON, ONE_CHAPTER_BOOKS, findBook } from './canon.js';

const END = '(?!\\d|[:.]\\d)';
const VERSES = `\\d+(?:\\s*(?:[-–—,]|y\\b)\\s*\\d+${END})*`;
const REF = new RegExp(
  '^\\s*((?:[1-3]\\s*)?[a-záéíóúüñªº.]+(?:\\s+[a-záéíóúüñ.]+)*?)\\s*(\\d+)'
  + `(?:\\s*([:.,\\s])\\s*(${VERSES})(?:\\s*[-–—]\\s*(\\d+)\\s*[:.]\\s*(\\d+))?|\\s*[-–—]\\s*(${VERSES}))?`
  + '(?:\\s*(?:y\\s+)?(?:ss|sigs?)\\.?)?\\s*$',
  'i',
);

// "Juan 3:16-18", "1 co 13 4", "Gn 1", "Salmo 23" -> { book, chapter, verseStart, verseEnd, endChapter? } o null.
// Sin versículo, verseStart y verseEnd son null (capítulo completo).
export function parseReference(text) {
  const m = REF.exec(text);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const first = Number(m[2]);
  const oneChapter = ONE_CHAPTER_BOOKS.has(book);
  if (m[7]) {
    if (!oneChapter) return null;
    const nums = [first, ...m[7].match(/\d+/g).map(Number)];
    return { book, chapter: 1, verseStart: Math.min(...nums), verseEnd: Math.max(...nums) };
  }
  if (!m[4]) {
    const hasSs = /(?:ss|sigs?)\.?\s*$/i.test(text);
    if (!oneChapter && hasSs) return null;
    const asVerse = oneChapter && (first > 1 || hasSs);
    return { book, chapter: asVerse ? 1 : first, verseStart: asVerse ? first : null, verseEnd: asVerse ? first : null };
  }
  if (oneChapter && m[3] === ',' && first > 1 && !m[5]) {
    const nums = [first, ...m[4].match(/\d+/g).map(Number)];
    return { book, chapter: 1, verseStart: Math.min(...nums), verseEnd: Math.max(...nums) };
  }
  const nums = m[4].match(/\d+/g).map(Number);
  if (m[5]) {
    const endChapter = Number(m[5]);
    const endVerse = Number(m[6]);
    if (endChapter < first) return null;
    const verseStart = Math.min(...nums);
    if (endChapter === first) return { book, chapter: first, verseStart, verseEnd: Math.max(endVerse, ...nums) };
    return { book, chapter: first, verseStart, verseEnd: endVerse, endChapter };
  }
  return { book, chapter: first, verseStart: Math.min(...nums), verseEnd: Math.max(...nums) };
}

export function formatReference(ref, bookName = CANON[ref.book - 1]?.name || '') {
  const range = ref.verseEnd > ref.verseStart ? `-${ref.verseEnd}` : '';
  return `${bookName} ${ref.chapter}:${ref.verseStart}${range}`;
}
