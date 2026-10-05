import test from 'node:test';
import assert from 'node:assert/strict';
import { clipKind, clock, encodersFor, ffmpegArgs, planFor, playsAsIs, readProbe, readProgress, toVtt } from '../server/modules/media/clips.js';

const probe = (format, streams, duration = '63.5') => readProbe({ format: { format_name: format, duration }, streams });
const h264 = { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p' };
const aac = { codec_type: 'audio', codec_name: 'aac', channels: 2 };

test('clipKind distingue video y audio por la extensión, y no admite otra cosa', () => {
  assert.equal(clipKind('Bienvenida.MP4'), 'video');
  assert.equal(clipKind('testimonio.final.mkv'), 'video');
  assert.equal(clipKind('pista.mp3'), 'audio');
  assert.equal(clipKind('grabación.WAV'), 'audio');
  for (const name of ['programa.exe', 'pagina.html', 'foto.jpg', 'sin-extension', 'video.mp4.sh']) assert.equal(clipKind(name), null, name);
  assert.equal(playsAsIs('.MP4'), true);
  assert.equal(playsAsIs('.avi'), false);
});

test('readProbe se queda con lo que importa de lo que dice ffprobe', () => {
  assert.deepEqual(probe('mov,mp4,m4a,3gp,3g2,mj2', [h264, aac]), {
    container: 'mov,mp4,m4a,3gp,3g2,mj2', duration: 63.5,
    video: { codec: 'h264', width: 1920, height: 1080, pixFmt: 'yuv420p' },
    audio: { codec: 'aac', channels: 2 },
  });
  // La carátula de un mp3 no es un video.
  const mp3 = probe('mp3', [{ codec_type: 'audio', codec_name: 'mp3', channels: 2 }, { codec_type: 'video', codec_name: 'mjpeg', disposition: { attached_pic: 1 } }]);
  assert.equal(mp3.video, null);
  assert.equal(mp3.audio.codec, 'mp3');
  assert.equal(readProbe({ format: {}, streams: [{ codec_type: 'data' }] }), null);
  assert.equal(readProbe('esto no es json'), null);
  assert.equal(probe('avi', [h264], 'N/A').duration, null);
});

test('planFor: lo habitual no se toca, lo que solo trae otro envoltorio se cambia en segundos, y el resto se convierte', () => {
  const mp4 = 'mov,mp4,m4a,3gp,3g2,mj2';
  assert.deepEqual(planFor(probe(mp4, [h264, aac]), 'video'), { action: 'direct', video: 'copy', audio: 'copy' });
  assert.deepEqual(planFor(probe(mp4, [h264]), 'video'), { action: 'direct', video: 'copy', audio: null }, 'un video mudo');
  assert.deepEqual(planFor(probe('matroska,webm', [h264, aac]), 'video'), { action: 'remux', video: 'copy', audio: 'copy' });
  assert.deepEqual(planFor(probe('avi', [h264, { codec_type: 'audio', codec_name: 'ac3' }]), 'video'), { action: 'remux', video: 'copy', audio: 'encode' });
  assert.deepEqual(planFor(probe(mp4, [h264, { codec_type: 'audio', codec_name: 'pcm_s16le' }]), 'video'), { action: 'remux', video: 'copy', audio: 'encode' }, 'el sonido de una cámara');
  // El video de un iPhone en "alta eficiencia", el de 10 bits y los formatos antiguos.
  assert.equal(planFor(probe(mp4, [{ ...h264, codec_name: 'hevc' }, aac]), 'video').action, 'transcode');
  assert.equal(planFor(probe(mp4, [{ ...h264, pix_fmt: 'yuv420p10le' }, aac]), 'video').action, 'transcode');
  assert.deepEqual(planFor(probe('avi', [{ ...h264, codec_name: 'mpeg4' }, { codec_type: 'audio', codec_name: 'mp3' }]), 'video'), { action: 'transcode', video: 'encode', audio: 'encode' });
  assert.equal(planFor(probe('asf', [{ ...h264, codec_name: 'wmv3' }]), 'video').audio, null);

  const sound = (container, codec) => planFor(probe(container, [{ codec_type: 'audio', codec_name: codec }]), 'audio').action;
  assert.equal(sound('mp3', 'mp3'), 'direct');
  assert.equal(sound('mov,mp4,m4a,3gp,3g2,mj2', 'aac'), 'direct');
  assert.equal(sound('wav', 'pcm_s16le'), 'direct');
  assert.equal(sound('ogg', 'opus'), 'direct');
  assert.equal(sound('asf', 'wmav2'), 'transcode');
  assert.equal(sound('aiff', 'pcm_s16be'), 'transcode');
});

test('encodersFor prefiere el chip de video del equipo y siempre deja libx264 al final', () => {
  const listing = ' V....D libx264   libx264 H.264\n V....D h264_videotoolbox VideoToolbox\n V....D h264_qsv Intel\n';
  assert.deepEqual(encodersFor('darwin', listing), ['h264_videotoolbox', 'libx264']);
  assert.deepEqual(encodersFor('win32', listing), ['h264_qsv', 'libx264']);
  assert.deepEqual(encodersFor('linux', listing), ['libx264']);
  assert.deepEqual(encodersFor('win32', ''), ['libx264']);
});

test('ffmpegArgs arma la orden como una lista, sin mezclar nombres de archivo con opciones', () => {
  const tricky = '/datos/-i otro.avi; rm -rf'; // un nombre así va como un solo argumento
  const remux = ffmpegArgs({ video: 'copy', audio: 'encode' }, { input: tricky, output: '/t/x.mp4', kind: 'video' });
  assert.equal(remux[remux.indexOf('-i') + 1], tricky);
  assert.ok(remux.join(' ').includes('-c:v copy -c:a aac -b:a 192k -ac 2 -movflags +faststart -f mp4 /t/x.mp4'));
  const full = ffmpegArgs({ video: 'encode', audio: null }, { input: 'a.avi', output: 'b.mp4', kind: 'video', encoder: 'h264_videotoolbox', width: 3840 }).join(' ');
  assert.ok(full.includes('-c:v h264_videotoolbox'));
  assert.ok(full.includes('-pix_fmt yuv420p -vf scale=1920:-2'), 'lo que pasa de 1080p se reduce');
  assert.equal(full.includes('-c:a'), false, 'sin sonido, nada que hacer con él');
  const small = ffmpegArgs({ video: 'encode', audio: 'encode' }, { input: 'a.avi', output: 'b.mp4', kind: 'video', width: 720 }).join(' ');
  assert.ok(small.includes('-c:v libx264 -preset veryfast -crf 21'));
  assert.ok(small.includes('scale=trunc(iw/2)*2:trunc(ih/2)*2'));
  assert.ok(ffmpegArgs({ audio: 'encode' }, { input: 'a.wma', output: 'b.m4a', kind: 'audio' }).join(' ').endsWith('-vn -c:a aac -b:a 192k -f mp4 b.m4a'));
});

test('readProgress lee por dónde va la conversión', () => {
  assert.equal(readProgress('frame=10\nout_time_us=1500000\nout_time=00:00:01.500000\nprogress=continue\n'), 1.5);
  assert.equal(readProgress('out_time_ms=2000000\nprogress=continue\nout_time_ms=4500000\nprogress=continue\n'), 4.5);
  assert.equal(readProgress('frame=10\nfps=30\n'), null);
});

test('toVtt convierte subtítulos .srt y deja un .vtt como está', () => {
  const srt = '﻿1\r\n00:00:01,000 --> 00:00:03,500\r\nBienvenidos\r\na la reunión\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nGracias por venir\r\n';
  assert.equal(toVtt(srt), 'WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nBienvenidos\na la reunión\n\n00:00:04.000 --> 00:00:06.000\nGracias por venir\n');
  assert.equal(toVtt('WEBVTT\n\n00:01.000 --> 00:02.000\nHola\n'), 'WEBVTT\n\n00:01.000 --> 00:02.000\nHola\n');
  assert.equal(toVtt('esto no son subtítulos'), 'WEBVTT\n\n\n');
});

test('clock escribe una duración', () => {
  assert.equal(clock(222.4), '3:42');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(clock(null), '');
  assert.equal(clock(0), '');
});
