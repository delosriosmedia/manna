import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import media from '../server/modules/media/index.js';
import { cleanVtt, createProgress, downloadArgs, explain, readLine, subtitleArgs, watchUrl, youtubeId } from '../server/modules/media/youtube.js';
import { writeFakeYtDlp } from '../scripts/lib/yt-dlp-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-youtube-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

test('youtubeId reconoce las formas de un enlace de YouTube y se queda solo con el identificador', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s&list=PL123`, `http://m.youtube.com/watch?feature=share&v=${id}`,
    `https://youtu.be/${id}`, `https://youtu.be/${id}?si=abcdef`, `youtu.be/${id}`, `www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}?feature=share`, `https://www.youtube.com/embed/${id}`,
    `https://music.youtube.com/watch?v=${id}`, `  https://youtu.be/${id}  `,
  ]) assert.equal(youtubeId(link), id, link);
  assert.equal(watchUrl(id), `https://www.youtube.com/watch?v=${id}`);
});

test('youtubeId no acepta nada que no sea un video de YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    '', null, 'hola', 'https://vimeo.com/123456789', `https://youtube.com.evil.example/watch?v=${id}`, `https://evil.example/?u=https://youtu.be/${id}`,
    `https://notyoutube.com/watch?v=${id}`, `https://youtu.be.evil.example/${id}`, `ftp://youtu.be/${id}`, `file:///etc/passwd`,
    'https://www.youtube.com/watch?v=corto', 'https://www.youtube.com/watch?v=demasiado-largo-para-serlo', 'https://www.youtube.com/watch',
    'https://www.youtube.com/playlist?list=PL123', 'https://www.youtube.com/@canal', `https://user:clave@youtu.be/${id}`,
    `https://youtu.be/${id} --exec rm`, `--exec rm -rf / https://youtu.be/${id}`, 'https://youtu.be/$(reboot)1', `https://youtu.be/${'a'.repeat(400)}`,
  ]) assert.equal(youtubeId(link), null, String(link));
});

test('las órdenes de yt-dlp llevan la dirección que escribe Manna, nunca el texto de la persona', () => {
  const args = downloadArgs({ id: 'dQw4w9WgXcQ', dir: '/t/yt', ffmpegDir: '/opt/bin' });
  assert.deepEqual(args.slice(-2), ['--', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'], 'la dirección va al final, tras "--"');
  assert.equal(args[args.indexOf('-o') + 1], path.join('/t/yt', 'video.%(ext)s'));
  assert.deepEqual(args.slice(args.indexOf('--ffmpeg-location'), args.indexOf('--ffmpeg-location') + 2), ['--ffmpeg-location', '/opt/bin']);
  assert.match(args[args.indexOf('-f') + 1], /height<=1080.*avc1.*mp4a/, 'hasta 1080p, con lo que reproduce cualquier navegador');
  for (const flag of ['--ignore-config', '--no-playlist', '--no-simulate', '--newline']) assert.ok(args.includes(flag), flag);
  assert.equal(downloadArgs({ id: 'dQw4w9WgXcQ', dir: '/t' }).includes('--ffmpeg-location'), false);
  const subs = subtitleArgs({ id: 'dQw4w9WgXcQ', dir: '/t/yt' });
  assert.ok(subs.includes('--skip-download') && subs.includes('--write-auto-subs'));
  assert.equal(subs[subs.indexOf('--sub-langs') + 1], 'es,es-orig,en,en-orig');
});

test('readLine y createProgress entienden lo que yt-dlp va diciendo', () => {
  assert.deepEqual(readLine('MANNA\ttitle\tCulto de jóvenes\ten vivo'), { title: 'Culto de jóvenes en vivo' });
  assert.deepEqual(readLine('MANNA\tduration\t222'), { duration: 222 });
  assert.equal(readLine('MANNA\tduration\tNA'), null);
  assert.deepEqual(readLine('MANNA\tprogress\t500\t2000\tNA'), { downloaded: 500, total: 2000 });
  assert.deepEqual(readLine('MANNA\tprogress\t500\tNA\t4000'), { downloaded: 500, total: 4000 }, 'si no sabe el total, vale el estimado');
  assert.equal(readLine('[download] 50% of 10MiB'), null);
  assert.equal(readLine('MANNA\tprogress\tNA\tNA\tNA'), null);
  // Primero la imagen (casi todo) y luego el sonido: el avance no vuelve atrás.
  const progress = createProgress();
  const seen = [[0, 100], [50, 100], [100, 100], [0, 10], [5, 10], [10, 10]].map(([downloaded, total]) => progress({ downloaded, total }));
  assert.deepEqual(seen.map((p) => Math.round(p * 100)), [0, 45, 90, 90, 95, 99]);
});

test('explain dice por qué falló una descarga, con palabras de quien usa Manna', () => {
  assert.match(explain('ERROR: [youtube] abc: Private video. Sign in if you have been granted access'), /privado/);
  assert.match(explain('ERROR: [youtube] abc: Video unavailable'), /no está disponible/);
  assert.match(explain("ERROR: [youtube] abc: Sign in to confirm you're not a bot"), /más tarde/);
  assert.match(explain('ERROR: unable to download webpage: <urlopen error [Errno 8] nodename nor servname provided>'), /internet/);
  assert.match(explain('ERROR: abc does not pass filter (!is_live), skipping ..'), /directo/);
  assert.match(explain('ERROR: algo que nadie esperaba'), /actualiza yt-dlp/);
});

test('cleanVtt deja los subtítulos automáticos de YouTube como los escribiría una persona', () => {
  // Así llegan: cada bloque repite la línea anterior y añade otra con marcas palabra a palabra,
  // y entre uno y otro hay un bloque de una centésima.
  const auto = `WEBVTT
Kind: captions
Language: es

00:00:00.320 --> 00:00:02.790 align:start position:0%
 
texto<00:00:00.560><c> inventado</c><00:00:00.880><c> de</c><00:00:01.040><c> prueba</c>

00:00:02.790 --> 00:00:02.800 align:start position:0%
texto inventado de prueba
 

00:00:02.800 --> 00:00:05.110 align:start position:0%
texto inventado de prueba
para<00:00:03.040><c> ver</c><00:00:03.280><c> la</c><00:00:03.440><c> limpieza</c>

00:00:05.110 --> 00:00:05.120 align:start position:0%
para ver la limpieza
 

00:00:05.120 --> 00:00:07.500 align:start position:0%
para ver la limpieza
y<00:00:05.400><c> nada</c><00:00:05.700><c> más</c>
`;
  assert.equal(cleanVtt(auto), 'WEBVTT\n\n00:00:00.320 --> 00:00:02.790\ntexto inventado de prueba\n\n00:00:02.800 --> 00:00:05.110\npara ver la limpieza\n\n00:00:05.120 --> 00:00:07.500\ny nada más\n');
  // Unos subtítulos escritos por el autor quedan como están (sin sus adornos de posición).
  const manual = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000 line:80%\nPrimera línea\nsegunda línea\n\n2\n00:00:03.500 --> 00:00:05.000\nOtra\n';
  assert.equal(cleanVtt(manual), 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nPrimera línea\nsegunda línea\n\n00:00:03.500 --> 00:00:05.000\nOtra\n');
  assert.equal(cleanVtt('nada'), 'WEBVTT\n\n\n');
});

// ---- La descarga entera, con un yt-dlp de mentira (sin internet) ----

const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;
const needs = HAS_FFMPEG && process.platform !== 'win32' ? {} : { skip: 'hace falta ffmpeg (y un sistema que ejecute guiones) para el yt-dlp de mentira' };

test('un enlace de YouTube se descarga a la biblioteca con su título, su imagen y sus subtítulos, y se proyecta sin internet', needs, async () => {
  const dataDir = path.join(tmp, 'datos');
  // El equipo "no tiene" yt-dlp; el de mentira está donde Manna guarda los que instala.
  const fake = writeFakeYtDlp(path.join(dataDir, 'herramientas'), { title: 'Culto de jóvenes (prueba)', seconds: 3, log: path.join(tmp, 'pedido.json') });
  process.env.MANNA_FALTA = 'yt-dlp';
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias'), mediaDir: path.join(tmp, 'carpeta') });
  for (const setup of [system, projection, order, media]) await setup(app);
  await app.tools.scan();
  delete process.env.MANNA_FALTA;
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
  const login = await request('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
  const send = async (type, payload = {}) => {
    const res = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) });
    return { ...(await res.json()), http: res.status };
  };
  const library = async () => (await (await request('/api/state')).json()).media.youtube;
  const settle = async (id, status) => { for (let i = 0; i < 300; i += 1) { const clip = (await library()).find((c) => c.id === id); if (clip?.status === status) return clip; await sleep(50); } return null; };

  try {
    assert.equal(app.tools.has('yt-dlp'), true, fake);
    assert.equal((await send('media.youtube', { link: 'https://vimeo.com/1234' })).http, 400);
    assert.equal((await send('media.youtube', { link: 'https://youtu.be/dQw4w9WgXcQ --exec reboot' })).http, 400);
    assert.deepEqual(await library(), []);

    const added = await send('media.youtube', { link: 'https://youtu.be/dQw4w9WgXcQ?si=compartido' });
    assert.equal(added.http, 200);
    const { id } = added.result;
    let [clip] = await library();
    assert.deepEqual([clip.kind, clip.status, clip.usable, clip.source], ['youtube', 'downloading', false, 'youtube']);
    assert.equal((await send('projection.show', { kind: 'youtube', data: { id } })).http, 409, 'mientras baja no se puede proyectar');
    // El mismo video, pegado otra vez con otra forma del enlace, no se baja dos veces.
    assert.deepEqual((await send('media.youtube', { link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10' })).result, { id, already: true });

    clip = await settle(id, 'ready');
    assert.ok(clip, 'termina de bajar');
    assert.deepEqual([clip.name, Math.round(clip.duration), clip.subtitles, clip.url], ['Culto de jóvenes (prueba)', 3, true, `/media/youtube/${id}.mp4`]);
    assert.match(clip.poster, /miniaturas/);
    // Lo que se le pidió a yt-dlp: la dirección la escribió Manna.
    const asked = JSON.parse(fs.readFileSync(path.join(tmp, 'pedido.json'), 'utf8'));
    assert.equal(asked.at(-1), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(asked.includes('--exec'), false);
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'tmp')).filter((f) => f.startsWith('youtube-')), [], 'la carpeta de paso se borra');

    // Al orden y al aire, con subtítulos en dos idiomas.
    const inOrder = await send('order.add', { kind: 'youtube', data: { id } });
    assert.deepEqual([inOrder.result.kind, inOrder.result.title, inOrder.result.subtitle], ['youtube', 'Culto de jóvenes (prueba)', 'YouTube · 0:03']);
    const shown = await send('projection.show', { kind: 'youtube', data: { id } });
    assert.equal(shown.http, 200);
    assert.deepEqual(shown.result.subtitles.map((t) => [t.lang, t.label]), [['es', 'Español'], ['en', 'Inglés']]);
    assert.equal(await (await request(shown.result.subtitles[0].url)).text(), 'WEBVTT\n\n00:00:00.320 --> 00:00:01.500\ntexto de prueba\n\n00:00:01.510 --> 00:00:02.900\nen español\n', 'limpios');
    await send('projection.control', { subtitles: 'en' });
    assert.equal((await (await request('/api/state')).json()).live.state.subtitles, 'en');
    await send('projection.clear');

    // Un nombre puesto a mano se respeta; eliminar borra todo lo suyo.
    await send('media.rename', { id, name: 'Especial de jóvenes' });
    assert.equal((await library())[0].name, 'Especial de jóvenes');
    assert.equal((await send('media.remove', { id })).http, 200);
    assert.deepEqual(await library(), []);
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'media', 'youtube')), []);
    assert.deepEqual(fs.readdirSync(path.join(dataDir, 'media', 'subtitulos')), []);

    // Un video que YouTube no deja bajar: se dice por qué, y se puede reintentar.
    const gone = await send('media.youtube', { link: 'https://youtu.be/privado0000' });
    const failed = await settle(gone.result.id, 'error');
    assert.match(failed.error, /privado o se quitó/);
    assert.equal(failed.usable, false);
    assert.equal((await send('media.retry', { id: gone.result.id })).http, 200);
    assert.equal((await library())[0].status, 'downloading');
    assert.ok(await settle(gone.result.id, 'error'));
    assert.equal((await send('media.remove', { id: gone.result.id })).http, 200);
  } finally {
    await app.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
