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
import order from '../server/modules/order/index.js';
import texts from '../server/modules/texts/index.js';
import hymns from '../server/modules/hymns/index.js';
import cloud from '../server/modules/cloud/index.js';
import { startFakeR2 } from '../scripts/lib/r2-falso.mjs';

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
  // Un himnario de mentira de un solo himno (el nombre del video basta para que exista).
  const hymnsDir = path.join(tmp, `${name}-himnario`);
  fs.mkdirSync(path.join(hymnsDir, 'videos'), { recursive: true });
  fs.writeFileSync(path.join(hymnsDir, 'videos', '001 Canción de prueba.mp4'), 'x');
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, `${name}-biblias`), hymnsDir });
  for (const key of Object.keys(env)) delete process.env[key];
  for (const setup of [system, users, order, texts, hymns, cloud]) await setup(app);
  app.services.hymns.reload();
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (url, body) => {
    const res = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie }, ...(body && { body: JSON.stringify(body) }) });
    cookie = res.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { status: res.status, ...(await res.json()) };
  };
  // Como un celular de la red (con la dirección que pondría un proxy): pide nombre y PIN.
  const remote = async (url, body) => {
    const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7' }, body: JSON.stringify(body) });
    return { status: res.status, ...(await res.json()) };
  };
  const s = {
    app, base, call, remote,
    raw: (url, options = {}) => fetch(base + url, { ...options, headers: { cookie } }),
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
  assert.equal((await nube.call('/api/session/alta', { clave: 'clave-de-alta-nube', name: 'Ana', pin: '1234' })).status, 200);
  for (const s of [a, b]) await s.call('/api/session', { role: 'control' }); // desde este equipo: el administrador
  const code = async () => (await nube.send('cloud.code')).result.code;
  const other = (c) => (c === '000000' ? '111111' : '000000');

  // Sin emparejar, el equipo funciona como siempre, con sus usuarios: una se llama como la administradora de la nube.
  assert.equal((await a.state()).cloud.status, 'off');
  const carla = (await a.send('users.create', { name: 'Carla', pin: '2222', functions: ['orden'] })).result.id;
  const anaHere = (await a.send('users.create', { name: 'ana', pin: '3333', functions: ['alabanza'] })).result.id;
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

  // Los usuarios (parte 3): los del equipo subieron, y el equipo tiene la lista de la nube. «ana» era Ana, la de la nube.
  const names = async (s) => (await s.state()).users.list.map((u) => u.name).sort();
  assert.deepEqual(await names(nube), ['Administrador', 'Ana', 'Carla']);
  assert.deepEqual(await names(a), ['Administrador', 'Ana', 'Carla']);
  const anaThere = (await nube.state()).users.list.find((u) => u.name === 'Ana').id;
  assert.notEqual(anaThere, anaHere);
  assert.ok((await a.state()).users.list.some((u) => u.id === anaThere), 'en el equipo, Ana es la de la nube');
  assert.equal((await a.remote('/api/session', { role: 'orden', user: carla, pin: '2222' })).status, 200, 'y cada uno entra con su PIN, también sin internet');
  // Un alta y una baja en la nube llegan al equipo.
  const dani = (await nube.send('users.create', { name: 'Dani', pin: '5555', functions: ['orden'] })).result.id;
  assert.equal((await nube.send('users.remove', { id: carla })).status, 200);
  await a.app.services.cloud.check();
  assert.deepEqual(await names(a), ['Administrador', 'Ana', 'Dani']);
  assert.equal((await a.remote('/api/session', { role: 'orden', user: dani, pin: '5555' })).status, 200);

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
  const managed = await a.send('users.create', { name: 'Beto', pin: '4321', functions: ['orden'] });
  assert.equal(managed.status, 409, 'emparejado, los usuarios se cambian en la nube');
  assert.match(managed.error, /se cambian ahí/);
  await b.app.services.cloud.check();
  assert.equal(b.app.blocked?.replaced, true, 'ahora el bloqueado es el otro');

  // ---- Parte 4: los órdenes, los textos y los favoritos, en los dos sentidos ----
  await nube.call('/api/session', { role: 'preparacion', user: anaThere, pin: '1234' }); // Ana prepara desde casa
  const orders = async (s) => (await s.state()).orders.list.map((o) => o.name).sort();
  const textList = async (s) => (await s.state()).texts.list.map((x) => x.text).sort();
  const cultoA = (await a.send('order.create', { name: 'Culto A' })).result.id;
  await a.send('texts.save', { style: 'normal', text: 'Texto de la iglesia' });
  await a.app.services.cloud.sync();
  assert.deepEqual(await orders(nube), ['Culto A'], 'lo de la iglesia llega a la nube');
  assert.deepEqual(await textList(nube), ['Texto de la iglesia']);
  const cultoB = (await nube.send('order.create', { name: 'Culto B' })).result.id;
  await nube.send('texts.save', { style: 'normal', text: 'Texto de la nube' });
  assert.equal((await nube.send('hymns.favorite', { number: 1, on: true })).status, 200);
  await a.app.services.cloud.sync();
  assert.deepEqual(await orders(a), ['Culto A', 'Culto B'], 'y lo de la nube, a la iglesia');
  assert.deepEqual(await textList(a), ['Texto de la iglesia', 'Texto de la nube']);
  assert.deepEqual((await a.state()).hymns.favorites, [1]);
  // Lo borrado en un lado no vuelve del otro.
  assert.equal((await a.send('order.deleteOrder', { id: cultoB })).status, 200);
  await a.app.services.cloud.sync();
  assert.deepEqual(await orders(nube), ['Culto A']);
  await a.app.services.cloud.sync();
  assert.deepEqual(await orders(a), ['Culto A'], 'ni a la segunda');
  // Cambiado en los dos lados sin juntarse: gana el último, y su dueño (y el administrador) lo ven en un aviso.
  await a.send('order.renameOrder', { id: cultoA, name: 'Culto A en la iglesia' });
  await new Promise((resolve) => { setTimeout(resolve, 5); });
  await nube.send('order.renameOrder', { id: cultoA, name: 'Culto A en la nube' });
  await a.app.services.cloud.sync();
  assert.deepEqual([await orders(a), await orders(nube)], [['Culto A en la nube'], ['Culto A en la nube']]);
  const notice = (await a.state()).orders.conflicts;
  assert.deepEqual(notice.map((c) => [c.id, c.name, c.where]), [[cultoA, 'Culto A en la nube', 'la nube']]);
  assert.equal((await nube.state()).orders.conflicts.length, 1, 'el aviso sale en los dos lados');
  assert.equal((await a.send('order.dismissConflict', { id: cultoA })).status, 200);
  assert.deepEqual((await a.state()).orders.conflicts, []);
  // La nube contesta la pregunta «¿cambió algo?» en cuanto cambia.
  const key = JSON.parse(fs.readFileSync(path.join(a.app.dataDir, 'nube.json'), 'utf8'));
  a.app.storage.flushAll();
  const { cloudData } = JSON.parse(fs.readFileSync(path.join(a.app.dataDir, 'nube.json'), 'utf8'));
  const t0 = Date.now();
  const waiting = fetch(`${nube.base}/api/nube/esperar?v=${cloudData}`, { headers: { authorization: `Bearer ${key.token}` } }).then((r) => r.json());
  await new Promise((resolve) => { setTimeout(resolve, 300); });
  await nube.send('texts.save', { style: 'normal', text: 'Otro texto de la nube' });
  const answer = await waiting;
  assert.ok(answer.version && answer.version !== cloudData && Date.now() - t0 < 5000, 'contesta enseguida, con la huella nueva');

  // Diez intentos fallidos anulan el código.
  await nube.call('/api/session', { role: 'administrar', user: anaThere, pin: '1234' });
  const last = await code();
  for (let i = 0; i < 10; i += 1) await a.send('cloud.pair', { url: nube.base, code: other(last) });
  const late = await a.send('cloud.pair', { url: nube.base, code: last });
  assert.equal(late.status, 400);
  assert.match(late.error, /ya no sirve/);
});

test('instalar el equipo principal desde la nube: el instalador emparejado y el himnario de la nube (decisión 64)', async () => {
  // Un R2 de mentira con una biblia, unas letras y un himno que el equipo no tiene; y un «GitHub» con el instalador.
  const r2dir = path.join(tmp, 'r2-instalar');
  for (const [file, text] of [['Biblias/Prueba.xmm', 'biblia'], ['Himnario/letras/Letras.md', '# Himnario'], ['Himnario/videos/002 Otro himno.mp4', 'video 2'], ['Himnario/diapositivas/002 Otro himno/01.jpg', 'portada']]) {
    fs.mkdirSync(path.dirname(path.join(r2dir, file)), { recursive: true });
    fs.writeFileSync(path.join(r2dir, file), text);
  }
  const r2 = await startFakeR2(r2dir);
  const github = http.createServer((req, res) => res.end(req.url === '/Instalar-Manna-Windows.exe' ? 'MZ instalador' : ''));
  await new Promise((resolve) => github.listen(0, '127.0.0.1', resolve));
  // Se lee al pedir el instalador: vale durante toda la prueba.
  process.env.MANNA_INSTALADORES_URL = `http://127.0.0.1:${github.address().port}`;
  const nube = await serve('nube-instalar', { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'clave-instalar', ...r2.env });
  try {
    await nube.call('/api/session/alta', { clave: 'clave-instalar', name: 'Ana', pin: '1234' });
    // El instalador: solo para un administrador, con el sistema y el himnario; lleva en su nombre la nube y un código.
    const id = 'ab'.repeat(16);
    assert.equal((await fetch(`${nube.base}/api/nube/instalador?so=windows&himnario=nube&id=${id}`)).status, 401);
    assert.equal((await nube.raw(`/api/nube/instalador?so=linux&himnario=nube&id=${id}`)).status, 400);
    const res = await nube.raw(`/api/nube/instalador?so=windows&himnario=nube&id=${id}`);
    assert.equal(await res.text(), 'MZ instalador');
    const code = /filename="Instalar-Manna-[a-z0-9.-]+-([a-f0-9]{12})\.exe"/.exec(res.headers.get('content-disposition'))?.[1];
    assert.ok(code, res.headers.get('content-disposition'));
    assert.equal((await nube.call(`/api/nube/instalado?id=${id}`)).installed, false);

    // El equipo, con lo que deja el instalador en sus datos: se empareja solo al abrirse, con el himnario elegido.
    const c = await serve('iglesia-instalada');
    await c.call('/api/session', { role: 'control' });
    fs.writeFileSync(path.join(tmp, 'iglesia-instalada', 'emparejar.json'), JSON.stringify({ url: nube.base, code }));
    await c.app.services.cloud.check();
    const st = (await c.state()).cloud;
    assert.deepEqual([st.status, st.hymnal], ['on', 'nube']);
    assert.ok(!fs.existsSync(path.join(tmp, 'iglesia-instalada', 'emparejar.json')), 'se usa una vez');
    assert.equal((await nube.call(`/api/nube/instalado?id=${id}`)).installed, true, 'la portada lo reconoce');
    assert.equal((await nube.call(`/api/nube/instalado?id=${'cd'.repeat(16)}`)).installed, false);
    assert.equal((await nube.call('/api/nube/emparejar', { install: code, id: 'f'.repeat(16) })).status, 410, 'el código del instalador sirve una vez');

    // El himnario de la nube: las biblias y las letras se bajan siempre; el himno que no está en la carpeta sale igual
    // (desde la nube) y se baja al usarlo.
    const bible = path.join(tmp, 'iglesia-instalada-biblias', 'Prueba.xmm');
    for (let i = 0; i < 50 && !fs.existsSync(bible); i += 1) await new Promise((r) => setTimeout(r, 100));
    assert.equal(fs.readFileSync(bible, 'utf8'), 'biblia');
    assert.ok(fs.existsSync(path.join(tmp, 'iglesia-instalada-himnario', 'letras', 'Letras.md')));
    const two = () => c.call('/api/hymns').then((r) => r.hymns.find((h) => h.number === 2));
    const remote = await two();
    assert.deepEqual([remote.url, remote.slidesBase], ['/himnos-nube/002%20Otro%20himno.mp4', '/himnos-letras-nube/002%20Otro%20himno/']);
    const video = await c.raw(remote.url, { redirect: 'manual' });
    assert.equal(video.status, 302);
    assert.ok(video.headers.get('location').startsWith(r2.endpoint));
    const file = path.join(tmp, 'iglesia-instalada-himnario', 'videos', '002 Otro himno.mp4');
    for (let i = 0; i < 50 && !fs.existsSync(file); i += 1) await new Promise((r) => setTimeout(r, 100));
    assert.equal(fs.readFileSync(file, 'utf8'), 'video 2', 'y queda en la carpeta del himnario');
    c.app.services.hymns.reload();
    assert.equal((await two()).url, '/himnos/002%20Otro%20himno.mp4');
  } finally {
    delete process.env.MANNA_INSTALADORES_URL;
    github.close();
    await r2.stop();
  }
});
