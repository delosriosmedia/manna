import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import internet, { diagnose, explain, tokenFrom } from '../server/modules/internet/index.js';
import { writeFakeCloudflared } from '../scripts/lib/cloudflared-falso.mjs';

// La conexión por internet, con un cloudflared de mentira en la carpeta de programas de Manna: ninguna
// prueba sale a internet ni abre un túnel de verdad.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const gone = async (pid) => {
  for (let i = 0; i < 60 && alive(pid); i += 1) await sleep(50);
  return !alive(pid);
};

test('tokenFrom saca la clave de lo que se pegue y explain dice por qué se cerró', () => {
  const key = `eyJ${'a1B2'.repeat(20)}`;
  assert.equal(tokenFrom(key), key);
  assert.equal(tokenFrom(`cloudflared.exe service install ${key}`), key, 'también dentro de la orden que muestra Cloudflare');
  assert.equal(tokenFrom('  '), '', 'vacía: túnel rápido');
  assert.throws(() => tokenFrom('hola'), /no parece la clave/);
  assert.match(explain('ERR error="Unauthorized: Invalid tunnel secret"'), /clave/);
  assert.match(explain('dial tcp: lookup region1.v2.argotunnel.com: no such host'), /internet/);
  assert.match(explain('algo raro'), /vuelve a intentar/);
  const where = { me: 'este', own: true, port: 8000 };
  assert.equal(diagnose({ ok: true, status: 200, id: 'este' }, where), null, 'contesta este mismo Manna');
  assert.match(diagnose({ ok: false, status: 502 }, where), /no llega a Manna \(responde 502\).*http:\/\/localhost:8000/, 'con dominio propio, dice qué poner en Cloudflare');
  assert.match(diagnose({ ok: true, status: 200, id: 'otro' }, where), /otro equipo/);
  assert.match(diagnose({ error: true }, where), /tiene internet/);
});

test('lo que se abre atado a Manna se cierra si Manna se cierra de golpe', async () => {
  // Un «Manna» que abre un programa con el vigilante y dice su número de proceso; luego se le mata sin aviso.
  const vigia = path.join(ROOT, 'server', 'core', 'vigia.js');
  const program = 'console.log(process.pid); setInterval(() => {}, 1000)';
  const manna = spawn(process.execPath, ['-e', `require('node:child_process').spawn(process.execPath, [${JSON.stringify(vigia)}, process.execPath, '-e', ${JSON.stringify(program)}], { stdio: ['pipe', 'inherit', 'inherit'] }); setInterval(() => {}, 1000);`], { stdio: ['ignore', 'pipe', 'inherit'] });
  const pid = Number(await new Promise((resolve) => { manna.stdout.once('data', (d) => resolve(String(d).trim())); }));
  assert.ok(alive(pid), 'el programa está abierto');
  manna.kill('SIGKILL');
  assert.ok(await gone(pid), 'y se cierra con Manna');
});

test('la conexión por internet se enciende, se recuerda, usa la clave sin publicarla y se apaga', { skip: process.platform === 'win32' && 'el cloudflared de mentira es un guion' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-internet-'));
  const dataDir = path.join(tmp, 'datos');
  const log = path.join(tmp, 'pedido.log');
  writeFakeCloudflared(path.join(dataDir, 'herramientas'), { log });
  // Que no cuente el cloudflared que pueda tener este equipo: solo el de mentira.
  process.env.MANNA_FALTA = 'cloudflared';
  // Lo que «llega desde internet» a la comprobación: un servidor de este equipo que la pasa a Manna, o falla
  // como Cloudflare sin Manna detrás (roto) o como otro equipo con el mismo túnel (otro).
  let edge = 'pasa';
  const edgeServer = http.createServer(async (req, res) => {
    if (edge === 'roto') {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end('<h1>Bad gateway</h1>');
      return;
    }
    const body = edge === 'otro' ? JSON.stringify({ id: 'otro-equipo', version: '9.9.9' }) : await (await fetch(`http://127.0.0.1:${app.port}${req.url}`)).text();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  await new Promise((resolve) => edgeServer.listen(0, '127.0.0.1', resolve));
  process.env.MANNA_TUNEL_PRUEBA = `http://127.0.0.1:${edgeServer.address().port}`;
  process.env.MANNA_TUNEL_COMPROBAR_MS = '50';
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
  const until = async (check, ms = 3000) => {
    for (let i = 0; i < ms / 50 && !check(state()); i += 1) await sleep(50);
    return state();
  };
  const asked = () => fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  // Lo local no depende de la conexión por internet: encendida, conectando o caída, la red de la iglesia
  // entra igual que siempre (sin cabeceras de túnel no hace falta sesión para ver el estado).
  const localWorks = async (when) => {
    assert.equal((await fetch(`${base}/api/state`)).status, 200, `lo local responde ${when}`);
    assert.equal((await (await fetch(`${base}/api/session`)).json()).internet, false, `lo local no cuenta como internet ${when}`);
  };
  try {
    assert.deepEqual([state().on, state().status], [false, 'off'], 'empieza apagada');
    await localWorks('con la conexión apagada');

    // Túnel rápido: la dirección que da cloudflared; al registrarse, se comprueba, y solo entonces «on».
    assert.equal((await send('internet.set', { on: true })).http, 200);
    assert.equal((await until((s) => s.status === 'checking')).status, 'checking', 'Cloudflare la acepta: falta comprobarla');
    let now = await until((s) => s.status === 'on');
    assert.deepEqual([now.on, now.status, now.url, now.own], [true, 'on', 'https://manna-de-prueba.trycloudflare.com', false]);
    assert.ok(Math.abs(now.since - Date.now()) < 30_000, 'since dice cuándo pasó a «on»');
    assert.ok(JSON.parse(fs.readFileSync(path.join(dataDir, 'tunel.json'), 'utf8')).on, 'se recuerda para el próximo arranque');
    await localWorks('con la conexión encendida');

    // Cloudflare sigue conectado pero ya no llega a Manna: tras unas comprobaciones fallidas lo dice y la rehace.
    const first = asked().at(-1).pid;
    edge = 'roto';
    now = await until((s) => s.status === 'error');
    assert.match(now.error, /no llega a Manna \(responde 502\)/);
    assert.equal(now.since, null, 'fuera de «on», since se borra');
    assert.ok(await gone(first), 'el cloudflared que no servía se cerró');
    now = await until((s) => s.status === 'checking', 8000);
    assert.ok(asked().at(-1).pid !== first && now.error, 'se volvió a abrir, con el último problema a la vista');
    edge = 'otro';
    now = await until((s) => s.status === 'error' && /otro equipo/.test(s.error));
    assert.match(now.error, /otro equipo/, 'el mismo túnel abierto en otro equipo');
    edge = 'pasa';
    await send('internet.set', { on: true });
    now = await until((s) => s.status === 'on');
    assert.deepEqual([now.status, now.error], ['on', null]);

    // Un túnel propio: la clave va por el entorno, nunca en los argumentos ni en el estado.
    const key = `eyJ${'x9Y8'.repeat(20)}`;
    assert.equal((await send('internet.own', { token: `cloudflared service install ${key}`, address: 'manna.ejemplo.org' })).http, 200);
    now = await until((s) => s.status === 'on' && s.own);
    assert.deepEqual([now.url, now.own], ['https://manna.ejemplo.org', true]);
    assert.ok(!JSON.stringify(app.store.snapshot()).includes(key), 'la clave no está en el estado');
    const last = asked().at(-1);
    assert.deepEqual([last.args, last.token], [['tunnel', '--no-autoupdate', 'run'], true]);

    // Un solo Manna por dominio propio: si otro equipo con Manna lo contesta, este se aparta y no vuelve a abrir
    // cloudflared mientras el otro lo tenga; cuando lo suelta, se conecta solo.
    edge = 'otro';
    now = await until((s) => s.status === 'busy');
    assert.deepEqual([now.status, now.busy, now.error], ['busy', '9.9.9', null]);
    assert.ok(await gone(last.pid), 'se apartó: cerró su cloudflared');
    const launched = asked().length;
    await sleep(1200);
    assert.deepEqual([state().status, asked().length], ['busy', launched], 'mientras el otro lo tenga, ni se conecta');
    edge = 'pasa';
    now = await until((s) => s.status === 'on', 3000);
    assert.deepEqual([now.status, now.busy, asked().length], ['on', null, launched + 1], 'cuando lo suelta, se conecta solo');

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
    const open = asked().at(-1).pid;
    assert.equal((await send('internet.set', { on: false })).http, 200);
    assert.deepEqual([state().on, state().status, state().url], [false, 'off', null]);
    assert.ok(await gone(open), 'al apagarla, cloudflared se cierra');
  } finally {
    await send('internet.set', { on: false }).catch(() => {});
    await app.close(); // también el nombre en la red, que se anuncia a los 10 s y dejaría el proceso abierto
    server.close();
    edgeServer.close();
    delete process.env.MANNA_TUNEL_PRUEBA;
    delete process.env.MANNA_TUNEL_COMPROBAR_MS;
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
  }
});
