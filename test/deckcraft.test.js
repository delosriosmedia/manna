import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import { readImageInfo } from '../server/core/images.js';
import system from '../server/modules/system/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import slides from '../server/modules/slides/index.js';
import { readInfo, scaleFor, visiblePages } from '../server/modules/slides/deckcraft.js';
import { writeFakeDeckCraft } from '../scripts/lib/deckcraft-falso.mjs';
import { makePptx } from '../scripts/lib/pptx.mjs';

// Convertir un PowerPoint con DeckCraft (fase 33, parte 2). Con uno de mentira en macOS y Linux; con el de verdad si se
// le da su ruta en MANNA_DECKCRAFT_PRUEBA (lo hace el Windows de GitHub en cada versión). Las presentaciones se fabrican
// aquí mismo (scripts/lib/pptx.mjs): ninguna de una iglesia.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-deckcraft-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const WIN = process.platform === 'win32';
const REAL = process.env.MANNA_DECKCRAFT_PRUEBA || null;

test('lo que dice DeckCraft: tamaño, diapositivas ocultas y escala', () => {
  const info = readInfo(JSON.stringify({ slideSize: [960, 540], slides: [{ index: 0, hidden: false }, { index: 1, hidden: true }, { index: 2 }] }));
  assert.deepEqual(info, { width: 960, height: 540, slides: [{ index: 0, hidden: false }, { index: 1, hidden: true }, { index: 2, hidden: false }] });
  assert.equal(scaleFor(info, 2560).toFixed(4), '2.6667');
  assert.equal(scaleFor({ width: 720, height: 540 }, 320).toFixed(4), '0.4444', 'una 4:3 manda su ancho');
  assert.throws(() => readInfo('no es JSON'), /no pudo leer/);
  assert.throws(() => readInfo('{"slides":[]}'), /no pudo leer/);
  const full = new Map([[1, 'a1'], [2, 'a2'], [3, 'a3']]);
  const thumbs = new Map([[1, 'm1'], [3, 'm3']]);
  assert.deepEqual(visiblePages(info, full, thumbs), [{ file: 'a1', thumb: 'm1' }, { file: 'a3', thumb: 'm3' }], 'la oculta se salta');
  assert.throws(() => visiblePages(info, new Map([[1, 'a1']]), thumbs), /no dibujó todas/);
});

async function start(name, program) {
  const dataDir = path.join(tmp, name);
  const tools = path.join(dataDir, 'herramientas');
  fs.mkdirSync(tools, { recursive: true });
  if (program) fs.copyFileSync(program, path.join(tools, WIN ? 'deckcraft-cli.exe' : 'deckcraft-cli'));
  else writeFakeDeckCraft(tools);
  fs.chmodSync(path.join(tools, WIN ? 'deckcraft-cli.exe' : 'deckcraft-cli'), 0o755);
  // Sin PowerPoint: así convierte DeckCraft seguro (con los dos, también lo haría él).
  process.env.MANNA_FALTA = 'powerpoint';
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias'), mediaDir: path.join(tmp, `${name}-carpeta`) });
  for (const setup of [system, projection, order, slides]) await setup(app);
  await app.tools.scan();
  delete process.env.MANNA_FALTA;
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) })).headers.get('set-cookie').split(';')[0];
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
  const json = async (res) => ({ ...(await res.json()), http: res.status });
  const api = {
    app, dataDir,
    upload: async (fileName, body) => json(await request(`/api/slides/powerpoint?name=${encodeURIComponent(fileName)}&ext=.pptx`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body })),
    async settle(id, status, ms = 60_000) {
      for (let waited = 0; waited < ms; waited += 100) {
        const deck = (await (await request('/api/state')).json()).slides.decks.find((d) => d.id === id);
        if (deck && deck.status !== 'converting') return deck.status === status ? deck : null;
        await sleep(100);
      }
      return null;
    },
    async stop() {
      await app.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
  return api;
}

async function convert(s) {
  assert.equal(s.app.tools.has('deckcraft'), true, 'DeckCraft se encuentra en la carpeta de programas de Manna');
  const added = await s.upload('Bienvenida', makePptx([{ text: 'Bienvenidos' }, { text: 'Oculta', hidden: true }, { text: 'Anuncios & avisos' }]));
  assert.deepEqual([added.http, added.status], [200, 'converting']);
  const deck = await s.settle(added.id, 'ready');
  assert.ok(deck, 'termina de convertirse');
  assert.deepEqual([deck.pages, deck.ext, deck.thumbs, deck.thumbExt, deck.width, deck.height], [2, 'png', true, 'png', 2560, 1440], 'dos diapositivas: la oculta no está');
  const folder = path.join(s.dataDir, 'media', 'diapositivas', deck.id);
  assert.deepEqual(readImageInfo(path.join(folder, 'm1.png')), { type: 'png', width: 320, height: 180 }, 'la miniatura, pequeña');
  assert.equal(fs.existsSync(path.join(folder, '3.png')), false);
  assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'tmp')).filter((n) => !n.startsWith('.')), [], 'no quedan restos de la conversión');
  return deck;
}

test('con DeckCraft, un PowerPoint se convierte sin PowerPoint: las ocultas no, y con miniaturas', { skip: WIN && !REAL ? 'el DeckCraft de mentira es un guion: en Windows se usa el de verdad (MANNA_DECKCRAFT_PRUEBA)' : false }, async () => {
  const s = await start('falso', REAL);
  try {
    await convert(s);
    if (REAL) return;
    // Una que DeckCraft no puede abrir, y una con todas las diapositivas ocultas: se dice por qué.
    const broken = await s.upload('Presentación rota', makePptx([{ text: 'ROTA' }]));
    assert.match((await s.settle(broken.id, 'error')).error, /DeckCraft no pudo convertir esta presentación\. Guárdala como PDF/);
    const hidden = await s.upload('Escondida', makePptx([{ text: 'Uno', hidden: true }]));
    assert.match((await s.settle(hidden.id, 'error')).error, /todas están ocultas/);
  } finally {
    await s.stop();
  }
});

test('con el DeckCraft de verdad', { skip: REAL ? false : 'sin MANNA_DECKCRAFT_PRUEBA (la ruta de un deckcraft-cli de verdad)' }, async () => {
  const s = await start('verdad', REAL);
  try {
    await convert(s);
  } finally {
    await s.stop();
  }
});
