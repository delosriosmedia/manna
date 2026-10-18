import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';
import { migrateLegacy, moveItem, neighbor, renameItem } from './logic.js';

const MAX_STEPS_SHOWN = 200;
const BEAT_MS = 60_000;
const KEEP_MS = 15 * 60_000; // el mismo margen con que se recupera lo que estaba al aire (projection/live.js)

// Módulo Orden del culto: la lista ordenada de todo lo que se va a proyectar en la reunión.
// Aquí confluyen los demás módulos: cada uno aporta elementos de su tipo (ver app.kind).
//
// Órdenes guardados (fase 23 de docs/PLAN.md), en data/orden.json:
//   { draft: { items }, saved: [{ id, name, items, updated }], active, alive }
// `draft` es el orden sin nombre, el de trabajo; solo pasa a `saved` si se le pone un nombre. `active` es el
// guardado que está en uso (null: el sin nombre). Todo cambio queda en el que está en uso. El sin nombre se
// vacía al cerrar Manna, salvo si se reinicia o se cerró de golpe y vuelve a abrirse en menos de 15 minutos
// (`alive`, la última hora en que estaba abierto, se apunta cada minuto y se borra al apagarlo).
export default function setup(app) {
  const { store, services } = app;
  const saved = app.storage('orden', { items: null });
  const data = saved.data;

  if (!data.draft) {
    // Primera vez tras actualizar: el orden de antes (o el "guion" de versiones más viejas) pasa a ser un
    // orden guardado, y esta vez sigue en uso.
    let items = data.items;
    if (!items) {
      let legacy = [];
      try { legacy = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'guion.json'), 'utf8')).items; } catch { /* no había guion */ }
      items = migrateLegacy(legacy, (d) => app.kinds.get('verses')?.describe(d));
    }
    const first = items.length ? { id: crypto.randomUUID(), name: 'Orden del culto', items, updated: Date.now() } : null;
    Object.assign(data, { draft: { items: [] }, saved: first ? [first] : [], active: first?.id || null, alive: Date.now() });
    delete data.items;
  } else if (process.env.MANNA_REINICIO !== '1' && !(Date.now() - (data.alive || 0) < KEEP_MS)) {
    data.draft.items = [];
    data.active = null;
  }
  if (data.active && !data.saved.some((o) => o.id === data.active)) data.active = null;
  data.alive = Date.now();
  saved.save();
  const beat = setInterval(() => { data.alive = Date.now(); saved.save(); }, BEAT_MS);
  beat.unref?.();
  app.onClose(() => {
    clearInterval(beat);
    data.alive = 0;
    saved.save();
  });

  const inUse = () => data.saved.find((o) => o.id === data.active) || data.draft;
  const items = () => inUse().items;
  const publish = () => store.set('order', {
    items: items(),
    name: data.active ? inUse().name : null,
    active: data.active,
    draft: data.draft.items.filter((i) => i.kind !== 'section').length,
    saved: data.saved.map((o) => ({ id: o.id, name: o.name, count: o.items.filter((i) => i.kind !== 'section').length, updated: o.updated })),
  });
  store.register('order', { items: [], name: null, active: null, draft: 0, saved: [] });
  publish();
  const update = (next) => {
    inUse().items = next;
    if (data.active) inUse().updated = Date.now();
    saved.save();
    publish();
  };
  const find = (id) => {
    const item = items().find((i) => i.id === id);
    if (!item) throw new HttpError(404, 'Ese elemento ya no está en el orden del culto.');
    return item;
  };
  const exists = (item) => item.kind === 'section' || Boolean(app.kinds.get(item.kind)?.describe(item.data));
  const order = (id) => {
    const found = data.saved.find((o) => o.id === id);
    if (!found) throw new HttpError(404, 'Ese orden ya no está guardado.');
    return found;
  };
  const orderName = (name, except = null) => {
    const clean = cleanName(name, 60);
    if (!clean) throw new HttpError(400, 'Escribe un nombre para el orden.');
    if (data.saved.some((o) => o !== except && o.name.toLowerCase() === clean.toLowerCase())) throw new HttpError(409, `Ya hay un orden «${clean}».`);
    return clean;
  };

  // Lo usa el módulo de proyección para avanzar por el orden.
  services.order = {
    has: (id) => items().some((i) => i.id === id),
    // Quita los elementos cuyo contenido ya no existe (tras «Limpiar multimedia temporales»), de todos los
    // órdenes. Las secciones quedan.
    prune() {
      let changed = false;
      for (const o of [data.draft, ...data.saved]) {
        const kept = o.items.filter(exists);
        if (kept.length === o.items.length) continue;
        o.items = kept;
        changed = true;
      }
      if (changed) {
        saved.save();
        publish();
      }
    },
    neighbor(id, step, delta) {
      const target = neighbor(items(), id, step, delta);
      const item = target && items().find((i) => i.id === target.id);
      return item ? { kind: item.kind, data: item.data, step: target.step, orderId: item.id } : null;
    },
  };

  app.action('order.add', { permission: 'order.edit' }, ({ kind, data: content }) => {
    const described = app.kinds.get(kind)?.describe(content);
    if (!described) throw new HttpError(404, 'Ese contenido no existe o ya no está disponible.');
    const item = { id: crypto.randomUUID(), kind, title: described.title, subtitle: described.subtitle, steps: described.steps, data: described.data };
    update([...items(), item]);
    return item;
  });

  // Varios de una vez (las citas de un texto o documento, fase 27): bajo una sección nueva ({ title }), al final de una
  // que ya existe ({ id }) o al final del orden. Se comprueban todos antes de añadir ninguno.
  app.action('order.addMany', { permission: 'order.edit' }, ({ items: list, section } = {}) => {
    if (!Array.isArray(list) || !list.length || list.length > 500) throw new HttpError(400, 'No hay nada que añadir.');
    const added = list.map(({ kind, data: content } = {}) => {
      const described = app.kinds.get(kind)?.describe(content);
      if (!described) throw new HttpError(404, 'Alguno de esos contenidos no existe o ya no está disponible.');
      return { id: crypto.randomUUID(), kind, title: described.title, subtitle: described.subtitle, steps: described.steps, data: described.data };
    });
    const next = [...items()];
    if (section?.title != null) next.push({ id: crypto.randomUUID(), kind: 'section', title: cleanName(section.title, 60) || 'Sección' }, ...added);
    else if (section?.id) {
      const at = next.findIndex((i) => i.id === section.id && i.kind === 'section');
      if (at < 0) throw new HttpError(404, 'Esa sección ya no está en el orden.');
      const after = next.findIndex((i, k) => k > at && i.kind === 'section');
      next.splice(after < 0 ? next.length : after, 0, ...added);
    } else next.push(...added);
    update(next);
    return { added: added.length };
  });

  app.action('order.addSection', { permission: 'order.edit' }, ({ title }) => {
    const item = { id: crypto.randomUUID(), kind: 'section', title: cleanName(title, 60) || 'Sección' };
    update([...items(), item]);
    return item;
  });

  // Cualquier elemento puede llevar un nombre propio ("Lectura bíblica", "Video de bienvenida").
  // Sin nombre, vuelve al que le da su contenido.
  app.action('order.rename', { permission: 'order.edit' }, ({ id, title }) => {
    find(id);
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

  // ---- Órdenes guardados ----
  // Guarda con un nombre el orden sin nombre, que sigue en uso ya guardado; el sin nombre queda vacío.
  app.action('order.save', { permission: 'order.edit' }, ({ name }) => {
    if (data.active) throw new HttpError(409, 'Este orden ya está guardado. Para cambiarle el nombre, usa «Cambiar el nombre».');
    const created = { id: crypto.randomUUID(), name: orderName(name), items: data.draft.items, updated: Date.now() };
    data.saved.push(created);
    data.draft.items = [];
    data.active = created.id;
    saved.save();
    publish();
    return { id: created.id };
  });
  // Pone en uso un orden guardado (id) o el sin nombre (sin id). Lo que ya no está en la biblioteca se quita.
  app.action('order.use', { permission: 'order.edit' }, ({ id = null }) => {
    const target = id ? order(id) : data.draft;
    const kept = target.items.filter(exists);
    const removed = target.items.length - kept.length;
    target.items = kept;
    data.active = id ? target.id : null;
    saved.save();
    publish();
    return { removed };
  });
  // Empieza un orden nuevo: el sin nombre, vacío y en uso.
  app.action('order.new', { permission: 'order.edit' }, () => {
    data.draft.items = [];
    data.active = null;
    saved.save();
    publish();
  });
  app.action('order.renameOrder', { permission: 'order.edit' }, ({ id, name }) => {
    const found = order(id);
    found.name = orderName(name, found);
    saved.save();
    publish();
  });
  // Una copia con otro nombre (para preparar el de la semana siguiente a partir de este); no se pone en uso.
  app.action('order.duplicate', { permission: 'order.edit' }, ({ id, name }) => {
    const source = order(id);
    const copy = { id: crypto.randomUUID(), name: orderName(name), items: source.items.map((i) => ({ ...i, id: crypto.randomUUID() })), updated: Date.now() };
    data.saved.push(copy);
    saved.save();
    publish();
    return { id: copy.id };
  });
  app.action('order.deleteOrder', { permission: 'order.edit' }, ({ id }) => {
    order(id);
    data.saved = data.saved.filter((o) => o.id !== id);
    if (data.active === id) data.active = null;
    saved.save();
    publish();
  });

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
