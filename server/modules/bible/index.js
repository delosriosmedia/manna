import { HttpError } from '../../core/router.js';
import { watchFolder } from '../../core/folders.js';
import { BibleLibrary } from './library.js';

// Módulo Biblia: versiones disponibles, lectura por capítulo y búsqueda.
export default function setup(app) {
  const library = new BibleLibrary(app.biblesDir);
  app.services.bible = library;

  // indexed: en cuántas versiones ya se puede buscar. El índice de cada una se prepara en
  // segundo plano, de una en una, para que el arranque y la proyección no esperen por él.
  app.store.register('bible', { versions: library.scan(), indexed: 0 });
  let indexing = false;
  let closed = false;
  const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms).unref(); });

  async function indexAll() {
    if (indexing) return;
    indexing = true;
    try {
      for (let pending = library.pendingIndex(); pending.length && !closed; pending = library.pendingIndex()) {
        library.index(pending[0]);
        app.store.set('bible', { indexed: library.list().length - library.pendingIndex().length });
        // Un respiro entre versiones: cada índice ocupa al servidor una fracción de segundo.
        await pause(60);
      }
    } finally {
      indexing = false;
    }
  }

  const rescan = () => {
    const versions = library.scan();
    app.store.set('bible', { versions, indexed: versions.length - library.pendingIndex().length });
    indexAll();
  };

  // Si se copia o borra una biblia en la carpeta, la lista se actualiza sola.
  app.onClose(watchFolder(app.biblesDir, rescan));
  app.onClose(() => { closed = true; });
  app.store.on('listening', () => setTimeout(indexAll, 800).unref());

  const found = (value) => {
    if (!value) throw new HttpError(404, 'No se encontró esa versión o pasaje.');
    return value;
  };

  app.route('GET', '/api/bible/:id/books', ({ params }) => ({ books: found(library.books(params.id)) }));

  app.route('GET', '/api/bible/:id/chapter/:book/:chapter', ({ params }) =>
    found(library.chapter(params.id, params.book, params.chapter)));

  // q: una cita o un texto. limit: cuántos resultados por nivel (para "ver más").
  app.route('GET', '/api/bible/:id/search', ({ params, query }) => {
    const limit = Math.min(Math.max(Number(query.get('limit')) || 40, 1), 400);
    return found(library.search(params.id, (query.get('q') || '').slice(0, 200), { limit }));
  });

  app.action('bible.rescan', { permission: 'bible.manage' }, rescan);

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
    // Fuera del orden del culto, "siguiente" sigue leyendo: el versículo que viene, aunque cambie de capítulo.
    neighbor(data, step, delta) {
      const p = this.resolve(data, step);
      const ref = p && library.step(p.versionId, p.ref, delta);
      return ref ? { data: { versionId: p.versionId, ref }, step: null } : null;
    },
  });
}
