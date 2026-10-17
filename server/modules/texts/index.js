import crypto from 'node:crypto';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';
import { MAX_AUTHOR, MAX_TEXT, STYLES, cleanText, splitParts, titleOf } from './text.js';

// Módulo Textos (fase 18 de docs/PLAN.md): mensajes y citas para proyectar, guardados para volver a usarlos.
// Ficha de cada uno (data/textos.json): { id, style: 'normal' | 'quote', text, author, added, updated }.
// Una línea en blanco parte el texto en pantallas (pasos); la cita lleva su autor debajo.

const MAX_TEXTS = 500;

export default function setup(app) {
  const { store } = app;
  const saved = app.storage('textos', { texts: [] });

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
  app.action('texts.save', { permission: 'texts.edit' }, ({ id, style, text, author }) => {
    const clean = cleanText(text);
    if (!clean) throw new HttpError(400, 'Escribe el texto que quieres proyectar.');
    if (clean.length > MAX_TEXT) throw new HttpError(400, `El texto es demasiado largo (${MAX_TEXT} letras como mucho). Pártelo en dos.`);
    if (!STYLES.includes(style)) throw new HttpError(400, 'Elige si es un texto o una cita.');
    const fields = { style, text: clean, author: style === 'quote' ? cleanName(author, MAX_AUTHOR) : '', updated: Date.now() };
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
    commit();
  });

  // ---- Tipo de contenido ----
  // data = { id }. Cada parte es un paso; el elemento entero se ve de una vez (si cabe, se reduce la letra).
  app.kind('text', {
    label: 'Texto',
    describe(data) {
      const t = find(data?.id);
      if (!t) return null;
      return { title: titleOf(t.text), subtitle: t.style === 'quote' ? `Cita${t.author ? ` · ${t.author}` : ''}` : 'Texto', steps: splitParts(t.text).length, data: { id: t.id } };
    },
    resolve(data, step) {
      const t = find(data?.id);
      if (!t) return null;
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
}
