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

// El servidor de verdad, con sus módulos, atendido por HTTP en este equipo. Usa datos temporales
// y no anuncia nada en la red ni abre ventanas (no se llama a listen()).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-servidor-'));

async function start(name, env = {}) {
  // Las variables de entorno solo se leen al crear la app: se ponen y se quitan enseguida.
  Object.assign(process.env, env);
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, `${name}-biblias`) });
  for (const key of Object.keys(env)) delete process.env[key];
  for (const setup of [system, projection, order]) await setup(app);
  await app.tools.scan();
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = (url, options = {}) => fetch(base + url, { redirect: 'manual', ...options, headers: { ...options.headers, cookie } });
  const send = async (type, payload = {}) => {
    const res = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) });
    return { status: res.status, ...(await res.json()) };
  };
  return {
    app, request, send,
    state: async () => (await request('/api/state')).json(),
    // Desde este mismo equipo el control se concede sin PIN.
    async login(role = 'control') {
      const res = await request('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      cookie = res.headers.get('set-cookie').split(';')[0];
    },
    async stop() {
      await app.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const main = await start('datos');
await main.login();
test.after(async () => {
  await main.stop();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

// ---- Archivos grandes ----

test('un archivo se puede pedir por trozos, como hace un video al saltar', async () => {
  const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
  fs.writeFileSync(path.join(main.app.uploadsDir, 'video.mp4'), bytes);

  const whole = await main.request('/media/video.mp4');
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get('accept-ranges'), 'bytes');
  assert.equal(whole.headers.get('content-type'), 'video/mp4');
  assert.equal((await whole.arrayBuffer()).byteLength, 1000);

  const part = await main.request('/media/video.mp4', { headers: { Range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 100-199/1000');
  assert.deepEqual(Buffer.from(await part.arrayBuffer()), bytes.subarray(100, 200));

  const tail = await main.request('/media/video.mp4', { headers: { Range: 'bytes=-50' } });
  assert.equal(tail.headers.get('content-range'), 'bytes 950-999/1000');
  assert.equal((await tail.arrayBuffer()).byteLength, 50);

  const beyond = await main.request('/media/video.mp4', { headers: { Range: 'bytes=5000-' } });
  assert.equal(beyond.status, 416);
  assert.equal(beyond.headers.get('content-range'), 'bytes */1000');
});

test('lo que el navegador ya tiene no se vuelve a enviar, y un archivo cambiado sí', async () => {
  const file = path.join(main.app.uploadsDir, 'nota.txt');
  fs.writeFileSync(file, 'primera versión');
  const first = await main.request('/media/nota.txt');
  const etag = first.headers.get('etag');
  await first.arrayBuffer();
  assert.equal((await main.request('/media/nota.txt', { headers: { 'If-None-Match': etag } })).status, 304);
  fs.writeFileSync(file, 'segunda versión, más larga');
  const again = await main.request('/media/nota.txt', { headers: { 'If-None-Match': etag } });
  assert.equal(again.status, 200);
  assert.equal(await again.text(), 'segunda versión, más larga');
  // Con el archivo cambiado, un trozo pedido sobre la versión anterior se responde entero.
  const stale = await main.request('/media/nota.txt', { headers: { Range: 'bytes=0-3', 'If-Range': etag } });
  assert.equal(stale.status, 200);
  await stale.arrayBuffer();
});

test('no se puede salir de la carpeta servida', async () => {
  for (const url of ['/media/%2e%2e/sesiones.json', '/media/..%2Fsesiones.json', '/%2e%2e/package.json']) {
    const res = await main.request(url);
    assert.equal(res.status, 404, url);
    await res.arrayBuffer();
  }
});

test('una subida se guarda en disco, respeta el límite y no deja archivos a medias', async () => {
  const png = Buffer.alloc(300_000, 7);
  const ok = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png });
  assert.equal(ok.status, 200);
  const { url } = await ok.json();
  assert.deepEqual(fs.readFileSync(path.join(main.app.uploadsDir, path.basename(url))), png);
  assert.equal((await main.state()).projection.styles.bgImage, url);

  const empty = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(0) });
  assert.equal(empty.status, 400);
  const wrong = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: '<p>' });
  assert.equal(wrong.status, 415);
  const huge = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(21 * 1024 * 1024) })
    .then((res) => res.status, () => 413); // el servidor puede cortar la conexión antes de que termine de enviarse
  assert.equal(huge, 413);
  assert.deepEqual(fs.readdirSync(main.app.uploadsDir).filter((f) => f.endsWith('.parcial')), []);
  // El fondo anterior sigue siendo el válido.
  assert.equal((await main.state()).projection.styles.bgImage, url);
});

// ---- Mandos en vivo ----

test('un tipo con mandos en vivo se proyecta, se gobierna y valida sus órdenes', async () => {
  assert.equal((await main.send('projection.control', { pattern: 'barras' })).status, 409); // nada al aire

  const shown = await main.send('projection.show', { kind: 'testcard', data: {} });
  assert.equal(shown.status, 200);
  let state = await main.state();
  assert.equal(state.projection.item.kind, 'testcard');
  assert.equal(state.live.uid, state.projection.item.uid);
  assert.deepEqual([state.live.state.pattern, state.live.state.clock.playing], ['ajuste', false]);

  assert.equal((await main.send('projection.control', { pattern: 'barras', playing: true })).status, 200);
  state = await main.state();
  assert.deepEqual([state.live.state.pattern, state.live.state.clock.playing], ['barras', true]);

  const bad = await main.send('projection.control', { pattern: 'inventado' });
  assert.equal(bad.status, 400);
  assert.match(bad.error, /no existe/);
  assert.equal((await main.send('projection.control', { position: -3 })).status, 400);
  assert.equal((await main.state()).live.state.pattern, 'barras'); // una orden rechazada no cambia nada

  // Al proyectar otra cosa, los mandos empiezan de nuevo y pertenecen a la nueva proyección.
  await main.send('projection.show', { kind: 'testcard', data: {} });
  state = await main.state();
  assert.equal(state.live.uid, state.projection.item.uid);
  assert.equal(state.live.state.pattern, 'ajuste');

  await main.send('projection.clear');
  state = await main.state();
  assert.deepEqual([state.projection.item, state.live.state], [null, null]);
});

test('el volumen general se valida y se guarda', async () => {
  assert.equal((await main.send('projection.volume', { volume: 0.4 })).status, 200);
  assert.equal((await main.state()).live.volume, 0.4);
  for (const volume of [1.5, -0.1, 'alto', null]) assert.equal((await main.send('projection.volume', { volume })).status, 400);
  assert.equal((await main.state()).live.volume, 0.4);
});

test('un tipo nuevo entra en el orden del culto, se proyecta desde él y admite nombre propio', async () => {
  const added = await main.send('order.add', { kind: 'testcard', data: {} });
  assert.equal(added.status, 200);
  const { id } = added.result;
  assert.deepEqual([added.result.title, added.result.steps], ['Imagen de prueba', 1]);

  const renamed = await main.send('order.rename', { id, title: 'Encuadre del proyector' });
  assert.deepEqual([renamed.result.title, renamed.result.original], ['Encuadre del proyector', 'Imagen de prueba']);
  const restored = await main.send('order.rename', { id, title: '' });
  assert.deepEqual([restored.result.title, restored.result.original], ['Imagen de prueba', undefined]);

  assert.equal((await main.send('order.show', { id })).status, 200);
  const state = await main.state();
  assert.equal(state.projection.item.source.orderId, id);
  assert.equal(state.live.state.pattern, 'ajuste');
  const steps = await (await main.request(`/api/order/${id}/steps`)).json();
  assert.equal(steps.steps.length, 1);
  await main.send('order.clear');
  await main.send('projection.clear');
});

test('sin sesión no se gobierna nada', async () => {
  const anonymous = await fetch(new URL('/api/action', (await main.request('/api/ping')).url), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'projection.control', payload: {} }),
  });
  assert.equal(anonymous.status, 401);
  await anonymous.arrayBuffer();
});

// ---- Revisión del equipo ----

test('la revisión del equipo lista los programas y dice con qué página abrir', async () => {
  const { tools } = await main.state();
  assert.equal(tools.checked, true);
  assert.deepEqual(tools.list.map((t) => t.id), ['navegador', 'ffmpeg', 'yt-dlp', 'powerpoint']);
  assert.equal(tools.pending, tools.list.filter((t) => t.level === 'feature' && !t.found).length);
  assert.equal(main.app.tools.entry(), tools.pending ? '/requisitos' : '/control');
});

test('aunque falten programas, ni siquiera el navegador, ninguna página se bloquea', async () => {
  const bare = await start('sin-programas', { MANNA_FALTA: 'navegador,ffmpeg,yt-dlp' });
  try {
    const { tools } = await bare.state();
    assert.equal(tools.pending, 3);
    assert.deepEqual(tools.list.filter((t) => !t.found && t.level === 'feature').map((t) => t.id), ['navegador', 'ffmpeg', 'yt-dlp']);
    // Manna se abre en la revisión, que avisa; pero el control y lo demás siguen ahí.
    assert.equal(bare.app.tools.entry(), '/requisitos');
    for (const page of ['/', '/control', '/orden', '/proyeccion', '/requisitos']) {
      const res = await bare.request(page);
      assert.equal(res.status, 200, page);
      await res.arrayBuffer();
    }
    // Lo que sí falla, con un mensaje que dice qué hacer, es usar el programa que falta.
    assert.equal(bare.app.tools.path('ffmpeg'), null);
    assert.throws(() => bare.app.tools.spawn('ffmpeg', ['-version']), /Falta ffmpeg.*Ajustes/);
    // Instalar exige sesión de control en el equipo principal; aquí no hay sesión.
    assert.equal((await bare.send('tools.install', { id: 'yt-dlp' })).status, 401);
  } finally {
    await bare.stop();
  }
});
