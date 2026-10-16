import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Un PowerPoint de mentira para las pruebas: un guion que hace lo que Manna espera del guion de
// verdad (server/modules/slides/powerpoint.js). Lee de las mismas variables de entorno qué
// presentación convertir y dónde dejar las imágenes, dice cuántas diapositivas hay y va
// dejando una imagen PNG por cada una (sin miniaturas, para probar también ese caso).
//
//   writeFakePowerPoint(carpeta, { slides, pause, log })  -> ruta del guion (va en MANNA_POWERPOINT_PRUEBA)
//   pause: milisegundos entre una diapositiva y la siguiente, para poder ver la conversión.
//   Una presentación cuyo contenido lleve la palabra ROTA falla, como una que PowerPoint no abre.
// Con MANNA_PPT_MODO=vivo hace de pase en vivo (LIVE_SCRIPT de powerpoint.js): contesta a ir, siguiente,
// anterior y parar como el de verdad, con una animación en la diapositiva 2. Apunta cada orden en `log` (una
// línea JSON por orden; "cerrar" al cerrársele la entrada) y, como si alguien la pasara en el equipo, mira el
// archivo `log + '.mover'`: un número la lleva a esa diapositiva; "fin", a la última, ya acabada (como el de verdad
// cuando alguien pasa de ella), y "parado" cierra el pase.
// Se ejecuta con Node, así que sirve en cualquier sistema.
export function writeFakePowerPoint(dir, { slides = 3, pause = 60, log = path.join(dir, 'pase.jsonl') } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'powerpoint-falso-guion.mjs');
  const png = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'png.mjs')).href;
  fs.writeFileSync(file, `import fs from 'node:fs';
import path from 'node:path';
import { examplePoster } from ${JSON.stringify(png)};
const input = process.env.MANNA_PPT_ENTRADA;
const out = process.env.MANNA_PPT_SALIDA;
const say = (line) => fs.writeSync(1, line + '\\n');
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (fs.readFileSync(input).includes('ROTA')) { console.error('PowerPoint could not open the file.'); process.exit(1); }
if (process.env.MANNA_PPT_MODO === 'vivo') {
  const total = ${Number(slides)};
  const clicks = { 2: 1 };
  const log = ${JSON.stringify(log)};
  let at = 0;
  let click = 0;
  const reply = (what, value, n) => say(['MANNA', what, value, n].join('\\t'));
  say('MANNA\\tlisto\\t' + total);
  let rest = '';
  process.stdin.on('data', (chunk) => {
    const lines = (rest + chunk).split('\\n');
    rest = lines.pop();
    for (const line of lines) {
      const [order, value, n] = line.split('\\t');
      fs.appendFileSync(log, JSON.stringify({ order, value }) + '\\n');
      if (order === 'parar') { at = 0; reply('parado', '', n); continue; }
      if (order === 'punto') { reply('punto', '', n); continue; }
      if (order === 'ir') { at = Number(value); click = 0; reply('diapositiva', at, n); continue; }
      if (!at) { reply('parado', '', n); continue; }
      if (order === 'siguiente') {
        if (at === total && click >= (clicks[at] || 0)) { reply('fin', '', n); continue; }
        if (click < (clicks[at] || 0)) click += 1; else { at += 1; click = 0; }
      } else if (order === 'anterior') {
        if (at === 1 && click === 0) { reply('inicio', '', n); continue; }
        if (click > 0) click -= 1; else { at -= 1; click = clicks[at] || 0; }
      }
      reply('diapositiva', at, n);
    }
  });
  process.stdin.on('end', () => { fs.appendFileSync(log, JSON.stringify({ order: 'cerrar' }) + '\\n'); process.exit(0); });
  setInterval(() => {
    let moved;
    try { moved = fs.readFileSync(log + '.mover', 'utf8').trim(); fs.rmSync(log + '.mover'); } catch { return; }
    if (moved === 'parado') { at = 0; reply('parado', '', ''); } else if (moved === 'fin') { at = total; click = clicks[at] || 0; reply('fin', '', ''); }
    else { at = Number(moved); click = 0; reply('diapositiva', at, ''); }
  }, 100);
} else {
fs.mkdirSync(out, { recursive: true });
const COLORS = [[[29, 78, 216], [147, 51, 234]], [[15, 118, 110], [202, 138, 4]], [[190, 18, 60], [234, 88, 12]]];
say('MANNA\\ttotal\\t${Number(slides)}');
for (let i = 1; i <= ${Number(slides)}; i += 1) {
  fs.writeFileSync(path.join(out, i + '.png'), examplePoster(640, 360, COLORS[(i - 1) % COLORS.length]));
  say('MANNA\\tslide\\t' + i);
  wait(${Number(pause)});
}
}
`);
  return file;
}

// Lo mínimo que hace que un archivo se reconozca como una presentación moderna (.pptx): empieza
// como un ZIP. Para el PowerPoint de mentira basta; el de verdad no lo abriría.
export const fakePresentation = (text = 'presentación de prueba') => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(text.padEnd(64, ' '))]);
