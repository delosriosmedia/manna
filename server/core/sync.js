import crypto from 'node:crypto';

// Juntar dos versiones de lo mismo, la del equipo de la iglesia y la de su nube (fase 37, parte 4; decisión 63, C).
// Un conjunto es { records: [{ id, updated, … }], deleted: [{ id, at }] }: lo que hay, con la hora de su último
// cambio, y lo borrado, con la hora en que se borró (para que el otro lado no lo vuelva a traer). De cada uno gana el
// cambio más reciente; lo borrado después de su último cambio no vuelve. since: la última vez que los dos lados se
// pusieron de acuerdo; si los dos lo cambiaron después, es un conflicto: gana el más reciente igual, y se dice.

const DELETED_MS = 90 * 86_400_000; // lo borrado se recuerda tres meses
const DELETED_MAX = 500;

export function mergeSets(mine, theirs, { since = 0, now = Date.now() } = {}) {
  const gone = new Map();
  for (const d of [...(mine?.deleted || []), ...(theirs?.deleted || [])]) {
    if (d && typeof d.id === 'string' && Number.isFinite(d.at)) gone.set(d.id, Math.max(gone.get(d.id) || 0, d.at));
  }
  const kept = new Map();
  const conflicts = [];
  const other = new Map((theirs?.records || []).map((r) => [r.id, r]));
  for (const r of [...(mine?.records || []), ...(theirs?.records || [])]) {
    if (!r || typeof r.id !== 'string') continue;
    const before = kept.get(r.id);
    if (!before || (Number(r.updated) || 0) > (Number(before.updated) || 0)) kept.set(r.id, r);
  }
  for (const r of mine?.records || []) {
    const t = other.get(r.id);
    if (t && since > 0 && r.updated > since && t.updated > since && r.updated !== t.updated && !(gone.get(r.id) >= Math.max(r.updated, t.updated))) {
      const winner = kept.get(r.id);
      conflicts.push({ id: r.id, kept: winner === r ? 'mine' : 'theirs', at: winner.updated });
    }
  }
  const records = [...kept.values()].filter((r) => !(gone.get(r.id) >= (Number(r.updated) || 0)));
  const deleted = [...gone].map(([id, at]) => ({ id, at })).filter((d) => now - d.at < DELETED_MS).sort((a, b) => b.at - a.at).slice(0, DELETED_MAX);
  return { records, deleted, conflicts };
}

// La huella de unos conjuntos: igual si tienen lo mismo, en el orden que sea (también el de las claves de cada ficha).
const stable = (value) => (Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])])) : value);
export function setVersion(sets) {
  const sorted = Object.fromEntries(Object.entries(sets).sort(([a], [b]) => a.localeCompare(b)).map(([name, set]) => [name, {
    records: [...(set.records || [])].sort((a, b) => a.id.localeCompare(b.id)),
    deleted: [...(set.deleted || [])].sort((a, b) => a.id.localeCompare(b.id)),
  }]));
  return crypto.createHash('sha256').update(JSON.stringify(stable(sorted))).digest('hex').slice(0, 16);
}
