// Descarga los iconos de la interfaz (Phosphor, licencia MIT) y los reúne en un solo archivo:
//   web/vendor/phosphor/sprite.svg
//
// Uso:  node scripts/actualizar-iconos.mjs     (necesita internet; solo al añadir un icono)
// Para añadir uno: busca su nombre en https://phosphoricons.com, agrégalo a ICONS y ejecuta esto.
// En la app se usan con icon('nombre') de web/core/icons.js. Una sola familia y un solo grosor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '2.1.1';
const ICONS = [
  // módulos
  'list-numbers', 'book-open-text', 'music-notes', 'image', 'video', 'presentation-chart', 'gear-six', 'devices',
  // acciones
  'magnifying-glass', 'plus', 'minus', 'x', 'check', 'play', 'trash', 'pencil-simple', 'dots-three', 'dots-six-vertical',
  'caret-left', 'caret-right', 'caret-up', 'caret-down', 'arrow-left', 'arrow-up', 'arrow-down', 'arrows-left-right',
  'pause', 'arrow-counter-clockwise', 'arrow-clockwise', 'download-simple', 'copy', 'arrow-square-out',
  // estado
  'monitor', 'power', 'warning', 'clock-counter-clockwise', 'rows', 'qr-code', 'wifi-slash', 'eye-slash', 'selection-background',
  'check-circle', 'warning-circle', 'frame-corners', 'columns',
  // televisores y medios
  'television-simple', 'house', 'keyboard', 'speaker-low', 'speaker-high', 'upload-simple', 'images',
  'magnifying-glass-plus', 'magnifying-glass-minus', 'arrows-out', 'squares-four',
];

const base = `https://unpkg.com/@phosphor-icons/core@${VERSION}`;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'vendor', 'phosphor');
fs.mkdirSync(out, { recursive: true });

const symbols = [];
for (const name of ICONS) {
  const res = await fetch(`${base}/assets/regular/${name}.svg`);
  if (!res.ok) throw new Error(`No existe el icono "${name}" (${res.status}).`);
  const svg = await res.text();
  const body = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  symbols.push(`<symbol id="${name}" viewBox="0 0 256 256">${body}</symbol>`);
}
fs.writeFileSync(path.join(out, 'sprite.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor">\n<!-- Phosphor Icons ${VERSION} (MIT). Generado por scripts/actualizar-iconos.mjs: no editar a mano. -->\n${symbols.join('\n')}\n</svg>\n`);
fs.writeFileSync(path.join(out, 'LICENSE'), await (await fetch(`${base}/LICENSE`)).text());
console.log(`✔ ${ICONS.length} iconos en web/vendor/phosphor/sprite.svg`);
