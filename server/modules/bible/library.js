import fs from 'node:fs';
import path from 'node:path';
import { createTextIndex, findMarks, prepareQuery } from '../../core/search.js';
import { parseBible } from './parsers.js';
import { describeVersion } from './versions.js';
import { parseReference, formatReference } from './reference.js';

const EXTENSIONS = new Set(['.xmm', '.xml']);

const LEVELS = [['exact', 'Frase exacta'], ['words', 'Todas las palabras'], ['similar', 'Parecidas']];
const SEARCH_VERSION = 'RVR1960'; // sigla de la versión en la que se busca texto
const LAST_OT_BOOK = 39;          // Malaquías: hasta aquí, Antiguo Testamento
const SCOPES = ['all', 'ot', 'nt']; // dónde buscar: toda la Biblia, Antiguo o Nuevo Testamento

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
  // El texto se busca en una sola versión: la Reina-Valera 1960, que es la que la congregación
  // sabe de memoria (decisión del dueño). Si no está instalada, en la versión elegida.
  // Un resultado es un versículo por su posición, así que después se proyecta en la versión
  // que el usuario tenga elegida.

  searchVersion(fallbackId = null) {
    const preferred = [...this.#versions.values()].find((v) => v.abbr === SEARCH_VERSION);
    return (preferred || this.#versions.get(fallbackId))?.id || null;
  }

  // Prepara el índice de palabras de una versión (ver core/search.js). Se hace una sola vez:
  // al arrancar, en segundo plano (index.js), o la primera vez que se busca en ella.
  // Devuelve false si la versión no existe.
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
    // keys: libro, capítulo y versículo de cada texto, en un solo número.
    bible.search = { texts, keys: Uint32Array.from(keys), index: createTextIndex(texts) };
    return true;
  }

  // Búsqueda: primero intenta leerla como cita; si no, busca el texto. Los resultados van por
  // niveles (frase exacta, todas las palabras, parecidas), con lo encontrado marcado.
  // id: la versión elegida; limit: cuántos resultados por nivel; scope: 'all', 'ot' (Antiguo
  // Testamento) o 'nt' (Nuevo Testamento).
  search(id, query, { limit = 40, scope = 'all' } = {}) {
    if (!this.#load(id)) return null;
    const ref = parseReference(query);
    const chapter = ref && this.chapter(id, ref.book, ref.chapter);
    if (chapter) {
      const reference = ref.verseStart ? formatReference(ref, chapter.name) : `${chapter.name} ${chapter.chapter}`;
      return { type: 'ref', ref, reference };
    }

    const started = performance.now();
    const searchId = this.searchVersion(id);
    this.index(searchId);
    const bible = this.#parsed.get(searchId);
    const meta = this.#versions.get(searchId);
    const prepared = prepareQuery(query);
    const where = SCOPES.includes(scope) ? scope : 'all';
    const everywhere = bible.search.index.find(prepared);
    // El libro va en los millones de la clave de cada versículo.
    const isOld = (doc) => bible.search.keys[doc] < (LAST_OT_BOOK + 1) * 1_000_000;
    const inScope = (docs) => (where === 'all' ? docs : docs.filter((doc) => isOld(doc) === (where === 'ot')));
    const found = { exact: inScope(everywhere.exact), words: inScope(everywhere.words), similar: inScope(everywhere.similar) };

    const levels = LEVELS.map(([level, label]) => ({
      id: level,
      label,
      total: found[level].length,
      results: Array.from(found[level].slice(0, limit), (doc) => {
        const key = bible.search.keys[doc];
        const book = Math.floor(key / 1_000_000);
        const text = bible.search.texts[doc];
        return {
          book,
          chapter: Math.floor(key / 1000) % 1000,
          verse: key % 1000,
          reference: `${bible.byNumber.get(book).name} ${Math.floor(key / 1000) % 1000}:${key % 1000}`,
          text,
          marks: findMarks(text, prepared, level),
        };
      }),
    })).filter((level) => level.total);

    return {
      type: 'text',
      levels,
      total: levels.reduce((sum, level) => sum + level.total, 0),
      // En qué versión se buscó (puede no ser la elegida) y en qué parte de la Biblia.
      version: { id: meta.id, name: meta.name, abbr: meta.abbr },
      scope: where,
      ms: Math.round((performance.now() - started) * 10) / 10,
    };
  }
}
