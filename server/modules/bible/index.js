import { HttpError } from '../../core/router.js';
import { watchFolder } from '../../core/folders.js';
import { BibleLibrary } from './library.js';

// Módulo Biblia: versiones disponibles, lectura por capítulo y búsqueda.
export default function setup(app) {
  const library = new BibleLibrary(app.biblesDir);
  app.services.bible = library;

  app.store.register('bible', { versions: library.scan() });
  const rescan = () => app.store.set('bible', { versions: library.scan() });

  // Si se copia o borra una biblia en la carpeta, la lista se actualiza sola.
  app.onClose(watchFolder(app.biblesDir, rescan));

  const found = (value) => {
    if (!value) throw new HttpError(404, 'No se encontró esa versión o pasaje.');
    return value;
  };

  app.route('GET', '/api/bible/:id/books', ({ params }) => ({ books: found(library.books(params.id)) }));

  app.route('GET', '/api/bible/:id/chapter/:book/:chapter', ({ params }) =>
    found(library.chapter(params.id, params.book, params.chapter)));

  app.route('GET', '/api/bible/:id/search', ({ params, query }) =>
    found(library.search(params.id, (query.get('q') || '').slice(0, 200))));

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
