import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';

// Órdenes del culto guardados (fase 23 de docs/PLAN.md): solo se guarda el que tiene nombre; el sin nombre
// se vacía al cerrar Manna, salvo si se reinicia o vuelve a abrirse antes de 15 minutos tras un corte.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-ordenes-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

async function open(name, env = {}) {
  Object.assign(process.env, env);
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, projection, order]) await setup(app);
  for (const key of Object.keys(env)) delete process.env[key];
  const fail = async (type, payload) => {
    try { await app.run(type, payload); } catch (err) { return err.status; }
    return 200;
  };
  return { app, run: (type, payload) => app.run(type, payload), fail, order: () => app.store.get('order') };
}
const file = (name) => path.join(tmp, name, 'orden.json');
const card = { kind: 'testcard', data: {} };

test('el orden de antes pasa a ser un orden guardado, y esa vez sigue en uso', async () => {
  fs.mkdirSync(path.join(tmp, 'antes'), { recursive: true });
  fs.writeFileSync(file('antes'), JSON.stringify({ items: [{ id: 's', kind: 'section', title: 'Apertura' }] }));
  const m = await open('antes');
  const o = m.order();
  assert.deepEqual([o.name, o.items.length, o.saved.map((s) => [s.name, s.count]), o.draft], ['Orden del culto', 1, [['Orden del culto', 0]], 0]);
  assert.equal(o.active, o.saved[0].id);
  await m.app.close();
});

test('guardar con un nombre, usar otro, cambiar el nombre, duplicar y eliminar', async () => {
  const m = await open('guardar');
  assert.deepEqual([m.order().active, m.order().items, m.order().saved], [null, [], []], 'empieza con el sin nombre, vacío');
  await m.run('order.add', card);
  await m.run('order.addSection', { title: 'Mensaje' });
  assert.equal(m.order().draft, 1, 'cuenta los elementos, no las secciones');
  assert.equal(await m.fail('order.save', { name: '  ' }), 400);
  const { id: sabado } = await m.run('order.save', { name: 'Sábado 18/10/26 19:30' });
  assert.deepEqual([m.order().active, m.order().name, m.order().items.length, m.order().draft], [sabado, 'Sábado 18/10/26 19:30', 2, 0]);
  assert.equal(await m.fail('order.save', { name: 'Otro' }), 409, 'el que ya tiene nombre no se vuelve a guardar');
  // Los cambios quedan en el que está en uso.
  await m.run('order.add', card);
  assert.equal(m.order().saved[0].count, 2);

  await m.run('order.new');
  assert.deepEqual([m.order().active, m.order().items, m.order().saved.length], [null, [], 1]);
  await m.run('order.add', card);
  assert.equal(await m.fail('order.save', { name: 'sábado 18/10/26 19:30' }), 409, 'no dos con el mismo nombre');
  const { id: oracion } = await m.run('order.save', { name: 'Semana de oración' });

  assert.deepEqual(await m.run('order.use', { id: sabado }), { removed: 0 });
  assert.equal(m.order().items.length, 3);
  await m.run('order.renameOrder', { id: sabado, name: 'Culto del sábado' });
  assert.equal(m.order().name, 'Culto del sábado');
  const { id: copia } = await m.run('order.duplicate', { id: sabado, name: 'Culto del sábado (copia)' });
  const copied = m.app.store.get('order').saved.find((s) => s.id === copia);
  assert.deepEqual([copied.count, m.order().active], [2, sabado], 'la copia no se pone en uso');
  await m.run('order.use', { id: copia });
  assert.ok(m.order().items.every((i, k) => i.id !== undefined && k >= 0));

  await m.run('order.deleteOrder', { id: copia });
  assert.deepEqual([m.order().active, m.order().saved.map((s) => s.id)], [null, [sabado, oracion]], 'al borrar el que está en uso, pasa al sin nombre');
  assert.equal(await m.fail('order.use', { id: copia }), 404);
  await m.run('order.use', {});
  await m.run('order.add', card);
  await m.app.close();
});

test('el orden sin nombre se vacía al cerrar Manna, salvo en un reinicio o tras un corte de menos de 15 minutos', async () => {
  const m = await open('cerrar');
  await m.run('order.add', card);
  await m.run('order.add', card);
  const { id } = await m.run('order.save', { name: 'Guardado' });
  await m.run('order.new');
  await m.run('order.add', card);
  await m.app.close();

  // Reiniciar (al actualizarse, «Reiniciar ahora»): sigue todo como estaba.
  const again = await open('cerrar', { MANNA_REINICIO: '1' });
  assert.deepEqual([again.order().active, again.order().items.length], [null, 1]);
  await again.run('order.use', { id });
  await again.app.close();

  // Apagado y vuelto a abrir: el sin nombre vacío y en uso; el guardado, en la lista.
  const later = await open('cerrar');
  assert.deepEqual([later.order().active, later.order().items, later.order().saved.map((s) => [s.name, s.count])], [null, [], [['Guardado', 2]]]);
  await later.run('order.add', card);
  await later.app.close();

  // Un corte (no pasó por el apagado): si vuelve antes de 15 minutos, conserva lo que tenía.
  const cut = (minutes) => {
    const data = JSON.parse(fs.readFileSync(file('cerrar'), 'utf8'));
    fs.writeFileSync(file('cerrar'), JSON.stringify({ ...data, draft: { items: [{ id: 'x', kind: 'section', title: 'Apertura' }] }, alive: Date.now() - minutes * 60_000 }));
  };
  cut(5);
  const soon = await open('cerrar');
  assert.equal(soon.order().items.length, 1);
  await soon.app.close();
  cut(20);
  const late = await open('cerrar');
  assert.equal(late.order().items.length, 0);
  await late.app.close();
});
