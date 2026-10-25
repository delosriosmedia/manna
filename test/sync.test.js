import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSets, setVersion } from '../server/core/sync.js';

const r = (id, updated, extra = {}) => ({ id, updated, ...extra });

test('juntar: de cada uno gana el cambio más reciente, y entra lo que solo tiene un lado', () => {
  const { records, conflicts } = mergeSets({ records: [r('a', 10, { name: 'A viejo' }), r('b', 5)], deleted: [] }, { records: [r('a', 20, { name: 'A nuevo' }), r('c', 7)], deleted: [] });
  assert.deepEqual(records.map((x) => [x.id, x.name ?? null]).sort(), [['a', 'A nuevo'], ['b', null], ['c', null]]);
  assert.deepEqual(conflicts, [], 'sin «since», nada se dio por acordado antes: no es un conflicto');
});

test('juntar: lo borrado después de su último cambio no vuelve; lo cambiado después de borrarlo, sí', () => {
  const now = 1_000_000;
  const { records, deleted } = mergeSets({ records: [r('a', 10), r('b', 50)], deleted: [] }, { records: [], deleted: [{ id: 'a', at: 30 }, { id: 'b', at: 30 }] }, { now });
  assert.deepEqual(records.map((x) => x.id), ['b']);
  assert.deepEqual(deleted.map((d) => d.id).sort(), ['a', 'b'], 'la marca se recuerda en los dos lados');
  assert.deepEqual(mergeSets({ records: [], deleted: [{ id: 'z', at: 1 }] }, { records: [], deleted: [] }, { now: 200 * 86_400_000 }).deleted, [], 'las marcas viejas se olvidan');
});

test('juntar: cambiado en los dos lados después de ponerse de acuerdo es un conflicto, y gana el último', () => {
  const { records, conflicts } = mergeSets({ records: [r('a', 120, { name: 'en la iglesia' })], deleted: [] }, { records: [r('a', 150, { name: 'en la nube' })], deleted: [] }, { since: 100 });
  assert.equal(records[0].name, 'en la nube');
  assert.deepEqual(conflicts, [{ id: 'a', kept: 'theirs', at: 150 }]);
  assert.deepEqual(mergeSets({ records: [r('a', 120)], deleted: [] }, { records: [r('a', 90)], deleted: [] }, { since: 100 }).conflicts, [], 'si solo un lado lo cambió, no lo es');
});

test('la huella no depende del orden', () => {
  assert.equal(setVersion({ x: { records: [r('a', 1), r('b', 2)], deleted: [] } }), setVersion({ x: { records: [r('b', 2), r('a', 1)], deleted: [] } }));
  assert.notEqual(setVersion({ x: { records: [r('a', 1)], deleted: [] } }), setVersion({ x: { records: [r('a', 2)], deleted: [] } }));
});
