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
import church from '../server/modules/church/index.js';
import media from '../server/modules/media/index.js';
import slides from '../server/modules/slides/index.js';
import superadmin from '../server/modules/super/index.js';
import { startFakeR2 } from '../scripts/lib/r2-falso.mjs';
import { startFakeGoogle } from '../scripts/lib/google-falso.mjs';
import { expired } from '../server/modules/super/drive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-nube-'));
const opened = [];
test.after(async () => {
  for (const s of opened) await s.stop();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

// Un Manna de verdad (la nube o un equipo de la iglesia) atendiendo en este equipo, con su cliente y su cookie.
const CHURCH_MODULES = [system, users, order, texts, hymns, cloud, church];
async function serve(name, env = {}, modules = CHURCH_MODULES) {
  Object.assign(process.env, env);
  // Un himnario de mentira de un solo himno (el nombre del video basta para que exista).
  const hymnsDir = path.join(tmp, `${name}-himnario`);
  fs.mkdirSync(path.join(hymnsDir, 'videos'), { recursive: true });
  fs.writeFileSync(path.join(hymnsDir, 'videos', '001 Canción de prueba.mp4'), 'x');
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: path.join(tmp, `${name}-biblias`), hymnsDir });
  for (const key of Object.keys(env)) delete process.env[key];
  for (const setup of modules) await setup(app);
  app.services.hymns?.reload();
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
    raw: (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } }),
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
    const known = await nube.call(`/api/nube/instalado?id=${id}`);
    assert.deepEqual([known.installed, known.version, known.latest], [true, known.latest, known.latest], 'la portada lo reconoce, con su versión y la de la nube');
    // Para ponerlo al día, el instalador de siempre: sin código, no lo vuelve a emparejar.
    const plain = await fetch(`${nube.base}/api/nube/actualizador?so=windows`);
    assert.deepEqual([await plain.text(), plain.headers.get('content-disposition')], ['MZ instalador', 'attachment; filename="Instalar-Manna-Windows.exe"']);
    assert.equal((await nube.call(`/api/nube/instalado?id=${'cd'.repeat(16)}`)).installed, false);
    assert.equal((await nube.call('/api/nube/emparejar', { install: code, id: 'f'.repeat(16) })).status, 410, 'el código del instalador sirve una vez');

    // La portada (fase 37, parte 6): con el equipo encendido, quien está en su misma red recibe la dirección de dentro;
    // quien no, la de internet. Una dirección que no es de una red local no se da.
    c.app.storage.flushAll();
    const token = JSON.parse(fs.readFileSync(path.join(tmp, 'iglesia-instalada', 'nube.json'), 'utf8')).token;
    const report = (lan) => fetch(`${nube.base}/api/nube/estado`, { headers: { authorization: `Bearer ${token}`, 'x-manna-lan': lan, 'x-manna-tunel': 'https://iglesia.ejemplo.org' } });
    await report('http://192.168.1.20:8000');
    const front = await nube.call('/api/nube/portada');
    assert.deepEqual([front.online, front.here, front.tunnel], [true, 'http://192.168.1.20:8000', 'https://iglesia.ejemplo.org']);
    const outside = await (await fetch(`${nube.base}/api/nube/portada`, { headers: { 'X-Forwarded-For': '203.0.113.9' } })).json();
    assert.deepEqual([outside.online, outside.here, outside.tunnel], [true, null, 'https://iglesia.ejemplo.org'], 'desde fuera, solo la de internet');
    await report('http://8.8.8.8');
    assert.equal((await nube.call('/api/nube/portada')).here, null, 'solo direcciones de una red local');

    // El himnario de la nube: las biblias y las letras se bajan siempre; el himno que no está en la carpeta sale igual
    // (desde la nube) y se baja al usarlo.
    const bible = path.join(tmp, 'iglesia-instalada-biblias', 'Prueba.xmm');
    const letras = path.join(tmp, 'iglesia-instalada-himnario', 'letras', 'Letras.md');
    for (let i = 0; i < 50 && !(fs.existsSync(bible) && fs.existsSync(letras)); i += 1) await new Promise((r) => setTimeout(r, 100));
    assert.equal(fs.readFileSync(bible, 'utf8'), 'biblia');
    assert.ok(fs.existsSync(letras));
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

test('el superadministrador: su contraseña, las iglesias, lo que puede usar cada una y el espacio del plan (fase 39, decisión 64)', async () => {
  // La clave del superadministrador: la misma en su sitio y en el de cada iglesia (aquí, el mismo proceso).
  process.env.MANNA_CLAVE_SUPER = 'clave-super-de-prueba';
  const GB = 1024 ** 3;
  const iglesia = await serve('iglesia-super', { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'alta-iglesia' });
  const admin = await serve('super', { MANNA_NUBE: '1', MANNA_SUPER: '1', MANNA_CLAVE_ALTA: 'alta-super' }, [system, users, superadmin]);
  try {
    // Su cuenta: con la clave de alta, su nombre y una contraseña de al menos 10 caracteres; después, con la contraseña.
    const info = await admin.call('/api/session');
    assert.deepEqual([info.roles.map((r) => r.id), info.alta], [['superadmin'], true]);
    assert.equal((await admin.call('/api/session/alta', { clave: 'alta-super', name: 'Ángel', password: 'corta' })).status, 400);
    assert.equal((await admin.call('/api/session/alta', { clave: 'alta-super', name: 'Ángel', password: 'una contraseña larga' })).status, 200);
    assert.equal((await admin.call('/api/session')).alta, false);
    assert.equal((await admin.remote('/api/session', { role: 'superadmin', password: 'otra cualquiera' })).status, 401);
    assert.equal((await admin.remote('/api/session', { role: 'superadmin', password: 'una contraseña larga' })).status, 200);

    // Una iglesia: contesta solo con la clave del superadministrador.
    const host = new URL(iglesia.base).host;
    assert.equal((await fetch(`${iglesia.base}/api/nube/super/estado`, { headers: { authorization: 'Bearer otra' } })).status, 401);
    assert.equal((await admin.send('super.add', { host })).status, 200);
    const first = (await admin.state()).super.churches[0];
    assert.deepEqual([first.ok, first.settings.active, first.settings.limit, first.settings.space], [true, true, 20, 5 * GB]);

    // El espacio del plan: con el margen, no se reparte más de lo que hay.
    assert.equal((await admin.send('super.plan', { total: 10 * GB, margin: 0.2 })).status, 200);
    assert.equal((await admin.send('super.set', { host, settings: { space: 9 * GB } })).status, 409);
    const set = await admin.send('super.set', { host, settings: { space: 6 * GB, off: ['textos'], limit: 30, layout: { preparacion: ['himnario', 'orden', 'otro'] } } });
    assert.equal(set.status, 200);
    const seen = (await iglesia.call('/api/session')).church;
    assert.deepEqual([seen.off, seen.layout.preparacion, seen.space], [['textos'], ['himnario', 'orden'], 6 * GB]);
    assert.equal(iglesia.app.services.order.limit(), 30);
    assert.ok(iglesia.app.services.church.refuses('texts.save'), 'un módulo apagado no da órdenes');
    assert.equal(iglesia.app.services.church.refuses('order.add'), null);

    // Suspendida: su nube no deja entrar; reactivada, sí.
    await admin.send('super.set', { host, settings: { active: false } });
    assert.equal((await iglesia.call('/api/session')).church.active, false);
    const refused = await iglesia.remote('/api/session', { role: 'preparacion', user: 'x', pin: '1234' });
    assert.equal(refused.status, 409);
    assert.match(refused.error, /suspendida/);
    await admin.send('super.set', { host, settings: { active: true } });
    assert.equal(iglesia.app.suspended, false);

    // Recuperar el acceso: una clave de alta nueva para el administrador de la iglesia.
    assert.equal((await iglesia.call('/api/session/alta', { clave: 'alta-iglesia', name: 'Ana', pin: '1234' })).status, 200);
    assert.equal((await iglesia.call('/api/session')).alta, false);
    const { result } = await admin.send('super.access', { host });
    assert.match(result.clave, /^[a-f0-9]{10}$/);
    assert.equal((await iglesia.call('/api/session')).alta, true);
    assert.equal((await iglesia.call('/api/session/alta', { clave: result.clave, name: 'Ana', pin: '4321' })).status, 200);
    assert.equal((await iglesia.call('/api/session')).alta, false, 'y sirve una vez');
  } finally {
    delete process.env.MANNA_CLAVE_SUPER;
  }
});

test('lo que se sube desde casa llega al equipo de la iglesia, y la nube se queda con la miniatura (decisión 64)', async () => {
  const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  const LIBRARY = [system, users, order, texts, hymns, media, slides, cloud, church];
  const nube = await serve('nube-archivos', { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'alta-archivos' }, LIBRARY);
  const c = await serve('iglesia-archivos', { MANNA_FALTA: 'yt-dlp' }, LIBRARY);
  const ana = (await nube.call('/api/session/alta', { clave: 'alta-archivos', name: 'Ana', pin: '1234' })).user.id;
  const code = (await nube.send('cloud.code')).result.code;
  await c.call('/api/session', { role: 'control' });
  assert.equal((await c.send('cloud.pair', { url: nube.base, code })).status, 200);
  // Quien prepara el culto sube una imagen (con su miniatura) y un PDF (sus páginas, ya en imágenes).
  assert.equal((await nube.call('/api/session', { role: 'preparacion', user: ana })).status, 200);
  const upload = async (url, body) => (await nube.raw(url, { method: 'POST', body, headers: { 'Content-Type': 'image/jpeg' } })).json();
  const image = await upload('/api/media/images?name=Bienvenida', JPG);
  assert.ok(image.id, JSON.stringify(image));
  await upload(`/api/media/images/${image.id}/thumb`, JPG);
  const deck = (await (await nube.raw('/api/slides?name=Anuncios&pages=1', { method: 'POST' })).json()).id;
  await upload(`/api/slides/${deck}/pages/1`, JPG);
  await upload(`/api/slides/${deck}/pages/1?mini=1`, JPG);
  assert.equal((await nube.send('slides.finish', { id: deck })).status, 200);
  for (const [kind, data] of [['image', { id: image.id }], ['slides', { id: deck }], ['ytlink', { link: 'Canto: https://youtu.be/dQw4w9WgXcQ' }]]) assert.equal((await nube.send('order.add', { kind, data })).status, 200);
  assert.deepEqual((await nube.call('/api/nube/archivos')).status, 401, 'la lista es solo para el equipo oficial');

  // El equipo se pone al día: trae el orden y lo subido, con los mismos identificadores.
  await c.app.services.cloud.check();
  let here = await c.state();
  for (let i = 0; i < 50 && !((await nube.state()).slides.decks[0]?.atChurch && here.media.images.length); i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    here = await c.state();
  }
  assert.ok(here.media.images.some((i) => i.id === image.id && i.name === 'Bienvenida' && !i.atChurch), 'la imagen está en la iglesia');
  assert.ok(here.slides.decks.some((d) => d.id === deck && d.status === 'ready' && d.pages === 1), 'y la presentación');
  const list = here.orders.list.find((o) => o.count === 3);
  assert.ok(list, 'y el orden con los tres');
  // En la nube, ya en la iglesia: la ficha y la miniatura, sin el archivo grande.
  const there = await nube.state();
  assert.ok(there.media.images.find((i) => i.id === image.id).atChurch);
  assert.ok(there.slides.decks.find((d) => d.id === deck).atChurch);
  assert.ok(!fs.existsSync(path.join(tmp, 'nube-archivos', 'media', 'diapositivas', deck, '1.jpg')) && fs.existsSync(path.join(tmp, 'nube-archivos', 'media', 'diapositivas', deck, 'm1.jpg')));
  assert.deepEqual((await nube.call('/api/nube/archivos')).status, 401);

  // Y al revés: lo que ya está en el equipo sube a la nube como ficha «en la iglesia», con su miniatura y sus categorías.
  const local = await (await c.raw('/api/media/images?name=Cartel de la iglesia', { method: 'POST', body: JPG, headers: { 'Content-Type': 'image/jpeg' } })).json();
  await c.raw(`/api/media/images/${local.id}/thumb`, { method: 'POST', body: JPG, headers: { 'Content-Type': 'image/jpeg' } });
  assert.equal((await c.send('media.categoryAdd', { name: 'Anuncios' })).status, 200);
  await c.app.services.cloud.check();
  let seen = null;
  for (let i = 0; i < 50 && !seen?.thumb; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    seen = (await nube.state()).media.images.find((x) => x.id === local.id);
  }
  assert.ok(seen?.atChurch && seen.thumb && seen.name === 'Cartel de la iglesia', JSON.stringify(seen));
  assert.deepEqual((await nube.state()).media.categories.map((x) => x.name), ['Anuncios']);
  assert.equal((await nube.send('order.add', { kind: 'image', data: { id: local.id } })).status, 200, 'y desde casa se añade al orden');
  // Lo que la iglesia quita de su biblioteca, se va también de la nube.
  assert.equal((await c.send('media.remove', { id: local.id })).status, 200);
  await c.app.services.cloud.check();
  for (let i = 0; i < 50 && (await nube.state()).media.images.some((x) => x.id === local.id); i += 1) await new Promise((r) => setTimeout(r, 100));
  assert.ok(!(await nube.state()).media.images.some((x) => x.id === local.id));
});

test('la misma versión: el equipo se pone al día al encenderse, y con otro idioma no sincroniza (fase 37, parte 7)', async () => {
  const marker = path.join(tmp, 'instalador-abierto');
  const installer = path.join(tmp, 'instalador.mjs');
  fs.writeFileSync(installer, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'abierto');\n`);
  process.env.MANNA_ACTUALIZADOR_PRUEBA = installer;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nube = await serve('nube-version', { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'alta-version' });
  // El equipo se apaga y se vuelve a encender: la primera comprobación de cada arranque es la que puede ponerlo al día.
  const start = async () => {
    const s = await serve('iglesia-version');
    await s.call('/api/session', { role: 'control' });
    return s;
  };
  const restart = async (s) => {
    opened.splice(opened.indexOf(s), 1);
    await s.stop();
    return start();
  };
  let c = await start();
  try {
    await nube.call('/api/session/alta', { clave: 'alta-version', name: 'Ana', pin: '1234' });
    assert.equal((await c.send('cloud.pair', { url: nube.base, code: (await nube.send('cloud.code')).result.code })).status, 200);
    await c.app.services.cloud.check();
    assert.equal((await c.state()).cloud.status, 'on');

    // La nube tiene una versión más nueva: con Manna abierto, nada; al encenderse, abre el instalador, una vez por versión.
    process.env.MANNA_NUBE_VERSION = '99.0.0';
    await c.app.services.cloud.check();
    assert.equal((await c.state()).cloud.status, 'on');
    await sleep(300);
    assert.ok(!fs.existsSync(marker), 'nunca con Manna abierto');
    c = await restart(c);
    await c.app.services.cloud.check();
    assert.equal((await c.state()).cloud.status, 'updating');
    for (let i = 0; i < 50 && !fs.existsSync(marker); i += 1) await sleep(100);
    assert.ok(fs.existsSync(marker), 'al encenderse, abre el instalador');
    fs.rmSync(marker);
    c = await restart(c);
    await c.app.services.cloud.check();
    assert.equal((await c.state()).cloud.status, 'on', 'si el instalador no pudo, con esa versión no lo vuelve a intentar');
    await sleep(300);
    assert.ok(!fs.existsSync(marker));

    // Otro idioma de sincronización: el equipo lo dice y sigue en local, y la nube no sincroniza con él.
    process.env.MANNA_NUBE_PROTOCOLO = '2';
    await c.app.services.cloud.check();
    const apart = (await c.state()).cloud;
    assert.equal(apart.status, 'version');
    assert.match(apart.error, /99\.0\.0.*sigue en local, sin sincronizar\. Se pondrá al día/);
    const token = JSON.parse(fs.readFileSync(path.join(c.app.dataDir, 'nube.json'), 'utf8')).token;
    const asks = (route, protocol) => fetch(`${nube.base}${route}`, { headers: { authorization: `Bearer ${token}`, ...(protocol && { 'x-manna-protocolo': protocol }) } });
    assert.equal((await asks('/api/nube/usuarios', '1')).status, 409);
    assert.equal((await asks('/api/nube/usuarios')).status, 409, 'un equipo de antes de la 1.55 habla el 1');
    assert.equal((await asks('/api/nube/usuarios', '2')).status, 200);
    delete process.env.MANNA_NUBE_PROTOCOLO;
    await c.app.services.cloud.check();
    assert.equal((await c.state()).cloud.status, 'on', 'con el mismo idioma, vuelve a sincronizar');
  } finally {
    for (const key of ['MANNA_ACTUALIZADOR_PRUEBA', 'MANNA_NUBE_VERSION', 'MANNA_NUBE_PROTOCOLO']) delete process.env[key];
  }
});

test('qué copias se quedan: las de los últimos 30 días y la primera de cada mes durante un año (fase 38)', () => {
  const names = ['2026-10-29.json', '2026-10-01.json', '2026-09-30.json', '2026-09-20.json', '2026-09-02.json', '2025-11-05.json', '2025-10-03.json', 'otra cosa.json'];
  assert.deepEqual(expired(names, '2026-10-29'), ['2025-10-03.json', '2026-09-20.json']);
});

test('copias en Google Drive: conectar la cuenta, hacer una copia y volver a ella (fase 38)', async () => {
  const google = await startFakeGoogle();
  const env = { MANNA_CLAVE_SUPER: 'clave-super-de-prueba', GOOGLE_CLIENT_ID: 'cliente-de-prueba', GOOGLE_CLIENT_SECRET: 'secreto-de-prueba', MANNA_GOOGLE_PRUEBA: google.url };
  Object.assign(process.env, env);
  const iglesia = await serve('iglesia-copias', { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'alta-copias' });
  const admin = await serve('super-copias', { MANNA_NUBE: '1', MANNA_SUPER: '1', MANNA_CLAVE_ALTA: 'alta-super-copias' }, [system, users, superadmin]);
  try {
    await admin.call('/api/session/alta', { clave: 'alta-super-copias', name: 'Ángel', password: 'una contraseña larga' });
    const host = new URL(iglesia.base).host;
    await admin.send('super.add', { host });
    let drive = (await admin.state()).super.drive;
    assert.deepEqual([drive.ready, drive.connected], [true, false]);
    assert.equal((await admin.send('super.backup')).status, 409, 'sin conectar no hay copias');

    // Conectar: el panel lleva a Google, y Google vuelve con un código que Manna cambia por su clave.
    const go = await admin.raw('/api/super/drive/conectar', { redirect: 'manual' });
    assert.equal(go.status, 302);
    const back = new URL((await fetch(go.headers.get('location'), { redirect: 'manual' })).headers.get('location'));
    assert.equal(back.pathname, '/api/super/drive/vuelta');
    const forged = await admin.raw('/api/super/drive/vuelta?code=codigo-de-prueba&state=otro', { redirect: 'manual' });
    assert.equal(forged.headers.get('location'), '/superadmin?drive=cancelado#copias', 'sin el state de la ida no se conecta');
    const done = await admin.raw(back.pathname + back.search, { redirect: 'manual' });
    assert.equal(done.headers.get('location'), '/superadmin?drive=conectado#copias');
    const state = await admin.state();
    assert.equal(state.super.drive.connected, true);
    assert.ok(!JSON.stringify(state).includes('renovar'), 'la clave de Google no va en el estado');

    // La iglesia, con su administrador, un orden y un texto; su copia va a «Manna Iglesia / <iglesia> / hoy.json».
    await iglesia.call('/api/session/alta', { clave: 'alta-copias', name: 'Ana', pin: '1234' });
    const ana = (await iglesia.call('/api/session')).users[0].id;
    assert.equal((await iglesia.call('/api/session', { role: 'preparacion', user: ana })).status, 200);
    const { result: kept } = await iglesia.send('order.create', { name: 'Culto del domingo' });
    await iglesia.send('texts.save', { style: 'normal', text: 'Bienvenidos' });
    const today = `${new Date().toISOString().slice(0, 10)}.json`;
    assert.equal((await admin.send('super.backup', { host })).result.ok, true);
    await admin.send('super.backup');
    assert.deepEqual([...google.files.values()].map((f) => f.name).sort(), ['Manna Iglesia', host, today].sort(), 'otra copia hoy sustituye a la de hoy');
    const copy = JSON.parse([...google.files.values()].find((f) => f.name === today).content);
    assert.deepEqual([copy.users.map((u) => u.name), copy.sets.orders.records.map((o) => o.name)], [['Ana'], ['Culto del domingo']]);
    assert.ok(copy.users[0].pin && !JSON.stringify(copy).includes('"1234"'), 'el PIN va como huella');
    drive = (await admin.state()).super.drive;
    assert.equal(drive.last[host].name, today);

    // Lo de la iglesia cambia; al volver a la copia queda como estaba, y lo de antes de volver se guarda.
    await iglesia.send('order.deleteOrder', { id: kept.id });
    await iglesia.send('order.create', { name: 'Ensayo' });
    await iglesia.send('texts.save', { style: 'normal', text: 'Otro texto' });
    const [listed] = (await admin.send('super.backups', { host })).result;
    assert.equal(listed.name, today);
    assert.equal((await admin.send('super.restore', { host, id: 'no-esta' })).status, 404);
    assert.equal((await admin.send('super.restore', { host, id: listed.id })).status, 200);
    assert.deepEqual(iglesia.app.services.order.sync.export().records.map((o) => o.name), ['Culto del domingo']);
    assert.deepEqual(iglesia.app.services.texts.sync.export().records.map((x) => x.text), ['Bienvenidos']);
    const saved = JSON.parse([...google.files.values()].find((f) => f.name === today).content);
    assert.deepEqual(saved.sets.orders.records.map((o) => o.name), ['Ensayo'], 'la de hoy guarda lo de antes de volver');
  } finally {
    for (const key of Object.keys(env)) delete process.env[key];
    await google.stop();
  }
});
