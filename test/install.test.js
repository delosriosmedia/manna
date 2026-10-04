import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { installTool } from '../server/core/install.js';

// Un servidor en este mismo equipo hace de sitio de descargas: la prueba no usa internet.
const files = new Map();
const server = http.createServer((req, res) => {
  const body = files.get(req.url);
  if (!body) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Length': body.length });
  res.end(body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-instalar-'));
test.after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const program = Buffer.from('#!/bin/sh\necho 2026.01.01\n');
files.set('/programa', program);

test('descarga un ejecutable, comprueba su huella y lo deja listo para ejecutarse', async () => {
  files.set('/SUMAS', Buffer.from(`${'0'.repeat(64)}  otro-archivo\n${sha(program)}  programa\n`));
  const dir = path.join(tmp, 'directo');
  const progress = [];
  const installed = await installTool({ url: `${base}/programa`, sums: `${base}/SUMAS`, file: 'mi-programa' }, { dir, onProgress: (p) => progress.push(p) });
  assert.deepEqual(installed, [path.join(dir, 'mi-programa')]);
  assert.deepEqual(fs.readFileSync(installed[0]), program);
  assert.equal(progress.at(-1), 1);
  if (process.platform !== 'win32') assert.equal(fs.statSync(installed[0]).mode & 0o111, 0o111);
  // No quedan restos de la descarga.
  assert.deepEqual(fs.readdirSync(dir), ['mi-programa']);
});

test('rechaza una descarga cuya huella no coincide y no deja nada instalado', async () => {
  files.set('/huella-mala', Buffer.from('f'.repeat(64)));
  const dir = path.join(tmp, 'danada');
  await assert.rejects(installTool({ url: `${base}/programa`, sha256: `${base}/huella-mala`, file: 'x' }, { dir }), /incompleta o dañada/);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('si la lista de huellas no nombra el archivo, no se instala', async () => {
  files.set('/SUMAS-otras', Buffer.from(`${sha(program)}  otro-nombre\n`));
  const dir = path.join(tmp, 'sin-huella');
  await assert.rejects(installTool({ url: `${base}/programa`, sums: `${base}/SUMAS-otras`, file: 'x' }, { dir }), /huella de verificación/);
});

test('avisa con claridad si la descarga no existe o no hay conexión', async () => {
  const dir = path.join(tmp, 'sin-red');
  await assert.rejects(installTool({ url: `${base}/no-existe`, file: 'x' }, { dir }), /no está disponible/);
  await assert.rejects(installTool({ url: 'http://127.0.0.1:9/x', file: 'x' }, { dir }), /tiene internet/);
});

test('saca de un .zip solo los archivos pedidos, estén en la carpeta que estén', async (t) => {
  const source = path.join(tmp, 'origen', 'ffmpeg-1.0', 'bin');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'ffmpeg.exe'), 'programa uno');
  fs.writeFileSync(path.join(source, 'ffprobe.exe'), 'programa dos');
  fs.writeFileSync(path.join(source, 'LEEME.txt'), 'no se instala');
  const zip = path.join(tmp, 'paquete.zip');
  try {
    execFileSync('tar', ['-a', '-cf', zip, '-C', path.join(tmp, 'origen'), 'ffmpeg-1.0'], { stdio: 'ignore' });
  } catch {
    t.skip('este sistema no tiene un tar que cree archivos .zip');
    return;
  }
  const data = fs.readFileSync(zip);
  files.set('/paquete.zip', data);
  files.set('/paquete.zip.sha256', Buffer.from(sha(data)));
  const dir = path.join(tmp, 'desde-zip');
  const installed = await installTool({ url: `${base}/paquete.zip`, sha256: `${base}/paquete.zip.sha256`, extract: ['ffmpeg.exe', 'ffprobe.exe'] }, { dir });
  assert.deepEqual(installed.map((f) => path.basename(f)), ['ffmpeg.exe', 'ffprobe.exe']);
  assert.equal(fs.readFileSync(path.join(dir, 'ffprobe.exe'), 'utf8'), 'programa dos');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['ffmpeg.exe', 'ffprobe.exe']);

  await assert.rejects(installTool({ url: `${base}/paquete.zip`, extract: ['no-esta.exe'] }, { dir: path.join(tmp, 'falta') }), /no contiene no-esta.exe/);
});
