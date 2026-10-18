// Lo que el detector necesita de las biblias instaladas (Contenido/Biblias): cuántos versículos tiene cada capítulo
// (el mayor de todas: no numeran igual) y el texto de cada versículo en cada versión (para comparar lo copiado).
import { BibleLibrary } from '../../../server/modules/bible/library.js';

export function loadBibles(dir = new URL('../../../Contenido/Biblias/', import.meta.url).pathname) {
  const lib = new BibleLibrary(dir);
  const versions = lib.scan();
  const shape = new Map();
  const texts = new Map();
  const structure = (b) => {
    if (!shape.has(b)) {
      let best = null;
      for (const v of versions) {
        const book = lib.books(v.id)?.find((x) => x.n === b);
        if (!book) continue;
        const counts = book.chapters.map((c) => lib.chapter(v.id, b, c).verses.length);
        best = best ? best.map((n, i) => Math.max(n, counts[i] || 0)).concat(counts.slice(best.length)) : counts;
      }
      shape.set(b, best);
    }
    return shape.get(b);
  };
  const verses = (b, c) => {
    const key = `${b}:${c}`;
    if (!texts.has(key)) {
      const out = [];
      for (const v of versions) {
        for (const verse of lib.chapter(v.id, b, c)?.verses || []) (out[verse.n - 1] ||= []).push(verse.text);
      }
      texts.set(key, out);
    }
    return texts.get(key);
  };
  return { structure, verses };
}
