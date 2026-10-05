import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Un PowerPoint de mentira para las pruebas: un guion que hace lo que Manna espera del guion de
// verdad (server/modules/slides/powerpoint.js). Lee de las mismas variables de entorno qué
// presentación convertir y dónde dejar las imágenes, dice cuántas diapositivas hay y va
// dejando una imagen PNG por cada una (sin miniaturas, para probar también ese caso).
//
//   writeFakePowerPoint(carpeta, { slides, pause })  -> ruta del guion (va en MANNA_POWERPOINT_PRUEBA)
//   pause: milisegundos entre una diapositiva y la siguiente, para poder ver la conversión.
//   Una presentación cuyo contenido lleve la palabra ROTA falla, como una que PowerPoint no abre.
// Se ejecuta con Node, así que sirve en cualquier sistema.
export function writeFakePowerPoint(dir, { slides = 3, pause = 60 } = {}) {
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
fs.mkdirSync(out, { recursive: true });
const COLORS = [[[29, 78, 216], [147, 51, 234]], [[15, 118, 110], [202, 138, 4]], [[190, 18, 60], [234, 88, 12]]];
say('MANNA\\ttotal\\t${Number(slides)}');
for (let i = 1; i <= ${Number(slides)}; i += 1) {
  fs.writeFileSync(path.join(out, i + '.png'), examplePoster(640, 360, COLORS[(i - 1) % COLORS.length]));
  say('MANNA\\tslide\\t' + i);
  wait(${Number(pause)});
}
`);
  return file;
}

// Lo mínimo que hace que un archivo se reconozca como una presentación moderna (.pptx): empieza
// como un ZIP. Para el PowerPoint de mentira basta; el de verdad no lo abriría.
export const fakePresentation = (text = 'presentación de prueba') => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(text.padEnd(64, ' '))]);
