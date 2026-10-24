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
  // reproducción
  'speaker-x', 'closed-captioning', 'waveform', 'folder-simple', 'youtube-logo', 'link-simple',
  // presentador
  'hand-pointing', 'arrows-out-cardinal',
  // páginas web
  'globe',
  // escenario (fase 13)
  'sliders-horizontal', 'arrows-in',
  // himnario: favoritos
  'star',
  // textos (fase 18)
  'text-aa', 'quotes',
  // «Solo fondo» en la barra de arriba (1.31): el texto se va
  'text-t-slash',
  // citas de un texto o documento (fase 27)
  'file-text',
  'list-plus',
  // capas (fase 31)
  'stack', 'eye',
];

// Iconos propios (a petición del dueño, no son de Phosphor): un QR que se lee desde 14 px y, para «Negro», una
// diapositiva negra de verdad, sin el pie del monitor del proyector (1.31). Ver DESIGN.md.
const CUSTOM = [
  `<symbol id="pantalla-negra" viewBox="0 0 24 24"><rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.5" fill="#000" stroke="currentColor" stroke-width="1.75"/></symbol>`,
  `<symbol id="qr-mini" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.5"/><rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.5"/><rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.5"/></g><g fill="currentColor"><rect x="13.75" y="13.75" width="3.25" height="3.25" rx="0.7"/><rect x="17.25" y="17.25" width="3" height="3" rx="0.7"/><rect x="17.25" y="13.75" width="3" height="1.5" rx="0.5"/></g></symbol>`,
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
  `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor">\n<!-- Phosphor Icons ${VERSION} (MIT). Generado por scripts/actualizar-iconos.mjs: no editar a mano. -->\n${[...symbols, ...CUSTOM].join('\n')}\n</svg>\n`);
fs.writeFileSync(path.join(out, 'LICENSE'), await (await fetch(`${base}/LICENSE`)).text());
console.log(`✔ ${ICONS.length + CUSTOM.length} iconos en web/vendor/phosphor/sprite.svg`);
