import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Un solo Manna a la vez (fase 21), con dos Manna de verdad, como procesos, con el mismo nombre en la red y
// datos distintos: el segundo se abre igual, dice dónde está el otro, no acepta órdenes salvo «Volver a
// comprobar» y apagarse, y en cuanto el primero se apaga se pone en marcha solo (en el puerto que dejó libre).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-unico-'));
const PORT = 18_800 + (process.pid % 400);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const children = [];
function launch(name) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT, stdio: 'ignore',
    env: {
      ...process.env, PORT: String(PORT), MANNA_NO_OPEN: '1', MANNA_SIN_VENTANA: '1', MANNA_SIN_HTTPS: '1', MANNA_NAME: 'manna-prueba-unico', MANNA_HOST: '127.0.0.1',
      MANNA_DATA: path.join(tmp, name), MANNA_BIBLIAS: path.join(tmp, 'biblias'), MANNA_HIMNARIO: path.join(tmp, 'himnario'), MANNA_FALTA: 'navegador,ffmpeg,yt-dlp,cloudflared',
    },
  });
  children.push(child);
  return child;
}
const at = (port) => `http://127.0.0.1:${port}`;
const ping = (port) => fetch(`${at(port)}/api/ping`, { signal: AbortSignal.timeout(500) }).then((res) => res.json(), () => null);
async function until(check, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(150);
  }
  return null;
}
// Una orden desde este mismo equipo (sin PIN).
async function send(port, type, payload = {}) {
  const login = await fetch(`${at(port)}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const res = await fetch(`${at(port)}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type, payload }) });
  return { http: res.status, ...(await res.json().catch(() => ({}))) };
}

test.after(async () => {
  // La copia que lanza un reinicio ya no es hija de esta prueba: se apaga por su puerto.
  await send(PORT, 'system.shutdown').catch(() => {});
  for (const child of children) child.kill();
  await sleep(300);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
});

test('con otro Manna del mismo nombre abierto, el segundo no funciona, lo dice y arranca cuando el otro se apaga', async () => {
  launch('primero');
  const first = await until(() => ping(PORT));
  assert.ok(first, 'el primero arranca');

  launch('segundo');
  const second = await until(async () => { const p = await ping(PORT + 1); return p?.id !== first.id && p; });
  assert.ok(second, 'el segundo se abre en el puerto siguiente');
  const system = async (port) => (await (await fetch(`${at(port)}/api/state`)).json()).system;
  const blocked = await until(async () => (await system(PORT + 1)).blocked);
  assert.deepEqual(blocked, { here: true, where: `http://localhost:${PORT}`, version: first.version }, 'dice dónde está el otro');
  assert.equal((await system(PORT)).blocked, null, 'el primero sigue como siempre');

  // No acepta órdenes, salvo volver a mirar y apagarse.
  const refused = await send(PORT + 1, 'order.addSection', { title: 'Apertura' });
  assert.equal(refused.http, 409);
  assert.match(refused.error, /otro en la red/);
  assert.equal((await send(PORT + 1, 'system.recheck')).http, 200, '«Volver a comprobar» sí');
  assert.ok((await system(PORT + 1)).blocked, 'con el otro abierto, sigue bloqueado');

  // Se apaga el primero: al volver a mirar, el segundo se pone en marcha solo, en el puerto que quedó libre.
  await send(PORT, 'system.shutdown');
  await until(async () => !(await ping(PORT)));
  await send(PORT + 1, 'system.recheck').catch(() => {});
  const taken = await until(async () => { const p = await ping(PORT); return p?.id === second.id && p; });
  assert.ok(taken, 'el segundo arrancó de nuevo y ocupa el puerto del primero');
  assert.equal((await system(PORT)).blocked, null, 'y ya funciona');
  assert.equal((await send(PORT, 'order.addSection', { title: 'Apertura' })).http, 200);
  await send(PORT, 'system.shutdown');
});
