import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRange } from '../server/core/router.js';
import { createStorage } from '../server/core/storage.js';
import { applyClock, createClock, freezeClock, hasEnded, positionAt } from '../server/core/playback.js';
import { createJobs, estimate } from '../server/core/jobs.js';
import { createSessions } from '../server/core/sessions.js';
import { createApp } from '../server/core/app.js';

// ---- Trozos de archivo (Range) ----

test('si el disco no deja guardar, Manna sigue y lo vuelve a intentar', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-guardado-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'error', () => {});
  const storage = createStorage(dir);
  const saved = storage('prueba', { n: 0 });
  saved.data.n = 7;
  saved.save();
  fs.rmSync(dir, { recursive: true }); // sin carpeta, escribir falla
  assert.doesNotThrow(() => saved.flush());
  fs.mkdirSync(dir);
  storage.flushAll(); // lo que no se pudo guardar sigue pendiente
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'prueba.json'), 'utf8')), { n: 7 });
});

test('parseRange entiende las tres formas de pedir un trozo', () => {
  assert.deepEqual(parseRange('bytes=0-499', 1000), { start: 0, end: 499 });
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=-200', 1000), { start: 800, end: 999 });
  // Un final más allá del archivo se recorta; pedir más cola que archivo da el archivo entero.
  assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=-5000', 1000), { start: 0, end: 999 });
});

test('parseRange devuelve null si no se pide un trozo y false si el trozo no existe', () => {
  assert.equal(parseRange(undefined, 1000), null);
  assert.equal(parseRange('bytes=0-10,20-30', 1000), null);
  assert.equal(parseRange('otra cosa', 1000), null);
  assert.equal(parseRange('bytes=1000-', 1000), false);
  assert.equal(parseRange('bytes=30-20', 1000), false);
  assert.equal(parseRange('bytes=-0', 1000), false);
  assert.equal(parseRange('bytes=0-', 0), false);
});

// ---- Reloj de reproducción ----

test('el reloj avanza solo mientras está reproduciendo y se detiene al final', () => {
  const t0 = 1_000_000;
  const clock = createClock({ duration: 60, now: t0 });
  assert.equal(positionAt(clock, t0 + 5000), 0);
  const playing = applyClock(clock, { playing: true }, t0);
  assert.equal(positionAt(playing, t0 + 5000), 5);
  assert.equal(positionAt(playing, t0 + 90_000), 60);
  assert.equal(hasEnded(playing, t0 + 90_000), true);
  const paused = applyClock(playing, { playing: false }, t0 + 12_500);
  assert.equal(paused.position, 12.5);
  assert.equal(positionAt(paused, t0 + 99_000), 12.5);
});

test('el reloj salta, reinicia y vuelve a empezar al reproducir desde el final', () => {
  const t0 = 5000;
  const playing = applyClock(createClock({ duration: 100, now: t0 }), { playing: true }, t0);
  const jumped = applyClock(playing, { position: 40 }, t0 + 3000);
  assert.deepEqual([jumped.position, jumped.playing], [40, true]);
  assert.equal(applyClock(jumped, { position: 500 }, t0 + 3000).position, 100);
  const restarted = applyClock(jumped, { restart: true }, t0 + 9000);
  assert.deepEqual([restarted.position, restarted.playing], [0, true]);
  // Llegó al final: queda detenido, y "reproducir" empieza de nuevo.
  const finished = applyClock(playing, {}, t0 + 200_000);
  assert.deepEqual([finished.position, finished.playing], [100, false]);
  assert.equal(applyClock(finished, { playing: true }, t0 + 200_000).position, 0);
  assert.throws(() => applyClock(playing, { position: -1 }, t0), /no es válido/);
  assert.throws(() => applyClock(playing, { position: 'x' }, t0), /no es válido/);
});

test('un cronómetro (sin duración) no tiene final', () => {
  const t0 = 0;
  const running = applyClock(createClock({ now: t0 }), { playing: true }, t0);
  assert.equal(positionAt(running, 3_600_000), 3600);
  assert.equal(hasEnded(running, 3_600_000), false);
});

test('tras un reinicio el reloj queda en pausa donde iba al guardarse', () => {
  const playing = applyClock(createClock({ duration: 300, now: 0 }), { playing: true }, 0);
  const frozen = freezeClock(playing, 42_000);
  assert.deepEqual([frozen.playing, frozen.position], [false, 42]);
  assert.equal(positionAt(frozen, 999_000), 42);
  assert.equal(freezeClock(null, 0).playing, false);
});

// ---- Tareas con avance ----

test('estimate calcula lo que falta a partir del ritmo reciente', () => {
  assert.equal(estimate([]), null);
  assert.equal(estimate([{ t: 0, p: 0.1 }, { t: 500, p: 0.2 }]), null);       // muy poco tiempo para saber
  assert.equal(estimate([{ t: 0, p: 0.2 }, { t: 4000, p: 0.2 }]), null);      // no avanza
  assert.equal(estimate([{ t: 0, p: 0 }, { t: 10_000, p: 0.25 }]), 30);
  assert.equal(estimate([{ t: 0, p: 0.5 }, { t: 2000, p: 1 }]), 0);
});

test('una tarea publica su avance, termina o falla, y se puede descartar', async () => {
  const store = Object.assign(new EventEmitter(), {
    state: {},
    register(ns, initial) { this.state[ns] = initial; },
    set(ns, patch) { this.state[ns] = { ...this.state[ns], ...patch }; },
  });
  let clock = 0;
  const jobs = createJobs({ store, now: () => clock });
  const job = jobs.start({ title: 'Convirtiendo', owner: 'medios', ref: 'v1' });
  assert.deepEqual(store.state.jobs.list.map((j) => [j.title, j.state, j.progress]), [['Convirtiendo', 'running', null]]);

  job.update({ progress: 0.1 });
  clock = 5000;
  job.update({ progress: 0.6, detail: 'falta poco' });
  assert.deepEqual([jobs.list()[0].progress, jobs.list()[0].eta, jobs.list()[0].detail], [0.6, 4, 'falta poco']);
  job.update({ progress: 7 });
  assert.equal(jobs.list()[0].progress, 1);

  const failing = jobs.start({ title: 'Descargando' });
  failing.fail('Sin internet');
  failing.update({ progress: 0.5 }); // ya terminó: no cambia nada
  const failed = store.state.jobs.list.find((j) => j.id === failing.id);
  assert.deepEqual([failed.state, failed.error, failed.progress], ['error', 'Sin internet', null]);

  jobs.dismiss(job.id); // sigue en marcha: no se descarta
  assert.equal(jobs.list().length, 2);
  jobs.dismiss(failing.id);
  assert.deepEqual(store.state.jobs.list.map((j) => j.id), [job.id]);

  job.done('Listo');
  assert.deepEqual([jobs.list()[0].state, jobs.list()[0].progress, jobs.list()[0].detail], ['done', 1, 'Listo']);
  jobs.close();
});

test('al pasar a usuarios (fase 35), el PIN único de antes es el del administrador, guardado como huella', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-pin-'));
  fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify({ pin: '0420', list: { abc: { role: 'control', created: 1 } } }));
  const storage = createStorage(dir);
  const sessions = createSessions({ storage, roles: [] });
  storage.flushAll();
  const [admin] = sessions.users.list();
  assert.deepEqual([admin.name, admin.admin], ['Administrador', true]);
  assert.ok(sessions.users.check(admin.id, '0420'), 'entra con el PIN de antes');
  assert.ok(!sessions.users.check(admin.id, '0421'));
  assert.ok(!fs.readFileSync(path.join(dir, 'usuarios.json'), 'utf8').includes('0420'), 'el PIN no se guarda tal cual');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'sesiones.json'), 'utf8'));
  assert.equal(saved.pin, undefined);
  assert.equal(saved.list.abc.user, admin.id, 'las sesiones de antes pasan a ser del administrador');
  // Un PIN de antes que no era de 4 cifras: el administrador recibe uno nuevo.
  fs.rmSync(path.join(dir, 'usuarios.json'));
  fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify({ pin: '123456', list: {} }));
  const again = createSessions({ storage: createStorage(dir), roles: [] });
  assert.ok(!again.users.check(again.users.list()[0].id, '123456'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('la contraseña del administrador de la nube (hasta la 1.48) se olvida y cuenta como clave de alta usada', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-clave-'));
  const pin = { salt: 'a'.repeat(32), hash: 'b'.repeat(64) };
  fs.writeFileSync(path.join(dir, 'usuarios.json'), JSON.stringify({ list: [{ id: 'a1b2c3d4e5f6', name: 'Ana', admin: true, functions: ['control'], pin, password: pin }] }));
  const storage = createStorage(dir);
  const sessions = createSessions({ storage, roles: [], cloud: true });
  storage.flushAll();
  assert.equal(sessions.altaPending(), false);
  assert.ok(!fs.readFileSync(path.join(dir, 'usuarios.json'), 'utf8').includes('password'));
  fs.rmSync(dir, { recursive: true, force: true });
});

// Con los usuarios ya creados, como en un equipo de verdad: en una carpeta vacía, Manna pasaría las sesiones de antes de
// la fase 35 al primer administrador.
const withUsers = (dir) => {
  const storage = createStorage(dir);
  createSessions({ storage, roles: [] });
  storage.flushAll();
};

test('las sesiones guardadas tienen un límite: al pasarlo se van las más viejas (fase 35)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-sesiones-'));
  withUsers(dir);
  const list = Object.fromEntries(Array.from({ length: 505 }, (_, i) => [`s${i}`, { role: 'proyeccion', user: null, created: 1000 + i }]));
  fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify({ list }));
  const storage = createStorage(dir);
  const sessions = createSessions({ storage, roles: [{ id: 'proyeccion', permissions: [] }] });
  sessions.open({ isLocal: false, internet: false, ip: '192.0.2.9', session: null, res: { setHeader() {} } }, { role: 'proyeccion' });
  storage.flushAll();
  const kept = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'sesiones.json'), 'utf8')).list);
  assert.equal(kept.length, 500);
  assert.ok(!kept.includes('s0') && !kept.includes('s5') && kept.includes('s6') && kept.includes('s504'), 'se van las más viejas');
  fs.rmSync(dir, { recursive: true, force: true });
});

// Un dispositivo de la wifi, sin PIN, abría cientos de «Pantalla de proyección» y expulsaba a quien entró con su PIN
// (auditoría integral, S2-4): primero se olvidan las que no tienen usuario.
test('al pasar el límite de sesiones, las que tienen usuario se quedan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-sesiones-'));
  withUsers(dir);
  const list = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`s${i}`, { role: 'proyeccion', user: null, created: 2000 + i }]));
  list.ana = { role: 'alabanza', user: 'u-ana', created: 1 };
  fs.writeFileSync(path.join(dir, 'sesiones.json'), JSON.stringify({ list }));
  const storage = createStorage(dir);
  const sessions = createSessions({ storage, roles: [{ id: 'proyeccion', permissions: [] }] });
  sessions.open({ isLocal: false, internet: false, ip: '192.0.2.9', session: null, res: { setHeader() {} } }, { role: 'proyeccion' });
  storage.flushAll();
  const kept = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'sesiones.json'), 'utf8')).list);
  assert.equal(kept.length, 500);
  assert.ok(kept.includes('ana'), 'la de Ana, la más vieja pero con su PIN, se queda');
  assert.ok(!kept.includes('s0') && !kept.includes('s1'), 'se van las anónimas más viejas');
  fs.rmSync(dir, { recursive: true, force: true });
});

// En Windows, un archivo de la carpeta temporal que otro programa aún tiene abierto (un ffmpeg que no terminó de
// cerrarse) no se deja borrar. Ese error cortaba el apagado y el reinicio, y Manna no volvía (N2-1-3 de la auditoría).
test('si la carpeta temporal no se deja vaciar, Manna se cierra igual y la deja para la próxima vez', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-temporal-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'error', () => {});
  const app = createApp({ rootDir: fileURLToPath(new URL('..', import.meta.url)), dataDir: dir, biblesDir: path.join(dir, 'biblias') });
  app.port = 1; // como si estuviera abierto
  const rm = fs.rmSync;
  t.mock.method(fs, 'rmSync', (where, ...rest) => {
    if (where === app.tmpDir) throw Object.assign(new Error('EBUSY: archivo en uso'), { code: 'EBUSY' });
    return rm(where, ...rest);
  });
  await assert.doesNotReject(app.close());
});

// Cuentas y PIN (fase 52.5 de la auditoría integral). Una persona entra desde un celular de la red, con su PIN.
const pinSetup = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-pin-'));
  const storage = createStorage(dir);
  const roles = ['control', 'alabanza'].map((id) => ({ id, name: id, permissions: [], requiresPin: true }));
  const sessions = createSessions({ storage, roles });
  const enter = (role, user, pin, { internet = false, ip = '192.0.2.5' } = {}) => {
    let cookie = '';
    try {
      sessions.open({ isLocal: false, internet, ip, session: null, res: { setHeader: (k, v) => { cookie = v.split(';')[0]; } } }, { role, user, pin });
    } catch (err) {
      return { error: err.message, status: err.status };
    }
    return { req: { headers: { cookie } } };
  };
  return { dir, sessions, enter };
};

test('quitarle una función a alguien lo saca de ella, y la nube dice a quién le cambió el PIN (N1-3-3)', (t) => {
  const { dir, sessions, enter } = pinSetup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ana = sessions.users.create({ name: 'Ana', pin: '1357', functions: ['alabanza', 'control'] });
  const { req } = enter('alabanza', ana.id, '1357');
  assert.equal(sessions.fromRequest(req)?.role, 'alabanza');
  sessions.users.update(ana.id, { functions: ['control'] });
  assert.equal(sessions.fromRequest(req), null, 'sin la función, su sesión ya no vale: vuelve a escribir su PIN');
  const tmp = sessions.users.create({ name: 'Otro', pin: '2468', functions: ['control'] });
  const list = sessions.users.records().filter((u) => u.id !== tmp.id).map((u) => (u.id === ana.id ? { ...u, pin: sessions.users.records().find((x) => x.id === tmp.id).pin } : u));
  const { gone, repinned } = sessions.users.replace(list);
  assert.deepEqual([gone, repinned], [[tmp.id], [ana.id]], 'quien la llama cierra sus sesiones');
});

test('un PIN equivocado dice cuántos intentos quedan, y el bloqueo de internet no deja fuera a la red de la iglesia (E4-07, S5-10)', (t) => {
  const { dir, sessions, enter } = pinSetup();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ana = sessions.users.create({ name: 'Ana', pin: '1357', functions: ['alabanza'] });
  const tries = [1, 2, 3, 4, 5].map((i) => enter('alabanza', ana.id, '0000', { internet: true, ip: `203.0.113.${i}` }).error);
  assert.deepEqual(tries.slice(0, 2), ['PIN incorrecto.', 'PIN incorrecto.']);
  assert.match(tries[2], /Te quedan 2 intentos/);
  assert.match(tries[4], /quedó bloqueado 15 minutos/);
  assert.match(enter('alabanza', ana.id, '1357', { internet: true, ip: '203.0.113.9' }).error, /bloqueado/, 'desde internet, bloqueado');
  assert.ok(enter('alabanza', ana.id, '1357').req, 'desde el wifi de la iglesia, entra');
  sessions.users.setPin(ana.id, '2468');
  sessions.unlock(ana.id);
  assert.ok(enter('alabanza', ana.id, '2468', { internet: true, ip: '203.0.113.10' }).req, 'el administrador la destraba cambiándole el PIN');
});
