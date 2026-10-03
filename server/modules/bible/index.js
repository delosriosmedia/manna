import fs from 'node:fs';
import { HttpError } from '../../core/router.js';
import { BibleLibrary } from './library.js';

// Módulo Biblia: versiones disponibles, lectura por capítulo y búsqueda.
export default function setup(app) {
  const library = new BibleLibrary(app.biblesDir);
  app.services.bible = library;

  app.store.register('bible', { versions: library.scan() });
  const rescan = () => app.store.set('bible', { versions: library.scan() });

  // Si se copia o borra una biblia en la carpeta, la lista se actualiza sola.
  let timer = null;
  try {
    const watcher = fs.watch(app.biblesDir, () => {
      clearTimeout(timer);
      timer = setTimeout(rescan, 1000);
    });
    app.onClose(() => watcher.close());
  } catch { /* sin vigilancia de carpeta: queda el botón de recargar */ }

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
}
