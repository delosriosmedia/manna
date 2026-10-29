import crypto from 'node:crypto';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';
import { MAX_AUTHOR, MAX_TEXT, STYLES, cleanLook, cleanText, splitParts, titleOf } from './text.js';

// Módulo Textos (fase 18 de docs/PLAN.md): mensajes y citas para proyectar, guardados para volver a usarlos.
// Ficha de cada uno (data/textos.json): { id, style: 'normal' | 'quote' | 'fixed', text, author, look, added, updated }.
// Una línea en blanco parte el texto en pantallas (pasos); la cita lleva su autor debajo. El texto fijo (tipo `fixed`)
// va solo en una capa, con su aspecto (`look`); no se proyecta ni va al orden.

const MAX_TEXTS = 500;

export default function setup(app) {
  const { store } = app;
  const saved = app.storage('textos', { texts: [] });
  // Lo borrado, con su hora, para que la nube no lo vuelva a traer (fase 37).
  saved.data.deleted ||= [];

  // Los más recientes (o recién cambiados), primero.
  const publish = () => store.set('texts', { list: [...saved.data.texts].sort((a, b) => b.updated - a.updated) });
  store.register('texts', { list: [] });
  publish();
  const commit = () => {
    saved.save();
    publish();
    // Si lo que cambió está al aire, las pantallas lo reciben.
    app.services.projection?.refresh();
  };
  const find = (id) => saved.data.texts.find((t) => t.id === id) || null;

  // Crea uno (sin id) o cambia el que se diga. Devuelve su id.
  app.action('texts.save', { permission: 'texts.edit' }, ({ id, style, text, author, look }) => {
    const clean = cleanText(text);
    if (!clean) throw new HttpError(400, 'Escribe el texto que quieres proyectar.');
    if (clean.length > MAX_TEXT) throw new HttpError(400, `El texto es demasiado largo (${MAX_TEXT} letras como mucho). Pártelo en dos.`);
    if (!STYLES.includes(style)) throw new HttpError(400, 'Elige si es un texto, una cita o un texto fijo.');
    const fields = { style, text: clean, author: style === 'quote' ? cleanName(author, MAX_AUTHOR) : '', look: style === 'fixed' ? cleanLook(look) : undefined, updated: Date.now() };
    if (id) {
      const existing = find(id);
      if (!existing) throw new HttpError(404, 'Ese texto ya no existe.');
      Object.assign(existing, fields);
      commit();
      return { id };
    }
    if (saved.data.texts.length >= MAX_TEXTS) throw new HttpError(409, `Ya hay ${MAX_TEXTS} textos guardados. Elimina alguno que no uses.`);
    const created = { id: crypto.randomBytes(5).toString('hex'), ...fields, added: fields.updated };
    saved.data.texts.push(created);
    commit();
    return { id: created.id };
  });

  app.action('texts.remove', { permission: 'texts.edit' }, ({ id }) => {
    if (!find(id)) throw new HttpError(404, 'Ese texto ya no existe.');
    saved.data.texts = saved.data.texts.filter((t) => t.id !== id);
    saved.data.deleted.push({ id, at: Date.now() });
    commit();
  });

  // La sincronización con la nube (fase 37, parte 4; core/sync.js): lo que hay y lo borrado, y ponerlo como quedó.
  app.services.texts = {
    sync: {
      export: () => ({ records: structuredClone(saved.data.texts), deleted: [...saved.data.deleted] }),
      apply({ records, deleted }) {
        saved.data.texts = records.filter((t) => typeof t.id === 'string' && typeof t.text === 'string');
        saved.data.deleted = deleted;
        commit();
      },
    },
  };

  // ---- Tipo de contenido ----
  // data = { id }. Cada parte es un paso; el elemento entero se ve de una vez (si cabe, se reduce la letra).
  app.kind('text', {
    label: 'Texto',
    describe(data) {
      const t = find(data?.id);
      if (!t || t.style === 'fixed') return null;
      return { title: titleOf(t.text), subtitle: t.style === 'quote' ? `Cita${t.author ? ` · ${t.author}` : ''}` : 'Texto', steps: splitParts(t.text).length, data: { id: t.id } };
    },
    resolve(data, step) {
      const t = find(data?.id);
      if (!t || t.style === 'fixed') return null;
      const parts = splitParts(t.text);
      const i = Number.isInteger(step) ? Math.max(0, Math.min(parts.length - 1, step)) : null;
      return {
        id: t.id, style: t.style, author: t.author, title: titleOf(t.text),
        text: i == null ? parts.join('\n\n') : parts[i], part: i == null ? null : i + 1, parts: parts.length,
      };
    },
    neighbor(data, step, delta) {
      const t = find(data?.id);
      const target = (Number.isInteger(step) ? step : 0) + delta;
      return t && target >= 0 && target < splitParts(t.text).length ? { data: { id: t.id }, step: target } : null;
    },
  });

  // El texto fijo: solo en una capa (`onlyLayer`: ni se proyecta ni va al orden). data = { id }.
  const fixed = (data) => { const t = find(data?.id); return t?.style === 'fixed' ? t : null; };
  app.kind('fixed', {
    label: 'Texto fijo',
    layer: true,
    onlyLayer: true,
    describe(data) {
      const t = fixed(data);
      return t && { title: titleOf(t.text), subtitle: 'Texto fijo', steps: 1, data: { id: t.id } };
    },
    resolve(data) {
      const t = fixed(data);
      return t && { id: t.id, title: titleOf(t.text), text: t.text, look: cleanLook(t.look) };
    },
  });
}
