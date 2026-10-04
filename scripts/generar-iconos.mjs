// Genera todos los formatos del logo de Manna a partir del vector instalacion/icono/manna.svg:
//
//   instalacion/icono/manna.ico   icono del acceso directo en Windows (16, 32, 48, 64 y 256 px)
//   instalacion/icono/manna.icns  icono de la app en Mac (con el margen que usa macOS)
//   web/logo.svg                  el icono en vector, para la interfaz
//   web/icono.png                 icono de la pestaña del navegador (128 px)
//   web/icono-180.png             icono al "añadir a la pantalla de inicio" en celulares (sin esquinas:
//                                 el sistema las recorta él mismo)
//   docs/logo.png                 imagen para el README (256 px)
//
// La marca sola, sin ficha, está en web/marca.svg y se edita a mano con las mismas medidas.
//
// Uso:  node scripts/generar-iconos.mjs      (solo hace falta si se cambia el dibujo)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startChrome, sleep } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'instalacion', 'icono');
const svg = fs.readFileSync(path.join(DIR, 'manna.svg'), 'utf8');
// Variante a sangre, sin esquinas redondeadas ni borde, para los sistemas que recortan el icono.
const square = svg.replace('x="370" y="370" width="1260" height="1260" rx="275"', 'x="366" y="366" width="1268" height="1268" rx="0" stroke-opacity="0"');
if (square === svg) throw new Error('No se encontró la ficha en manna.svg: revisa generar-iconos.mjs.');

const chrome = await startChrome();
await chrome.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

// Dibuja el SVG al tamaño pedido, con fondo transparente, y devuelve el PNG.
// margin: fracción del lienzo que queda libre alrededor (macOS deja aire en torno al icono).
async function render(source, size, margin = 0) {
  const inner = Math.round(size * (1 - 2 * margin));
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  const page = `<html><body style="margin:0;background:transparent;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${source}</div></body></html>`;
  await chrome.send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(page).toString('base64')}` });
  await sleep(400);
  const shot = await chrome.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  return Buffer.from(shot.result.data, 'base64');
}

// .ico: una cabecera y, por cada tamaño, una entrada que apunta a su PNG.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`✔ ${path.relative(ROOT, file)}`);
};

try {
  const ico = [];
  for (const size of [16, 32, 48, 64, 256]) ico.push({ size, png: await render(svg, size) });
  write(path.join(DIR, 'manna.ico'), buildIco(ico));
  write(path.join(ROOT, 'web', 'logo.svg'), svg);
  write(path.join(ROOT, 'web', 'icono.png'), await render(svg, 128));
  write(path.join(ROOT, 'web', 'icono-180.png'), await render(square, 180));
  write(path.join(ROOT, 'docs', 'logo.png'), await render(svg, 256));

  if (process.platform === 'darwin') {
    const set = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'manna-icono-')), 'Manna.iconset');
    fs.mkdirSync(set);
    for (const base of [16, 32, 128, 256, 512]) {
      fs.writeFileSync(path.join(set, `icon_${base}x${base}.png`), await render(svg, base, 0.09));
      fs.writeFileSync(path.join(set, `icon_${base}x${base}@2x.png`), await render(svg, base * 2, 0.09));
    }
    execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(DIR, 'manna.icns')]);
    fs.rmSync(path.dirname(set), { recursive: true, force: true });
    console.log('✔ instalacion/icono/manna.icns');
  } else {
    console.log('· manna.icns no se regenera fuera de macOS (se conserva el existente).');
  }
} finally {
  chrome.close();
}
