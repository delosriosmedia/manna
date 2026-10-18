import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import { newer } from '../server/modules/system/versions.js';

// Versiones nuevas: Manna pregunta cada poco qué versión hay en GitHub (aquí, un servidor de este equipo) y solo avisa
// si es más nueva; sin respuesta no dice nada. «Actualizar ahora» abre el instalador (aquí, uno de mentira).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

test('newer compara versiones por sus números', () => {
  assert.equal(newer('1.30.0', '1.29.9'), true);
  assert.equal(newer('1.29.10', '1.29.9'), true);
  assert.equal(newer('2.0.0', '1.99.99'), true);
  assert.equal(newer('1.29.0', '1.29.0'), false);
  assert.equal(newer('1.28.5', '1.29.0'), false);
});

test('avisa solo de una versión más nueva, calla sin internet, y «Actualizar ahora» abre el instalador desde el equipo principal', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-versiones-'));
  let latest = version;
  let up = true;
  const github = http.createServer((req, res) => {
    if (!up) { req.socket.destroy(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'manna', version: latest }));
  });
  await new Promise((resolve) => github.listen(0, '127.0.0.1', resolve));
  const marker = path.join(tmp, 'instalador-abierto');
  const installer = path.join(tmp, 'instalador.mjs');
  fs.writeFileSync(installer, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, process.cwd());\n`);
  Object.assign(process.env, { MANNA_VERSIONES_URL: `http://127.0.0.1:${github.address().port}/package.json`, MANNA_VERSIONES_MS: '60', MANNA_ACTUALIZADOR_PRUEBA: installer });
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, 'datos'), biblesDir: path.join(tmp, 'biblias') });
  await system(app);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  app.port = server.address().port;
  app.store.emit('listening', app.port);
  const base = `http://127.0.0.1:${app.port}`;
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const send = async (type, headers = {}) => (await fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: JSON.stringify({ type }) })).status;
  const update = () => app.store.get('system').update;
  try {
    await sleep(400);
    assert.equal(update(), null, 'la misma versión: nada');
    up = false;
    latest = '99.0.0';
    await sleep(400);
    assert.equal(update(), null, 'sin respuesta de GitHub: nada');
    up = true;
    for (let i = 0; i < 40 && !update(); i += 1) await sleep(50);
    assert.deepEqual(update(), { version: '99.0.0' }, 'una versión más nueva: se avisa');

    assert.equal(await send('system.update', { 'X-Forwarded-For': '203.0.113.9', 'Cf-Connecting-Ip': '203.0.113.9' }), 403, 'desde fuera del equipo principal, no');
    assert.equal(await send('system.update'), 200);
    for (let i = 0; i < 60 && !fs.existsSync(marker); i += 1) await sleep(50);
    assert.equal(fs.realpathSync(fs.readFileSync(marker, 'utf8')), fs.realpathSync(tmp), 'se abrió el instalador, en su carpeta');
  } finally {
    for (const key of ['MANNA_VERSIONES_URL', 'MANNA_VERSIONES_MS', 'MANNA_ACTUALIZADOR_PRUEBA']) delete process.env[key];
    await app.close();
    server.close();
    github.close();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
  }
});
