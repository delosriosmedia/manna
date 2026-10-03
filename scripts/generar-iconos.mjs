// Genera los iconos de Manna a partir de instalacion/icono/manna.svg:
//   instalacion/icono/manna.ico    icono del acceso directo en Windows
//   instalacion/icono/manna.icns   icono de la app en Mac (solo se genera en macOS)
//   web/icono.png                  icono de la pestaña del navegador
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

const chrome = await startChrome();
await chrome.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

// Dibuja el SVG al tamaño pedido, con fondo transparente, y devuelve el PNG.
async function render(size) {
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  const page = `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg}</div></body></html>`;
  await chrome.send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(page).toString('base64')}` });
  await sleep(400);
  const shot = await chrome.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  return Buffer.from(shot.result.data, 'base64');
}

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const png = {};
for (const size of sizes) png[size] = await render(size);
chrome.close();

// .ico: una cabecera y, por cada tamaño, una entrada que apunta a su PNG.
function buildIco(list) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(list.length, 4);
  let offset = 6 + 16 * list.length;
  const entries = list.map((size) => {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png[size].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png[size].length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...list.map((size) => png[size])]);
}

fs.writeFileSync(path.join(DIR, 'manna.ico'), buildIco([16, 32, 48, 64, 256]));
fs.writeFileSync(path.join(ROOT, 'web', 'icono.png'), png[128]);
console.log('✔ instalacion/icono/manna.ico');
console.log('✔ web/icono.png');

if (process.platform === 'darwin') {
  const set = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'manna-icono-')), 'Manna.iconset');
  fs.mkdirSync(set);
  for (const base of [16, 32, 128, 256, 512]) {
    fs.writeFileSync(path.join(set, `icon_${base}x${base}.png`), png[base]);
    fs.writeFileSync(path.join(set, `icon_${base}x${base}@2x.png`), png[base * 2]);
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(DIR, 'manna.icns')]);
  fs.rmSync(path.dirname(set), { recursive: true, force: true });
  console.log('✔ instalacion/icono/manna.icns');
} else {
  console.log('· manna.icns no se regenera fuera de macOS (se conserva el existente).');
}
