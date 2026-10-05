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
import { createConverter } from '../server/modules/media/convert.js';
import { planFor, readProbe } from '../server/modules/media/clips.js';

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
    assert.deepEqual(item.subtitles.map((t) => [t.lang, t.label]), [['sub', 'Subtítulos']]);
    assert.match(item.subtitles[0].url, /^\/media\/subtitulos\/.+\.vtt\?v=\d+$/);
    assert.equal(await (await s.request(item.subtitles[0].url)).text(), 'WEBVTT\n\n00:00:00.500 --> 00:00:01.500\nBienvenidos\n');
    // "Mostrar subtítulos" sin decir cuáles pone los primeros; pedir unos que no tiene, ninguno.
    assert.equal((await s.send('projection.control', { subtitles: true })).http, 200);
    assert.equal((await s.state()).live.state.subtitles, 'sub');
    await s.send('projection.control', { subtitles: 'fr' });
    assert.equal((await s.state()).live.state.subtitles, false);
    await s.send('projection.control', { subtitles: 'sub', position: 1 });
    assert.equal((await s.state()).live.state.subtitles, 'sub', 'otra orden no los quita');
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

test('un video que hay que convertir se puede usar al instante si el equipo principal lo reproduce tal cual', needs, async () => {
  const mkv = make('instante.mkv', [...PICTURE, ...TONE, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
  const strange = make('sonido-raro.mkv', [...PICTURE, ...TONE, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'ac3', '-shortest']);
  // Las conversiones tardan en empezar, para poder mirar lo que pasa mientras tanto.
  const s = await start('instante', { MANNA_CONVERSION_LENTA: '700' });
  const says = (id, ok, by) => s.put(`/api/media/clips/${id}/original`, JSON.stringify({ ok, by }), 'application/json');
  const clipNow = async (id) => (await s.state()).media.videos.find((v) => v.id === id);
  try {
    const up = await s.put('/api/media/clips?name=Instante&ext=.mkv', fs.readFileSync(mkv));
    assert.deepEqual([up.status, up.usable, up.url, up.original], ['converting', false, null, { url: `/media/videos/${up.id}.mkv`, playable: null, by: null }]);
    assert.match(up.poster, /miniaturas/, 'la imagen se saca del original, sin esperar a la conversión');
    assert.equal((await s.send('projection.show', { kind: 'video', data: { id: up.id } })).http, 409, 'aún no se sabe si este equipo puede con él');

    // El control del equipo principal lo comprueba y dice que sí: ya se puede proyectar.
    const told = await says(up.id, true, 'control');
    assert.deepEqual([told.status, told.usable, told.original.playable, told.original.by], ['converting', true, true, 'control']);
    const shown = await s.send('projection.show', { kind: 'video', data: { id: up.id } });
    assert.equal(shown.http, 200);
    assert.deepEqual([shown.result.local, shown.result.url, /cuando termine de prepararse/.test(shown.result.waiting)], [`/media/videos/${up.id}.mkv`, null, true]);
    const { uid } = shown.result;

    // Mientras se reproduce, la conversión cede el paso: no avanza.
    await sleep(1500);
    let clip = await clipNow(up.id);
    assert.equal(clip.status, 'converting');
    assert.equal((await s.state()).jobs.list.find((j) => j.ref === up.id).detail, 'En pausa mientras se reproduce');
    assert.equal(fs.existsSync(path.join(s.dataDir, 'media', 'convertidos', `${up.id}.mp4`)), false);

    // Al pausar, sigue, y la copia llega a lo que está al aire sin tocar su reproducción.
    await s.send('projection.control', { playing: false, position: 0.5 });
    clip = await s.settle(up.id);
    assert.deepEqual([clip.status, clip.url, clip.usable], ['ready', `/media/convertidos/${up.id}.mp4`, true]);
    const after = await s.state();
    assert.deepEqual([after.projection.item.uid, after.projection.item.url, after.projection.item.local, after.projection.item.waiting],
      [uid, `/media/convertidos/${up.id}.mp4`, `/media/videos/${up.id}.mkv`, null], 'las demás pantallas ya tienen su copia; las del equipo siguen con el original');
    assert.deepEqual([after.live.state.clock.playing, after.live.state.clock.position], [false, 0.5]);

    // Lo que diga la pantalla de proyección manda sobre lo que dijo el control.
    assert.equal((await says(up.id, false, 'proyeccion')).original.playable, false);
    assert.equal((await says(up.id, true, 'control')).original.playable, false);
    assert.equal((await s.send('projection.show', { kind: 'video', data: { id: up.id } })).result.local, null, 'ya convertido, todas usan la copia');
    await s.send('projection.clear');

    // Un original cuyo sonido no entendería el navegador ni se ofrece: se espera a la copia.
    const odd = await s.put('/api/media/clips?name=Raro&ext=.mkv', fs.readFileSync(strange));
    assert.deepEqual([odd.status, odd.usable, odd.original], ['converting', false, null]);
    assert.equal((await says(odd.id, true, 'proyeccion')).usable, false);
    assert.ok(await s.settle(odd.id));
    assert.equal((await says('no-existe', true, 'control')).http, 404);
  } finally {
    await s.stop();
  }
});

test('una conversión cede el paso a lo que se reproduce: se congela y sigue, o se corta y vuelve a empezar', needs, async () => {
  // Un video que tarde unos segundos en convertirse.
  const long = make('largo.avi', ['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=45', '-c:v', 'mpeg4', '-q:v', '6']);
  const info = readProbe(String(spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', long]).stdout));
  const s = await start('ceder');
  try {
    for (const pause of ['freeze', 'restart']) {
      const converter = createConverter(s.app, { pause });
      const output = path.join(tmp, `cedido-${pause}.mp4`);
      const done = new Promise((resolve) => {
        converter.enqueue({ id: `ceder-${pause}`, name: pause, input: long, output, kind: 'video', plan: planFor(info, 'video'), duration: info.duration, width: 1280, onDone: resolve });
      });
      const job = () => s.app.jobs.list().find((j) => j.ref === `ceder-${pause}`);
      const until = async (check) => { for (let i = 0; i < 300 && !check(); i += 1) await sleep(20); return check(); };
      assert.ok(await until(() => job()?.progress > 0.02), 'empieza a convertir');
      converter.hold(true);
      await sleep(250);
      const paused = job().progress;
      await sleep(700);
      assert.equal(job().detail, 'En pausa mientras se reproduce');
      assert.equal(job().progress, paused, 'mientras cede el paso no avanza');
      assert.equal(job().state, 'running');
      if (pause === 'restart') assert.equal(paused, 0, 'cortada: empezará de nuevo');
      else assert.ok(paused > 0, 'congelada: seguirá por donde iba');
      converter.hold(false);
      assert.deepEqual(await done, { ok: true }, 'al dejar de reproducirse, termina');
      const check = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output]);
      assert.ok(Math.abs(Number(String(check.stdout)) - 45) < 1, `la copia queda entera (${String(check.stdout).trim()} s)`);
      converter.close();
    }
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

test('suena una sola pantalla, siempre del equipo principal: su proyección y, si no la hay, su control', async () => {
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
    assert.equal((await s.state()).conexiones.sonido ?? null, null, 'sin nada abierto en el equipo, no suena en ningún sitio');
    const control = await open('control');
    assert.equal(await sound(), control.id, 'sin ventana de proyección, suena el control del equipo');
    const first = await open('proyeccion');
    assert.equal(await sound(), first.id, 'en cuanto hay proyección, suena ella');
    const second = await open('proyeccion');
    assert.notEqual(second.id, first.id);
    assert.equal(await sound(), first.id, 'la segunda pantalla va en silencio');
    first.close();
    assert.equal(await sound(), second.id, 'si la primera se cierra, suena la siguiente');
    second.close();
    assert.equal(await sound(), control.id, 'y sin proyección, otra vez el control');
    // Una pestaña a la que el navegador no deja sonar lo dice, y se elige a otra que pueda.
    const other = await open('control');
    const tell = (id, able) => s.put('/api/events/sound', JSON.stringify({ id, able }), 'application/json');
    assert.equal((await tell(control.id, false)).sonido, other.id);
    assert.equal(await sound(), other.id);
    assert.equal((await tell(other.id, false)).sonido, null, 'si ninguna puede, no suena en ningún sitio');
    assert.equal((await tell(control.id, true)).sonido, control.id);
    assert.equal((await tell('c999', false)).sonido, control.id, 'una conexión que no existe no cambia nada');
    other.close();
    control.close();
    assert.equal(await sound(), null);
  } finally {
    await s.stop();
  }
});

test('«Negro» y «Solo fondo» pausan lo que suena; pedir que se reproduzca lo vuelve a mostrar; al terminar pasa a fondo', async () => {
  // Sin ffmpeg para no depender de él: un MP3 de mentira con la duración que dice quien lo sube.
  const s = await start('ocultar', { MANNA_FALTA: 'ffmpeg' });
  try {
    const clip = await s.put('/api/media/clips?name=Pista&ext=.mp3&duration=1.2', Buffer.alloc(800, 1));
    const show = () => s.send('projection.show', { kind: 'audio', data: { id: clip.id } });
    const now = async () => { const st = await s.state(); return { mode: st.projection.mode, playing: st.live.state.clock.playing, position: st.live.state.clock.position }; };

    await show();
    assert.deepEqual([(await now()).mode, (await now()).playing], ['live', true]);
    await sleep(250);
    assert.equal((await s.send('projection.mode', { mode: 'black' })).http, 200);
    let state = await now();
    assert.deepEqual([state.mode, state.playing], ['black', false]);
    assert.ok(state.position >= 0.2 && state.position < 0.7, `queda en pausa donde iba (${state.position})`);
    // Quitar el negro no lo reanuda solo: no debe sonar nada por sorpresa.
    await s.send('projection.mode', { mode: 'live' });
    assert.deepEqual([(await now()).mode, (await now()).playing], ['live', false]);
    await s.send('projection.mode', { mode: 'clear' });
    assert.equal((await now()).mode, 'clear');
    // "Reproducir" con la pantalla oculta la vuelve a mostrar.
    assert.equal((await s.send('projection.control', { playing: true })).http, 200);
    assert.deepEqual([(await now()).mode, (await now()).playing], ['live', true]);
    // Una orden que no es reproducir no cambia el modo.
    await s.send('projection.mode', { mode: 'black' });
    await s.send('projection.control', { position: 0.1 });
    assert.equal((await now()).mode, 'black');

    // Al llegar al final, la proyección pasa sola a "Solo fondo".
    await show();
    await sleep(700);
    assert.equal((await now()).mode, 'live', 'a medio camino sigue al aire');
    await sleep(900);
    state = await now();
    assert.deepEqual([state.mode, state.playing, state.position], ['clear', false, 1.2]);
    // Y "Reproducir" lo pone otra vez desde el principio.
    await s.send('projection.control', { playing: true });
    state = await now();
    assert.deepEqual([state.mode, state.playing, state.position], ['live', true, 0]);

    // Pausado no termina; y si se salta atrás poco antes del final, tampoco.
    await s.send('projection.control', { playing: false });
    await sleep(1500);
    assert.equal((await now()).mode, 'live');
    await s.send('projection.control', { playing: true, position: 0.9 });
    await sleep(150);
    await s.send('projection.control', { position: 0.1 });
    await sleep(400);
    assert.equal((await now()).mode, 'live', 'el salto atrás aplaza el final');
    await s.send('projection.clear');
  } finally {
    await s.stop();
  }
});
