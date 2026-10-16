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
import web, { framable, parseAddress } from '../server/modules/web/index.js';
import { makePng } from '../scripts/lib/png.mjs';

// El servidor de verdad, con sus módulos, atendido por HTTP en este equipo. Usa datos temporales
// y no anuncia nada en la red ni abre ventanas (no se llama a listen()).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-servidor-'));

async function start(name, env = {}) {
  // Las variables de entorno solo se leen al crear la app: se ponen y se quitan enseguida.
  Object.assign(process.env, env);
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, `${name}-biblias`) });
  for (const key of Object.keys(env)) delete process.env[key];
  for (const setup of [system, projection, order, web]) await setup(app);
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
    app, base, request, send,
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
  const png = makePng(320, 180, (x, y) => [Math.round(x * 255), Math.round(y * 255), 90]);
  const folder = path.join(main.app.uploadsDir, 'fondos');
  const ok = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png });
  assert.equal(ok.status, 200);
  const { id, url } = await ok.json();
  assert.equal(url, `/media/fondos/${id}.png`);
  assert.deepEqual(fs.readFileSync(path.join(folder, `${id}.png`)), png);
  assert.equal((await main.state()).projection.styles.bgImage, url);

  const empty = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(0) });
  assert.equal(empty.status, 400);
  const wrong = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: '<p>' });
  assert.equal(wrong.status, 415);
  // Dice ser una imagen y no lo es.
  const fake = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(300_000, 7) });
  assert.equal(fake.status, 415);
  const huge = await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(21 * 1024 * 1024) })
    .then((res) => res.status, () => 413); // el servidor puede cortar la conexión antes de que termine de enviarse
  assert.equal(huge, 413);
  assert.deepEqual(fs.readdirSync(folder), [`${id}.png`], 'ni archivos a medias ni los rechazados');
  // El fondo anterior sigue siendo el válido.
  assert.equal((await main.state()).projection.styles.bgImage, url);
});

test('«Limpiar multimedia temporales» borra lo subido, también del orden del culto, y deja el fondo de Ajustes', async () => {
  // Una página web hecha con un archivo (lo subido de esta prueba; Medios y Diapositivas lo borran con su misma orden).
  const page = await (await main.request('/api/web?name=Concurso', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: '<!doctype html><p>Concurso</p>'.padEnd(4000, ' ') })).json();
  const background = await (await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: makePng(16, 9, () => [10, 90, 200]) })).json();
  const inOrder = (await main.send('order.add', { kind: 'web', data: { id: page.id } })).result;
  assert.ok(inOrder);
  await main.send('order.show', { id: inOrder.id, step: 0 });
  const disk = await (await main.request('/api/system/disk')).json();
  assert.ok(disk.groups.find((g) => g.id === 'pages').bytes >= 4000, JSON.stringify(disk.groups));
  assert.ok(disk.free > 0 && disk.size >= disk.free, 'dice lo libre del disco');

  const done = (await main.send('system.clean')).result;
  assert.ok(done.removed >= 1 && done.failed === 0 && done.freed >= 4000, JSON.stringify(done));
  const after = await main.state();
  assert.equal(after.web.pages.some((p) => p.id === page.id), false);
  assert.equal(after.order.items.some((i) => i.id === inOrder.id), false, 'se quita del orden del culto');
  assert.equal(after.projection.item, null, 'lo que estaba al aire se va');
  assert.ok(after.projection.backgrounds.some((b) => b.id === background.id), 'el fondo de Ajustes se queda');
  assert.equal((await (await main.request('/api/system/disk')).json()).groups.find((g) => g.id === 'pages').bytes, 0);
});

test('las imágenes de fondo se conservan: se elige entre ellas, junto a los colores, y se eliminan', async () => {
  const upload = async (color) => (await main.request('/api/projection/background', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: makePng(16, 9, () => color) })).json();
  const before = (await main.state()).projection.backgrounds;
  const first = await upload([200, 30, 30]);
  const second = await upload([30, 30, 200]);
  let { styles, backgrounds } = (await main.state()).projection;
  assert.deepEqual(backgrounds.slice(before.length), [{ id: first.id, url: first.url }, { id: second.id, url: second.url }]);
  assert.deepEqual([styles.backgroundType, styles.bgImage], ['image', second.url], 'la recién subida queda puesta');

  // Pasar a un color no borra las imágenes.
  assert.equal((await main.send('projection.styles', { backgroundType: 'solid', bgColor: '#000000' })).status, 200);
  // El tamaño de los subtítulos: entre 60 % y 200 %; lo demás no se guarda.
  await main.send('projection.styles', { subtitleSize: 150 });
  await main.send('projection.styles', { subtitleSize: 900 });
  await main.send('projection.styles', { subtitleSize: 'enorme' });
  assert.equal((await main.state()).projection.styles.subtitleSize, 150);
  ({ styles, backgrounds } = (await main.state()).projection);
  assert.deepEqual([styles.backgroundType, styles.bgImage], ['solid', '']);
  assert.equal(backgrounds.length, before.length + 2);
  assert.equal((await main.request(first.url)).status, 200);

  // Volver a una imagen guardada.
  assert.equal((await main.send('projection.background', { id: first.id })).status, 200);
  assert.deepEqual((await main.state()).projection.styles.bgImage, first.url);
  assert.equal((await main.send('projection.background', { id: 'no-existe' })).status, 404);

  // Eliminar una que no está puesta no cambia el fondo; eliminar la puesta vuelve al color.
  assert.equal((await main.send('projection.backgroundRemove', { id: second.id })).status, 200);
  assert.equal((await main.request(second.url)).status, 404);
  assert.equal((await main.state()).projection.styles.bgImage, first.url);
  assert.equal((await main.send('projection.backgroundRemove', { id: first.id })).status, 200);
  ({ styles, backgrounds } = (await main.state()).projection);
  assert.notEqual(styles.backgroundType, 'image');
  assert.equal(styles.bgImage, '');
  assert.equal(backgrounds.length, before.length);
  assert.equal((await main.send('projection.backgroundRemove', { id: first.id })).status, 404);
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

test('el puntero señala sobre lo que está al aire y desaparece al soltar, al cambiar de contenido o si no es válido', async () => {
  const shown = await main.send('projection.show', { kind: 'testcard', data: {} });
  assert.equal((await main.send('projection.pointer', { x: 0.25, y: 0.75 })).status, 200);
  assert.deepEqual((await main.state()).pointer, { uid: shown.result.uid, x: 0.25, y: 0.75 });
  for (const bad of [{ x: 2, y: 0.5 }, { x: '0.5', y: 0.5 }, {}]) {
    await main.send('projection.pointer', { x: 0.5, y: 0.5 });
    await main.send('projection.pointer', bad);
    assert.equal((await main.state()).pointer.x, null, JSON.stringify(bad));
  }
  // Ligado a la proyección: lo de antes no se ve sobre lo nuevo, y en negro no se señala.
  await main.send('projection.pointer', { x: 0.5, y: 0.5 });
  await main.send('projection.show', { kind: 'testcard', data: {} });
  const state = await main.state();
  assert.notEqual(state.pointer.uid, state.projection.item.uid);
  await main.send('projection.mode', { mode: 'black' });
  await main.send('projection.pointer', { x: 0.5, y: 0.5 });
  assert.equal((await main.state()).pointer.x, null);
  await main.send('projection.clear');
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

test('lo que llega por un túnel o un proxy de este equipo no cuenta como el equipo principal', async () => {
  // Así entrega cloudflared lo que viene de internet: desde 127.0.0.1, con estas cabeceras.
  const tunnel = { 'Cf-Connecting-Ip': '203.0.113.9', 'X-Forwarded-For': '203.0.113.9' };
  const outside = (url, options = {}) => fetch(new URL(url, main.base), { ...options, headers: { ...options.headers, ...tunnel } });
  assert.equal((await (await outside('/api/session')).json()).isLocal, false);
  const login = await outside('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  assert.equal(login.status, 401, 'sin PIN no entra');
  assert.notEqual((await outside('/api/system/pin')).status, 200);
  // Sin esas cabeceras sigue siendo el equipo principal.
  assert.equal((await (await main.request('/api/session')).json()).isLocal, true);
});

test('desde internet nada se ve sin PIN, ni la pantalla de proyección', async () => {
  const tunnel = { 'Cf-Connecting-Ip': '203.0.113.9', 'X-Forwarded-For': '203.0.113.9' };
  const outside = (url, options = {}) => fetch(new URL(url, main.base), { ...options, headers: { ...options.headers, ...tunnel } });
  const info = await (await outside('/api/session')).json();
  assert.equal(info.internet, true);
  assert.ok(info.roles.every((r) => r.requiresPin), 'todas las funciones piden PIN');
  assert.equal((await main.request('/api/session').then((r) => r.json())).internet, false);
  // La interfaz y lo necesario para entrar, sí; el contenido y el estado, no.
  for (const url of ['/', '/proyeccion', '/core/api.js', '/api/ping']) assert.equal((await outside(url)).status, 200, url);
  for (const url of ['/api/state', '/api/events?rol=proyeccion', '/media/x.jpg', '/paginas/x']) assert.equal((await outside(url)).status, 401, url);
  // La proyección pide el PIN; con él, entra y ve el estado.
  const open = (pin) => outside('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'proyeccion', pin }) });
  assert.equal((await open()).status, 401, 'sin PIN no entra');
  const { pin } = await (await main.request('/api/system/pin')).json();
  const entered = await open(pin);
  assert.equal(entered.status, 200);
  const cookie = entered.headers.get('set-cookie').split(';')[0];
  assert.equal((await outside('/api/state', { headers: { cookie } })).status, 200, 'con la sesión, sí');
});

test('cambiar el PIN cierra las demás sesiones, también las abiertas sin PIN', async () => {
  const other = await fetch(new URL('/api/session', main.base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  const cookie = other.headers.get('set-cookie').split(';')[0];
  const state = () => fetch(new URL('/api/action', main.base), { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type: 'projection.mode', payload: { mode: 'clear' } }) }).then((res) => res.status);
  assert.equal(await state(), 200);
  for (const wrong of ['123', '12345', '12a4']) assert.equal((await main.send('system.setPin', { pin: wrong })).status, 400, `«${wrong}» no vale: 4 números`);
  assert.equal(await state(), 200, 'un PIN rechazado no cierra nada');
  assert.equal((await main.send('system.setPin', { pin: '1357' })).status, 200);
  assert.equal(await state(), 401, 'la otra sesión ya no vale');
  assert.equal((await main.send('projection.mode', { mode: 'clear' })).status, 200, 'la de quien lo cambió, sí');
});

// ---- Revisión del equipo ----

test('la revisión del equipo lista los programas y dice con qué página abrir', async () => {
  const { tools } = await main.state();
  assert.equal(tools.checked, true);
  assert.deepEqual(tools.list.map((t) => t.id), ['navegador', 'ffmpeg', 'yt-dlp', 'cloudflared', 'powerpoint']);
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

// ---- Páginas web ----

// Un sitio de mentira en este equipo: responde según la ruta, para probar cómo se reconoce lo que se deja mostrar.
async function withSite(run) {
  const routes = {
    '/libre': [200, {}],
    '/deny': [200, { 'X-Frame-Options': 'DENY' }],
    '/same': [200, { 'X-Frame-Options': 'SAMEORIGIN' }],
    '/csp-no': [200, { 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'" }],
    '/csp-todos': [200, { 'Content-Security-Policy': 'frame-ancestors *' }],
    '/roto': [500, {}],
  };
  const site = http.createServer((req, res) => {
    const [status, headers] = routes[req.url] || [404, {}];
    res.writeHead(status, headers);
    res.end('<html></html>');
  });
  await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${site.address().port}`);
  } finally {
    await new Promise((resolve) => site.close(resolve));
  }
}

test('una dirección se agrega y se reconoce si se deja mostrar dentro de la proyección', async () => {
  await withSite(async (site) => {
    const add = async (route) => (await main.send('web.add', { url: site + route })).result;
    const libre = await add('/libre');
    assert.deepEqual([libre.framable, libre.source, libre.url, libre.name], [true, 'url', `${site}/libre`, '127.0.0.1']);
    assert.equal((await add('/deny')).framable, false);
    assert.equal((await add('/same')).framable, false);
    assert.equal((await add('/csp-no')).framable, false);
    assert.equal((await add('/csp-todos')).framable, true);
    const roto = await main.send('web.add', { url: `${site}/roto`, name: 'Juego roto' });
    assert.deepEqual([roto.status, roto.result.framable, roto.result.name], [200, false, 'Juego roto'], 'si responde con error se agrega, en su propia ventana');
    const pages = (await main.state()).web.pages;
    assert.equal(pages.length, 6);
    assert.deepEqual(pages.map((p) => p.added), pages.map((p) => p.added).sort((a, b) => b - a), 'la más reciente va primero');
    assert.match(pages.find((p) => p.id === roto.result.id).subtitle, /127\.0\.0\.1 · en su propia ventana/);
    assert.equal(pages.find((p) => p.id === libre.id).subtitle, '127.0.0.1');
  });
  // Un puerto cerrado no se puede abrir; un texto que no es una dirección ni se intenta.
  const closed = http.createServer();
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
  const { port } = closed.address();
  await new Promise((resolve) => closed.close(resolve));
  assert.equal((await main.send('web.add', { url: `http://127.0.0.1:${port}/` })).status, 502);
  assert.equal((await main.send('web.add', { url: 'hola' })).status, 400);
  assert.equal((await main.state()).web.pages.length, 6);

  assert.equal(parseAddress('canva.com/x'), 'https://canva.com/x');
  assert.equal(parseAddress(' http://localhost:3000/a '), 'http://localhost:3000/a');
  for (const bad of ['hola', '', 'ftp://sitio.com', null]) assert.throws(() => parseAddress(bad), /dirección de la página/, String(bad));
  const headers = (h) => (name) => h[name] ?? null;
  assert.equal(framable(headers({})), true);
  assert.equal(framable(headers({ 'x-frame-options': 'deny' })), false);
  assert.equal(framable(headers({ 'content-security-policy': "frame-ancestors 'self' https://a.com" })), false);
  assert.equal(framable(headers({ 'content-security-policy': 'script-src *' })), true);
});

test('un archivo HTML se sube, se sirve encerrado y con el puente; lo que no es HTML se rechaza', async () => {
  const upload = (name, body) => main.request(`/api/web?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
  const html = '<!doctype html><html><body><h1>Juego de prueba</h1></body></html>';
  const ok = await upload('Juego de prueba', html);
  assert.equal(ok.status, 200);
  const page = await ok.json();
  assert.deepEqual([page.source, page.url, page.name, page.framable], ['file', `/paginas/${page.id}`, 'Juego de prueba', true]);

  const before = (await main.state()).web.pages.length;
  assert.equal((await upload('Binario', Buffer.from([0x89, 0, 1, 2, 0, 0, 60, 100, 105, 118, 62]))).status, 415);
  assert.equal((await upload('Texto', 'solo texto, sin etiquetas')).status, 415);
  assert.equal((await main.state()).web.pages.length, before, 'lo rechazado no queda en la biblioteca');
  assert.equal(fs.readdirSync(path.join(main.app.dataDir, 'paginas')).length, 1, 'ni su archivo');

  // Sin sesión no se sube.
  const anonymous = await fetch(`${main.base}/api/web?name=x`, { method: 'POST', body: html });
  assert.ok([401, 403].includes(anonymous.status), String(anonymous.status));
  await anonymous.arrayBuffer();

  // Se sirve sin sesión (la abre la pantalla de proyección), encerrada y con el puente al final.
  const served = await fetch(`${main.base}${page.url}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-security-policy'), 'sandbox allow-scripts');
  const body = await served.text();
  assert.ok(body.startsWith(html));
  const bridge = body.slice(html.length);
  assert.ok(bridge.includes('manna') && bridge.includes('tecla'));
  const missing = await fetch(`${main.base}/paginas/inexistente`);
  assert.equal(missing.status, 404);
  await missing.arrayBuffer();
});

test('el tipo web: un archivo se pasa con las flechas; una dirección no tiene mandos', async () => {
  const pages = (await main.state()).web.pages;
  const file = pages.find((p) => p.source === 'file');
  const own = pages.find((p) => p.source === 'url' && !p.framable);
  const framed = pages.find((p) => p.source === 'url' && p.framable);

  assert.equal((await main.send('projection.show', { kind: 'web', data: { id: file.id } })).status, 200);
  let state = await main.state();
  assert.deepEqual([state.projection.item.file, state.projection.item.window], [true, null]);
  assert.deepEqual(state.live.state, { presses: [], count: 0 });
  await main.send('projection.control', { key: 'ArrowRight' });
  await main.send('projection.control', { key: 'ArrowRight' });
  assert.equal((await main.send('projection.control', { key: 'ArrowLeft' })).status, 200);
  assert.deepEqual((await main.state()).live.state, { presses: ['ArrowRight', 'ArrowRight', 'ArrowLeft'], count: 3 });
  assert.equal((await main.send('projection.control', { key: 'Enter' })).status, 400);
  assert.equal((await main.state()).live.state.count, 3, 'una tecla no permitida no cambia nada');

  // Una dirección que no se deja mostrar la abre el proyector en su ventana, y se pasa con las flechas
  // (las pulsa el módulo de proyección en esa ventana); la que se deja no tiene mandos.
  await main.send('projection.show', { kind: 'web', data: { id: own.id } });
  state = await main.state();
  assert.deepEqual([state.projection.item.window, state.projection.item.file], [own.url, false]);
  assert.equal((await main.send('projection.control', { key: 'ArrowRight' })).status, 200);
  assert.deepEqual((await main.state()).live.state, { presses: ['ArrowRight'], count: 1 });
  await main.send('projection.show', { kind: 'web', data: { id: framed.id } });
  assert.equal((await main.state()).projection.item.window, null);
  assert.equal((await main.send('projection.control', { key: 'ArrowRight' })).status, 409);

  const added = await main.send('order.add', { kind: 'web', data: { id: file.id } });
  assert.deepEqual([added.status, added.result.title, added.result.steps], [200, file.name, 1]);
  await main.send('order.clear');
  await main.send('projection.clear');
});

test('una página se renombra, también lo que está al aire, y al quitarla se borra su archivo', async () => {
  const file = (await main.state()).web.pages.find((p) => p.source === 'file');
  await main.send('projection.show', { kind: 'web', data: { id: file.id } });
  assert.equal((await main.send('web.rename', { id: file.id, name: 'Trivia de domingo' })).status, 200);
  const state = await main.state();
  assert.equal(state.web.pages.find((p) => p.id === file.id).name, 'Trivia de domingo');
  assert.equal(state.projection.item.title, 'Trivia de domingo');
  assert.equal((await main.send('web.rename', { id: file.id, name: '  ' })).status, 400);

  assert.equal((await main.send('web.remove', { id: file.id })).status, 200);
  assert.equal((await main.state()).web.pages.some((p) => p.id === file.id), false);
  const gone = await fetch(`${main.base}/paginas/${file.id}`);
  assert.equal(gone.status, 404);
  await gone.arrayBuffer();
  assert.equal((await main.send('web.remove', { id: file.id })).status, 404);
  await main.send('projection.clear');
});

test('una orden mal formada no cierra Manna ni cuela datos sin validar', async () => {
  const bad = await main.send('tools.install', { id: 'no-existe' });
  assert.equal(bad.status, 400);
  const styled = await main.send('projection.styles', { toString: 'malo', valueOf: 'malo' });
  assert.equal(styled.status, 200);
  const { styles } = (await main.state()).projection;
  assert.equal(Object.hasOwn(styles, 'toString') || Object.hasOwn(styles, 'valueOf'), false);
  const alive = await main.request('/api/ping');
  assert.equal(alive.status, 200);
  await alive.arrayBuffer();
});

test('una orden que no viene de Manna (origen «null» o de otro sitio) se rechaza', async () => {
  const post = (headers) => main.request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ type: 'projection.mode', payload: { mode: 'clear' } }) });
  const statusOf = async (headers) => {
    const res = await post(headers);
    await res.arrayBuffer();
    return res.status;
  };
  assert.equal(await statusOf({ Origin: 'null' }), 403);
  assert.equal(await statusOf({ 'Sec-Fetch-Site': 'cross-site' }), 403);
  // Otro puerto del mismo equipo, u otro subdominio: el navegador dice «same-site».
  assert.equal(await statusOf({ 'Sec-Fetch-Site': 'same-site' }), 403);
  assert.equal(await statusOf({ 'Sec-Fetch-Site': 'same-origin' }), 200);
  assert.equal(await statusOf({}), 200);
  // Leer no se restringe: la página encerrada se abre con origen «null».
  const read = await main.request('/api/ping', { headers: { Origin: 'null' } });
  assert.equal(read.status, 200);
  await read.arrayBuffer();
});
