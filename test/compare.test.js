import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BibleLibrary } from '../server/modules/bible/library.js';
import { registerCompare } from '../server/modules/bible/compare.js';

// Dos versiones de prueba con textos inventados. A la segunda le falta el versículo 18.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-test-comparar-'));
const bible = (verses) => `<bible><b n="Juan"><c n="3">${verses.map(([n, text]) => `<v n="${n}">${text}</v>`).join('')}</c><c n="4"><v n="1">Capítulo siguiente.</v></c></b></bible>`;
fs.writeFileSync(path.join(dir, 'Antigua.xmm'), bible([[16, 'Texto antiguo dieciséis.'], [17, 'Texto antiguo diecisiete.'], [18, 'Texto antiguo dieciocho.']]));
fs.writeFileSync(path.join(dir, 'Moderna.xmm'), bible([[16, 'Texto moderno dieciséis.'], [17, 'Texto moderno diecisiete.']]));
const library = new BibleLibrary(dir);
library.scan();
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

// El tipo se registra en un "app" mínimo: solo hace falta recoger la definición.
let kind;
registerCompare({ kind(name, def) { kind = def; } }, library);
const at = (a, b = a) => ({ book: 43, chapter: 3, verseStart: a, verseEnd: b });
const data = (ref, extra = {}) => ({ versions: ['antigua', 'moderna'], ref, ...extra });

test('describe da el pasaje, las dos versiones y un paso por versículo', () => {
  assert.deepEqual(kind.describe(data(at(16, 17), { layout: 'rows' })), {
    title: 'Juan 3:16-17',
    subtitle: 'Antigua · Moderna',
    steps: 2,
    data: { versions: ['antigua', 'moderna'], ref: at(16, 17), layout: 'rows' },
  });
  // Una disposición desconocida se queda en la habitual.
  assert.equal(kind.describe(data(at(16), { layout: 'diagonal' })).data.layout, 'columns');
});

test('no hay comparación si falta una versión, son la misma o el pasaje no existe', () => {
  assert.equal(kind.describe({ versions: ['antigua', 'no-existe'], ref: at(16) }), null);
  assert.equal(kind.describe({ versions: ['antigua', 'antigua'], ref: at(16) }), null);
  assert.equal(kind.describe({ versions: ['antigua'], ref: at(16) }), null);
  assert.equal(kind.describe(data(at(99))), null);
  assert.equal(kind.describe(undefined), null);
  assert.equal(kind.resolve(data(at(16)), 5), null);
});

test('resolve entrega el texto de las dos versiones, entero o paso a paso', () => {
  const whole = kind.resolve(data(at(16, 17)), null);
  assert.equal(whole.reference, 'Juan 3:16-17');
  assert.deepEqual(whole.sides.map((s) => [s.versionId, s.version, s.verses.map((v) => v.n)]), [['antigua', 'Antigua', [16, 17]], ['moderna', 'Moderna', [16, 17]]]);

  const second = kind.resolve(data(at(16, 17)), 1);
  assert.equal(second.reference, 'Juan 3:17');
  assert.deepEqual(second.sides.map((s) => s.verses[0].text), ['Texto antiguo diecisiete.', 'Texto moderno diecisiete.']);
});

test('si a la segunda versión le falta un versículo, su lado va vacío', () => {
  const missing = kind.resolve(data(at(18)), null);
  assert.deepEqual(missing.sides.map((s) => s.verses.length), [1, 0]);
  // En un rango, solo faltan los que faltan: nunca se rellena con versículos de fuera.
  const range = kind.resolve(data(at(17, 18)), null);
  assert.deepEqual(range.sides.map((s) => s.verses.map((v) => v.n)), [[17, 18], [17]]);
});

test('"siguiente" sigue leyendo en las dos versiones, también al cambiar de capítulo', () => {
  const next = kind.neighbor(data(at(16)), null, 1);
  assert.deepEqual(next, { data: data(at(17)), step: null });
  assert.deepEqual(kind.neighbor(data(at(18)), null, 1).data.ref, { book: 43, chapter: 4, verseStart: 1, verseEnd: 1 });
  assert.equal(kind.neighbor(data(at(16)), null, -1), null);
});

test('la disposición es un mando en vivo, validado', () => {
  const content = kind.resolve(data(at(16), { layout: 'rows' }), null);
  assert.deepEqual(kind.live(content, null), { layout: 'rows' });
  // Tras un reinicio se conserva la que estaba puesta al aire.
  assert.deepEqual(kind.live(content, { state: { layout: 'columns' }, at: 0 }), { layout: 'columns' });
  assert.deepEqual(kind.live(content, { state: { layout: 'inventada' }, at: 0 }), { layout: 'rows' });
  assert.deepEqual(kind.control({ layout: 'rows' }, { layout: 'columns' }), { layout: 'columns' });
  assert.deepEqual(kind.control({ layout: 'rows' }, {}), { layout: 'rows' });
  assert.throws(() => kind.control({ layout: 'rows' }, { layout: 'diagonal' }), /no existe/);
});
