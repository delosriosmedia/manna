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
import slides from '../server/modules/slides/index.js';
import { collect, explain, exportPlan, isPresentation, MAC_SCRIPT, readLine, WIN_SCRIPT } from '../server/modules/slides/powerpoint.js';
import { fakePresentation, writeFakePowerPoint } from '../scripts/lib/powerpoint-falso.mjs';
import { makePng } from '../scripts/lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-diapositivas-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// La imagen JPG más pequeña posible (un punto): para el servidor, una página ya convertida.
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

test('isPresentation reconoce un PowerPoint por su contenido, no por su nombre', () => {
  assert.equal(isPresentation(fakePresentation()), true, 'moderno (.pptx): empieza como un ZIP');
  assert.equal(isPresentation(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])), true, 'antiguo (.ppt)');
  assert.equal(isPresentation(Buffer.from('%PDF-1.7 esto es un PDF')), false);
  assert.equal(isPresentation(JPG), false);
  assert.equal(isPresentation(Buffer.from('PK')), false, 'demasiado corto');
  assert.equal(isPresentation(null), false);
});

test('las órdenes para PowerPoint nunca llevan la ruta pegada en el texto', () => {
  const input = 'C:\\Datos de Manna\\tmp\\presentación "final".pptx';
  const win = exportPlan('win32', { input, dir: 'C:\\salida' });
  assert.equal(win.file, 'powershell.exe');
  assert.equal(win.args.at(-2), '-EncodedCommand');
  const script = Buffer.from(win.args.at(-1), 'base64').toString('utf16le');
  assert.equal(script, WIN_SCRIPT, 'el guion viaja codificado, entero');
  assert.equal(win.args.join(' ').includes('Datos de Manna'), false);
  assert.deepEqual([win.env.MANNA_PPT_ENTRADA, win.env.MANNA_PPT_SALIDA], [input, 'C:\\salida'], 'las rutas van en variables de entorno');
  // Sin ventana, sin cerrar un PowerPoint que ya estuviera en uso, y sin las diapositivas ocultas.
  assert.match(script, /Presentations\.Open\(\$entrada, -1, 0, 0\)/);
  assert.match(script, /\$abiertas -eq 0/);
  assert.match(script, /SlideShowTransition\.Hidden -eq 0/);
  assert.match(script, /"MANNA`ttotal`t"/);

  const mac = exportPlan('darwin', { input: '/tmp/a b.pptx', dir: '/tmp/salida' });
  assert.deepEqual([mac.file, mac.args[0], mac.args[1]], ['osascript', '-e', MAC_SCRIPT]);
  assert.deepEqual(mac.args.slice(2), ['/tmp/a b.pptx', '/tmp/salida'], 'las rutas van como argumentos');
  assert.equal(MAC_SCRIPT.includes('/tmp'), false);
  assert.match(MAC_SCRIPT, /if not estabaAbierto then quit/);

  assert.equal(exportPlan('linux', { input: 'a', dir: 'b' }), null);
  const fake = exportPlan('win32', { input: 'a', dir: 'b', fake: '/x/guion.mjs' });
  assert.deepEqual([fake.file, fake.args], [process.execPath, ['/x/guion.mjs']]);
});

test('readLine, collect y explain entienden lo que deja y dice PowerPoint', () => {
  assert.deepEqual(readLine('MANNA\ttotal\t24\r'), { total: 24 });
  assert.deepEqual(readLine('MANNA\tslide\t3'), { slide: 3 });
  assert.equal(readLine('MANNA\tslide\tx'), null);
  assert.equal(readLine('otra cosa'), null);
  // En Mac, PowerPoint deja "Slide1.jpeg"… (con Office en español, "Diapositiva1.jpeg"): manda el número.
  const mac = path.join(tmp, 'mac');
  fs.mkdirSync(mac);
  for (const name of ['Slide10.jpeg', 'Slide2.jpeg', 'Slide1.jpeg', 'notas.txt']) fs.writeFileSync(path.join(mac, name), '');
  assert.deepEqual(collect(mac).map((p) => [path.basename(p.file), p.thumb]), [['Slide1.jpeg', null], ['Slide2.jpeg', null], ['Slide10.jpeg', null]]);
  const win = path.join(tmp, 'win');
  fs.mkdirSync(win);
  for (const name of ['2.jpg', 'm2.jpg', '1.jpg', 'm1.jpg']) fs.writeFileSync(path.join(win, name), '');
  assert.deepEqual(collect(win).map((p) => [path.basename(p.file), path.basename(p.thumb)]), [['1.jpg', 'm1.jpg'], ['2.jpg', 'm2.jpg']]);
  assert.deepEqual(collect(path.join(tmp, 'no-existe')), []);
  assert.match(explain('execution error: Not authorized to send Apple events to Microsoft PowerPoint. (-1743)', 'darwin'), /Automatización/);
  assert.match(explain('Retrieving the COM class factory ... 80040154 Class not registered', 'win32'), /PDF/);
  assert.match(explain('execution error: Microsoft PowerPoint detectó un error: Tiempo límite agotado para un evento Apple. (-1712)', 'darwin'), /acéptalo/);
  assert.match(explain('algo raro', 'win32'), /Guárdala como PDF/);
});

// ---- Contra el servidor de verdad ----
async function start(name, env = {}) {
  Object.assign(process.env, env);
  const dataDir = path.join(tmp, name);
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias'), mediaDir: path.join(tmp, `${name}-carpeta`) });
  for (const setup of [system, projection, order, slides]) await setup(app);
  await app.tools.scan();
  for (const key of Object.keys(env)) delete process.env[key];
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (role) => {
    const res = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    return res.headers.get('set-cookie').split(';')[0];
  };
  let cookie = await login('control');
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
  const json = async (res) => ({ ...(await res.json()), http: res.status });
  const api = {
    app, dataDir, request,
    as: async (role) => { cookie = await login(role); },
    send: async (type, payload = {}) => json(await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) })),
    put: async (url, body = '') => json(await request(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body })),
    state: async () => (await request('/api/state')).json(),
    decks: async () => (await api.state()).slides.decks,
    async settle(id, status, ms = 15_000) {
      for (let waited = 0; waited < ms; waited += 50) {
        const deck = (await api.decks()).find((d) => d.id === id);
        if (deck?.status === status) return deck;
        await sleep(50);
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

test('un PDF llega ya convertido en imágenes, página a página, y se proyecta diapositiva a diapositiva', async () => {
  const s = await start('pdf');
  try {
    assert.equal((await s.put('/api/slides?name=x&pages=0')).http, 400);
    assert.equal((await s.put('/api/slides?name=x&pages=9999')).http, 413);
    const { id } = await s.put('/api/slides?name=Informe%20de%20tesorer%C3%ADa&pages=3');
    assert.match(id, /^[0-9a-f]{12}$/);
    assert.deepEqual(await s.decks(), [], 'mientras llegan las páginas no se ve en la biblioteca');

    assert.equal((await s.put(`/api/slides/${id}/pages/1`, JPG)).http, 200);
    assert.equal((await s.put(`/api/slides/${id}/pages/1?mini=1`, JPG)).http, 200);
    assert.equal((await s.put(`/api/slides/${id}/pages/2`, makePng(4, 4))).http, 415, 'una página que no es JPG se rechaza');
    assert.equal((await s.put(`/api/slides/${id}/pages/2`, 'esto no es una imagen')).http, 415);
    assert.equal((await s.put(`/api/slides/${id}/pages/9`, JPG)).http, 400, 'una página que la presentación no tiene');
    assert.equal((await s.send('slides.finish', { id })).http, 409, 'no se da por terminada si faltan páginas');
    for (const n of [2, 3]) {
      assert.equal((await s.put(`/api/slides/${id}/pages/${n}`, JPG)).http, 200);
      assert.equal((await s.put(`/api/slides/${id}/pages/${n}?mini=1`, JPG)).http, 200);
    }
    const done = await s.send('slides.finish', { id });
    assert.deepEqual([done.http, done.result.status, done.result.pages, done.result.thumbs, done.result.ext, done.result.source], [200, 'ready', 3, true, 'jpg', 'pdf']);
    const [deck] = await s.decks();
    assert.deepEqual([deck.name, deck.base, deck.width, deck.height], ['Informe de tesorería', `/media/diapositivas/${id}/`, 1, 1]);
    assert.equal((await s.request(`${deck.base}3.${deck.ext}`)).status, 200);
    assert.equal((await s.request(`${deck.base}m3.jpg`)).status, 200);
    assert.equal((await s.put(`/api/slides/${id}/pages/1`, JPG)).http, 400, 'ya publicada, no admite más páginas');

    // Al aire: cada diapositiva es un paso, con la que viene a la vista.
    let shown = await s.send('projection.show', { kind: 'slides', data: { id }, step: 1 });
    assert.deepEqual([shown.result.kind, shown.result.number, shown.result.pages, shown.result.url, shown.result.thumb, shown.result.reference], ['slides', 2, 3, `${deck.base}2.jpg`, `${deck.base}m2.jpg`, 'Diapositiva 2']);
    assert.deepEqual(shown.result.next, { number: 3, thumb: `${deck.base}m3.jpg` });
    await s.send('projection.control', { zoom: 2.5, x: 0.2, fit: 'cover' });
    assert.deepEqual((await s.state()).live.state, { fit: 'contain', zoom: 2.5, x: 0.2, y: 0.5 }, 'se acerca y se desplaza; siempre completa');
    shown = await s.send('projection.step', { delta: 1 });
    assert.deepEqual([shown.result.number, shown.result.next], [3, null]);
    assert.equal((await s.state()).live.state.zoom, 1, 'cada diapositiva empieza en vista completa');
    assert.equal((await s.send('projection.step', { delta: 1 })).result, null, 'tras la última no hay más');
    assert.equal((await s.send('projection.step', { delta: -1 })).result.number, 2);

    // En el orden del culto: un elemento con tantos pasos como diapositivas.
    const item = (await s.send('order.add', { kind: 'slides', data: { id } })).result;
    assert.deepEqual([item.kind, item.title, item.subtitle, item.steps], ['slides', 'Informe de tesorería', 'PDF', 3]);
    const steps = await (await s.request(`/api/order/${item.id}/steps`)).json();
    assert.deepEqual(steps.steps.map((step) => step.thumb), [1, 2, 3].map((n) => `${deck.base}m${n}.jpg`));
    assert.equal((await s.send('order.show', { id: item.id })).result.number, 1);
    assert.equal((await s.send('projection.step', { delta: 1 })).result.number, 2);

    // Otra función sin permiso de edición no sube ni borra, pero sí proyecta.
    await s.as('orden');
    assert.equal((await s.put('/api/slides?name=x&pages=2')).http, 403);
    assert.equal((await s.send('slides.remove', { id })).http, 403);
    assert.equal((await s.send('projection.show', { kind: 'slides', data: { id }, step: 0 })).http, 200);
    await s.as('control');

    await s.send('slides.rename', { id, name: '  Informe   del trimestre ' });
    assert.equal((await s.decks())[0].name, 'Informe del trimestre');
    assert.equal((await s.state()).projection.item.title, 'Informe del trimestre', 'lo que está al aire recibe el nombre nuevo');
    assert.equal((await s.send('slides.rename', { id, name: '  ' })).http, 400);
    assert.equal((await s.send('slides.remove', { id })).http, 200);
    assert.deepEqual(await s.decks(), []);
    assert.equal(fs.existsSync(path.join(s.dataDir, 'media', 'diapositivas', id)), false, 'se borran sus imágenes');
    assert.equal((await s.send('projection.show', { kind: 'slides', data: { id }, step: 0 })).http, 404);
  } finally {
    await s.stop();
  }
});

test('un PowerPoint lo convierte el PowerPoint del equipo principal, como tarea con avance', async () => {
  const fake = writeFakePowerPoint(path.join(tmp, 'falso'), { slides: 3, pause: 40 });
  const s = await start('powerpoint', { MANNA_POWERPOINT_PRUEBA: fake });
  try {
    assert.equal(s.app.tools.has('powerpoint'), true);
    assert.equal((await s.put('/api/slides/powerpoint?name=x&ext=.key', fakePresentation())).http, 415, 'solo PowerPoint');
    assert.equal((await s.put('/api/slides/powerpoint?name=x&ext=.pptx', 'esto no es un PowerPoint')).http, 415, 'se reconoce por su contenido');
    process.env.MANNA_POWERPOINT_PRUEBA = fake;
    const added = await s.put('/api/slides/powerpoint?name=Escuela%20sab%C3%A1tica&ext=.pptx', fakePresentation());
    assert.deepEqual([added.http, added.status, added.source, added.pages], [200, 'converting', 'powerpoint', 0]);
    assert.equal((await s.send('projection.show', { kind: 'slides', data: { id: added.id }, step: 0 })).http, 409, 'mientras se convierte no se puede proyectar');
    assert.equal((await s.send('order.add', { kind: 'slides', data: { id: added.id } })).http, 404);
    const deck = await s.settle(added.id, 'ready');
    assert.ok(deck, 'termina de convertirse');
    // El de mentira entrega PNG y sin miniaturas: la interfaz usará la propia imagen.
    assert.deepEqual([deck.pages, deck.ext, deck.thumbs, deck.width, deck.height], [3, 'png', false, 640, 360]);
    assert.equal((await s.request(`${deck.base}3.png`)).headers.get('content-type'), 'image/png');
    const shown = await s.send('projection.show', { kind: 'slides', data: { id: deck.id }, step: 0 });
    assert.deepEqual([shown.result.thumb, shown.result.next.thumb], [`${deck.base}1.png`, `${deck.base}2.png`]);
    assert.equal((await s.send('order.add', { kind: 'slides', data: { id: deck.id } })).result.subtitle, 'PowerPoint');
    assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'tmp')), [], 'no quedan restos de la conversión');

    // Una que PowerPoint no puede abrir: se dice, y se propone el PDF.
    const broken = await s.put('/api/slides/powerpoint?name=Da%C3%B1ada&ext=.pptx', fakePresentation('ROTA'));
    const failed = await s.settle(broken.id, 'error');
    assert.match(failed.error, /Guárdala como PDF/);
    assert.equal((await s.state()).jobs.list.filter((j) => j.ref === broken.id && j.state === 'error').length, 1);
    assert.equal((await s.send('slides.remove', { id: broken.id })).http, 200);
    assert.equal((await s.state()).jobs.list.some((j) => j.ref === broken.id), false, 'al eliminarla se va su aviso');
  } finally {
    delete process.env.MANNA_POWERPOINT_PRUEBA;
    await s.stop();
  }
});

test('sin PowerPoint en el equipo, una presentación se rechaza diciendo que se suba el PDF', async () => {
  const s = await start('sin-powerpoint', { MANNA_FALTA: 'powerpoint' });
  try {
    assert.equal(s.app.tools.has('powerpoint'), false);
    const res = await s.put('/api/slides/powerpoint?name=x&ext=.pptx', fakePresentation());
    assert.equal(res.http, 409);
    assert.match(res.error, /sube el PDF/);
  } finally {
    await s.stop();
  }
});

test('al volver a abrir Manna, una subida a medias desaparece y una conversión cortada se dice', async () => {
  const dataDir = path.join(tmp, 'reinicio');
  fs.mkdirSync(path.join(dataDir, 'media', 'diapositivas', 'a-medias'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'media', 'diapositivas', 'lista'), { recursive: true });
  const deck = (id, status) => ({ id, name: id, source: 'pdf', pages: 2, ext: 'jpg', thumbs: false, width: 1, height: 1, added: 1, status, error: null });
  fs.writeFileSync(path.join(dataDir, 'diapositivas.json'), JSON.stringify({ decks: [deck('a-medias', 'receiving'), deck('lista', 'ready'), deck('borrada', 'ready'), deck('cortada', 'converting')] }));
  const s = await start('reinicio');
  try {
    const decks = await s.decks();
    assert.deepEqual(decks.map((d) => [d.id, d.status]).sort(), [['cortada', 'error'], ['lista', 'ready']]);
    assert.match(decks.find((d) => d.id === 'cortada').error, /se interrumpió/);
    assert.equal(fs.existsSync(path.join(dataDir, 'media', 'diapositivas', 'a-medias')), false);
  } finally {
    await s.stop();
  }
});
