import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { parseRange } from '../server/core/router.js';
import { applyClock, createClock, freezeClock, hasEnded, positionAt } from '../server/core/playback.js';
import { createJobs, estimate } from '../server/core/jobs.js';

// ---- Trozos de archivo (Range) ----

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
