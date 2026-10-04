import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { migrateLegacy, moveItem, neighbor, renameItem } from './logic.js';

const MAX_STEPS_SHOWN = 200;

// Módulo Orden del culto: la lista ordenada de todo lo que se va a proyectar en la reunión.
// Aquí confluyen los demás módulos: cada uno aporta elementos de su tipo (ver app.kind).
export default function setup(app) {
  const { store, services } = app;
  const saved = app.storage('orden', { items: null });

  // Primera vez tras actualizar: se trae el "guion" de las versiones anteriores.
  if (!saved.data.items) {
    let legacy = [];
    try { legacy = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'guion.json'), 'utf8')).items; } catch { /* no había guion */ }
    saved.data.items = migrateLegacy(legacy, (data) => app.kinds.get('verses')?.describe(data));
    saved.save();
  }

  store.register('order', { items: saved.data.items });
  const items = () => store.get('order').items;
  const update = (next) => {
    saved.data.items = next;
    saved.save();
    store.set('order', { items: next });
  };
  const find = (id) => {
    const item = items().find((i) => i.id === id);
    if (!item) throw new HttpError(404, 'Ese elemento ya no está en el orden del culto.');
    return item;
  };
  const text = (value, max = 120) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  // Lo usa el módulo de proyección para avanzar por el orden.
  services.order = {
    has: (id) => items().some((i) => i.id === id),
    neighbor(id, step, delta) {
      const target = neighbor(items(), id, step, delta);
      const item = target && items().find((i) => i.id === target.id);
      return item ? { kind: item.kind, data: item.data, step: target.step, orderId: item.id } : null;
    },
  };

  app.action('order.add', { permission: 'order.edit' }, ({ kind, data }) => {
    const described = app.kinds.get(kind)?.describe(data);
    if (!described) throw new HttpError(404, 'Ese contenido no existe o ya no está disponible.');
    const item = { id: crypto.randomUUID(), kind, title: described.title, subtitle: described.subtitle, steps: described.steps, data: described.data };
    update([...items(), item]);
    return item;
  });

  app.action('order.addSection', { permission: 'order.edit' }, ({ title }) => {
    const item = { id: crypto.randomUUID(), kind: 'section', title: text(title, 60) || 'Sección' };
    update([...items(), item]);
    return item;
  });

  // Cualquier elemento puede llevar un nombre propio ("Lectura bíblica", "Video de bienvenida").
  // Sin nombre, vuelve al que le da su contenido.
  app.action('order.rename', { permission: 'order.edit' }, ({ id, title }) => {
    const item = find(id);
    update(items().map((i) => (i.id === id ? renameItem(i, title, app.kinds.get(i.kind)?.describe(i.data)?.title) : i)));
    return items().find((i) => i.id === id);
  });

  app.action('order.remove', { permission: 'order.edit' }, ({ id }) => {
    update(items().filter((i) => i.id !== id));
  });

  app.action('order.move', { permission: 'order.edit' }, ({ id, toIndex }) => {
    update(moveItem(items(), id, Number(toIndex)));
  });

  app.action('order.clear', { permission: 'order.edit' }, () => update([]));

  // Proyecta un elemento del orden. Sin step, empieza por su primer paso.
  // step null (explícito) = el elemento entero en una sola pantalla.
  app.action('order.show', { permission: 'projection.control' }, ({ id, step = 0 }) => {
    const item = find(id);
    if (item.kind === 'section') throw new HttpError(400, 'Una sección no se proyecta.');
    return services.projection.present({ kind: item.kind, data: item.data, step: Number.isInteger(step) ? step : null, orderId: id });
  });

  // Los pasos de un elemento, ya resueltos, para dibujar sus miniaturas.
  app.route('GET', '/api/order/:id/steps', ({ params }) => {
    const item = find(params.id);
    const kind = app.kinds.get(item.kind);
    const steps = [];
    for (let i = 0; i < Math.min(item.steps || 0, MAX_STEPS_SHOWN); i += 1) {
      const content = kind?.resolve(item.data, i);
      if (content) steps.push({ kind: item.kind, ...content });
    }
    return { steps, whole: item.steps > 1 ? { kind: item.kind, ...kind?.resolve(item.data, null) } : null };
  });
}
