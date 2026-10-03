import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './canon.js';
import { parseBible } from './parsers.js';
import { describeVersion } from './versions.js';
import { parseReference, formatReference } from './reference.js';

const EXTENSIONS = new Set(['.xmm', '.xml']);

// Biblioteca de biblias: lee la carpeta Biblias/, procesa cada versión la primera vez
// que se usa y la deja en memoria.
export class BibleLibrary {
  #dir;
  #versions = new Map(); // id -> { id, name, abbr, file }
  #parsed = new Map();   // id -> { books, byNumber, flat? }

  constructor(dir) {
    this.#dir = dir;
  }

  scan() {
    const found = new Map();
    const names = new Map();
    const files = fs.readdirSync(this.#dir).filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase())).sort();
    for (const fileName of files) {
      const file = path.join(this.#dir, fileName);
      let head = '';
      try {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(2048);
        head = buf.toString('utf8', 0, fs.readSync(fd, buf, 0, buf.length, 0));
        fs.closeSync(fd);
      } catch { continue; }
      const meta = describeVersion(fileName, head);
      if (found.has(meta.id)) continue;
      // Dos archivos de la misma versión: el segundo se distingue con "(2)".
      const count = (names.get(meta.name) || 0) + 1;
      names.set(meta.name, count);
      if (count > 1) meta.name += ` (${count})`;
      found.set(meta.id, { ...meta, file, mtime: fs.statSync(file).mtimeMs });
    }
    for (const [id, old] of this.#versions) {
      if (found.get(id)?.mtime !== old.mtime) this.#parsed.delete(id);
    }
    this.#versions = found;
    return this.list();
  }

  list() {
    return [...this.#versions.values()]
      .map(({ id, name, abbr }) => ({ id, name, abbr }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  version(id) {
    return this.#versions.get(id) || null;
  }

  #load(id) {
    let bible = this.#parsed.get(id);
    if (bible) return bible;
    const meta = this.#versions.get(id);
    if (!meta) return null;
    const { books } = parseBible(fs.readFileSync(meta.file, 'utf8'));
    bible = { books, byNumber: new Map(books.map((b) => [b.n, b])) };
    this.#parsed.set(id, bible);
    return bible;
  }

  books(id) {
    const bible = this.#load(id);
    return bible && bible.books.map((b) => ({ n: b.n, name: b.name, abbr: b.abbr, chapters: b.chapters.map((c) => c.n) }));
  }

  chapter(id, bookN, chapterN) {
    const book = this.#load(id)?.byNumber.get(Number(bookN));
    const chapter = book?.chapters.find((c) => c.n === Number(chapterN));
    return chapter ? { book: book.n, name: book.name, chapter: chapter.n, verses: chapter.verses } : null;
  }

  // Resuelve una referencia a contenido listo para proyectar. Ajusta el rango a lo que exista.
  passage(id, ref) {
    const meta = this.#versions.get(id);
    const data = this.chapter(id, ref?.book, ref?.chapter);
    if (!meta || !data) return null;
    const start = Number(ref.verseStart) || data.verses[0].n;
    const end = Math.max(Number(ref.verseEnd) || start, start);
    const verses = data.verses.filter((v) => v.n >= start && v.n <= end);
    if (!verses.length) return null;
    const fixed = { book: data.book, chapter: data.chapter, verseStart: verses[0].n, verseEnd: verses.at(-1).n };
    return {
      versionId: id,
      version: meta.abbr || meta.name,
      ref: fixed,
      reference: formatReference(fixed, data.name),
      verses,
    };
  }

  // Versículo siguiente (delta=1) o anterior (delta=-1), cruzando capítulos y libros.
  step(id, ref, delta) {
    const bible = this.#load(id);
    const book = bible?.byNumber.get(ref.book);
    if (!book) return null;
    let bi = bible.books.indexOf(book);
    let ci = book.chapters.findIndex((c) => c.n === ref.chapter);
    if (ci < 0) return null;
    const verses = book.chapters[ci].verses;
    let vi = delta > 0
      ? verses.findIndex((v) => v.n > ref.verseEnd)
      : verses.findLastIndex((v) => v.n < ref.verseStart);
    if (vi < 0) {
      ci += delta > 0 ? 1 : -1;
      if (ci < 0 || ci >= bible.books[bi].chapters.length) {
        bi += delta > 0 ? 1 : -1;
        if (bi < 0 || bi >= bible.books.length) return null;
        ci = delta > 0 ? 0 : bible.books[bi].chapters.length - 1;
      }
      vi = delta > 0 ? 0 : bible.books[bi].chapters[ci].verses.length - 1;
    }
    const b = bible.books[bi];
    const c = b.chapters[ci];
    const n = c.verses[vi].n;
    return { book: b.n, chapter: c.n, verseStart: n, verseEnd: n };
  }

  // Búsqueda: primero intenta leerla como cita; si no, busca las palabras (sin importar tildes ni mayúsculas).
  search(id, query, limit = 60) {
    const bible = this.#load(id);
    if (!bible) return null;
    const ref = parseReference(query);
    if (ref && this.chapter(id, ref.book, ref.chapter)) return { type: 'ref', ref };

    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return { type: 'text', total: 0, results: [] };
    bible.flat ||= bible.books.flatMap((b) => b.chapters.flatMap((c) => c.verses.map((v) => ({
      book: b.n, name: b.name, chapter: c.n, verse: v.n, text: v.text, norm: normalize(v.text),
    }))));
    const results = [];
    let total = 0;
    for (const v of bible.flat) {
      if (!words.every((w) => v.norm.includes(w))) continue;
      total += 1;
      if (results.length < limit) {
        results.push({ book: v.book, chapter: v.chapter, verse: v.verse, reference: `${v.name} ${v.chapter}:${v.verse}`, text: v.text });
      }
    }
    return { type: 'text', total, results };
  }
}
