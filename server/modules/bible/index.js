import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { imageInfo } from '../../core/images.js';
import { watchFolder } from '../../core/folders.js';
import { BibleLibrary } from './library.js';
import { registerCompare } from './compare.js';
import { createReview } from './citas.js';
import { readImageText } from './ocr.js';

// Módulo Biblia: versiones disponibles, lectura por capítulo y búsqueda. Aporta dos tipos de
// contenido: el pasaje en una versión ('verses') y en dos a la vez ('compare', en compare.js).
export default function setup(app) {
  const library = new BibleLibrary(app.biblesDir);
  app.services.bible = library;

  app.store.register('bible', { versions: library.scan() });
  let closed = false;

  // El índice de búsqueda se prepara en segundo plano, para que la primera búsqueda no espere.
  const prepareSearch = () => setTimeout(() => {
    const id = library.searchVersion();
    if (id && !closed) library.index(id);
  }, 800).unref();

  const rescan = () => {
    app.store.set('bible', { versions: library.scan() });
    prepareSearch();
  };

  // Si se copia o borra una biblia en la carpeta, la lista se actualiza sola.
  app.onClose(watchFolder(app.biblesDir, rescan));
  app.onClose(() => { closed = true; });
  app.store.on('listening', prepareSearch);

  const found = (value) => {
    if (!value) throw new HttpError(404, 'No se encontró esa versión o pasaje.');
    return value;
  };

  app.route('GET', '/api/bible/:id/books', ({ params }) => ({ books: found(library.books(params.id)) }));

  app.route('GET', '/api/bible/:id/chapter/:book/:chapter', ({ params }) =>
    found(library.chapter(params.id, params.book, params.chapter)));

  // q: una cita o un texto. limit: cuántos resultados por nivel (para "ver más").
  // en: 'ot' o 'nt' para buscar solo en el Antiguo o en el Nuevo Testamento.
  app.route('GET', '/api/bible/:id/search', ({ params, query }) => {
    const limit = Math.min(Math.max(Number(query.get('limit')) || 40, 1), 400);
    return found(library.search(params.id, (query.get('q') || '').slice(0, 200), { limit, scope: query.get('en') || 'all' }));
  });

  app.action('bible.rescan', { permission: 'bible.manage' }, rescan);

  // Citas de un texto o documento (fase 27): el texto llega tal cual (text/plain, hasta 4 MB; un PDF trae «\f» entre
  // páginas) y vuelve la lista para revisar (citas.js). Con el permiso de editar el orden, que es adonde van.
  const SIGLAS = { RV60: 'RVR1960', RV1960: 'RVR1960', RVR: 'RVR1960' };
  const versionOf = (sigla) => library.list().find((v) => (v.abbr || '').toUpperCase().replace(/\s+/g, '') === (SIGLAS[sigla] || sigla))?.id || null;
  let review = null;
  app.route('POST', '/api/bible/citas', async (ctx) => {
    ctx.require('order.edit');
    const text = (await ctx.raw(4 * 1024 * 1024)).toString('utf8');
    if (!text.trim()) throw new HttpError(400, 'No hay texto en el que buscar citas.');
    review ||= createReview({ structure: (b) => library.shape(b), verses: (b, c) => library.verseTexts(b, c), versionOf });
    return review(text);
  });

  // Un PDF que es solo imágenes (hecho desde una web o escaneado): el navegador manda cada página como imagen y el
  // equipo principal lee su texto (ocr.js). Una página cada vez, hasta 12 MB, JPEG o PNG.
  app.route('POST', '/api/bible/ocr', async (ctx) => {
    ctx.require('order.edit');
    const body = await ctx.raw(12 * 1024 * 1024);
    const info = imageInfo(body);
    if (!info || !['jpeg', 'png'].includes(info.type)) throw new HttpError(400, 'Eso no es la imagen de una página.');
    fs.mkdirSync(app.tmpDir, { recursive: true });
    const file = path.join(app.tmpDir, `ocr-${crypto.randomBytes(6).toString('hex')}.${info.type === 'png' ? 'png' : 'jpg'}`);
    fs.writeFileSync(file, body);
    try {
      return { text: await readImageText(file) };
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  // Tipo de contenido "pasaje bíblico". data: { versionId, ref }. Cada versículo es un paso.
  const single = (ref, n) => ({ ...ref, verseStart: n, verseEnd: n });
  app.kind('verses', {
    label: 'Biblia',
    describe(data) {
      const p = library.passage(data?.versionId, data?.ref);
      if (!p) return null;
      return { title: p.reference, subtitle: library.version(p.versionId).name, steps: p.verses.length, data: { versionId: p.versionId, ref: p.ref } };
    },
    resolve(data, step) {
      const p = library.passage(data?.versionId, data?.ref);
      if (!p || step == null) return p;
      const verse = p.verses[step];
      return verse ? library.passage(p.versionId, single(p.ref, verse.n)) : null;
    },
    // Qué es cada paso (el número de versículo): lo usa projection.swap para no cambiar de versículo al cambiar de versión.
    stepIds: (content) => content.verses.map((v) => v.n),
    // Fuera del orden del culto, "siguiente" sigue leyendo: el versículo que viene, aunque cambie de capítulo.
    neighbor(data, step, delta) {
      const p = this.resolve(data, step);
      const ref = p && library.step(p.versionId, p.ref, delta);
      return ref ? { data: { versionId: p.versionId, ref }, step: null } : null;
    },
  });

  registerCompare(app, library);
}
