import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Un DeckCraft de mentira para las pruebas (fase 33): responde como `deckcraft-cli` 0.10.0 sin descargar los 70 MB del
// de verdad. Lee la presentación (un .pptx: un .zip) y hace lo que Manna le pide:
//   --version                          "deckcraft-cli 0.10.0"
//   info ARCHIVO                       el tamaño y las diapositivas, cuáles ocultas (como el de verdad, en JSON)
//   render ARCHIVO --all --scale S OUT una imagen PNG por diapositiva, también las ocultas, y una línea por cada una
// Una presentación con una diapositiva que dice «ROTA» falla como una que DeckCraft no puede abrir.
//   writeFakeDeckCraft(carpeta) -> ruta del programa
// Solo sirve en macOS y Linux (es un guion); en Windows, las pruebas usan el de verdad si se les da
// (MANNA_DECKCRAFT_PRUEBA) o se saltan.
export function writeFakeDeckCraft(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'deckcraft-cli');
  const png = pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), 'png.mjs')).href;
  fs.writeFileSync(file, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const args = process.argv.slice(2);
const say = (line) => fs.writeSync(1, line + '\\n');
if (args.includes('--version')) { say('deckcraft-cli 0.10.0'); process.exit(0); }
const input = args[1];
// Lo de dentro del .zip: se recorren sus cabeceras y se descomprime cada parte.
const zip = fs.readFileSync(input);
const parts = {};
for (let at = 0; zip.readUInt32LE(at) === 0x04034b50;) {
  const method = zip.readUInt16LE(at + 8);
  const size = zip.readUInt32LE(at + 18);
  const nameLength = zip.readUInt16LE(at + 26);
  const extra = zip.readUInt16LE(at + 28);
  const name = zip.toString('utf8', at + 30, at + 30 + nameLength);
  const data = zip.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
  parts[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
  at += 30 + nameLength + extra + size;
}
if (Object.values(parts).some((xml) => xml.includes('>ROTA<'))) { console.error('error: not a presentation'); process.exit(1); }
const count = Object.keys(parts).filter((n) => /^ppt\\/slides\\/slide\\d+\\.xml$/.test(n)).length;
const slides = Array.from({ length: count }, (_, i) => ({ index: i, hidden: /<p:sld\\b[^>]*\\bshow="0"/.test(parts['ppt/slides/slide' + (i + 1) + '.xml']) }));
if (args[0] === 'info') { say(JSON.stringify({ slideSize: [960.0, 540.0], slides })); process.exit(0); }
if (args[0] === 'render') {
  const scale = Number(args[args.indexOf('--scale') + 1]) || 2;
  const out = args.at(-1);
  fs.mkdirSync(out, { recursive: true });
  import(${JSON.stringify(png)}).then(({ makePng }) => {
    const w = Math.round(960 * scale);
    const h = Math.round(540 * scale);
    slides.forEach((s, i) => {
      const file = path.join(out, 'slide-' + String(i + 1).padStart(2, '0') + '.png');
      fs.writeFileSync(file, makePng(w, h, () => [40 + i * 60, 90, 200]));
      say(file + ' (' + w + '×' + h + ')');
    });
  });
} else { console.error('error: unknown command'); process.exit(2); }
`, { mode: 0o755 });
  return file;
}
