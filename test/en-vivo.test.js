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
import bible from '../server/modules/bible/index.js';
import layers from '../server/modules/layers/index.js';
import users from '../server/modules/users/index.js';
import { layoutFor } from '../web/core/disposicion.js';

// Los cimientos de las pantallas «En vivo» (fase 42): las funciones, Siguiente sin pasos dobles, «Volver», lo que sigue y la
// capa del orador, contra el servidor de verdad; y qué pantalla le toca a cada dispositivo.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-en-vivo-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

// Una Reina-Valera de mentira no hace falta: la de 1909 viene con el programa.
async function start(name) {
  const biblesDir = path.join(ROOT, 'Contenido', 'Biblias');
  const only = path.join(tmp, `${name}-biblias`);
  fs.mkdirSync(only, { recursive: true });
  fs.copyFileSync(path.join(biblesDir, 'Reina Valera 1909.xmm'), path.join(only, 'Reina Valera 1909.xmm'));
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, name), biblesDir: only });
  for (const setup of [system, users, projection, order, bible, layers]) await setup(app);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const as = async (role) => {
    const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
    return login.json();
  };
  await as('control');
  const request = (url, options = {}) => fetch(base + url, { redirect: 'manual', ...options, headers: { ...options.headers, cookie } });
  return {
    app, as, request,
    send: async (type, payload = {}) => {
      const res = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) });
      return { ...(await res.json()), http: res.status };
    },
    state: async () => (await request('/api/state')).json(),
    async stop() {
      await app.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const passage = (s, chapter, from, to) => {
  const { versions } = s.app.store.get('bible');
  const versionId = versions[0].id;
  return { versionId, ref: { book: 43, chapter, verseStart: from, verseEnd: to } };
};

test('las funciones: dos oradores, sin Control del orden, y los marcadores antiguos siguen llegando', async () => {
  const s = await start('funciones');
  try {
    const { roles, permissions } = await (await s.request('/api/session')).json();
    assert.deepEqual(roles.map((r) => r.name).slice(0, 4), ['Control total', 'Alabanza', 'Orador completo', 'Orador sencillo']);
    assert.ok(!roles.some((r) => r.id === 'orden'));
    assert.deepEqual(permissions, ['*'], 'la interfaz sabe lo que puede esta función');
    assert.deepEqual((await s.as('presentador')).permissions, ['projection.control', 'slides.edit', 'hymns.read']);
    assert.deepEqual((await s.as('orador-sencillo')).permissions, ['projection.control', 'slides.edit', 'hymns.read']);
    for (const [from, to] of [['/presentador', '/orador'], ['/orden', '/'], ['/guion', '/']]) {
      const res = await s.request(from);
      assert.equal(res.status, 302, from);
      assert.equal(res.headers.get('location'), to, from);
    }
    assert.equal((await s.request('/orador-sencillo')).status, 200);
    // Alabanza enciende y apaga capas, pero no las pone ni las quita.
    await s.as('alabanza');
    assert.equal((await s.send('layers.set', { n: 1, kind: 'verses', data: passage(s, 3, 16, 16) })).http, 403);
    assert.equal((await s.send('layers.clear', { n: 1 })).http, 403);
    assert.equal((await s.send('layers.visible', { n: 1, visible: true })).http, 409, 'puede intentarlo: la capa está vacía');
  } finally {
    await s.stop();
  }
});

test('un usuario que solo tenía Control del orden se queda sin función', async () => {
  const dir = path.join(tmp, 'sin-funcion');
  fs.mkdirSync(dir, { recursive: true });
  const seal = { salt: 'a'.repeat(32), hash: 'b'.repeat(64) };
  fs.writeFileSync(path.join(dir, 'usuarios.json'), JSON.stringify({ list: [
    { id: 'a'.repeat(12), name: 'Admin', admin: true, functions: ['control', 'orden'], pin: seal, added: 1 },
    { id: 'b'.repeat(12), name: 'Beto', admin: false, functions: ['orden'], pin: seal, added: 2 },
    { id: 'c'.repeat(12), name: 'Carla', admin: false, functions: ['orden', 'presentador'], pin: seal, added: 3 },
  ] }));
  const s = await start('sin-funcion');
  try {
    const people = (await (await s.request('/api/session')).json()).users;
    assert.deepEqual(people.find((u) => u.name === 'Beto').functions, []);
    assert.deepEqual(people.find((u) => u.name === 'Carla').functions, ['presentador']);
    const refused = await s.send('users.create', { name: 'Dani', pin: '1234', functions: ['orden'] });
    assert.equal(refused.http, 400, JSON.stringify(refused));
    assert.equal((await s.send('users.create', { name: 'Dani', pin: '1234', functions: ['orador-sencillo'] })).http, 200);
  } finally {
    await s.stop();
  }
});

test('Siguiente: dos toques casi juntos no pasan dos pasos, y se sabe qué pondrá', async () => {
  const s = await start('siguiente');
  try {
    const a = (await s.send('order.add', { kind: 'verses', data: passage(s, 3, 16, 18) })).result;
    const b = (await s.send('order.add', { kind: 'verses', data: passage(s, 1, 1, 1) })).result;
    const shown = (await s.send('order.show', { id: a.id, step: 0 })).result;
    let now = await s.state();
    assert.deepEqual(now.projection.next, { title: a.title, kind: 'verses', orderId: a.id, step: 1, steps: 3, inside: true });
    assert.equal(now.projection.back, null, 'lo primero no tiene a qué volver');

    const first = await s.send('projection.step', { delta: 1, uid: shown.uid });
    assert.equal(first.result.source.step, 1);
    const second = await s.send('projection.step', { delta: 1, uid: shown.uid });
    assert.equal(second.result.source.step, 1, 'el segundo se pulsó viendo lo de antes: no pasa otra vez');
    assert.equal((await s.send('projection.step', { delta: 1, uid: first.result.uid })).result.source.step, 2, 'con lo que se ve ahora, sí');

    now = await s.state();
    assert.deepEqual(now.projection.next, { title: b.title, kind: 'verses', orderId: b.id, step: 0, steps: 1, inside: false });
    assert.equal(now.projection.back, null, 'el paso que tocaba no se ofrece deshacer');
    const last = (await s.send('projection.step', { delta: 1 })).result;
    assert.equal(last.source.orderId, b.id);
    assert.deepEqual((await s.state()).projection.next, { end: true }, 'al llegar al final, lo dice');
    assert.equal((await s.send('projection.step', { delta: 1 })).result, null);

    // Siguiente con la pantalla en Negro vuelve al aire con lo que sigue.
    await s.send('order.show', { id: a.id, step: 0 });
    await s.send('projection.mode', { mode: 'black' });
    await s.send('projection.step', { delta: 1 });
    now = await s.state();
    assert.deepEqual([now.projection.mode, now.projection.item.source.step], ['live', 1]);
    // El orden cambia y lo que sigue se pone al día.
    await s.send('order.show', { id: b.id, step: 0 });
    await s.send('order.remove', { id: b.id });
    assert.deepEqual((await s.state()).projection.next.end, undefined, 'lo que estaba al aire ya no está en el orden: sigue leyendo la Biblia');
  } finally {
    await s.stop();
  }
});

test('Volver: un salto se deshace mientras nadie cambie lo que está al aire', async () => {
  const s = await start('volver');
  try {
    const a = (await s.send('order.add', { kind: 'verses', data: passage(s, 3, 16, 18) })).result;
    await s.send('order.show', { id: a.id, step: 1 });
    await s.send('projection.mode', { mode: 'black' });
    await s.send('projection.show', { kind: 'verses', data: passage(s, 1, 1, 1) });
    let now = await s.state();
    assert.equal(now.projection.back.title, a.title);
    assert.equal(now.projection.mode, 'live');
    await s.send('projection.back');
    now = await s.state();
    assert.deepEqual([now.projection.item.source.orderId, now.projection.item.source.step, now.projection.mode], [a.id, 1, 'black'], 'al mismo punto, y como estaba');
    assert.equal(now.projection.back, null);
    assert.equal((await s.send('projection.back')).http, 409, 'volver no se deshace');
    // Si otro cambió lo que está al aire, ya no se puede.
    await s.send('projection.show', { kind: 'verses', data: passage(s, 1, 1, 1) });
    const seen = (await s.state()).projection.back;
    assert.ok(seen);
    await s.send('projection.step', { delta: 1 });
    assert.equal((await s.send('projection.back')).http, 409);
  } finally {
    await s.stop();
  }
});

test('la capa del orador: encima de lo que está al aire, sin cambiarlo', async () => {
  const s = await start('capa-orador');
  try {
    assert.equal((await s.send('projection.over', {})).http, 400);
    // Sin nada al aire no hay qué tapar: se proyecta.
    await s.send('projection.over', { data: passage(s, 1, 1, 1) });
    let now = await s.state();
    assert.deepEqual([now.projection.item.kind, now.projection.over], ['verses', null]);

    const a = (await s.send('order.add', { kind: 'verses', data: passage(s, 3, 16, 16) })).result;
    const onAir = (await s.send('order.show', { id: a.id, step: 0 })).result;
    await s.send('projection.over', { data: passage(s, 1, 1, 2) });
    now = await s.state();
    assert.equal(now.projection.item.uid, onAir.uid, 'lo que está al aire no cambia');
    assert.deepEqual([now.projection.over.kind, now.projection.over.step, now.projection.over.steps], ['verses', 0, 2]);
    assert.equal(now.projection.over.content.verses.length, 1);
    assert.deepEqual(now.projection.next, { over: true, step: 1, steps: 2 });

    // Siguiente pasa sus versículos, con la misma protección de dos toques.
    const seen = now.projection.over.uid;
    await s.send('projection.step', { delta: 1, uid: seen });
    await s.send('projection.step', { delta: 1, uid: seen });
    now = await s.state();
    assert.equal(now.projection.over.step, 1);
    assert.equal(now.projection.item.uid, onAir.uid);
    // Tras el último, la capa se quita y queda lo de debajo, donde estaba.
    await s.send('projection.step', { delta: 1 });
    now = await s.state();
    assert.equal(now.projection.over, null);
    assert.equal(now.projection.item.uid, onAir.uid);

    // Se quita sola si cambia lo que está al aire, y con su orden.
    await s.send('projection.over', { data: passage(s, 1, 1, 2) });
    await s.send('projection.overClear');
    assert.equal((await s.state()).projection.over, null);
    await s.send('projection.over', { data: passage(s, 1, 1, 2) });
    await s.send('projection.show', { kind: 'verses', data: passage(s, 1, 3, 3) });
    assert.equal((await s.state()).projection.over, null);
    // Con «Negro» sigue ahí (la pantalla la oculta), y Siguiente vuelve al aire con su versículo.
    await s.send('projection.over', { data: passage(s, 1, 1, 2) });
    await s.send('projection.mode', { mode: 'black' });
    assert.ok((await s.state()).projection.over);
    await s.send('projection.step', { delta: 1 });
    now = await s.state();
    assert.deepEqual([now.projection.mode, now.projection.over.step], ['live', 1]);
  } finally {
    await s.stop();
  }
});

test('lo que «Negro» pausó sigue al volver al aire; lo que terminó, no', async () => {
  const s = await start('reanudar');
  try {
    // Un tipo de mentira que suena: lo único que importa aquí es su reloj.
    s.app.kind('sonido', {
      label: 'Sonido',
      describe: () => ({ title: 'Canto', subtitle: '', steps: 1, data: {} }),
      resolve: () => ({ title: 'Canto' }),
      live: (content, previous) => (previous ? { clock: { ...previous.state.clock, playing: false } } : { clock: { playing: true } }),
      hide: (state) => ({ clock: { ...state.clock, playing: false } }),
      control: (state, patch) => ({ clock: { ...state.clock, playing: patch.playing ?? state.clock.playing } }),
    });
    const playing = async () => (await s.state()).live.state.clock.playing;
    await s.send('projection.show', { kind: 'sonido', data: {} });
    await s.send('projection.mode', { mode: 'black' });
    assert.equal(await playing(), false);
    await s.send('projection.mode', { mode: 'live' });
    assert.equal(await playing(), true, 'sigue');

    // Alguien lo pausó antes: al volver, no se pone a sonar.
    await s.send('projection.control', { playing: false });
    await s.send('projection.mode', { mode: 'clear' });
    await s.send('projection.mode', { mode: 'live' });
    assert.equal(await playing(), false);

    // Alguien decide con la pantalla oculta: manda lo que decidió.
    await s.send('projection.control', { playing: true });
    await s.send('projection.mode', { mode: 'black' });
    await s.send('projection.control', { playing: false });
    await s.send('projection.mode', { mode: 'live' });
    assert.equal(await playing(), false);

    // «Volver» a algo que sonaba: vuelve a sonar.
    await s.send('projection.control', { playing: true });
    await s.send('projection.show', { kind: 'verses', data: passage(s, 1, 1, 1) });
    await s.send('projection.back');
    assert.deepEqual([(await s.state()).projection.item.kind, await playing()], ['sonido', true]);
  } finally {
    await s.stop();
  }
});

test('qué pantalla le toca a cada dispositivo (decisión 71)', () => {
  const phoneUp = 'telefono-pie';
  const phoneSide = 'telefono-acostado';
  const tabletUp = 'tableta-pie';
  const tabletSide = 'tableta-acostada';
  for (const [w, h, want] of [
    [360, 560, phoneUp], [412, 915, phoneUp], [430, 932, phoneUp], [599, 900, phoneUp],
    [640, 280, phoneSide], [932, 430, phoneSide], [915, 412, phoneSide], [1000, 479, phoneSide],
    [600, 880, tabletUp], [600, 960, tabletUp], [768, 1024, tabletUp], [1024, 1366, tabletUp],
    [960, 520, tabletSide], [1024, 768, tabletSide], [1366, 1024, tabletSide],
  ]) assert.equal(layoutFor({ mobile: true, width: w, height: h }), want, `móvil de ${w} × ${h}`);
  // Girarlo no cambia de familia.
  assert.equal(layoutFor({ mobile: true, width: 932, height: 430 }), phoneSide);
  assert.equal(layoutFor({ mobile: true, width: 430, height: 932 }), phoneUp);
  // Un computador es Escenario desde 860 px; más angosto, usa las de móvil.
  assert.equal(layoutFor({ mobile: false, width: 1280, height: 720 }), 'computador');
  assert.equal(layoutFor({ mobile: false, width: 860, height: 400 }), 'computador');
  assert.equal(layoutFor({ mobile: false, width: 859, height: 700 }), tabletSide);
  assert.equal(layoutFor({ mobile: false, width: 700, height: 859 }), tabletUp);
  assert.equal(layoutFor({ mobile: false, width: 500, height: 700 }), phoneUp);
});
