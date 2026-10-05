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
import media from '../server/modules/media/index.js';
import { imageInfo } from '../server/core/images.js';
import { cleanName } from '../server/core/names.js';
import { applyView, initialView } from '../server/core/view.js';
import { makePng } from '../scripts/lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-medios-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

// Cabeceras mínimas de cada formato: lo justo para que se reconozca y se lean sus medidas.
const le16 = (n) => [n & 0xff, n >> 8];
const be16 = (n) => [n >> 8, n & 0xff];
const le24 = (n) => [n & 0xff, (n >> 8) & 0xff, n >> 16];
const pad = (bytes, size = 40) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(Math.max(0, size - bytes.length))]);
const gif = (w, h) => pad([...Buffer.from('GIF89a'), ...le16(w), ...le16(h)]);
// Con un bloque de datos de la cámara (APP1) delante, como traen las fotos de un celular.
const jpeg = (w, h) => pad([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x06, 1, 2, 3, 4, 0xff, 0xc0, 0x00, 0x11, 8, ...be16(h), ...be16(w), 3]);
const riff = (chunk, rest) => pad([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), ...Buffer.from(chunk), 0, 0, 0, 0, ...rest]);
const webpLossy = (w, h) => riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)]);
const webpLossless = (w, h) => {
  const bits = ((w - 1) | ((h - 1) << 14)) >>> 0;
  return riff('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff]);
};
const webpExtended = (w, h) => riff('VP8X', [0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]);

test('imageInfo reconoce JPG, PNG, WebP y GIF por su contenido y lee sus medidas', () => {
  assert.deepEqual(imageInfo(makePng(4, 3)), { type: 'png', width: 4, height: 3 });
  assert.deepEqual(imageInfo(gif(320, 200)), { type: 'gif', width: 320, height: 200 });
  assert.deepEqual(imageInfo(jpeg(4032, 3024)), { type: 'jpeg', width: 4032, height: 3024 });
  assert.deepEqual(imageInfo(webpLossy(1280, 720)), { type: 'webp', width: 1280, height: 720 });
  assert.deepEqual(imageInfo(webpLossless(1920, 1080)), { type: 'webp', width: 1920, height: 1080 });
  assert.deepEqual(imageInfo(webpExtended(2560, 1440)), { type: 'webp', width: 2560, height: 1440 });
});

test('imageInfo no acepta lo que no es una imagen', () => {
  assert.equal(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(imageInfo(Buffer.from('%PDF-1.7 esto es un documento, no una imagen')), null);
  assert.equal(imageInfo(Buffer.alloc(40)), null);
  assert.equal(imageInfo(Buffer.from([0xff, 0xd8])), null);
  assert.equal(imageInfo(gif(0, 200)), null, 'sin medidas no sirve');
  assert.equal(imageInfo(null), null);
});

test('la vista de una imagen al aire: empieza completa y cada orden se ajusta a lo permitido', () => {
  assert.deepEqual(initialView('cover'), { fit: 'cover', zoom: 1, x: 0.5, y: 0.5 });
  assert.deepEqual(initialView('raro'), { fit: 'contain', zoom: 1, x: 0.5, y: 0.5 });
  // Tras un reinicio se recupera el encuadre que tenía.
  assert.deepEqual(initialView('contain', { fit: 'cover', zoom: 2, x: 0.25, y: 0.8 }), { fit: 'cover', zoom: 2, x: 0.25, y: 0.8 });

  const start = initialView('contain');
  assert.deepEqual(applyView(start, { zoom: 2.456 }), { fit: 'contain', zoom: 2.46, x: 0.5, y: 0.5 });
  assert.deepEqual(applyView(start, { zoom: 99, x: -3, y: 7 }), { fit: 'contain', zoom: 5, x: 0, y: 1 });
  assert.deepEqual(applyView(start, { zoom: 'mucho', x: null, fit: 'estirar', otra: 1 }), start, 'lo que no se entiende se ignora');
  const moved = applyView(start, { fit: 'cover', zoom: 3, x: 0.1, y: 0.9 });
  assert.deepEqual(applyView(moved, { reset: true }), { fit: 'cover', zoom: 1, x: 0.5, y: 0.5 }, 'la vista completa conserva el ajuste');
});

test('cleanName ordena el nombre de una imagen', () => {
  assert.equal(cleanName('  Anuncios   de\noctubre '), 'Anuncios de octubre');
  assert.equal(cleanName('x'.repeat(200)).length, 80);
  assert.equal(cleanName(undefined), '');
});

// ---- La biblioteca, con el servidor de verdad ----

test('Medios: subir, nombrar, ajustar, proyectar, encuadrar al aire, añadir al orden y eliminar', async () => {
  const dataDir = path.join(tmp, 'datos');
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, projection, order, media]) await setup(app);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = (role) => {
    let cookie = '';
    const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
    return {
      request,
      async login() {
        const res = await request('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
        cookie = res.headers.get('set-cookie').split(';')[0];
      },
      async send(type, payload = {}) {
        const res = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) });
        return { status: res.status, ...(await res.json()) };
      },
      async put(url, body, type) {
        const res = await request(url, { method: 'POST', headers: { 'Content-Type': type }, body });
        return { status: res.status, ...(await res.json()) };
      },
    };
  };
  const control = client('control');
  await control.login();
  const state = async () => (await control.request('/api/state')).json();
  const folder = path.join(dataDir, 'media', 'imagenes');
  const files = () => (fs.existsSync(folder) ? fs.readdirSync(folder).sort() : []);

  try {
    const png = makePng(64, 36, (x) => [Math.round(x * 255), 80, 160]);
    assert.equal((await control.put('/api/media/images?name=x', png, 'application/pdf')).status, 415);
    // Dice ser una imagen, pero no lo es: no entra ni deja archivo.
    const fake = await control.put('/api/media/images?name=x', Buffer.from('<script>alert(1)</script>'.repeat(4)), 'image/png');
    assert.equal(fake.status, 415);
    assert.deepEqual(files(), []);

    const up = await control.put(`/api/media/images?name=${encodeURIComponent('  Anuncios   de octubre ')}`, png, 'image/png');
    assert.equal(up.status, 200);
    assert.deepEqual({ ...up, id: null, url: null, added: null }, {
      status: 200, id: null, name: 'Anuncios de octubre', url: null, thumb: null, width: 64, height: 36, bytes: png.length, fit: 'contain', added: null,
    });
    assert.equal(up.url, `/media/imagenes/${up.id}.png`);
    assert.deepEqual(files(), [`${up.id}.png`]);
    assert.deepEqual(Buffer.from(await (await control.request(up.url)).arrayBuffer()), png, 'se sirve tal como se subió');

    // Se envió diciendo que era un JPG y es un PNG: manda lo que el archivo es.
    const second = await control.put('/api/media/images', png, 'image/jpeg');
    assert.equal(second.url, `/media/imagenes/${second.id}.png`);
    assert.equal(second.name, 'Imagen');
    assert.deepEqual((await state()).media.images.map((i) => i.id), [second.id, up.id], 'las más recientes, primero');

    // Miniatura: la manda el dispositivo que sube.
    const thumb = await control.put(`/api/media/images/${up.id}/thumb`, jpeg(480, 270), 'image/jpeg');
    assert.equal(thumb.thumb, `/media/imagenes/${up.id}.mini.jpg`);
    assert.equal((await control.put(`/api/media/images/${up.id}/thumb`, png, 'image/jpeg')).status, 415);
    assert.equal((await control.put('/api/media/images/no-existe/thumb', jpeg(4, 4), 'image/jpeg')).status, 404);

    assert.equal((await control.send('media.rename', { id: up.id, name: 'Cartel de la campaña' })).status, 200);
    assert.equal((await control.send('media.rename', { id: up.id, name: '   ' })).status, 400);
    assert.equal((await control.send('media.fit', { id: up.id, fit: 'cover' })).status, 200);
    assert.equal((await control.send('media.fit', { id: up.id, fit: 'estirar' })).status, 400);
    const listed = (await state()).media.images.find((i) => i.id === up.id);
    assert.deepEqual([listed.name, listed.fit], ['Cartel de la campaña', 'cover']);

    // Al orden del culto, con el ajuste elegido.
    const added = await control.send('order.add', { kind: 'image', data: { id: up.id, fit: 'contain', sobra: true } });
    assert.deepEqual({ ...added.result, id: null }, { id: null, kind: 'image', title: 'Cartel de la campaña', subtitle: 'Imagen · 64 × 36', steps: 1, data: { id: up.id, fit: 'contain' } });
    assert.equal((await control.send('order.add', { kind: 'image', data: { id: 'no-existe' } })).status, 404);

    // Al aire: sin decir el ajuste, vale el de la imagen.
    assert.equal((await control.send('projection.show', { kind: 'image', data: { id: up.id } })).status, 200);
    let now = await state();
    assert.deepEqual({ ...now.projection.item, uid: null, source: null }, { kind: 'image', title: 'Cartel de la campaña', url: up.url, width: 64, height: 36, fit: 'cover', uid: null, source: null });
    assert.deepEqual(now.live.state, { fit: 'cover', zoom: 1, x: 0.5, y: 0.5 });

    assert.equal((await control.send('projection.control', { zoom: 2, x: 0.2 })).status, 200);
    assert.equal((await control.send('projection.control', { zoom: 40, y: -1, fit: 'contain' })).status, 200);
    assert.deepEqual((await state()).live.state, { fit: 'contain', zoom: 5, x: 0.2, y: 0 });
    assert.equal((await control.send('projection.control', { reset: true })).status, 200);
    assert.deepEqual((await state()).live.state, { fit: 'contain', zoom: 1, x: 0.5, y: 0.5 });

    // Quien solo opera el orden puede encuadrar lo que está al aire, pero no tocar la biblioteca.
    const orden = client('orden');
    await orden.login();
    assert.equal((await orden.send('projection.control', { zoom: 1.5 })).status, 200);
    assert.equal((await orden.put('/api/media/images?name=x', png, 'image/png')).status, 403);
    assert.equal((await orden.send('media.remove', { id: up.id })).status, 403);
    assert.equal((await orden.send('media.rename', { id: up.id, name: 'Otro' })).status, 403);

    // Eliminar borra la imagen y su miniatura; el elemento del orden deja de poder proyectarse.
    assert.equal((await control.send('media.remove', { id: up.id })).status, 200);
    assert.deepEqual(files(), [`${second.id}.png`]);
    assert.equal((await control.request(up.url)).status, 404);
    assert.equal((await control.send('order.show', { id: added.result.id })).status, 404);
    assert.equal((await control.send('media.remove', { id: up.id })).status, 404);

    // Lo guardado sobrevive a un reinicio, y una ficha sin archivo se descarta sola.
    app.storage.flushAll();
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'medios.json'), 'utf8'));
    assert.deepEqual(saved.images.map((i) => i.id), [second.id]);
    saved.images.push({ id: 'perdida', name: 'Perdida', file: 'imagenes/perdida.png', width: 1, height: 1, bytes: 1, added: 1 });
    fs.writeFileSync(path.join(dataDir, 'medios.json'), JSON.stringify(saved));
    const again = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias') });
    for (const setup of [system, projection, order, media]) await setup(again);
    assert.deepEqual(again.store.get('media').images.map((i) => i.id), [second.id]);
    await again.close();
  } finally {
    await app.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
