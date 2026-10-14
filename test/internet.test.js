import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import internet, { explain, tokenFrom } from '../server/modules/internet/index.js';
import { writeFakeCloudflared } from '../scripts/lib/cloudflared-falso.mjs';

// La conexión por internet, con un cloudflared de mentira en la carpeta de programas de Manna: ninguna
// prueba sale a internet ni abre un túnel de verdad.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('tokenFrom saca la clave de lo que se pegue y explain dice por qué se cerró', () => {
  const key = `eyJ${'a1B2'.repeat(20)}`;
  assert.equal(tokenFrom(key), key);
  assert.equal(tokenFrom(`cloudflared.exe service install ${key}`), key, 'también dentro de la orden que muestra Cloudflare');
  assert.equal(tokenFrom('  '), '', 'vacía: túnel rápido');
  assert.throws(() => tokenFrom('hola'), /no parece la clave/);
  assert.match(explain('ERR error="Unauthorized: Invalid tunnel secret"'), /clave/);
  assert.match(explain('dial tcp: lookup region1.v2.argotunnel.com: no such host'), /internet/);
  assert.match(explain('algo raro'), /vuelve a intentar/);
});

test('la conexión por internet se enciende, se recuerda, usa la clave sin publicarla y se apaga', { skip: process.platform === 'win32' && 'el cloudflared de mentira es un guion' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-internet-'));
  const dataDir = path.join(tmp, 'datos');
  const log = path.join(tmp, 'pedido.log');
  writeFakeCloudflared(path.join(dataDir, 'herramientas'), { log });
  // Que no cuente el cloudflared que pueda tener este equipo: solo el de mentira.
  process.env.MANNA_FALTA = 'cloudflared';
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, internet]) await setup(app);
  await app.tools.scan();
  delete process.env.MANNA_FALTA;
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  app.port = server.address().port;
  app.store.emit('listening', app.port);
  const base = `http://127.0.0.1:${app.port}`;
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const send = async (type, payload = {}, headers = {}) => {
    const res = await fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: JSON.stringify({ type, payload }) });
    return { ...(await res.json()), http: res.status };
  };
  const state = () => app.store.get('internet');
  const until = async (check) => {
    for (let i = 0; i < 60 && !check(state()); i += 1) await sleep(50);
    return state();
  };
  // Lo local no depende de la conexión por internet: encendida, conectando o caída, la red de la iglesia
  // entra igual que siempre (sin cabeceras de túnel no hace falta sesión para ver el estado).
  const localWorks = async (when) => {
    assert.equal((await fetch(`${base}/api/state`)).status, 200, `lo local responde ${when}`);
    assert.equal((await (await fetch(`${base}/api/session`)).json()).internet, false, `lo local no cuenta como internet ${when}`);
  };
  try {
    assert.deepEqual([state().on, state().status], [false, 'off'], 'empieza apagada');
    await localWorks('con la conexión apagada');

    // Túnel rápido: la dirección que da cloudflared y, al registrarse, «on».
    assert.equal((await send('internet.set', { on: true })).http, 200);
    let now = await until((s) => s.status === 'on');
    assert.deepEqual([now.on, now.status, now.url, now.own], [true, 'on', 'https://manna-de-prueba.trycloudflare.com', false]);
    assert.ok(JSON.parse(fs.readFileSync(path.join(dataDir, 'tunel.json'), 'utf8')).on, 'se recuerda para el próximo arranque');
    await localWorks('con la conexión encendida');

    // Un túnel propio: la clave va por el entorno, nunca en los argumentos ni en el estado.
    const key = `eyJ${'x9Y8'.repeat(20)}`;
    assert.equal((await send('internet.own', { token: `cloudflared service install ${key}`, address: 'manna.ejemplo.org' })).http, 200);
    now = await until((s) => s.status === 'on' && s.own);
    assert.deepEqual([now.url, now.own], ['https://manna.ejemplo.org', true]);
    assert.ok(!JSON.stringify(app.store.snapshot()).includes(key), 'la clave no está en el estado');
    const last = JSON.parse(fs.readFileSync(log, 'utf8').trim().split('\n').at(-1));
    assert.deepEqual(last, { args: ['tunnel', '--no-autoupdate', 'run'], token: true });

    // Una clave no válida: lo dice, con palabras de quien usa Manna.
    assert.equal((await send('internet.own', { token: `malo${'z'.repeat(50)}` })).http, 200);
    now = await until((s) => s.status === 'error');
    assert.match(now.error, /clave del túnel no es válida/);
    await localWorks('con la conexión caída');

    // Desde internet no se puede cambiar.
    const outside = await send('internet.set', { on: false }, { 'Cf-Connecting-Ip': '203.0.113.9', 'X-Forwarded-For': '203.0.113.9' });
    assert.notEqual(outside.http, 200);
    assert.equal(state().on, true);

    // Sin clave vuelve al túnel rápido; apagada, se cierra.
    await send('internet.own', { token: '' });
    await until((s) => s.status === 'on');
    assert.equal((await send('internet.set', { on: false })).http, 200);
    assert.deepEqual([state().on, state().status, state().url], [false, 'off', null]);
  } finally {
    await send('internet.set', { on: false }).catch(() => {});
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
  }
});
