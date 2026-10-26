import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import users from '../server/modules/users/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import { dayOf, defaultName } from '../server/modules/order/logic.js';

// Órdenes del culto (fases 23 y 35 de docs/PLAN.md): cada uno con nombre, dueño y fecha desde que se crea. El que
// está en uso lo ven todos en la cola; los demás, solo su dueño y el administrador. Al apagar Manna nada queda en uso,
// salvo si se reinicia o vuelve a abrirse antes de 15 minutos tras un corte.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-ordenes-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const file = (name) => path.join(tmp, name, 'orden.json');
const card = { kind: 'testcard', data: {} };
// Desde otro equipo (aquí, por un túnel: el mismo equipo entra sin PIN, como administrador).
const away = { 'Cf-Connecting-Ip': '203.0.113.30', 'X-Forwarded-For': '203.0.113.30' };

// Cada prueba cierra lo que abrió aunque falle (si no, la prueba no termina).
async function open(t, name, env = {}) {
  Object.assign(process.env, env);
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, users, projection, order]) await setup(app);
  for (const key of Object.keys(env)) delete process.env[key]; // el orden lee MANNA_REINICIO al montarse
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const json = { 'Content-Type': 'application/json' };
  // Una persona: el administrador en el equipo principal o, con usuario y PIN, otra desde fuera.
  async function person(user = null, pin = null, role = 'control') {
    const headers = user ? away : {};
    const res = await fetch(`${base}/api/session`, { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify({ role, user, pin }) });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie').split(';')[0];
    const ask = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, ...headers, cookie } });
    return {
      ask,
      async send(type, payload = {}) {
        const r = await ask('/api/action', { method: 'POST', headers: json, body: JSON.stringify({ type, payload }) });
        return { status: r.status, ...(await r.json()) };
      },
      state: async () => (await ask('/api/state')).json(),
    };
  }
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  t.after(close);
  return {
    app, person, close,
    run: (type, payload) => app.run(type, payload),
    order: () => app.store.get('order'),
  };
}

test('el orden de antes pasa a ser un orden del administrador, y esa vez sigue en uso', async (t) => {
  fs.mkdirSync(path.join(tmp, 'antes'), { recursive: true });
  fs.writeFileSync(file('antes'), JSON.stringify({ items: [{ id: 's', kind: 'section', title: 'Apertura' }] }));
  const m = await open(t, 'antes');
  const admin = await m.person();
  const { orders, order: inUse } = await admin.state();
  assert.deepEqual([inUse.name, inUse.items.length, inUse.owner], ['Orden del culto', 1, 'Administrador']);
  assert.deepEqual(orders.list.map((o) => [o.name, o.ownerName, o.date, o.count]), [['Orden del culto', 'Administrador', dayOf(), 0]]);
  assert.equal(orders.editing, inUse.active, 'el administrador tiene abierto el que está en uso');
  await m.close();
});

test('al pasar a la fase 35, los guardados son del administrador y el orden sin nombre pasa a ser uno más', async (t) => {
  const updated = new Date('2026-10-18T19:30').getTime();
  fs.mkdirSync(path.join(tmp, 'fase23'), { recursive: true });
  fs.writeFileSync(file('fase23'), JSON.stringify({
    draft: { items: [{ id: 'x', kind: 'section', title: 'Mensaje' }] },
    saved: [{ id: 's1', name: 'Sábado', items: [], updated }], active: 's1', alive: Date.now(),
  }));
  const m = await open(t, 'fase23');
  const { orders, order: inUse } = await (await m.person()).state();
  assert.deepEqual(orders.list.map((o) => [o.name, o.ownerName, o.date]), [['Sábado', 'Administrador', '2026-10-18'], [defaultName('Administrador', dayOf()), 'Administrador', dayOf()]]);
  assert.equal(inUse.active, 's1', 'tras un corte corto, sigue en uso el que estaba');
  await m.close();
  const saved = JSON.parse(fs.readFileSync(file('fase23'), 'utf8'));
  assert.deepEqual([saved.version, 'draft' in saved], [2, false]);
});

test('cada orden es de quien lo crea: los demás no lo ven, salvo el que está en uso, y el administrador los ve todos', async (t) => {
  const m = await open(t, 'duenos');
  const admin = await m.person();
  const { result: { id: ana } } = await admin.send('users.create', { name: 'Ana', pin: '2468', functions: ['alabanza'] });
  const { result: { id: beto } } = await admin.send('users.create', { name: 'Beto', pin: '1357', functions: ['control'] });

  const { result: sabado } = await admin.send('order.create', { name: 'Culto del sábado', date: '2026-11-01' });
  assert.equal(m.order().active, sabado.id, 'con nada en uso, el nuevo pasa a la cola');
  const { result: privado } = await admin.send('order.create', { name: 'Ensayo privado' });
  assert.equal(m.order().active, sabado.id, 'con uno en uso, el nuevo no lo cambia');
  assert.equal((await admin.state()).orders.editing, privado.id, 'quien lo crea lo tiene abierto');

  const anaIn = await m.person(ana, '2468', 'alabanza');
  let seen = await anaIn.state();
  assert.deepEqual([seen.orders.list, seen.orders.editing, seen.order.name, seen.order.owner], [[], null, 'Culto del sábado', 'Administrador'], 'Ana ve el que está en uso, pero no es suyo');
  assert.ok(!JSON.stringify(seen).includes('Ensayo privado'), 'los órdenes de otro no le llegan');
  for (const type of ['order.open', 'order.use', 'order.renameOrder', 'order.favorite', 'order.deleteOrder']) {
    assert.equal((await anaIn.send(type, { id: privado.id, name: 'Mío', on: true })).status, 404, `${type} con uno ajeno`);
  }

  // Lo que añade sin tener ninguno abierto va a uno nuevo, suyo, con el nombre del día.
  assert.equal((await anaIn.send('order.add', card)).status, 200);
  seen = await anaIn.state();
  assert.deepEqual(seen.orders.list.map((o) => [o.name, o.ownerName, o.count]), [[defaultName('Ana', dayOf()), 'Ana', 1]]);
  assert.deepEqual([seen.orders.editing, seen.orders.items.length, seen.order.name], [seen.orders.list[0].id, 1, 'Culto del sábado']);
  const hers = seen.orders.list[0].id;
  assert.equal((await anaIn.send('order.create', { name: 'Alabanza' })).status, 200);
  assert.equal((await anaIn.send('order.create', { name: 'alabanza' })).status, 409, 'no dos con el mismo nombre del mismo dueño');
  assert.equal((await admin.send('order.create', { name: 'Alabanza' })).status, 200, 'pero otro sí puede llamar así el suyo');

  // El administrador los ve todos, con su dueño, y puede cambiar el de Ana.
  const all = (await admin.state()).orders.list;
  assert.deepEqual(all.map((o) => o.ownerName).sort(), ['Administrador', 'Administrador', 'Administrador', 'Ana', 'Ana']);
  assert.equal((await anaIn.send('order.use', { id: hers })).status, 200);
  assert.deepEqual([m.order().active, m.order().owner], [hers, 'Ana']);
  await admin.send('order.open', { id: hers });
  await admin.send('order.addSection', { title: 'Alabanza' });
  assert.equal(m.order().items.length, 2, 'lo que añade el administrador va al que tiene abierto');

  // Beto no puede cambiar el de Ana, que está en uso: lo que añade va a uno suyo.
  const betoIn = await m.person(beto, '1357');
  await betoIn.send('order.add', card);
  const betoSees = await betoIn.state();
  assert.deepEqual([betoSees.orders.list.map((o) => o.ownerName), m.order().items.length], [['Beto'], 2]);

  // El nombre y la fecha, favoritos y borrar.
  assert.equal((await anaIn.send('order.renameOrder', { id: hers, date: '2026-02-30' })).status, 400);
  await anaIn.send('order.renameOrder', { id: hers, name: 'Alabanza joven', date: '2026-11-08' });
  await anaIn.send('order.favorite', { id: hers, on: true });
  const mine = (await anaIn.state()).orders.list.find((o) => o.id === hers);
  assert.deepEqual([mine.name, mine.date, mine.favorite], ['Alabanza joven', '2026-11-08', true]);
  await anaIn.send('order.deleteOrder', { id: hers });
  assert.deepEqual([m.order().active, m.order().items], [null, []], 'al borrar el que está en uso, la cola queda vacía');
  assert.equal((await admin.state()).orders.editing, null);
  await m.close();
});

test('en el tiempo real, cada conexión recibe solo sus órdenes', async (t) => {
  const m = await open(t, 'vivo');
  const admin = await m.person();
  const { result: { id: ana } } = await admin.send('users.create', { name: 'Ana', pin: '2468', functions: ['alabanza'] });
  const anaIn = await m.person(ana, '2468', 'alabanza');
  const stop = new AbortController();
  const events = await anaIn.ask('/api/events?rol=alabanza', { signal: stop.signal });
  const reader = events.body.getReader();
  let text = '';
  const until = async (fn) => {
    while (!fn(text)) text += new TextDecoder().decode((await reader.read()).value);
  };
  await until((t) => t.includes('event: state'));
  await admin.send('order.create', { name: 'En uso' }); // el que está en uso sí lo ven todos
  await admin.send('order.create', { name: 'Solo del administrador' });
  await anaIn.send('order.create', { name: 'De Ana' });
  await until((t) => t.includes('De Ana'));
  stop.abort();
  assert.ok(!text.includes('Solo del administrador'), 'lo del administrador no le llega');
  await m.close();
});

test('al apagar Manna nada queda en uso, salvo en un reinicio, tras un corte de menos de 15 minutos o si hay un solo orden de hoy', async (t) => {
  const m = await open(t, 'cerrar');
  await m.run('order.create', { name: 'Guardado' });
  await m.run('order.add', card);
  await m.run('order.create', { name: 'De otro día', date: '2026-01-04' });
  await m.close();

  const again = await open(t, 'cerrar', { MANNA_REINICIO: '1' });
  assert.deepEqual([again.order().name, again.order().items.length], ['Guardado', 1], 'reiniciar no cambia nada');
  await again.run('order.use', { id: (await (await again.person()).state()).orders.list.find((o) => o.name === 'De otro día').id });
  await again.close();

  // Apagado y vuelto a abrir: con un solo orden de hoy, ese pasa a la cola (S51).
  const later = await open(t, 'cerrar');
  assert.deepEqual([later.order().name, later.order().items.length], ['Guardado', 1], 'el único de hoy queda en uso');
  await later.run('order.create', { name: 'Otro de hoy' });
  await later.close();
  const twice = await open(t, 'cerrar');
  assert.deepEqual([twice.order().active, twice.order().items], [null, []], 'con dos de hoy, nada en uso: elige quien opera');
  const { orders } = await (await twice.person()).state();
  assert.deepEqual(orders.list.map((o) => [o.name, o.count]), [['Guardado', 1], ['De otro día', 0], ['Otro de hoy', 0]]);
  await twice.run('order.use', { id: orders.list[1].id });
  await twice.close();

  // Un corte (no pasó por el apagado): si vuelve antes de 15 minutos, sigue en uso lo que estaba.
  const cut = (minutes) => {
    const saved = JSON.parse(fs.readFileSync(file('cerrar'), 'utf8'));
    fs.writeFileSync(file('cerrar'), JSON.stringify({ ...saved, active: saved.saved[1].id, alive: Date.now() - minutes * 60_000 }));
  };
  cut(5);
  const soon = await open(t, 'cerrar');
  assert.equal(soon.order().name, 'De otro día');
  await soon.close();
  cut(20);
  const late = await open(t, 'cerrar');
  assert.equal(late.order().active, null);
});

test('caben 20 órdenes por iglesia: el cajón lo sabe, y el siguiente no se crea', async (t) => {
  const m = await open(t, 'maximo');
  const admin = await m.person();
  let left;
  for (let i = 1; i <= 20; i += 1) ({ result: { left } } = await admin.send('order.create', { name: `Culto ${i}` }));
  assert.equal(left, 0);
  const { orders } = await admin.state();
  assert.deepEqual([orders.total, orders.limit], [20, 20]);
  const over = await admin.send('order.create', { name: 'Uno más' });
  assert.deepEqual([over.status, over.error.startsWith('Ya hay 20 órdenes, el máximo')], [409, true]);
  await admin.send('order.open', { id: orders.list[0].id });
  await admin.send('order.deleteOrder', { id: orders.list[0].id });
  assert.equal((await admin.send('order.add', card)).status, 200, 'lo que se añade sin orden abierto va a uno nuevo, que ya cabe');
  assert.equal((await admin.state()).orders.total, 20);
});

test('al quitar a un usuario, sus órdenes pasan al administrador que lo quita (S52)', async (t) => {
  const m = await open(t, 'quitar');
  const admin = await m.person();
  await admin.send('order.create', { name: 'Alabanza' });
  const { result: { id: ana } } = await admin.send('users.create', { name: 'Ana', pin: '2468', functions: ['alabanza'] });
  const anaIn = await m.person(ana, '2468', 'alabanza');
  await anaIn.send('order.create', { name: 'Alabanza' });
  await anaIn.send('order.create', { name: 'Jóvenes' });
  assert.equal((await admin.send('users.remove', { id: ana })).status, 200);
  const list = (await admin.state()).orders.list.map((o) => `${o.name}:${o.ownerName}`).sort();
  assert.deepEqual(list, ['Alabanza (2):Administrador', 'Alabanza:Administrador', 'Jóvenes:Administrador']);
});
