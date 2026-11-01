// Las versiones con derechos de la portada, por libro: { [libro]: { [capítulo]: [[versículo, texto], …] } }.
import { parseBible } from '../../server/modules/bible/parsers.js';

export const ARCHIVOS = { RVR60: 'SpanishRVR1960Bible.xml', NTV: 'SpanishNTVBible.xml', PDT: 'SpanishPDTBible.xml' };

export const porLibro = (fuente) => Object.fromEntries(parseBible(fuente).books.map((libro) => [
  libro.n,
  Object.fromEntries(libro.chapters.map((c) => [c.n, c.verses.map((v) => [v.n, v.text])])),
]));
