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

// Videos y audios de Medios contra el servidor de verdad. La mitad de estas pruebas necesita
// ffmpeg para fabricar archivos de ejemplo y convertirlos: en un equipo sin él se saltan (y se
// prueba, a cambio, cómo se comporta Manna sin ffmpeg, que siempre se puede simular).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-clips-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const needs = HAS_FFMPEG ? {} : { skip: 'este equipo no tiene ffmpeg' };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Archivos de ejemplo hechos en el momento: un patrón de colores con un tono, de un par de segundos.
function make(name, args) {
  const file = path.join(tmp, name);
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, file]);
  assert.equal(result.status, 0, String(result.stderr));
  return file;
}
const PICTURE = ['-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15:duration=2'];
const TONE = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'];

async function start(name, env = {}) {
  Object.assign(process.env, env);
  const dataDir = path.join(tmp, name);
  const mediaDir = path.join(tmp, `${name}-carpeta`);
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias'), mediaDir });
  for (const setup of [system, projection, order, media]) await setup(app);
  await app.tools.scan();
  for (const key of Object.keys(env)) delete process.env[key];
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
  const login = await request('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
  // `http` es el código de la respuesta; `status`, si viene, es el estado del video o audio.
  const json = async (res) => ({ ...(await res.json()), http: res.status });
  return {
    app, dataDir, mediaDir, request,
    send: async (type, payload = {}) => json(await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) })),
    put: async (url, body, type = 'application/octet-stream') => json(await request(url, { method: 'POST', headers: { 'Content-Type': type }, body })),
    state: async () => (await request('/api/state')).json(),
    // Espera a que un video o audio quede en un estado.
    async settle(id, status = 'ready', ms = 30_000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const s = await (await request('/api/state')).json();
        const clip = [...s.media.videos, ...s.media.audios].find((c) => c.id === id);
        if (clip?.status === status) return clip;
        await sleep(100);
      }
      return null;
    },
    async stop() {
      await app.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test('un video habitual se usa tal cual: se sube, se le saca imagen, se proyecta y se gobierna', needs, async () => {
  const mp4 = make('habitual.mp4', [...PICTURE, ...TONE, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
  const s = await start('habitual');
  try {
    assert.equal((await s.put('/api/media/clips?name=x&ext=.exe', Buffer.from('MZ'))).http, 415);
    assert.equal((await s.put('/api/media/clips?name=x&ext=../a', Buffer.from('x'))).http, 415);
    // Tiene nombre de video, pero dentro no hay nada que reproducir.
    assert.equal((await s.put('/api/media/clips?name=x&ext=.mp4', Buffer.from('esto no es un video'.repeat(50)))).http, 415);
    assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'media', 'videos')), [], 'lo rechazado no deja archivo');

    const up = await s.put(`/api/media/clips?name=${encodeURIComponent('  Video de   bienvenida ')}&ext=.mp4&duration=99`, fs.readFileSync(mp4));
    assert.equal(up.http, 200);
    assert.deepEqual([up.kind, up.name, up.status, up.source, up.converted, up.width, up.height], ['video', 'Video de bienvenida', 'ready', 'upload', false, 320, 180]);
    assert.ok(Math.abs(up.duration - 2) < 0.2, `dura lo que dice el archivo (${up.duration}), no lo que dijo quien lo subió`);
    assert.equal(up.url, `/media/videos/${up.id}.mp4`);
    assert.match(up.poster, /^\/media\/miniaturas\/.+\.jpg\?v=\d+$/);
    assert.equal((await s.request(up.poster)).headers.get('content-type'), 'image/jpeg');
    // Un trozo del video, como lo pide el navegador al saltar.
    const part = await s.request(up.url, { headers: { Range: 'bytes=0-99' } });
    assert.deepEqual([part.status, part.headers.get('content-type'), (await part.arrayBuffer()).byteLength], [206, 'video/mp4', 100]);

    // Al orden del culto y al aire: empieza a reproducirse.
    const added = await s.send('order.add', { kind: 'video', data: { id: up.id } });
    assert.deepEqual([added.result.kind, added.result.title, added.result.subtitle, added.result.steps], ['video', 'Video de bienvenida', 'Video · 0:02', 1]);
    assert.equal((await s.send('projection.show', { kind: 'video', data: { id: up.id } })).http, 200);
    let now = await s.state();
    assert.deepEqual([now.projection.item.kind, now.projection.item.url, now.projection.item.unavailable], ['video', up.url, undefined]);
    assert.equal(now.live.state.clock.playing, true);
    assert.equal(now.live.state.subtitles, false);

    // Pausa, salto, reinicio; lo que no vale se rechaza.
    assert.equal((await s.send('projection.control', { playing: false, position: 1.5 })).http, 200);
    now = await s.state();
    assert.deepEqual([now.live.state.clock.playing, now.live.state.clock.position], [false, 1.5]);
    assert.equal((await s.send('projection.control', { position: 500 })).http, 200);
    assert.ok(Math.abs((await s.state()).live.state.clock.position - up.duration) < 0.01, 'no pasa del final');
    assert.equal((await s.send('projection.control', { position: -3 })).http, 400);
    assert.equal((await s.send('projection.control', { restart: true, playing: true })).http, 200);
    now = await s.state();
    assert.deepEqual([now.live.state.clock.playing, now.live.state.clock.position], [true, 0]);
    // Ya se sabe cuánto dura: lo que diga una pantalla no lo cambia.
    await s.send('projection.control', { duration: 777 });
    assert.ok(Math.abs((await s.state()).live.state.clock.duration - up.duration) < 0.01);

    // Subtítulos: un .srt se convierte; algo que no lo es, se rechaza.
    assert.equal((await s.put(`/api/media/clips/${up.id}/subtitles`, 'no son subtítulos', 'text/plain')).http, 415);
    const withCaptions = await s.put(`/api/media/clips/${up.id}/subtitles`, '1\n00:00:00,500 --> 00:00:01,500\nBienvenidos\n', 'text/plain');
    assert.equal(withCaptions.subtitles, true);
    const item = (await s.send('projection.show', { kind: 'video', data: { id: up.id } })).result;
    assert.match(item.subtitles, /^\/media\/subtitulos\/.+\.vtt\?v=\d+$/);
    assert.equal(await (await s.request(item.subtitles)).text(), 'WEBVTT\n\n00:00:00.500 --> 00:00:01.500\nBienvenidos\n');
    assert.equal((await s.send('projection.control', { subtitles: true })).http, 200);
    assert.equal((await s.state()).live.state.subtitles, true);
    assert.equal((await s.send('media.subtitlesRemove', { id: up.id })).http, 200);
    assert.equal((await s.state()).media.videos[0].subtitles, false);

    assert.equal((await s.send('media.rename', { id: up.id, name: 'Bienvenida' })).http, 200);
    assert.equal((await s.state()).media.videos[0].name, 'Bienvenida');

    // Eliminar borra el archivo y lo que Manna hizo con él.
    assert.equal((await s.send('media.remove', { id: up.id })).http, 200);
    assert.deepEqual((await s.state()).media.videos, []);
    assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'media', 'videos')), []);
    assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'media', 'miniaturas')), []);
    assert.equal((await s.send('order.show', { id: added.result.id })).http, 404);
  } finally {
    await s.stop();
  }
});

test('lo que el navegador no reproduce se convierte en segundo plano, con su avance, y queda listo', needs, async () => {
  // Un AVI con MPEG-4 y MP3 (conversión completa), un MKV con H.264 (solo cambia el envoltorio) y un audio WMA.
  const avi = make('antiguo.avi', [...PICTURE, ...TONE, '-c:v', 'mpeg4', '-c:a', 'libmp3lame', '-shortest']);
  const mkv = make('envoltorio.mkv', [...PICTURE, ...TONE, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
  const wma = make('pista.wma', [...TONE, '-c:a', 'wmav2']);
  const mp3 = make('pista.mp3', [...TONE, '-c:a', 'libmp3lame']);
  const s = await start('conversion');
  try {
    const old = await s.put('/api/media/clips?name=Antiguo&ext=.avi', fs.readFileSync(avi));
    assert.deepEqual([old.status, old.url, old.converted], ['converting', null, false]);
    // Mientras se convierte: se puede añadir al orden, pero no poner en pantalla.
    assert.equal((await s.send('order.add', { kind: 'video', data: { id: old.id } })).http, 200);
    const early = await s.send('projection.show', { kind: 'video', data: { id: old.id } });
    assert.deepEqual([early.http, /aún se está convirtiendo/.test(early.error)], [409, true]);
    assert.ok((await s.state()).jobs.list.some((j) => j.owner === 'media' && j.ref === old.id), 'la tarea está a la vista');

    const done = await s.settle(old.id);
    assert.ok(done, 'termina de convertirse');
    assert.deepEqual([done.url, done.converted], [`/media/convertidos/${old.id}.mp4`, true]);
    assert.match(done.poster, /miniaturas/);
    const check = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,pix_fmt', '-of', 'csv=p=0', path.join(s.dataDir, 'media', 'convertidos', `${old.id}.mp4`)]);
    assert.match(String(check.stdout), /h264,yuv420p/);
    assert.match(String(check.stdout), /aac/);
    assert.ok(fs.existsSync(path.join(s.dataDir, 'media', 'videos', `${old.id}.avi`)), 'el original no se toca');
    assert.equal((await s.send('projection.show', { kind: 'video', data: { id: old.id } })).http, 200);

    const wrapped = await s.put('/api/media/clips?name=Envoltorio&ext=.mkv', fs.readFileSync(mkv));
    assert.equal(wrapped.status, 'converting');
    assert.ok(await s.settle(wrapped.id));

    const sound = await s.put('/api/media/clips?name=Pista&ext=.wma', fs.readFileSync(wma));
    assert.deepEqual([sound.kind, sound.status], ['audio', 'converting']);
    const ready = await s.settle(sound.id);
    assert.equal(ready.url, `/media/convertidos/${sound.id}.m4a`);
    const direct = await s.put('/api/media/clips?name=Otra&ext=.mp3', fs.readFileSync(mp3));
    assert.deepEqual([direct.kind, direct.status, direct.url, direct.poster], ['audio', 'ready', `/media/audios/${direct.id}.mp3`, null]);
    assert.equal((await s.put('/api/media/clips?name=x&ext=.mp3', fs.readFileSync(avi).subarray(0, 10))).http, 415);
    assert.deepEqual((await s.state()).media.audios.map((a) => a.name), ['Otra', 'Pista'], 'los más recientes, primero');

    assert.equal((await s.send('projection.show', { kind: 'audio', data: { id: direct.id } })).http, 200);
    assert.equal((await s.state()).projection.item.kind, 'audio');
    assert.equal((await s.put(`/api/media/clips/${direct.id}/subtitles`, '1\n00:00:00,5 --> 00:00:01,5\nx', 'text/plain')).http, 400, 'los subtítulos son de los videos');

    // Eliminar algo mientras espera su turno no deja restos.
    const first = await s.put('/api/media/clips?name=Uno&ext=.avi', fs.readFileSync(avi));
    const second = await s.put('/api/media/clips?name=Dos&ext=.avi', fs.readFileSync(avi));
    assert.equal((await s.send('media.remove', { id: second.id })).http, 200);
    assert.ok(await s.settle(first.id));
    await sleep(300);
    assert.equal(fs.readdirSync(path.join(s.dataDir, 'media', 'convertidos')).some((f) => f.startsWith(second.id)), false);
  } finally {
    await s.stop();
  }
});

test('lo copiado a la carpeta Contenido/Medios aparece solo, con sus subtítulos, y no se borra desde la app', needs, async () => {
  const mp4 = make('carpeta.mp4', [...PICTURE, '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
  const s = await start('carpeta');
  try {
    fs.copyFileSync(mp4, path.join(s.mediaDir, 'Testimonio_de_la_semana.mp4'));
    fs.writeFileSync(path.join(s.mediaDir, 'Testimonio_de_la_semana.srt'), '1\n00:00:00,000 --> 00:00:01,000\nHola\n');
    fs.writeFileSync(path.join(s.mediaDir, 'notas.txt'), 'esto no es un medio');
    await s.app.services.media.rescan();
    const [clip] = (await s.state()).media.videos;
    assert.deepEqual([clip.name, clip.source, clip.status, clip.subtitles, clip.url], ['Testimonio de la semana', 'folder', 'ready', true, '/medios/Testimonio_de_la_semana.mp4']);
    assert.equal((await s.request(clip.url)).status, 200);
    assert.equal((await s.request('/medios/notas.txt')).status, 200); // la carpeta se sirve entera a la red local, como las demás de contenido
    assert.equal((await s.request('/medios/..%2F..%2Fpackage.json')).status, 404);
    const kept = await s.send('media.remove', { id: clip.id });
    assert.deepEqual([kept.http, /bórralo de esa carpeta/.test(kept.error)], [409, true]);
    assert.ok(fs.existsSync(path.join(s.mediaDir, 'Testimonio_de_la_semana.mp4')));
    // El nombre que se le ponga en Manna se conserva al volver a mirar la carpeta.
    await s.send('media.rename', { id: clip.id, name: 'Testimonio' });
    await s.app.services.media.rescan();
    assert.equal((await s.state()).media.videos[0].name, 'Testimonio');
    // Al borrarlo de la carpeta, desaparece de la biblioteca con lo que Manna hizo de él.
    fs.rmSync(path.join(s.mediaDir, 'Testimonio_de_la_semana.mp4'));
    await s.app.services.media.rescan();
    assert.deepEqual((await s.state()).media.videos, []);
    assert.deepEqual(fs.readdirSync(path.join(s.dataDir, 'media', 'subtitulos')), []);
  } finally {
    await s.stop();
  }
});

test('sin ffmpeg: lo habitual funciona, lo demás espera, y la duración la dice quien lo sube o quien lo reproduce', async () => {
  const s = await start('sin-ffmpeg', { MANNA_FALTA: 'ffmpeg' });
  try {
    assert.equal(s.app.tools.has('ffmpeg'), false);
    // No se puede mirar dentro: se confía en la extensión y en lo que dice el navegador que lo sube.
    const mp4 = await s.put('/api/media/clips?name=Saludo&ext=.mp4&duration=12.5', Buffer.alloc(2000, 1));
    assert.deepEqual([mp4.status, mp4.duration, mp4.poster, mp4.url], ['ready', 12.5, null, `/media/videos/${mp4.id}.mp4`]);
    // La imagen la manda quien lo subió (aquí, la cabecera mínima de un JPG).
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 8, 0, 90, 0, 160, 3]), Buffer.alloc(30)]);
    assert.match((await s.put(`/api/media/clips/${mp4.id}/thumb`, jpeg, 'image/jpeg')).poster, /miniaturas/);
    assert.equal((await s.put(`/api/media/clips/${mp4.id}/thumb`, Buffer.from('no es una imagen, de verdad que no'), 'image/jpeg')).http, 200, 'ya tiene imagen: no se cambia');

    const avi = await s.put('/api/media/clips?name=Antiguo&ext=.avi', Buffer.alloc(2000, 1));
    assert.deepEqual([avi.status, /hace falta ffmpeg/.test(avi.error), avi.url], ['needs-ffmpeg', true, null]);
    const blocked = await s.send('projection.show', { kind: 'video', data: { id: avi.id } });
    assert.deepEqual([blocked.http, /ffmpeg/.test(blocked.error)], [409, true]);
    assert.equal((await s.send('media.retry', { id: avi.id })).http, 200);
    assert.equal((await s.state()).media.videos.find((v) => v.id === avi.id).status, 'needs-ffmpeg');

    // Sin duración conocida: vale la primera que diga una pantalla que lo reproduce.
    const unknown = await s.put('/api/media/clips?name=Pista&ext=.mp3', Buffer.alloc(500, 1));
    assert.equal(unknown.duration, null);
    await s.send('projection.show', { kind: 'audio', data: { id: unknown.id } });
    assert.equal((await s.state()).live.state.clock.duration, null);
    await s.send('projection.control', { duration: 183.25 });
    await s.send('projection.control', { duration: 5 });
    const after = await s.state();
    assert.equal(after.live.state.clock.duration, 183.25);
    assert.equal(after.media.audios[0].duration, 183.25, 'y queda guardada');
    assert.equal((await s.send('projection.control', { duration: -4 })).http, 200);
  } finally {
    await s.stop();
  }
});

test('una sola pantalla suena: la primera de proyección abierta en el equipo principal', async () => {
  const s = await start('sonido');
  const open = async (role) => {
    const controller = new AbortController();
    const res = await s.request(`/api/events?rol=${role}`, { signal: controller.signal });
    // Lo primero que dice el servidor a cada conexión es quién es.
    const reader = res.body.getReader();
    let text = '';
    while (!/event: hello\ndata: (.+)\n/.test(text)) text += new TextDecoder().decode((await reader.read()).value);
    return { id: JSON.parse(/event: hello\ndata: (.+)\n/.exec(text)[1]).id, close: () => controller.abort() };
  };
  const sound = async () => { await sleep(60); return (await s.state()).conexiones.sonido; };
  try {
    assert.equal((await s.state()).conexiones.sonido ?? null, null);
    const control = await open('control');
    assert.equal(await sound(), null, 'un control no suena');
    const first = await open('proyeccion');
    assert.equal(await sound(), first.id);
    const second = await open('proyeccion');
    assert.notEqual(second.id, first.id);
    assert.equal(await sound(), first.id, 'la segunda pantalla va en silencio');
    first.close();
    assert.equal(await sound(), second.id, 'si la primera se cierra, suena la siguiente');
    second.close();
    assert.equal(await sound(), null);
    control.close();
  } finally {
    await s.stop();
  }
});
