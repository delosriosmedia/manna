import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacy, moveItem, neighbor } from '../server/modules/order/logic.js';

const items = [
  { id: 's1', kind: 'section', title: 'Apertura' },
  { id: 'a', kind: 'verses', title: 'Salmos 100:1-3', steps: 3 },
  { id: 's2', kind: 'section', title: 'Mensaje' },
  { id: 'b', kind: 'verses', title: 'Juan 3:16', steps: 1 },
  { id: 'c', kind: 'verses', title: 'Romanos 8:28-29', steps: 2 },
];

test('neighbor recorre los pasos de un elemento antes de pasar al siguiente', () => {
  assert.deepEqual(neighbor(items, 'a', 0, 1), { id: 'a', step: 1 });
  assert.deepEqual(neighbor(items, 'a', 2, -1), { id: 'a', step: 1 });
  assert.deepEqual(neighbor(items, 'a', 2, 1), { id: 'b', step: 0 });
});

test('neighbor salta las secciones y entra por el último paso al retroceder', () => {
  assert.deepEqual(neighbor(items, 'b', 0, -1), { id: 'a', step: 2 });
  assert.deepEqual(neighbor(items, 'b', 0, 1), { id: 'c', step: 0 });
  assert.deepEqual(neighbor(items, 'c', 0, -1), { id: 'b', step: 0 });
});

test('neighbor se detiene en los extremos y con elementos que ya no existen', () => {
  assert.equal(neighbor(items, 'a', 0, -1), null);
  assert.equal(neighbor(items, 'c', 1, 1), null);
  assert.equal(neighbor(items, 'x', 0, 1), null);
});

test('neighbor, con el elemento entero en pantalla, pasa directamente al vecino', () => {
  assert.deepEqual(neighbor(items, 'a', null, 1), { id: 'b', step: 0 });
  assert.deepEqual(neighbor(items, 'c', null, -1), { id: 'b', step: 0 });
});

test('moveItem reordena sin modificar la lista original', () => {
  const moved = moveItem(items, 'c', 1);
  assert.deepEqual(moved.map((i) => i.id), ['s1', 'c', 'a', 's2', 'b']);
  assert.deepEqual(items.map((i) => i.id), ['s1', 'a', 's2', 'b', 'c']);
  assert.deepEqual(moveItem(items, 'a', 99).map((i) => i.id), ['s1', 's2', 'b', 'c', 'a']);
  assert.equal(moveItem(items, 'x', 0), items);
  assert.equal(moveItem(items, 'a', 1), items);
});

test('migrateLegacy convierte el guion antiguo y tolera versiones que ya no están', () => {
  const ref = { book: 43, chapter: 3, verseStart: 16, verseEnd: 17 };
  const legacy = [
    { id: '1', versionId: 'rv', version: 'RV1909', ref, reference: 'Juan 3:16-17', preview: '…' },
    { id: '2', versionId: 'borrada', version: 'XYZ', ref, reference: 'Juan 3:16-17' },
    { id: '3' },
  ];
  const describe = (data) => (data.versionId === 'rv' ? { title: 'Juan 3:16-17', subtitle: 'Reina-Valera 1909', steps: 2, data } : null);
  const out = migrateLegacy(legacy, describe);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: '1', kind: 'verses', title: 'Juan 3:16-17', subtitle: 'Reina-Valera 1909', steps: 2, data: { versionId: 'rv', ref } });
  assert.deepEqual([out[1].title, out[1].subtitle, out[1].steps], ['Juan 3:16-17', 'XYZ', 2]);
  assert.deepEqual(migrateLegacy(undefined, describe), []);
});
