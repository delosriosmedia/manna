import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import users from '../server/modules/users/index.js';
import cloud from '../server/modules/cloud/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-nube-'));
const opened = [];
test.after(async () => {
  for (const s of opened) await s.stop();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

// Un Manna de verdad (la nube o un equipo de la iglesia) atendiendo en este equipo, con su cliente y su cookie.
async function serve(name, env = {}) {
  Object.assign(process.env, env);
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, `${name}-biblias`) });
  for (const key of Object.keys(env)) delete process.env[key];
  for (const setup of [system, users, cloud]) await setup(app);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (url, body) => {
    const res = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie }, ...(body && { body: JSON.stringify(body) }) });
    cookie = res.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { status: res.status, ...(await res.json()) };
  };
  const s = {
    app, base, call,
    send: (type, payload = {}) => call('/api/action', { type, payload }),
    state: () => call('/api/state'),
    stop: async () => { await app.close(); server.close(); },
  };
  opened.push(s);
  return s;
}

test('emparejar con un código de «Administrar», el equipo oficial y el bloqueo del anterior (fase 37)', async () => {
  const nube = await serve('nube', { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'clave-de-alta-nube' });
  const a = await serve('iglesia-a');
  const b = await serve('iglesia-b');
  assert.equal((await nube.call('/api/session/alta', { clave: 'clave-de-alta-nube', name: 'Ana', pin: '1234', password: 'contraseña de prueba' })).status, 200);
  for (const s of [a, b]) await s.call('/api/session', { role: 'control' }); // desde este equipo: el administrador
  const code = async () => (await nube.send('cloud.code')).result.code;
  const other = (c) => (c === '000000' ? '111111' : '000000');

  // Sin emparejar, el equipo funciona como siempre.
  assert.equal((await a.state()).cloud.status, 'off');
  assert.equal((await b.send('cloud.code')).status, 404, 'el código solo lo da la nube');
  const first = await code();
  assert.match(first, /^\d{6}$/);
  assert.ok((await nube.state()).cloud.codeUntil > Date.now());
  assert.equal((await a.send('cloud.pair', { url: nube.base, code: other(first) })).status, 400, 'un código equivocado no sirve');
  assert.equal((await a.send('cloud.pair', { url: 'http://otra.cosa.com', code: first })).status, 400, 'fuera de este equipo, solo https');
  const paired = await a.send('cloud.pair', { url: nube.base, code: first });
  assert.equal(paired.status, 200);
  assert.equal(paired.result.church, new URL(nube.base).host);
  const token = JSON.parse(fs.readFileSync(path.join(a.app.dataDir, 'nube.json'), 'utf8')).token;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(await a.state()).includes(token) && !JSON.stringify(await nube.state()).includes(token), 'la clave no sale en el estado');
  nube.app.storage.flushAll();
  assert.ok(!fs.readFileSync(path.join(nube.app.dataDir, 'equipos.json'), 'utf8').includes(token), 'la nube guarda solo su huella');
  assert.equal((await a.send('cloud.pair', { url: nube.base, code: first })).status, 400, 'el código sirve una vez');
  await a.app.services.cloud.check();
  assert.equal((await a.state()).cloud.status, 'on');
  assert.deepEqual((({ name, online }) => ({ name, online }))((await nube.state()).cloud.official), { name: os.hostname(), online: true });

  // Un segundo equipo: primero se pregunta; confirmado, pasa a ser el oficial y el primero queda bloqueado al enterarse.
  const second = await code();
  const asked = await b.send('cloud.pair', { url: nube.base, code: second });
  assert.deepEqual(asked.result.conflict.name, os.hostname());
  assert.equal((await b.send('cloud.pair', { url: nube.base, code: second, confirm: true })).status, 200);
  await a.app.services.cloud.check();
  assert.equal(a.app.blocked?.replaced, true);
  assert.equal((await a.state()).system.blocked.replaced, true);
  const refused = await a.send('users.create', { name: 'Beto', pin: '4321', functions: ['orden'] });
  assert.equal(refused.status, 409);
  assert.match(refused.error, /ya no es el oficial/);
  assert.deepEqual((await a.send('system.recheck')).result, { blocked: true }, 'volver a comprobar no lo desbloquea');

  // Volver a ser el equipo oficial: con otro código, desde la pantalla de bloqueado (la dirección ya la sabe).
  assert.equal((await a.send('cloud.pair', { code: await code(), confirm: true })).status, 200);
  assert.equal(a.app.blocked, null);
  assert.equal((await a.send('users.create', { name: 'Beto', pin: '4321', functions: ['orden'] })).status, 200);
  await b.app.services.cloud.check();
  assert.equal(b.app.blocked?.replaced, true, 'ahora el bloqueado es el otro');

  // Diez intentos fallidos anulan el código.
  const last = await code();
  for (let i = 0; i < 10; i += 1) await a.send('cloud.pair', { url: nube.base, code: other(last) });
  const late = await a.send('cloud.pair', { url: nube.base, code: last });
  assert.equal(late.status, 400);
  assert.match(late.error, /ya no sirve/);
});
