import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Manna de verdad, como proceso, en una copia del programa: para probar lo que solo pasa entre
// arranques. En concreto, lo que rompió la subida de imágenes en la 1.5: el programa se actualizó
// con Manna abierto, y la interfaz nueva habló con un servidor viejo que no conocía sus órdenes.
//
//   1. El servidor nota que su código cambió en disco y lo avisa (system.stale).
//   2. Al pulsar el icono otra vez, la copia nueva cierra a la vieja y ocupa su sitio.
//   3. "Reiniciar Manna" cierra y vuelve a abrir solo.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-arranque-'));
const copy = path.join(tmp, 'programa');
const PORT = 18_200 + (process.pid % 500);
const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// El resultado de una promesa, o 'sin respuesta' si tarda más de lo dado (sin dejar el reloj corriendo).
const within = (promise, ms = 15_000) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve('sin respuesta'), ms);
  promise.then((value) => { clearTimeout(timer); resolve(value); });
});

fs.cpSync(path.join(ROOT, 'server'), path.join(copy, 'server'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(copy, 'package.json'));
fs.mkdirSync(path.join(copy, 'web'));

const children = [];
function launch() {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: copy, stdio: 'ignore',
    env: {
      ...process.env, PORT: String(PORT), MANNA_NO_OPEN: '1', MANNA_SIN_HTTPS: '1', MANNA_NAME: 'manna-prueba-arranque', MANNA_HOST: '127.0.0.1',
      MANNA_DATA: path.join(tmp, 'datos'), MANNA_BIBLIAS: path.join(tmp, 'biblias'), MANNA_REVISAR_CODIGO_MS: '150', MANNA_FALTA: 'navegador,ffmpeg,yt-dlp',
    },
  });
  child.exited = new Promise((resolve) => { child.on('exit', resolve); });
  children.push(child);
  return child;
}
const ping = () => fetch(`${base}/api/ping`, { signal: AbortSignal.timeout(500) }).then((res) => res.json(), () => null);
const system = async () => (await (await fetch(`${base}/api/state`)).json()).system;
async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(100);
  }
  return null;
}
async function control(type) {
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  return fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type, payload: {} }) });
}

test.after(async () => {
  // Lo que quede abierto (también la copia que lanza el propio reinicio) se cierra por su puerto.
  if (await ping()) await control('system.shutdown').catch(() => {});
  for (const child of children) child.kill();
  await sleep(300);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

test('Manna nota que se actualizó estando abierto, y al pulsar el icono la copia nueva releva a la vieja', async () => {
  const old = launch();
  const first = await until(ping);
  assert.ok(first, 'la primera copia arranca');
  assert.match(first.build, /^[0-9a-f]{12}$/);
  assert.deepEqual([(await system()).build, (await system()).stale], [first.build, false]);

  // Pulsar el icono con el mismo código: no se abre otra copia; la segunda se retira sola.
  const twin = launch();
  assert.equal(await within(twin.exited), 0);
  assert.equal((await ping()).build, first.build);
  assert.equal(old.exitCode, null, 'la que estaba sigue abierta');

  // Llega una actualización: cambia un archivo del servidor.
  fs.appendFileSync(path.join(copy, 'server', 'roles.js'), '\n// versión nueva\n');
  assert.ok(await until(async () => (await system()).stale), 'el servidor avisa de que hay que reiniciarlo');
  assert.equal((await ping()).build, first.build, 'sigue siendo el de antes hasta que se reinicie');

  // Pulsar el icono ahora: la copia nueva cierra a la vieja y ocupa su sitio.
  const fresh = launch();
  assert.equal(await within(old.exited), 0, 'la copia vieja se cierra');
  const second = await until(async () => { const p = await ping(); return p && p.build !== first.build ? p : null; });
  assert.ok(second, 'la copia nueva responde en el mismo puerto');
  assert.deepEqual([(await system()).build, (await system()).stale], [second.build, false]);
  assert.equal(fresh.exitCode, null);

  // "Reiniciar Manna": se cierra y vuelve a abrirse sola, con los mismos datos.
  const id = second.id;
  assert.equal((await control('system.restart')).status, 200);
  assert.equal(await within(fresh.exited), 0, 'la copia se cierra para reiniciarse');
  const third = await until(ping);
  assert.ok(third, 'vuelve a abrirse sola');
  assert.deepEqual([third.id, third.build], [id, second.build]);
});
