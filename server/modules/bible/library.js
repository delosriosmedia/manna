import fs from 'node:fs';
import path from 'node:path';
import { createTextIndex, findMarks, prepareQuery } from '../../core/search.js';
import { parseBible } from './parsers.js';
import { describeVersion } from './versions.js';
import { parseReference, formatReference } from './reference.js';

const EXTENSIONS = new Set(['.xmm', '.xml']);

const LEVELS = [['exact', 'Frase exacta'], ['words', 'Todas las palabras'], ['similar', 'Parecidas']];

// Biblioteca de biblias: lee la carpeta Biblias/, procesa cada versión la primera vez
// que se usa y la deja en memoria.
export class BibleLibrary {
  #dir;
  #versions = new Map(); // id -> { id, name, abbr, file }
  #parsed = new Map();   // id -> { books, byNumber, search? }

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

  // ---- Búsqueda ----
  // Cada versión tiene su índice de palabras (ver core/search.js). Se hace una vez, en segundo
  // plano al arrancar (index.js) o la primera vez que se busca en ella.

  // Prepara el índice de una versión. Devuelve false si la versión no existe.
  index(id) {
    const bible = this.#load(id);
    if (!bible) return false;
    if (bible.search) return true;
    const texts = [];
    const keys = [];
    for (const book of bible.books) {
      for (const chapter of book.chapters) {
        for (const verse of chapter.verses) {
          texts.push(verse.text);
          keys.push(book.n * 1_000_000 + chapter.n * 1000 + verse.n);
        }
      }
    }
    // keys: libro, capítulo y versículo de cada texto en un solo número, igual en todas las versiones.
    bible.search = { texts, keys: Uint32Array.from(keys), index: createTextIndex(texts) };
    return true;
  }

  // Versiones que aún no tienen índice.
  pendingIndex() {
    return [...this.#versions.keys()].filter((id) => !this.#parsed.get(id)?.search);
  }

  // Búsqueda: primero intenta leerla como cita; si no, busca el texto en todas las versiones que
  // ya tienen índice. Los resultados van por niveles (frase exacta, todas las palabras, parecidas).
  // Un mismo versículo sale una sola vez: con el texto de la versión elegida si coincide en ella,
  // y si no, con el de la primera versión donde coincide, indicando cuál es.
  search(id, query, { limit = 40 } = {}) {
    const bible = this.#load(id);
    if (!bible) return null;
    const ref = parseReference(query);
    const chapter = ref && this.chapter(id, ref.book, ref.chapter);
    if (chapter) {
      const reference = ref.verseStart ? formatReference(ref, chapter.name) : `${chapter.name} ${chapter.chapter}`;
      return { type: 'ref', ref, reference };
    }

    const started = performance.now();
    const prepared = prepareQuery(query);
    this.index(id);
    // La versión elegida primero; después las demás, por nombre.
    const order = [id, ...this.list().map((v) => v.id).filter((other) => other !== id)]
      .map((vid) => ({ meta: this.#versions.get(vid), search: this.#parsed.get(vid)?.search, bible: this.#parsed.get(vid) }))
      .filter((v) => v.search);
    const found = order.map((v) => v.search.index.find(prepared));
    const seen = new Set();

    const levels = LEVELS.map(([level, label]) => {
      const groups = new Map(); // versículo -> [{ versión, posición }], la versión elegida primero
      order.forEach((version, vi) => {
        for (const doc of found[vi][level]) {
          const key = version.search.keys[doc];
          if (seen.has(key)) continue;
          const hits = groups.get(key);
          if (hits) hits.push({ version, doc }); else groups.set(key, [{ version, doc }]);
        }
      });
      const results = [];
      for (const [key, hits] of groups) {
        seen.add(key);
        if (results.length >= limit) continue;
        const [{ version, doc }] = hits;
        const book = Math.floor(key / 1_000_000);
        const text = version.search.texts[doc];
        results.push({
          book,
          chapter: Math.floor(key / 1000) % 1000,
          verse: key % 1000,
          reference: `${version.bible.byNumber.get(book).name} ${Math.floor(key / 1000) % 1000}:${key % 1000}`,
          versionId: version.meta.id,
          version: version.meta.abbr || version.meta.name,
          text,
          marks: findMarks(text, prepared, level),
          others: hits.slice(1).map((hit) => hit.version.meta.abbr || hit.version.meta.name),
        });
      }
      return { id: level, label, total: groups.size, results };
    }).filter((level) => level.total);

    return {
      type: 'text',
      levels,
      total: levels.reduce((sum, level) => sum + level.total, 0),
      // En cuántas versiones se buscó, de cuántas hay: las demás aún se están preparando.
      searched: order.length,
      versions: this.#versions.size,
      ms: Math.round((performance.now() - started) * 10) / 10,
    };
  }
}
