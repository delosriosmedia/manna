// Lógica pura del orden del culto. Un elemento es:
//   { id, kind, title, subtitle, steps, data }   contenido proyectable de cualquier módulo
//   { id, kind: 'section', title }               separador ("Apertura", "Mensaje"); no se proyecta

const isContent = (item) => item.kind !== 'section' && item.steps > 0;

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
