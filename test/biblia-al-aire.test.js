import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import bible from '../server/modules/bible/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';

// Fase 24: cambiar la versión de un pasaje que está al aire (projection.swap) sin salir del orden del culto.
// Versiones con textos inventados; a «Corta» le falta el versículo 18.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-biblia-aire-'));
const bibles = path.join(tmp, 'biblias');
fs.mkdirSync(bibles);
const write = (file, verses) => fs.writeFileSync(path.join(bibles, file), `<bible><b n="Juan"><c n="3">${verses.map((n) => `<v n="${n}">Texto ${file} ${n}.</v>`).join('')}</c><c n="4"><v n="1">Siguiente ${file}.</v></c></b></bible>`);
write('Antigua.xmm', [16, 17, 18]);
write('Moderna.xmm', [16, 17, 18]);
write('Corta.xmm', [16, 17]);

const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, 'datos'), biblesDir: bibles });
for (const setup of [system, bible, projection, order]) await setup(app);
test.after(async () => {
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

const run = (type, payload) => app.run(type, payload);
const fail = async (type, payload) => {
  try { await run(type, payload); } catch (err) { return err.status; }
  return 200;
};
const onAir = () => app.store.get('projection').item;
const ref = (a, b = a) => ({ book: 43, chapter: 3, verseStart: a, verseEnd: b });
const verses = (versionId, r) => ({ kind: 'verses', data: { versionId, ref: r } });

test('cambiar la versión de algo del orden no lo saca del orden: «Siguiente» sigue por él, en esa versión', async () => {
  const first = await run('order.add', verses('antigua', ref(16, 18)));
  const second = await run('order.add', verses('antigua', { book: 43, chapter: 4, verseStart: 1, verseEnd: 1 }));
  await run('order.show', { id: first.id, step: 1 });

  await run('projection.swap', verses('moderna', ref(16, 18)));
  let item = onAir();
  assert.deepEqual([item.versionId, item.verses[0].n, item.source.orderId, item.source.step], ['moderna', 17, first.id, 1]);
  // El elemento del orden no se toca.
  assert.equal(app.store.get('order').items[0].data.versionId, 'antigua');

  await run('projection.step', { delta: 1 });
  item = onAir();
  assert.deepEqual([item.versionId, item.verses[0].n, item.source.orderId, item.source.step], ['moderna', 18, first.id, 2]);
  await run('projection.step', { delta: -1 });
  assert.equal(onAir().versionId, 'moderna', 'también hacia atrás');

  // Una comparación se conserva con sus pasos, y su disposición al aire pasa a la nueva comparación.
  await run('projection.swap', { kind: 'compare', data: { versions: ['moderna', 'antigua'], ref: ref(16, 18), layout: 'columns' } });
  await run('projection.control', { layout: 'rows' });
  await run('projection.swap', { kind: 'compare', data: { versions: ['moderna', 'corta'], ref: ref(16, 18), layout: 'columns' } });
  assert.deepEqual([onAir().kind, onAir().source.orderId, onAir().source.step, app.store.get('live').state.layout], ['compare', first.id, 1, 'rows']);
  await run('projection.step', { delta: 1 });
  assert.deepEqual([onAir().kind, onAir().source.step], ['compare', 2]);

  // Al pasar al elemento siguiente del orden vale el contenido de ese elemento.
  await run('projection.step', { delta: 1 });
  item = onAir();
  assert.deepEqual([item.kind, item.versionId, item.source.orderId], ['verses', 'antigua', second.id]);
  await run('order.clear');
  await run('projection.clear');
});

test('fuera del orden, el cambio de versión no inventa un sitio y «Siguiente» sigue leyendo en la versión nueva', async () => {
  await run('projection.show', verses('antigua', ref(16)));
  await run('projection.swap', verses('moderna', ref(16)));
  assert.deepEqual([onAir().versionId, onAir().source.orderId], ['moderna', null]);
  await run('projection.step', { delta: 1 });
  assert.deepEqual([onAir().versionId, onAir().verses[0].n], ['moderna', 17]);
  await run('projection.clear');
});

test('projection.swap valida lo que recibe y, si falla, deja lo que estaba al aire', async () => {
  assert.equal(await fail('projection.swap', verses('moderna', ref(16))), 409, 'nada al aire');
  const shown = await run('projection.show', verses('antigua', ref(18)));
  for (const bad of [{}, { kind: 5, data: {} }, { kind: 'verses' }, { kind: 'verses', data: [] }]) assert.equal(await fail('projection.swap', bad), 400, JSON.stringify(bad));
  assert.equal(await fail('projection.swap', { kind: 'inventado', data: {} }), 404);
  assert.equal(await fail('projection.swap', verses('no-existe', ref(18))), 404);
  assert.equal(await fail('projection.swap', verses('corta', ref(18))), 404, 'a esa versión le falta el versículo');
  assert.equal(onAir().uid, shown.uid);
  await run('projection.clear');
});
