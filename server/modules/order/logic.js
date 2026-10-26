// Lógica pura del orden del culto. Un elemento es:
//   { id, kind, title, subtitle, steps, data }   contenido proyectable de cualquier módulo
//   { id, kind: 'section', title }               separador ("Apertura", "Mensaje"); no se proyecta
// Si el dueño le puso un nombre propio, lleva además `original`: el título que le da su contenido.
import { cleanName } from '../../core/names.js';

const isContent = (item) => item.kind !== 'section' && item.steps > 0;

// La fecha de un orden (fase 35) es el día del culto, «AAAA-MM-DD» con la hora del equipo principal.
const two = (n) => String(n).padStart(2, '0');
export const dayOf = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};
export const validDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && dayOf(new Date(`${day}T12:00`).getTime()) === day;

// El nombre que se propone para un orden (decisión 64): «Orden Ana 25 de oct.», con quien lo crea y el día en que lo crea.
const MONTHS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];
export function defaultName(owner, day) {
  const d = new Date(`${day}T12:00`);
  return `Orden ${owner} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

// base, o «base (2)», «base (3)»… si ya está entre names (sin contar mayúsculas).
export function uniqueName(base, names) {
  const taken = new Set(names.map((n) => n.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${base} (${n})`;
  return name;
}

// Mueve un elemento a otra posición. Devuelve una lista nueva (o la misma si no hay cambio).
export function moveItem(items, id, toIndex) {
  const from = items.findIndex((i) => i.id === id);
  const to = Math.max(0, Math.min(items.length - 1, Math.trunc(toIndex)));
  if (from < 0 || !Number.isFinite(to) || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Qué se proyecta al pulsar anterior (delta -1) o siguiente (delta 1) desde el elemento id
// en el paso step (null = se estaba mostrando el elemento entero).
// Primero recorre los pasos del elemento; al agotarlos pasa al elemento vecino, saltando
// las secciones. Devuelve { id, step } o null si no hay más.
export function neighbor(items, id, step, delta) {
  const index = items.findIndex((i) => i.id === id);
  if (index < 0) return null;
  const current = items[index];
  if (step != null) {
    const inside = step + delta;
    if (inside >= 0 && inside < current.steps) return { id, step: inside };
  }
  for (let i = index + delta; i >= 0 && i < items.length; i += delta) {
    if (isContent(items[i])) return { id: items[i].id, step: delta > 0 ? 0 : items[i].steps - 1 };
  }
  return null;
}


// Cambia el nombre de un elemento. described: el título que le da su contenido hoy (si aún existe).
// Un nombre vacío, o igual al de su contenido, devuelve el elemento a su nombre original.
export function renameItem(item, title, described) {
  if (item.kind === 'section') return { ...item, title: cleanName(title, 60) || item.title };
  const original = item.original || described || item.title;
  const name = cleanName(title, 120);
  const { original: _dropped, ...rest } = item;
  return !name || name === original ? { ...rest, title: original } : { ...rest, title: name, original };
}

// Convierte el guion de versiones anteriores (data/guion.json) al formato actual.
export function migrateLegacy(legacyItems, describe) {
  return (legacyItems || []).filter((old) => old?.ref && old.versionId).map((old) => {
    const data = { versionId: old.versionId, ref: old.ref };
    const fresh = describe(data);
    return {
      id: old.id,
      kind: 'verses',
      title: fresh?.title || old.reference || 'Pasaje',
      subtitle: fresh?.subtitle || old.version || '',
      steps: fresh?.steps || Math.max(1, (old.ref.verseEnd || old.ref.verseStart) - old.ref.verseStart + 1),
      data: fresh?.data || data,
    };
  });
}
