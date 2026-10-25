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
import bible from '../server/modules/bible/index.js';
import web from '../server/modules/web/index.js';
import layers from '../server/modules/layers/index.js';

// Las tres capas (fase 31) contra el servidor de verdad, con datos temporales y un sitio de mentira en este equipo:
// nada sale a internet.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-capas-'));
// Una biblia con textos inventados, para los versículos en una capa (fase 34).
fs.mkdirSync(path.join(tmp, 'biblias'));
fs.writeFileSync(path.join(tmp, 'biblias', 'Prueba.xmm'), '<bible><b n="Juan"><c n="3"><v n="16">Texto inventado uno.</v><v n="17">Texto inventado dos.</v></c></b></bible>');

const site = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html', ...(req.url.startsWith('/no-se-deja') && { 'X-Frame-Options': 'DENY' }) });
  res.end('<!doctype html><body style="background:transparent">Palabra</body>');
});
await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
const sitePort = site.address().port;
const at = (p) => `http://127.0.0.1:${sitePort}${p}`;

async function start() {
  process.env.MANNA_CAPAS_REINTENTO_MS = '200';
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, 'datos'), biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, bible, projection, web, layers]) await setup(app);
  delete process.env.MANNA_CAPAS_REINTENTO_MS;
  // app.run no mira permisos: los de layers.* (projection.control) los comprueba el router como los de cualquier orden.
  const run = async (type, payload) => app.run(type, payload);
  return { app, run, slots: () => app.store.get('layers').slots };
}
const until = async (fn, ms = 5000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 50))) if (fn()) return true;
  return false;
};

test.after(() => {
  site.close();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

test('una página se pone en una capa, se oculta, se recarga y se quita; las demás capas no cambian', async () => {
  const { app, run, slots } = await start();
  try {
    const page = await run('web.add', { url: at('/palabra'), name: 'Palabra del concurso' });
    assert.deepEqual(slots().map((s) => s.n), [1, 2, 3]);
    await run('layers.set', { n: 2, kind: 'web', data: { id: page.id } });
    let two = slots()[1];
    assert.equal(two.title, 'Palabra del concurso');
    assert.equal(two.visible, true);
    assert.equal(two.content.url, at('/palabra'));
    assert.ok(await until(() => slots()[1].ready), 'su dirección contesta: se puede cargar');
    assert.equal(slots()[0].kind, undefined);
    assert.equal(app.services.layers.covering(), true);

    await run('layers.visible', { n: 2, visible: false });
    assert.equal(slots()[1].visible, false);
    assert.equal(app.services.layers.covering(), false);

    const before = slots()[1].uid;
    await run('layers.reload', { n: 2 });
    assert.notEqual(slots()[1].uid, before, 'recargar le da otro uid: la pantalla la vuelve a cargar');

    await run('layers.clear', { n: 2 });
    assert.equal(slots()[1].kind, undefined);
    await assert.rejects(run('layers.visible', { n: 2, visible: true }), /está vacía/);
  } finally {
    await app.close();
  }
});

test('un pasaje va en una capa, con su texto, y lo que está al aire no cambia (fase 34)', async () => {
  const { app, run, slots } = await start();
  try {
    await run('projection.show', { kind: 'testcard', data: {} });
    const onAir = app.store.get('projection').item.uid;
    await run('layers.set', { n: 2, kind: 'verses', data: { versionId: 'prueba', ref: { book: 43, chapter: 3, verseStart: 16, verseEnd: 17 } } });
    assert.ok(await until(() => slots()[1].ready), 'sin nada que esperar, se carga ya');
    const slot = slots()[1];
    assert.equal(slot.kind, 'verses');
    assert.equal(slot.title, 'Juan 3:16-17');
    assert.deepEqual(slot.content.verses.map((v) => v.text), ['Texto inventado uno.', 'Texto inventado dos.']);
    assert.equal(app.store.get('projection').item.uid, onAir, 'lo que está al aire sigue igual');
    assert.equal(app.services.layers.covering(), true, 'tapa (PowerPoint en vivo iría como imágenes)');
  } finally {
    await app.close();
  }
});

test('lo que no puede ir en una capa se rechaza con su motivo', async () => {
  const { app, run } = await start();
  try {
    const closed = await run('web.add', { url: at('/no-se-deja'), name: 'Juego' });
    await assert.rejects(run('layers.set', { n: 1, kind: 'web', data: { id: closed.id } }), /propia ventana/);
    await assert.rejects(run('layers.set', { n: 4, kind: 'web', data: { id: closed.id } }), /son la 1, la 2 y la 3/);
    await assert.rejects(run('layers.set', { n: 1, kind: 'testcard', data: {} }), /no se puede poner en una capa/);
    await assert.rejects(run('layers.set', { n: 1, kind: 'web', data: { id: 'no-existe' } }), /ya no está/);
    await assert.rejects(run('layers.set', { n: 1, kind: 'web' }), /Falta qué poner/);
  } finally {
    await app.close();
  }
});

test('sin respuesta de la dirección la capa espera, y se carga sola cuando contesta', async () => {
  // Un puerto donde aún no escucha nadie: como sin internet.
  const later = http.createServer((req, res) => res.end('<!doctype html>Palabra'));
  await new Promise((resolve) => later.listen(0, '127.0.0.1', resolve));
  const port = later.address().port;
  await new Promise((resolve) => later.close(resolve));
  const { app, run, slots } = await start();
  try {
    // Al agregarla, Manna lee sus cabeceras: se agrega con el sitio en marcha y luego el sitio «se cae».
    const up = http.createServer((req, res) => res.end('<!doctype html>Palabra'));
    await new Promise((resolve) => up.listen(port, '127.0.0.1', resolve));
    const page = await run('web.add', { url: `http://127.0.0.1:${port}/palabra`, name: 'Sin internet' });
    await new Promise((resolve) => up.close(resolve));
    await run('layers.set', { n: 1, kind: 'web', data: { id: page.id } });
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(slots()[0].ready, false, 'sin respuesta no se carga: no saldría la página de error');
    const back = http.createServer((req, res) => res.end('<!doctype html>Palabra'));
    await new Promise((resolve) => back.listen(port, '127.0.0.1', resolve));
    try {
      assert.ok(await until(() => slots()[0].ready), 'cuando vuelve a contestar, se carga sola');
    } finally {
      await new Promise((resolve) => back.close(resolve));
    }
  } finally {
    await app.close();
  }
});

test('las capas se guardan y vuelven al arrancar, aunque haya pasado mucho tiempo', async () => {
  let first = await start();
  const page = await first.run('web.add', { url: at('/palabra'), name: 'Palabra' });
  await first.run('layers.set', { n: 3, kind: 'web', data: { id: page.id } });
  await first.run('layers.visible', { n: 3, visible: false });
  await first.app.close();
  first = null;
  const { app, slots } = await start();
  try {
    const three = slots()[2];
    assert.equal(three.title, 'Palabra');
    assert.equal(three.visible, false);
    assert.ok(await until(() => slots()[2].ready));
  } finally {
    await app.close();
  }
});
