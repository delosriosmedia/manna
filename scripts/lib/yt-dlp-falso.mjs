import fs from 'node:fs';
import path from 'node:path';

// Un yt-dlp de mentira para las pruebas: no sale a internet. Hace lo que Manna espera del de
// verdad: dice el título y la duración, va contando el avance, y deja en la carpeta de salida un
// video (hecho con ffmpeg en el momento), una imagen y unos subtítulos "automáticos" en dos idiomas.
//
//   writeFakeYtDlp(carpeta, { title, seconds, log, pause })  -> ruta del programa
//   pause: milisegundos entre un aviso de avance y el siguiente (hay cinco), para poder ver la descarga.
//   El video cuyo identificador empieza por "privado" falla como un video privado (tras dos pausas).
//   log: archivo donde apunta los argumentos que recibió (para comprobar qué se le pidió).
// Solo sirve en macOS y Linux (es un guion); en Windows las pruebas que lo usan se saltan.
export function writeFakeYtDlp(dir, { title = 'Video de prueba', seconds = 3, log = null, pause = 120 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'yt-dlp');
  const script = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
// Se escribe directo a la salida: con console.log, lo dicho podría quedarse esperando mientras el guion hace una pausa.
const say = (line) => fs.writeSync(1, line + '\\n');
if (args.includes('--version')) { say('2099.01.01'); process.exit(0); }
${log ? `fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(args));` : ''}
const url = args.at(-1);
const dir = path.dirname(args[args.indexOf('-o') + 1]);
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (/v=privado/.test(url)) { wait(${Number(pause) * 2}); console.error('ERROR: [youtube] privado: Private video. Sign in if you have been granted access to this video'); process.exit(1); }
const auto = (a, b) => 'WEBVTT\\nKind: captions\\n\\n00:00:00.320 --> 00:00:01.500 align:start position:0%\\n \\n' + a.split(' ').map((w, i) => i ? '<00:00:00.' + (400 + i * 100) + '><c> ' + w + '</c>' : w).join('') + '\\n\\n00:00:01.500 --> 00:00:01.510 align:start position:0%\\n' + a + '\\n \\n\\n00:00:01.510 --> 00:00:02.900 align:start position:0%\\n' + a + '\\n' + b + '\\n';
if (args.includes('--skip-download')) {
  fs.writeFileSync(path.join(dir, 'video.es.vtt'), auto('texto de prueba', 'en español'));
  fs.writeFileSync(path.join(dir, 'video.en-orig.vtt'), auto('test text', 'in English'));
  process.exit(0);
}
say(${JSON.stringify(`MANNA\ttitle\t${title}`)});
say('MANNA\\tduration\\t${seconds}');
for (const [done, total] of [[0, 1000], [400, 1000], [1000, 1000], [0, 100], [100, 100]]) { say('MANNA\\tprogress\\t' + done + '\\t' + total + '\\tNA'); wait(${Number(pause)}); }
const made = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=${seconds}', '-f', 'lavfi', '-i', 'sine=frequency=392:duration=${seconds}', '-af', 'volume=0.05', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'video.mp4')]);
if (made.status !== 0) { console.error('ERROR: ' + made.stderr); process.exit(1); }
spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, 'video.mp4'), '-frames:v', '1', '-vf', 'scale=320:-2', path.join(dir, 'video.jpg')]);
`;
  fs.writeFileSync(file, script, { mode: 0o755 });
  return file;
}
