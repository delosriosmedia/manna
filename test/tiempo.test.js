import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import { positionAt } from '../server/core/playback.js';
import system from '../server/modules/system/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import time from '../server/modules/time/index.js';
import layers from '../server/modules/layers/index.js';
import { adjustClock, cleanData, cleanTimer, clockText, newClock } from '../server/modules/time/clock.js';

// Módulo Tiempo (fase 32): la lógica de los relojes y las órdenes contra el servidor de verdad, con datos temporales.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-tiempo-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

async function start(name = 'datos') {
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, projection, order, time, layers]) await setup(app);
  // app.run no mira permisos: los de time.* los comprueba el router como los de cualquier orden.
  const run = async (type, payload) => app.run(type, payload);
  return { app, run, timers: () => app.store.get('time').timers };
}

test('cómo se ve: lo que falta o no vale toma el valor de siempre', () => {
  assert.deepEqual(cleanData({ type: 'hora' }), { type: 'hora', style: 'sencillo', size: 's', place: 'br', look: 'sutil', format: '12' });
  assert.deepEqual(cleanData({ type: 'hora', style: 'anillo', format: 24, place: 'nada' }), { type: 'hora', style: 'anillo', size: 's', place: 'br', look: 'sutil', format: '24' });
  assert.deepEqual(cleanData({ id: 'abc', size: 'm' }), { id: 'abc', style: 'tarjeta', size: 'm', place: 'mc', look: 'normal' });
  assert.throws(() => cleanData({}), /qué cronómetro/);
});

test('crear: un temporizador necesita cuánto dura; el nombre se propone solo', () => {
  assert.deepEqual(cleanTimer({ type: 'timer', title: '  Anuncios ', seconds: 300 }), { type: 'timer', title: 'Anuncios', seconds: 300, sound: true });
  assert.equal(cleanTimer({ type: 'timer', seconds: 90 }).title, 'Temporizador de 1:30');
  assert.equal(cleanTimer({ type: 'timer', seconds: 60, sound: false }).sound, false);
  assert.deepEqual(cleanTimer({ type: 'stopwatch', title: '' }), { type: 'stopwatch', title: 'Cronómetro', seconds: null, sound: false });
  assert.throws(() => cleanTimer({ type: 'timer', seconds: 0 }), /cuánto dura/);
  assert.throws(() => cleanTimer({ type: 'timer', seconds: 90000 }), /24 horas/);
  assert.throws(() => cleanTimer({ type: 'reloj' }), /temporizador o un cronómetro/);
  assert.equal(clockText(3725), '1:02:05');
  assert.equal(clockText(59.6), '1:00');
});

test('sumar o restar un minuto: a un temporizador le cambia lo que queda, nunca por debajo de cero', () => {
  const t0 = 1_000_000;
  let clock = { ...newClock({ type: 'timer', seconds: 120 }, t0), playing: true };
  clock = adjustClock(clock, 1, t0 + 30_000); // a los 30 s quedan 90: +1 min, 150
  assert.equal(clock.duration - positionAt(clock, t0 + 30_000), 150);
  assert.equal(clock.playing, true);
  clock = adjustClock(clock, -60, t0 + 30_000);
  assert.equal(clock.duration, positionAt(clock, t0 + 30_000), 'restar más de lo que queda lo deja en cero');
  assert.equal(clock.playing, false, 'en cero se queda quieto');
  let watch = { ...newClock({ type: 'stopwatch' }, t0), playing: true };
  watch = adjustClock(watch, -1, t0 + 20_000);
  assert.equal(positionAt(watch, t0 + 20_000), 0, 'un cronómetro no baja de cero');
  assert.throws(() => adjustClock(watch, 0, t0), /minuto en minuto/);
});

test('las órdenes: crear, empezar, parar, sumar, volver al principio, cambiar y eliminar', async () => {
  const { app, run, timers } = await start();
  try {
    const { id } = await run('time.save', { type: 'timer', title: 'Predicación', seconds: 40 * 60 });
    assert.equal(timers()[0].title, 'Predicación');
    await run('time.start', { id });
    assert.equal(timers()[0].clock.playing, true);
    await run('time.pause', { id });
    assert.equal(timers()[0].clock.playing, false);
    await run('time.adjust', { id, minutes: 1 });
    assert.equal(timers()[0].clock.duration, 41 * 60);
    await run('time.reset', { id });
    assert.equal(timers()[0].clock.position, 0);
    await run('time.save', { id, title: 'Sermón', seconds: 41 * 60 });
    assert.equal(timers()[0].clock.duration, 41 * 60, 'cambiar el nombre no reinicia');
    await run('time.save', { id, title: 'Sermón', seconds: 30 * 60 });
    assert.equal(timers()[0].clock.duration, 30 * 60, 'cambiar lo que dura lo deja en su principio');
    await assert.rejects(run('time.start', { id: 'no-existe' }), /ya no está/);
    await run('time.remove', { id });
    assert.equal(timers().length, 0);
  } finally {
    await app.close();
  }
});

test('se proyecta, va al orden y a una capa; desde el orden empieza solo si está en su principio', async () => {
  const { app, run, timers } = await start('orden');
  try {
    const { id } = await run('time.save', { type: 'timer', title: 'Anuncios', seconds: 300 });
    const item = await run('order.add', { kind: 'clock', data: { id, place: 'tr' } });
    const added = app.store.get('order').items.find((i) => i.kind === 'clock');
    assert.equal(added.title, 'Anuncios');
    assert.equal(added.data.place, 'tr');
    await run('order.show', { id: item?.id ?? added.id });
    assert.equal(app.store.get('projection').item.kind, 'clock');
    assert.equal(timers()[0].clock.playing, true, 'desde el orden, al principio: empieza solo');
    await run('time.pause', { id });
    await run('projection.show', { kind: 'clock', data: { id } });
    assert.equal(timers()[0].clock.playing, false, 'desde el módulo no empieza solo');
    await run('projection.show', { kind: 'clock', data: { type: 'hora', format: '24' } });
    assert.equal(app.store.get('projection').item.title, 'Hora');
    await run('layers.set', { n: 1, kind: 'clock', data: { type: 'hora' } });
    const slot = app.store.get('layers').slots[0];
    assert.equal(slot.ready, true);
    assert.equal(slot.content.style, 'sencillo');
  } finally {
    await app.close();
  }
});

test('siguen corriendo tras un reinicio de Manna', async () => {
  const first = await start('reinicio');
  const { id } = await first.run('time.save', { type: 'stopwatch', title: 'Alabanza' });
  await first.run('time.start', { id });
  await first.app.close();
  const again = await start('reinicio');
  try {
    assert.equal(again.timers()[0].clock.playing, true);
  } finally {
    await again.app.close();
  }
});
