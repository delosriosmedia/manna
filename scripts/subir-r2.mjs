// Sube a Cloudflare R2 el himnario y las biblias de la iglesia, para la nube (fase 36, parte 3): los videos, las
// letras y las diapositivas del himnario, y las biblias. Solo lo que falta (o cambió de tamaño): se puede cortar y
// volver a lanzar. Las claves salen de ~/.manna-r2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET),
// nunca del repositorio, y no se escriben en la salida.
//
// Uso:  node scripts/subir-r2.mjs            sube lo que falta de Contenido/
//       node scripts/subir-r2.mjs prueba     solo dice qué subiría, sin subir nada
//       node scripts/subir-r2.mjs --contenido /otra/carpeta/Contenido
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { r2Bucket } from '../server/core/r2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('prueba');
const at = args.indexOf('--contenido');
const content = at >= 0 ? path.resolve(args[at + 1]) : path.join(ROOT, 'Contenido');
const PARALLEL = 4;

// Las claves: del entorno o de ~/.manna-r2 (líneas NOMBRE=valor).
const file = path.join(os.homedir(), '.manna-r2');
const saved = fs.existsSync(file) ? Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
  .map((line) => line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]])) : {};
const env = (name) => process.env[name] || saved[name] || '';
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter((name) => !env(name));
if (missing.length) {
  console.error(`Faltan en ${file}: ${missing.join(', ')}.`);
  process.exit(1);
}
const bucket = r2Bucket({ accountId: env('R2_ACCOUNT_ID'), accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), bucket: env('R2_BUCKET') });

// Qué se sube: la carpeta, qué archivos y su tipo. Las claves del depósito repiten la ruta dentro de Contenido/.
const TYPES = { '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.xmm': 'application/xml', '.xml': 'application/xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const PARTS = [
  ['Biblias', /\.(xmm|xml)$/i],
  ['Himnario/videos', /\.mp4$/i],
  ['Himnario/letras', /\.md$/i],
  ['Himnario/diapositivas', /\.(jpe?g|png)$/i],
];
const NOTE = 'Contenido de Manna Iglesia: el himnario y las biblias de cada iglesia, para uso y estudio personal, investigación y pruebas; no comercial. Solo para las iglesias con ingreso, con enlaces que caducan. No se publica ni se comparte.\n';

function walk(dir, rx) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.')).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, rx) : rx.test(e.name) ? [full] : [];
  });
}
const keyOf = (full) => path.relative(content, full).split(path.sep).join('/').normalize('NFC');
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const local = PARTS.flatMap(([dir, rx]) => walk(path.join(content, dir), rx)).map((full) => ({ full, key: keyOf(full), size: fs.statSync(full).size }));
console.log(`En ${content}: ${local.length} archivos (${mb(local.reduce((t, f) => t + f.size, 0))}).`);
const remote = new Map((await bucket.list()).map((o) => [o.key, o.size]));
const todo = local.filter((f) => remote.get(f.key) !== f.size);
const total = todo.reduce((t, f) => t + f.size, 0);
console.log(`Ya en R2: ${local.length - todo.length}. Faltan: ${todo.length} (${mb(total)}).`);
if (!remote.has('LEEME.txt') && !DRY) await bucket.put('LEEME.txt', Buffer.from(NOTE), 'text/plain; charset=utf-8');
if (DRY) {
  for (const [dir] of PARTS) {
    const part = todo.filter((f) => f.key.startsWith(`${dir}/`));
    if (part.length) console.log(`  ${dir}: ${part.length} (${mb(part.reduce((t, f) => t + f.size, 0))})`);
  }
  process.exit(0);
}

// De cuatro en cuatro; un fallo se cuenta y se sigue (al volver a lanzarlo, sube lo que quedó).
const t0 = Date.now();
let sent = 0;
let done = 0;
const failed = [];
const queue = [...todo];
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let f = queue.shift(); f; f = queue.shift()) {
    try {
      await bucket.put(f.key, fs.readFileSync(f.full), TYPES[path.extname(f.key).toLowerCase()]);
      sent += f.size;
    } catch (err) {
      failed.push(`${f.key}: ${err.message}`);
    }
    done += 1;
    const speed = sent / Math.max(1, (Date.now() - t0) / 1000);
    if (done % 25 === 0 || done === todo.length) console.log(`${done}/${todo.length} · ${mb(sent)} de ${mb(total)} · ${mb(speed)}/s · faltan unos ${Math.ceil((total - sent) / Math.max(speed, 1) / 60)} min`);
  }
}));
if (failed.length) console.log(`\nNo se subieron ${failed.length}:\n  ${failed.slice(0, 20).join('\n  ')}\nVuelve a lanzar el guion: sube solo lo que falta.`);
console.log(failed.length ? '' : '\nTodo subido.');
process.exit(failed.length ? 1 : 0);
