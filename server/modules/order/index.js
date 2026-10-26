import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';
import { dayOf, defaultName, migrateLegacy, moveItem, neighbor, renameItem, uniqueName, validDay } from './logic.js';

const MAX_STEPS_SHOWN = 200;
const BEAT_MS = 60_000;
const KEEP_MS = 15 * 60_000; // el mismo margen con que se recupera lo que estaba al aire (projection/live.js)
// Cuántos órdenes guarda cada iglesia (pedido del dueño, 2026-10-25): por defecto 20; lo cambiará el superadministrador
// (fase 39) en `limit` de data/orden.json. Al quedar WARN_LEFT o menos, el cajón avisa de que hay que limpiar.
const LIMIT = 20;

// Módulo Orden del culto: la lista ordenada de todo lo que se va a proyectar en la reunión.
// Aquí confluyen los demás módulos: cada uno aporta elementos de su tipo (ver app.kind).
//
// Órdenes (fases 23 y 35 de docs/PLAN.md), en data/orden.json:
//   { saved: [{ id, name, owner, date, favorite, items, updated }], active, editing: { usuario: orden }, limit, alive, version }
// Cada orden tiene nombre, dueño (quien lo creó) y fecha (el día del culto) desde que se crea. `active` es el que está
// en uso: el de la cola del culto, que ven todos los que operan (espacio `order`). Un orden lo cambian su dueño y el
// administrador; el administrador ve todos y los demás, solo los suyos (el espacio `orders` se filtra por quien mira).
// `editing` es el que cada persona tiene abierto en el cajón Orden: ahí va lo que añade y lo que cambia. Al apagar
// Manna nada queda en uso, salvo si se reinicia o vuelve a abrirse antes de 15 minutos tras un corte (`alive`, la
// última hora en que estaba abierto, se apunta cada minuto y se borra al apagarlo).
export default function setup(app) {
  const { store, services, sessions } = app;
  const { users } = sessions;
  const saved = app.storage('orden', { items: null });
  const data = saved.data;

  const legacy = !data.draft && !data.version;
  if (legacy) {
    // Primera vez tras actualizar desde antes de la fase 23: el orden de antes (o el "guion" de versiones más viejas)
    // pasa a ser un orden guardado, y esta vez sigue en uso.
    let items = data.items;
    if (!items) {
      let old = [];
      try { old = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'guion.json'), 'utf8')).items; } catch { /* no había guion */ }
      items = migrateLegacy(old, (d) => app.kinds.get('verses')?.describe(d));
    }
    const first = items.length ? { id: crypto.randomUUID(), name: 'Orden del culto', items, updated: Date.now() } : null;
    Object.assign(data, { saved: first ? [first] : [], active: first?.id || null });
    delete data.items;
  }
  if (data.version !== 2) {
    // Fase 35: cada orden con su dueño (el administrador, los de antes) y su fecha; el orden sin nombre, si tenía algo,
    // pasa a ser uno más, con el nombre de siempre.
    const admin = users.firstAdmin().id;
    for (const o of data.saved) Object.assign(o, { owner: o.owner || admin, date: o.date || dayOf(o.updated) });
    if (data.draft?.items?.length) {
      const day = dayOf();
      const draft = { id: crypto.randomUUID(), name: uniqueName(defaultName(users.get(admin).name, day), data.saved.map((o) => o.name)), owner: admin, date: day, items: data.draft.items, updated: Date.now() };
      data.saved.push(draft);
      if (!data.active) data.active = draft.id;
    }
    delete data.draft;
    Object.assign(data, { editing: {}, version: 2 });
  }
  if (!Number.isInteger(data.limit) || data.limit < 1) data.limit = LIMIT;
  // Para la nube (fase 37, parte 4): lo borrado, con su hora (para que no vuelva), y los avisos de un orden cambiado en
  // los dos lados sin conexión (decisión 63, C).
  data.deleted ||= [];
  data.conflicts ||= [];
  if (!legacy && process.env.MANNA_REINICIO !== '1' && !(Date.now() - (data.alive || 0) < KEEP_MS)) data.active = null;
  const find = (id) => data.saved.find((o) => o.id === id) || null;
  if (!find(data.active)) data.active = null;
  // Al abrir Manna sin nada en uso, si hay un solo orden con la fecha de hoy, ese pasa a la cola (S51).
  if (!data.active) {
    const today = data.saved.filter((o) => o.date === dayOf());
    if (today.length === 1) data.active = today[0].id;
  }
  data.alive = Date.now();
  saved.save();
  const beat = setInterval(() => { data.alive = Date.now(); saved.save(); }, BEAT_MS);
  beat.unref?.();
  app.onClose(() => {
    clearInterval(beat);
    data.alive = 0;
    saved.save();
  });

  const inUse = () => find(data.active);
  const items = () => inUse()?.items || [];
  // Quién pide algo: la sesión (null si nadie entró) o undefined si lo pide Manna mismo (app.run), que puede con todo.
  const sessionOf = (ctx) => (ctx ? ctx.session : undefined);
  const mayTouch = (o, session) => session === undefined || Boolean(session?.admin) || (Boolean(session?.user) && o.owner === session.user.id);
  // El orden que esa persona tiene abierto o, si no eligió, el que está en uso, si lo puede cambiar.
  const editingOf = (session) => {
    const user = session?.user;
    if (!user) return null;
    const mine = (o) => (o && mayTouch(o, session) ? o : null);
    return mine(find(data.editing[user.id])) || mine(inUse());
  };
  const ownerName = (o) => users.get(o.owner)?.name || 'Alguien que ya no está';
  const count = (o) => o.items.filter((i) => i.kind !== 'section').length;
  let version = 0;
  const publish = () => {
    const o = inUse();
    store.set('order', { items: o?.items || [], name: o?.name || null, active: o?.id || null, owner: o ? ownerName(o) : null });
    store.set('orders', { version: ++version });
  };
  store.register('order', { items: [], name: null, active: null, owner: null });
  // Cada sesión recibe sus órdenes (el administrador, todos), sin sus elementos, y los del que tiene abierto.
  store.register('orders', { version }, {
    view: (_, viewer) => {
      const session = viewer ?? null;
      const editing = editingOf(session);
      return {
        list: session?.user ? data.saved.filter((o) => mayTouch(o, session)).map((o) => ({
          id: o.id, name: o.name, owner: o.owner, ownerName: ownerName(o), date: o.date, favorite: Boolean(o.favorite), count: count(o), updated: o.updated,
        })) : [],
        editing: editing?.id || null,
        items: editing?.items || [],
        // Los avisos de conflicto, para el dueño de ese orden y para el administrador.
        conflicts: session?.user ? data.conflicts.filter((c) => session.user.admin || c.owner === session.user.id) : [],
        total: data.saved.length,
        limit: data.limit,
      };
    },
  });
  publish();
  const save = () => {
    saved.save();
    publish();
  };
  const update = (o, next) => {
    o.items = next;
    o.updated = Date.now();
    save();
  };
  const itemOf = (o, id) => {
    const item = o?.items.find((i) => i.id === id);
    if (!item) throw new HttpError(404, 'Ese elemento ya no está en el orden del culto.');
    return item;
  };
  const exists = (item) => item.kind === 'section' || Boolean(app.kinds.get(item.kind)?.describe(item.data));
  const visible = (id, ctx) => {
    const o = find(id);
    if (!o || !mayTouch(o, sessionOf(ctx))) throw new HttpError(404, 'Ese orden ya no está.');
    return o;
  };
  // El dueño de lo que se crea: quien lo pide (Manna mismo: el administrador).
  const ownerOf = (ctx) => {
    const session = sessionOf(ctx);
    if (session === undefined) return users.firstAdmin().id;
    if (!session?.user) throw new HttpError(401, 'Entra con tu nombre para preparar un orden.');
    return session.user.id;
  };
  const orderName = (name, owner, except = null) => {
    const clean = cleanName(name, 60);
    if (!clean) throw new HttpError(400, 'Escribe un nombre para el orden.');
    if (data.saved.some((o) => o !== except && o.owner === owner && o.name.toLowerCase() === clean.toLowerCase())) {
      throw new HttpError(409, `Ya hay otro orden «${clean}» de ${users.get(owner)?.name || 'esa persona'}.`);
    }
    return clean;
  };
  const cleanDay = (date) => {
    const day = String(date);
    if (!validDay(day)) throw new HttpError(400, 'Esa fecha no es válida.');
    return day;
  };
  // Sin nombre, el de quien lo crea y el día («Orden Ana 25 de oct.»). Con nada en uso, el nuevo pasa a ser el de la cola.
  const create = (owner, { name, date } = {}) => {
    if (data.saved.length >= data.limit) {
      throw new HttpError(409, `Ya hay ${data.limit} órdenes, el máximo de esta iglesia. Para crear otro, borra los antiguos que ya no se necesiten (los de otras personas los borra el administrador).`);
    }
    const day = date == null || date === '' ? dayOf() : cleanDay(date);
    const named = name != null && cleanName(name, 60);
    const created = {
      id: crypto.randomUUID(), owner, date: day, favorite: false, items: [], updated: Date.now(),
      name: named ? orderName(name, owner) : uniqueName(defaultName(ownerName({ owner }), dayOf()), data.saved.filter((o) => o.owner === owner).map((o) => o.name)),
    };
    data.saved.push(created);
    if (!inUse()) data.active = created.id;
    return created;
  };
  const openFor = (ctx, o) => {
    const user = sessionOf(ctx)?.user;
    if (user) data.editing[user.id] = o.id;
  };
  // El orden que cambia una edición: el que esa persona tiene abierto; si no tiene ninguno, uno nuevo con el nombre
  // del día. Lo que pide Manna mismo va al que está en uso (o a uno nuevo, que pasa a estarlo).
  const target = (ctx) => {
    if (sessionOf(ctx) === undefined) return inUse() || create(ownerOf(ctx));
    const o = editingOf(sessionOf(ctx)) || create(ownerOf(ctx));
    openFor(ctx, o);
    return o;
  };
  const describeItem = (kind, content) => {
    const described = app.kinds.get(kind)?.describe(content);
    return described && { id: crypto.randomUUID(), kind, title: described.title, subtitle: described.subtitle, steps: described.steps, data: described.data };
  };

  // Lo usa el módulo de proyección para avanzar por el orden.
  services.order = {
    has: (id) => items().some((i) => i.id === id),
    // Quita los elementos cuyo contenido ya no existe (tras «Limpiar multimedia temporales»), de todos los
    // órdenes. Las secciones quedan.
    prune() {
      let changed = false;
      for (const o of data.saved) {
        const kept = o.items.filter(exists);
        if (kept.length === o.items.length) continue;
        o.items = kept;
        changed = true;
      }
      if (changed) save();
    },
    // Los órdenes de un usuario que se quita pasan a otro (el administrador que lo quita), con otro nombre si choca (S52).
    reassign(from, to) {
      const theirs = data.saved.filter((o) => o.owner === from);
      for (const o of theirs) {
        o.name = uniqueName(o.name, data.saved.filter((x) => x.owner === to).map((x) => x.name));
        o.owner = to;
        o.updated = Date.now();
      }
      delete data.editing[from];
      if (theirs.length) save();
    },
    // La sincronización con la nube (fase 37, parte 4; core/sync.js). Lo que está en uso y lo que cada uno tiene
    // abierto es de cada lado y no viaja.
    sync: {
      export: () => ({ records: structuredClone(data.saved), deleted: [...data.deleted] }),
      apply({ records, deleted }, conflicts = []) {
        data.saved = records.filter((o) => typeof o.id === 'string' && typeof o.name === 'string' && Array.isArray(o.items));
        data.deleted = deleted;
        if (!find(data.active)) data.active = null;
        for (const [user, open] of Object.entries(data.editing)) if (!find(open)) delete data.editing[user];
        const at = Date.now();
        for (const c of conflicts) {
          const o = find(c.id);
          if (o) data.conflicts = [...data.conflicts.filter((x) => x.id !== c.id), { id: c.id, name: o.name, owner: o.owner, at, where: c.where }].slice(-20);
        }
        save();
      },
    },
    neighbor(id, step, delta) {
      const target = neighbor(items(), id, step, delta);
      const item = target && items().find((i) => i.id === target.id);
      return item ? { kind: item.kind, data: item.data, step: target.step, orderId: item.id } : null;
    },
  };

  // ---- Lo de dentro de un orden: va al que esa persona tiene abierto ----
  app.action('order.add', { permission: 'order.edit' }, ({ kind, data: content }, ctx) => {
    const item = describeItem(kind, content);
    if (!item) throw new HttpError(404, 'Ese contenido no existe o ya no está disponible.');
    const o = target(ctx);
    update(o, [...o.items, item]);
    return item;
  });

  // Varios de una vez (las citas de un texto o documento, fase 27): bajo una sección nueva ({ title }), al final de una
  // que ya existe ({ id }) o al final del orden. Se comprueban todos antes de añadir ninguno.
  app.action('order.addMany', { permission: 'order.edit' }, ({ items: list, section } = {}, ctx) => {
    if (!Array.isArray(list) || !list.length || list.length > 500) throw new HttpError(400, 'No hay nada que añadir.');
    const added = list.map(({ kind, data: content } = {}) => {
      const item = describeItem(kind, content);
      if (!item) throw new HttpError(404, 'Alguno de esos contenidos no existe o ya no está disponible.');
      return item;
    });
    const o = target(ctx);
    const next = [...o.items];
    if (section?.title != null) next.push({ id: crypto.randomUUID(), kind: 'section', title: cleanName(section.title, 60) || 'Sección' }, ...added);
    else if (section?.id) {
      const at = next.findIndex((i) => i.id === section.id && i.kind === 'section');
      if (at < 0) throw new HttpError(404, 'Esa sección ya no está en el orden.');
      const after = next.findIndex((i, k) => k > at && i.kind === 'section');
      next.splice(after < 0 ? next.length : after, 0, ...added);
    } else next.push(...added);
    update(o, next);
    return { added: added.length };
  });

  app.action('order.addSection', { permission: 'order.edit' }, ({ title }, ctx) => {
    const item = { id: crypto.randomUUID(), kind: 'section', title: cleanName(title, 60) || 'Sección' };
    const o = target(ctx);
    update(o, [...o.items, item]);
    return item;
  });

  // Cualquier elemento puede llevar un nombre propio ("Lectura bíblica", "Video de bienvenida").
  // Sin nombre, vuelve al que le da su contenido.
  app.action('order.rename', { permission: 'order.edit' }, ({ id, title }, ctx) => {
    const o = target(ctx);
    itemOf(o, id);
    update(o, o.items.map((i) => (i.id === id ? renameItem(i, title, app.kinds.get(i.kind)?.describe(i.data)?.title) : i)));
    return itemOf(o, id);
  });

  app.action('order.remove', { permission: 'order.edit' }, ({ id }, ctx) => {
    const o = target(ctx);
    update(o, o.items.filter((i) => i.id !== id));
  });

  app.action('order.move', { permission: 'order.edit' }, ({ id, toIndex }, ctx) => {
    const o = target(ctx);
    update(o, moveItem(o.items, id, Number(toIndex)));
  });

  app.action('order.clear', { permission: 'order.edit' }, (_, ctx) => {
    const o = target(ctx);
    update(o, []);
  });

  // ---- Los órdenes (fase 35): de su dueño y del administrador ----
  app.action('order.create', { permission: 'order.edit' }, ({ name, date } = {}, ctx) => {
    const o = create(ownerOf(ctx), { name, date });
    openFor(ctx, o);
    save();
    return { id: o.id, name: o.name, left: data.limit - data.saved.length };
  });
  // Abre un orden en el cajón de quien lo pide (solo en el suyo): lo que añada va ahí.
  app.action('order.open', { permission: 'order.edit' }, ({ id }, ctx) => {
    openFor(ctx, visible(id, ctx));
    save();
  });
  // Lo pone en uso: es el que ven todos en la cola del culto. Lo que ya no está en la biblioteca se quita.
  app.action('order.use', { permission: 'order.edit' }, ({ id }, ctx) => {
    const o = visible(id, ctx);
    // En la nube no se quita nada: lo que no conoce (las imágenes y los videos de la iglesia) sí existe allí.
    const kept = app.cloud ? o.items : o.items.filter(exists);
    const removed = o.items.length - kept.length;
    o.items = kept;
    data.active = o.id;
    openFor(ctx, o);
    save();
    return { removed };
  });
  app.action('order.renameOrder', { permission: 'order.edit' }, ({ id, name, date }, ctx) => {
    const o = visible(id, ctx);
    const next = { name: name === undefined ? o.name : orderName(name, o.owner, o), date: date === undefined ? o.date : cleanDay(date) };
    Object.assign(o, next, { updated: Date.now() });
    save();
  });
  // Favoritos: los órdenes que se repiten, en su pestaña del cajón (fase 35).
  app.action('order.favorite', { permission: 'order.edit' }, ({ id, on }, ctx) => {
    Object.assign(visible(id, ctx), { favorite: on === true, updated: Date.now() });
    save();
  });
  // Cerrar el aviso de un orden cambiado en los dos lados (decisión 63, C).
  app.action('order.dismissConflict', { permission: 'order.edit' }, ({ id }) => {
    data.conflicts = data.conflicts.filter((c) => c.id !== id);
    save();
  });
  app.action('order.deleteOrder', { permission: 'order.edit' }, ({ id }, ctx) => {
    visible(id, ctx);
    data.saved = data.saved.filter((o) => o.id !== id);
    data.deleted.push({ id, at: Date.now() });
    if (data.active === id) data.active = null;
    for (const [user, open] of Object.entries(data.editing)) if (open === id) delete data.editing[user];
    save();
  });

  // Proyecta un elemento del orden. Sin step, empieza por su primer paso.
  // step null (explícito) = el elemento entero en una sola pantalla.
  app.action('order.show', { permission: 'projection.control' }, ({ id, step = 0 }) => {
    const item = itemOf(inUse(), id);
    if (item.kind === 'section') throw new HttpError(400, 'Una sección no se proyecta.');
    return services.projection.present({ kind: item.kind, data: item.data, step: Number.isInteger(step) ? step : null, orderId: id });
  });

  // Los pasos de un elemento (del orden en uso o del que tiene abierto quien pide), ya resueltos, para dibujar sus
  // miniaturas.
  app.route('GET', '/api/order/:id/steps', ({ params, session }) => {
    const item = [inUse(), editingOf(session ?? null)].flatMap((o) => o?.items || []).find((i) => i.id === params.id);
    if (!item) throw new HttpError(404, 'Ese elemento ya no está en el orden del culto.');
    const kind = app.kinds.get(item.kind);
    const steps = [];
    for (let i = 0; i < Math.min(item.steps || 0, MAX_STEPS_SHOWN); i += 1) {
      const content = kind?.resolve(item.data, i);
      if (content) steps.push({ kind: item.kind, ...content });
    }
    return { steps, whole: item.steps > 1 ? { kind: item.kind, ...kind?.resolve(item.data, null) } : null };
  });
}
