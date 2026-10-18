import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import bible from '../server/modules/bible/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import media from '../server/modules/media/index.js';
import hymns from '../server/modules/hymns/index.js';
import { looksLikeContent, pickPlan, prepareContent } from '../server/modules/system/contenido.js';

// La carpeta de contenido (fase 29): elegirla, prepararla sin tocar lo que hay y cambiarla con Manna abierto.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-contenido-'));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const write = (file, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

test('preparar una carpeta: le añade sus carpetas, las instrucciones y la 1909, sin tocar lo que ya tenía', () => {
  const dir = path.join(tmp, 'preparada');
  write(path.join(dir, 'Biblias', 'LEEME.txt'), 'mis notas');
  assert.equal(looksLikeContent(path.join(tmp, 'nada')), false);
  assert.equal(looksLikeContent(dir), true);
  prepareContent(dir, path.join(ROOT, 'Contenido'));
  assert.equal(fs.readFileSync(path.join(dir, 'Biblias', 'LEEME.txt'), 'utf8'), 'mis notas', 'lo que había no se reemplaza');
  for (const rel of ['LEEME.txt', 'Biblias/Reina Valera 1909.xmm', 'Himnario/videos/LEEME.txt', 'Himnario/letras/LEEME.txt', 'Medios/LEEME.txt']) assert.ok(fs.existsSync(path.join(dir, rel)), rel);
  assert.ok(fs.statSync(path.join(dir, 'Himnario', 'diapositivas')).isDirectory());
});

test('la ventana para elegir la carpeta: la del sistema en Mac y en Windows', () => {
  const mac = pickPlan('/Users/x/Contenido', 'darwin');
  assert.deepEqual([mac.file, mac.args[0], mac.args.at(-1)], ['osascript', '-e', '/Users/x/Contenido']);
  const win = pickPlan('C:\\Contenido', 'win32');
  assert.deepEqual([win.file, win.args[0], win.env.MANNA_CARPETA_ACTUAL], ['powershell.exe', '-STA', 'C:\\Contenido']);
  assert.equal(pickPlan('/x', 'linux'), null);
});

test('cambiar la carpeta de contenido con Manna abierto: biblias, himnario y medios de la nueva, sin reiniciar', async () => {
  const a = path.join(tmp, 'iglesia-a');
  const b = path.join(tmp, 'iglesia-b');
  fs.mkdirSync(path.join(a, 'Biblias'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'Contenido', 'Biblias', 'Reina Valera 1909.xmm'), path.join(a, 'Biblias', 'Reina Valera 1909.xmm'));
  write(path.join(a, 'Himnario', 'videos', '001 Primer himno.mp4'));
  write(path.join(b, 'Himnario', 'videos', '002 Segundo himno.mp4'), 'del segundo');
  write(path.join(b, 'Himnario', 'videos', '003 Tercer himno.mp4'));
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, 'datos'), biblesDir: path.join(a, 'Biblias'), mediaDir: path.join(a, 'Medios'), hymnsDir: path.join(a, 'Himnario'), contentDir: a });
  for (const setup of [system, bible, projection, order, media, hymns]) await setup(app);
  app.store.emit('listening', 0);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const send = async (type, payload) => {
    const res = await fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type, payload }) });
    return { status: res.status, ...(await res.json()) };
  };
  const state = () => app.store.get('system').content;
  try {
    await sleep(300);
    assert.deepEqual(state(), { dir: a, chosen: false, exists: true });
    assert.equal(app.store.get('hymns').count, 1);
    assert.equal((await send('system.contentSet', { dir: path.join(tmp, 'no-existe') })).status, 404);
    assert.equal((await send('system.contentSet', { dir: path.join(tmp, 'datos') })).status, 400, 'la de los datos de Manna no');
    assert.equal((await send('system.contentSet', { dir: 'relativa' })).status, 400);

    const changed = await send('system.contentSet', { dir: b });
    assert.equal(changed.status, 200);
    assert.deepEqual(changed.result, { dir: b, chosen: true, exists: true });
    await sleep(300);
    assert.equal(app.store.get('hymns').count, 2, 'el himnario de la nueva, sin reiniciar');
    assert.deepEqual(app.store.get('bible').versions.map((v) => v.name), ['Reina-Valera 1909'], 'la nueva no tenía biblias: se le puso la 1909');
    assert.equal(await (await fetch(`${base}/himnos/002%20Segundo%20himno.mp4`, { headers: { cookie } })).text(), 'del segundo', 'se sirve de la nueva');
    assert.equal(app.settings.data.contenido, b, 'se recuerda al volver a abrir');
    assert.ok(fs.existsSync(path.join(b, 'Medios', 'LEEME.txt')));
    assert.ok(fs.existsSync(path.join(a, 'Himnario', 'videos', '001 Primer himno.mp4')), 'la anterior queda como estaba');
  } finally {
    await app.close();
    server.close();
  }
});
