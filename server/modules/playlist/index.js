import crypto from 'node:crypto';
import { HttpError } from '../../core/router.js';

// Módulo Guion de culto: pasajes guardados para proyectarlos con un toque.
export default function setup(app) {
  const { store, services } = app;
  const saved = app.storage('guion', { items: [] });

  store.register('playlist', { items: saved.data.items });
  const items = () => store.get('playlist').items;
  const update = (next) => {
    saved.data.items = next;
    saved.save();
    store.set('playlist', { items: next });
  };

  app.action('playlist.add', { permission: 'playlist.edit' }, ({ versionId, ref }) => {
    const p = services.bible.passage(versionId, ref);
    if (!p) throw new HttpError(404, 'Ese pasaje no existe en la versión elegida.');
    if (items().some((i) => i.versionId === p.versionId && i.reference === p.reference)) {
      throw new HttpError(409, 'Ese pasaje ya está en el guion.');
    }
    const preview = p.verses.map((v) => v.text).join(' ').slice(0, 140);
    update([...items(), { id: crypto.randomUUID(), versionId: p.versionId, version: p.version, ref: p.ref, reference: p.reference, preview }]);
  });

  app.action('playlist.remove', { permission: 'playlist.edit' }, ({ id }) => {
    update(items().filter((i) => i.id !== id));
  });

  app.action('playlist.move', { permission: 'playlist.edit' }, ({ id, delta }) => {
    const list = [...items()];
    const from = list.findIndex((i) => i.id === id);
    const to = from + (delta < 0 ? -1 : 1);
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    update(list);
  });

  app.action('playlist.clear', { permission: 'playlist.edit' }, () => update([]));

  app.action('playlist.show', { permission: 'projection.control' }, ({ id }) => {
    const item = items().find((i) => i.id === id);
    if (!item) throw new HttpError(404, 'Ese pasaje ya no está en el guion.');
    return app.run('projection.show', { versionId: item.versionId, ref: item.ref });
  });
}
