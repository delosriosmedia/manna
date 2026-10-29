import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import texts from '../server/modules/texts/index.js';
import layers from '../server/modules/layers/index.js';
import { cleanLook, cleanText, splitParts, titleOf } from '../server/modules/texts/text.js';

// Módulo Textos (fase 18): la lógica pura y, contra el servidor de verdad, guardar, proyectar por partes y quitar.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-textos-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

test('un texto se limpia, se parte en pantallas por las líneas en blanco y se titula con su principio', () => {
  assert.equal(cleanText('  Hola   \r\nmundo  \n\n\n\nOtra parte  '), 'Hola\nmundo\n\nOtra parte');
  assert.deepEqual(splitParts('Primera línea\nsigue igual\n \nSegunda\n\n\n\nTercera'), ['Primera línea\nsigue igual', 'Segunda', 'Tercera']);
  assert.deepEqual(splitParts('   '), []);
  assert.equal(titleOf('Un aviso corto\ncon más líneas'), 'Un aviso corto');
  assert.equal(titleOf('a'.repeat(80)), `${'a'.repeat(59)}…`);
});

async function start(name, role = 'control') {
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, projection, order, texts, layers]) await setup(app);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
  const cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
  return {
    send: async (type, payload = {}) => {
      const res = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) });
      return { ...(await res.json()), http: res.status };
    },
    state: async () => (await request('/api/state')).json(),
    async stop() {
      await app.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test('textos y citas: se guardan, se proyectan por partes, van al orden del culto y se quitan', async () => {
  const s = await start('textos');
  try {
    assert.equal((await s.send('texts.save', { style: 'normal', text: '  \n ' })).http, 400, 'vacío, no');
    assert.equal((await s.send('texts.save', { style: 'grande', text: 'Hola' })).http, 400, 'solo texto o cita');
    assert.equal((await s.send('texts.save', { style: 'normal', text: 'x'.repeat(4001) })).http, 400, 'con un largo razonable');
    const notice = (await s.send('texts.save', { style: 'normal', text: 'Bienvenidos\n\nLos esperamos en el salón', author: 'no se guarda' })).result.id;
    const quote = (await s.send('texts.save', { style: 'quote', text: 'Una frase inventada para la prueba', author: '  Alguien   de ejemplo ' })).result.id;
    const { list } = (await s.state()).texts;
    assert.deepEqual(list.map((t) => [t.id, t.style, t.author]), [[quote, 'quote', 'Alguien de ejemplo'], [notice, 'normal', '']], 'el más reciente primero; el autor, solo en la cita');

    // Cada parte es un paso; el elemento entero se ve de una vez.
    const whole = (await s.send('projection.show', { kind: 'text', data: { id: notice } })).result;
    assert.deepEqual([whole.text, whole.part, whole.parts], ['Bienvenidos\n\nLos esperamos en el salón', null, 2]);
    await s.send('projection.show', { kind: 'text', data: { id: notice }, step: 0 });
    await s.send('projection.step', { delta: 1 });
    let air = (await s.state()).projection.item;
    assert.deepEqual([air.text, air.part], ['Los esperamos en el salón', 2], '«Siguiente» pasa a la otra parte');
    // Al cambiarlo, lo que está al aire se ve cambiado.
    await s.send('texts.save', { id: notice, style: 'normal', text: 'Bienvenidos\n\nLos esperamos en el patio' });
    air = (await s.state()).projection.item;
    assert.equal(air.text, 'Los esperamos en el patio');

    const added = (await s.send('order.add', { kind: 'text', data: { id: quote } })).result;
    assert.deepEqual([added.title, added.subtitle, added.steps], ['Una frase inventada para la prueba', 'Cita · Alguien de ejemplo', 1]);
    await s.send('texts.save', { id: quote, style: 'normal', text: 'Ya no es una cita', author: 'Alguien' });
    assert.equal((await s.state()).texts.list.find((t) => t.id === quote).author, '', 'un texto normal no lleva autor');

    assert.equal((await s.send('texts.remove', { id: quote })).http, 200);
    assert.equal((await s.send('texts.remove', { id: quote })).http, 404);
    assert.equal((await s.send('texts.save', { id: quote, style: 'normal', text: 'Otra vez' })).http, 404, 'no se cambia uno que ya no existe');
    assert.equal((await s.send('projection.show', { kind: 'text', data: { id: quote } })).http, 404);
  } finally {
    await s.stop();
  }
});

test('textos: una función sin el permiso no los toca', async () => {
  const s = await start('textos-orden', 'orden');
  try {
    assert.equal((await s.send('texts.save', { style: 'normal', text: 'Hola' })).http, 403);
  } finally {
    await s.stop();
  }
});

test('el texto fijo va solo en una capa, con su aspecto (2026-10-29)', async () => {
  assert.deepEqual(cleanLook({ font: 'lexend', size: 'gigante', place: 'tl', box: 'stripe', motion: 'scroll', speed: 'fast' }),
    { font: 'lexend', size: 'm', place: 'tl', box: 'stripe', motion: 'scroll', speed: 'fast' }, 'lo desconocido, el de siempre');
  assert.deepEqual(cleanLook(null), { font: 'sora', size: 'm', place: 'bc', box: 'pill', motion: 'still', speed: 'normal' });
  assert.equal(cleanLook({ size: 'xxl' }).size, 'xxl', 'seis tamaños, del muy pequeño al enorme');
  const s = await start('fijo');
  try {
    const id = (await s.send('texts.save', { style: 'fixed', text: 'Silencien sus celulares', look: { font: 'atkinson', box: 'none' } })).result.id;
    assert.equal((await s.state()).texts.list[0].look.font, 'atkinson');
    assert.notEqual((await s.send('order.add', { kind: 'fixed', data: { id } })).http, 200, 'no va al orden');
    assert.notEqual((await s.send('order.add', { kind: 'text', data: { id } })).http, 200, 'ni como texto normal');
    assert.equal((await s.send('projection.show', { kind: 'fixed', data: { id } })).http, 400, 'ni se proyecta solo');
    assert.equal((await s.send('layers.set', { n: 4, kind: 'fixed', data: { id } })).http, 200, 'va en una capa');
    const slot = (await s.state()).layers.slots[3];
    assert.deepEqual([slot.kind, slot.title, slot.content.look.font, slot.content.look.box], ['fixed', 'Silencien sus celulares', 'atkinson', 'none']);
  } finally {
    await s.stop();
  }
});
