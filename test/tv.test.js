import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import tvModule, { addressFor, describeArrival, isLocalAddress } from '../server/modules/tv/index.js';
import { createSamsung, TvError } from '../server/modules/tv/samsung.js';
import { startFakeTv } from '../scripts/lib/tv-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-tv-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const until = async (check, tries = 200) => {
  for (let i = 0; i < tries && !(await check()); i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
};

test('isLocalAddress solo admite direcciones de una red local', () => {
  for (const ip of ['192.168.1.3', '10.0.0.8', '172.16.4.1', '172.31.255.254', '169.254.10.2']) assert.equal(isLocalAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '127.0.0.1', '192.169.1.1', 'tele.local', '', null, '192.168.1', '192.168.1.3:80']) assert.equal(isLocalAddress(ip), false, String(ip));
});

test('addressFor elige la dirección de Manna que está en la red del televisor', () => {
  const addresses = ['http://192.168.1.14', 'http://10.0.0.5'];
  assert.equal(addressFor('10.0.0.77', addresses), 'http://10.0.0.5');
  assert.equal(addressFor('192.168.1.3', addresses), 'http://192.168.1.14');
  assert.equal(addressFor('172.16.0.9', addresses), 'http://192.168.1.14');
  assert.equal(addressFor('172.16.0.9', []), null);
});

test('describeArrival resume cómo llegó el televisor a Manna', () => {
  const now = 1_000_000_000;
  assert.equal(describeArrival(undefined, now), null);
  assert.equal(describeArrival({ at: now - 5000, secure: false, error: null, errorAt: 0 }, now), 'http');
  assert.equal(describeArrival({ at: now - 5000, secure: true, error: null, errorAt: 0 }, now), 'https');
  // Cortó el saludo de la conexión segura y no ha vuelto a entrar: no aceptó el certificado.
  assert.equal(describeArrival({ at: now - 5000, secure: true, error: 'ECONNRESET', errorAt: now - 4990 }, now), 'rejected');
  // Después aceptó: una llegada posterior al corte.
  assert.equal(describeArrival({ at: now - 1000, secure: true, error: 'ECONNRESET', errorAt: now - 4990 }, now), 'https');
  assert.equal(describeArrival({ at: now - 3_600_000, secure: true, error: 'X', errorAt: now - 3_600_000 }, now), 'https');
});

// ---- El mando, contra un televisor de mentira ----

test('el mando de Samsung se vincula, guarda la clave y envía teclas, puntero y texto', async () => {
  const tv = await startFakeTv();
  const tokens = [];
  const remote = createSamsung({ ip: '192.168.1.50', endpoints: tv.endpoints, onToken: (t) => tokens.push(t) });
  try {
    assert.deepEqual(await remote.info(), { name: 'Tele "de prueba"', model: 'QN00PRUEBA', on: true });
    assert.equal(remote.paired, false);
    assert.equal(await remote.pair(), tv.token);
    assert.deepEqual(tokens, [tv.token]);
    assert.equal(remote.paired, true);
    assert.equal(tv.lastName, 'Manna');

    await remote.key('ok');
    await remote.move(12, -7);
    await remote.click();
    await remote.text('http://192.168.1.14/proyeccion', { done: true });
    await until(() => tv.received.length === 5);
    assert.deepEqual(tv.received, [
      { Cmd: 'Click', DataOfCmd: 'KEY_ENTER', Option: 'false', TypeOfRemote: 'SendRemoteKey' },
      { Cmd: 'Move', Position: { x: 12, y: -7, Time: '0' }, TypeOfRemote: 'ProcessMouseDevice' },
      { Cmd: 'LeftClick', TypeOfRemote: 'ProcessMouseDevice' },
      { Cmd: Buffer.from('http://192.168.1.14/proyeccion').toString('base64'), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' },
      { TypeOfRemote: 'SendInputEnd' },
    ]);
    assert.equal(tv.connections, 1, 'todas las órdenes van por la misma conexión');

    assert.equal(await remote.browser(), 'closed');
    await remote.openBrowser();
    assert.equal(await remote.browser(), 'open');
    await remote.closeBrowser();
    assert.equal(await remote.browser(), 'hidden');
  } finally {
    remote.close();
    await tv.stop();
  }
});

test('sin permiso del televisor, el mando lo dice; y sin televisor, no hay datos', async () => {
  const tv = await startFakeTv();
  tv.accept = false;
  const remote = createSamsung({ ip: '192.168.1.50', endpoints: tv.endpoints });
  try {
    await assert.rejects(remote.key('ok'), (err) => err instanceof TvError && err.code === 'unauthorized');
  } finally {
    remote.close();
    await tv.stop();
  }
  // Apagado: nadie responde en esa dirección.
  const gone = createSamsung({ ip: '192.168.1.50', endpoints: tv.endpoints });
  assert.equal(await gone.info(), null);
  await assert.rejects(gone.key('ok'), (err) => err instanceof TvError && err.code === 'unreachable');
});

// ---- El módulo, con el servidor de verdad ----

test('Televisores: añadir, vincular, abrir la proyección, escribir la dirección y quitar', async () => {
  const tv = await startFakeTv();
  process.env.MANNA_TV_PRUEBA = JSON.stringify(tv.endpoints);
  const dataDir = path.join(tmp, 'datos');
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, tvModule]) await setup(app);
  delete process.env.MANNA_TV_PRUEBA;
  app.store.set('system', { addresses: ['http://192.168.1.14:8123'] });
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
    };
  };
  const control = client('control');
  await control.login();
  const tvState = async () => (await (await control.request('/api/state')).json()).tv;

  try {
    assert.equal((await control.send('tv.add', { ip: '8.8.8.8' })).status, 400);
    const added = await control.send('tv.add', { ip: '192.168.1.50' });
    assert.equal(added.status, 200);
    const { id } = added.result;
    assert.equal((await control.send('tv.add', { ip: '192.168.1.50' })).status, 409);

    // Al añadirlo pide permiso al televisor; al aceptarse queda vinculado.
    await until(async () => (await tvState()).list[0].paired);
    const [listed] = (await tvState()).list;
    assert.deepEqual({ ...listed, id: null }, {
      id: null, ip: '192.168.1.50', name: 'Tele "de prueba"', model: 'QN00PRUEBA',
      paired: true, pairing: false, error: null, on: true, browser: null, showing: false, arrival: null,
    });
    // La clave se guarda en el servidor y no viaja a los dispositivos.
    app.storage.flushAll();
    assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'televisores.json'), 'utf8')).list[0].token, tv.token);
    assert.equal(JSON.stringify(await tvState()).includes(tv.token), false);

    assert.equal((await control.send('tv.open', { id })).status, 200);
    assert.deepEqual(tv.browser, { running: true, visible: true });
    assert.equal((await tvState()).list[0].browser, 'open');

    assert.equal((await control.send('tv.key', { id, key: 'ok' })).status, 200);
    assert.equal((await control.send('tv.key', { id, key: 'KEY_POWER' })).status, 400, 'solo las teclas previstas');
    assert.equal((await control.send('tv.move', { id, dx: 99999, dy: -3.4 })).status, 200);
    assert.equal((await control.send('tv.click', { id })).status, 200);
    assert.deepEqual((await control.send('tv.address', { id })).result, { url: 'http://192.168.1.14:8123/proyeccion' });
    assert.deepEqual(await (await control.request(`/api/tv/${id}/address`)).json(), { url: 'http://192.168.1.14:8123/proyeccion' });
    assert.equal((await control.send('tv.text', { id, text: '' })).status, 400);
    await until(() => tv.received.length === 5);
    assert.deepEqual(tv.received.map((p) => p.DataOfCmd || p.Cmd || p.TypeOfRemote), ['KEY_ENTER', 'Move', 'LeftClick', 'base64', 'SendInputEnd']);
    assert.deepEqual(tv.received[1].Position, { x: 400, y: -3, Time: '0' }, 'el movimiento se limita');
    assert.equal(Buffer.from(tv.received[3].Cmd, 'base64').toString(), 'http://192.168.1.14:8123/proyeccion');

    // El televisor llega a Manna pero corta el saludo de la conexión segura: se sabe y se explica.
    app.arrivals.set('192.168.1.50', { at: Date.now() - 20, secure: true, error: 'ECONNRESET', errorAt: Date.now() });
    await control.send('tv.refresh');
    assert.equal((await tvState()).list[0].arrival, 'rejected');

    assert.equal((await control.send('tv.close', { id })).status, 200);
    assert.equal(tv.browser.visible, false);

    // Quien solo opera el orden del culto no gobierna televisores.
    const orden = client('orden');
    await orden.login();
    assert.equal((await orden.send('tv.key', { id, key: 'ok' })).status, 403);
    assert.equal((await orden.request(`/api/tv/${id}/address`)).status, 403);

    // Apagado: se dice en claro.
    await tv.stop();
    await control.send('tv.refresh');
    assert.equal((await tvState()).list[0].on, false);
    const failed = await control.send('tv.open', { id });
    assert.equal(failed.status, 502);
    assert.match(failed.error, /no responde/);

    assert.equal((await control.send('tv.remove', { id })).status, 200);
    assert.deepEqual((await tvState()).list, []);
    assert.equal((await control.send('tv.key', { id, key: 'ok' })).status, 404);
  } finally {
    await tv.stop().catch(() => {});
    await app.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('cuando el televisor llega a la proyección que se le pidió, Manna le pulsa OK (pantalla completa)', async () => {
  const tv = await startFakeTv();
  // Un televisor ya vinculado que "vive" en este mismo equipo, para poder hacer de él.
  const dataDir = path.join(tmp, 'llegada');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'televisores.json'), JSON.stringify({ list: [{ id: 'tele', ip: '127.0.0.1', name: 'Tele', model: '', token: tv.token }] }));
  process.env.MANNA_TV_PRUEBA = JSON.stringify(tv.endpoints);
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias') });
  for (const setup of [system, tvModule]) await setup(app);
  delete process.env.MANNA_TV_PRUEBA;
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const screen = new AbortController();
  try {
    assert.equal(app.store.get('tv').list[0].showing, false);
    await app.run('tv.open', { id: 'tele' });
    assert.equal(tv.browser.visible, true);
    assert.equal(app.realtime.has('proyeccion', '127.0.0.1'), false);

    // El "televisor" abre la página de proyección.
    const events = await fetch(`${base}/api/events?rol=proyeccion`, { signal: screen.signal });
    assert.equal(events.status, 200);
    assert.equal(app.realtime.has('proyeccion', '127.0.0.1'), true);
    assert.equal(app.realtime.has('control', '127.0.0.1'), false);
    await until(() => app.store.get('tv').list[0].showing);
    assert.equal(app.store.get('tv').list[0].showing, true);
    await until(() => tv.received.length > 0, 500);
    assert.deepEqual(tv.received.map((p) => p.DataOfCmd), ['KEY_ENTER']);

    // Al cerrarla, deja de contarse como pantalla.
    screen.abort();
    await until(() => !app.store.get('tv').list[0].showing);
    assert.equal(app.store.get('tv').list[0].showing, false);
  } finally {
    screen.abort();
    await app.close();
    await new Promise((resolve) => server.close(resolve));
    await tv.stop();
  }
});
