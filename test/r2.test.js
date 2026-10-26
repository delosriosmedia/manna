import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bucketFromEnv, mirror, presignedUrl, sha256, signedHeaders } from '../server/core/r2.js';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import users from '../server/modules/users/index.js';
import hymns from '../server/modules/hymns/index.js';
import { startFakeR2 } from '../scripts/lib/r2-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-r2-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

// Los ejemplos oficiales de AWS para la firma SigV4 de S3 (documentación de Amazon S3, «Authenticating Requests»).
const AWS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  host: 'examplebucket.s3.amazonaws.com',
  date: new Date('2013-05-24T00:00:00Z'),
};
const signatureOf = (headers) => headers.authorization.match(/Signature=([0-9a-f]+)/)[1];

test('R2: un enlace que caduca se firma como en el ejemplo de AWS', () => {
  const url = presignedUrl({ ...AWS, path: '/test.txt', expires: 86400 });
  assert.equal(new URL(url).searchParams.get('X-Amz-Signature'), 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
  assert.ok(url.startsWith('https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature='));
});

test('R2: pedir un objeto, subirlo y listar se firman como en los ejemplos de AWS', () => {
  const empty = sha256('');
  const get = signedHeaders({ ...AWS, method: 'GET', path: '/test.txt', headers: { range: 'bytes=0-9' }, payloadHash: empty });
  assert.equal(signatureOf(get), 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  assert.equal(get.authorization.split(',')[1], 'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date');
  const body = 'Welcome to Amazon S3.';
  const put = signedHeaders({ ...AWS, method: 'PUT', path: '/test$file.text', payloadHash: sha256(body),
    headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' } });
  assert.equal(signatureOf(put), '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
  const list = signedHeaders({ ...AWS, method: 'GET', path: '/', query: { 'max-keys': 2, prefix: 'J' }, payloadHash: empty });
  assert.equal(signatureOf(list), '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
});

test('R2: las rutas con espacios y tildes se codifican como pide S3', () => {
  const url = presignedUrl({ ...AWS, path: '/Himnario/videos/001 - Canción (prueba)!.mp4' });
  assert.ok(url.startsWith('https://examplebucket.s3.amazonaws.com/Himnario/videos/001%20-%20Canci%C3%B3n%20%28prueba%29%21.mp4?'), url);
});

// Un depósito de mentira con lo que tendría el de verdad (textos inventados).
async function fakeBucket() {
  const dir = path.join(tmp, 'deposito');
  const put = (rel, data) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), data); };
  put('Biblias/Versión de prueba.xmm', '<bible><b n="Juan"><c n="3"><v n="16">Texto inventado de prueba.</v></c></b></bible>');
  put('Himnario/videos/001 Canción de prueba.mp4', Buffer.alloc(2048, 7));
  put('Himnario/diapositivas/001 Canción de prueba/1.jpg', Buffer.alloc(64, 1));
  put('Himnario/letras/Letras.md', '# 1. Canción de prueba\n\nUn renglón inventado.\n');
  put('LEEME.txt', 'Nota');
  return startFakeR2(dir);
}

test('R2: listar, subir y pedir; la nube copia las biblias y las letras, y de los videos solo el nombre', async () => {
  const fake = await fakeBucket();
  try {
    const bucket = bucketFromEnv(fake.env);
    assert.equal(bucketFromEnv({ R2_BUCKET: 'x' }), null, 'sin todas sus claves, no hay depósito');
    assert.equal((await bucket.list()).length, 5);
    await bucket.put('Biblias/Otra.xmm', Buffer.from('<bible/>'));
    assert.equal((await bucket.get('Biblias/Otra.xmm')).toString(), '<bible/>');
    assert.ok(fake.requests.every((r) => r.signed), 'toda petición va firmada');
    const out = path.join(tmp, 'copia');
    assert.equal(await mirror(bucket, out), 5, 'las dos biblias, las letras, el video y la diapositiva');
    assert.equal(fs.readFileSync(path.join(out, 'Biblias', 'Versión de prueba.xmm'), 'utf8').includes('Texto inventado'), true);
    assert.equal(fs.statSync(path.join(out, 'Himnario', 'videos', '001 Canción de prueba.mp4')).size, 0, 'del video, solo el nombre');
    assert.ok(fs.existsSync(path.join(out, 'Himnario', 'diapositivas', '001 Canción de prueba', '1.jpg')));
    assert.ok(!fs.existsSync(path.join(out, 'LEEME.txt')), 'lo que no es del himnario ni de las biblias, no');
    assert.equal(await mirror(bucket, out), 0, 'la segunda vez no baja nada');
  } finally {
    await fake.stop();
  }
});

test('R2: en la nube, el video de un himno se pide con un enlace que caduca, solo con ingreso', async () => {
  const fake = await fakeBucket();
  Object.assign(process.env, { MANNA_NUBE: '1', MANNA_CLAVE_ALTA: 'clave-de-alta-r2', ...fake.env });
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, 'nube'), biblesDir: path.join(tmp, 'nube-biblias') });
  for (const key of ['MANNA_NUBE', 'MANNA_CLAVE_ALTA', ...Object.keys(fake.env)]) delete process.env[key];
  const server = http.createServer(app.handle);
  try {
    assert.ok(app.r2, 'con las claves en el entorno, la nube tiene su depósito');
    await mirror(app.r2, path.join(app.dataDir, 'contenido'));
    app.setContent(path.join(app.dataDir, 'contenido'));
    for (const setup of [system, users, hymns]) await setup(app);
    app.services.hymns.reload();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const video = `/himnos/${encodeURIComponent('001 Canción de prueba.mp4')}`;
    assert.equal((await fetch(base + video, { redirect: 'manual' })).status, 401, 'sin ingreso, nada');
    const post = (url, body, cookie = '') => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
    const admin = await post('/api/session/alta', { clave: 'clave-de-alta-r2', name: 'Ana', pin: '1234' });
    const user = (await admin.json()).user.id;
    const cookie = (await post('/api/session', { role: 'preparacion', user, pin: '1234' }, admin.headers.get('set-cookie').split(';')[0])).headers.get('set-cookie').split(';')[0];
    const list = await (await fetch(`${base}/api/hymns`, { headers: { cookie } })).json();
    assert.deepEqual(list.hymns.map((h) => [h.number, h.title]), [[1, 'Canción de prueba']], 'el himnario se arma con los nombres de R2');
    const res = await fetch(base + video, { redirect: 'manual', headers: { cookie } });
    assert.equal(res.status, 302);
    const link = res.headers.get('location');
    assert.ok(link.startsWith(`${fake.endpoint}/manna-prueba/Himnario/videos/001%20Canci%C3%B3n%20de%20prueba.mp4?`) && link.includes('X-Amz-Expires=3600&'), link);
    assert.equal((await (await fetch(link)).arrayBuffer()).byteLength, 2048, 'y el enlace trae el video');
    const slide = await fetch(`${base}/himnos-letras/${encodeURIComponent('001 Canción de prueba')}/1.jpg`, { redirect: 'manual', headers: { cookie } });
    assert.equal(slide.status, 302, 'las diapositivas, igual');
  } finally {
    await app.close();
    server.close();
    await fake.stop();
  }
});
