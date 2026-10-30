import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

// Las letras (fuentes) de una presentación de PowerPoint. DeckCraft con animaciones corre en el navegador y no ve
// las letras del equipo: Manna busca entre las instaladas las que usa la presentación y se las entrega al abrirla
// (GET /api/slides/:id/fuentes). Las que no encuentra en el equipo ni vienen dentro de la presentación las dice,
// para que se instalen; las que son de Google Fonts las instala Manna (installFont).

const MAX_FONT = 32 * 1024 ** 2; // una letra más grande (las de chino o japonés) no se manda
const MAX_TOTAL = 64 * 1024 ** 2;
const FONT_FILE = /\.(ttf|otf|ttc|otc)$/i;

// ---- Un .pptx es un .zip: se leen solo las partes que se piden, sin cargar el archivo entero ----
export function readZip(file, wanted) {
  const fd = fs.openSync(file, 'r');
  const read = (at, length) => {
    const buffer = Buffer.alloc(length);
    if (fs.readSync(fd, buffer, 0, length, at) !== length) throw new Error('El archivo está cortado.');
    return buffer;
  };
  try {
    const size = fs.fstatSync(fd).size;
    const tail = read(Math.max(0, size - 65_557), Math.min(size, 65_557));
    const end = tail.lastIndexOf(Buffer.from('PK\x05\x06', 'latin1'));
    if (end < 0) throw new Error('No es un archivo .zip.');
    const dir = read(tail.readUInt32LE(end + 16), tail.readUInt32LE(end + 12));
    const parts = new Map();
    for (let at = 0; at + 46 <= dir.length && dir.readUInt32LE(at) === 0x02014b50;) {
      const method = dir.readUInt16LE(at + 10);
      const packed = dir.readUInt32LE(at + 20);
      const nameLength = dir.readUInt16LE(at + 28);
      const local = dir.readUInt32LE(at + 42);
      const name = dir.toString('utf8', at + 46, at + 46 + nameLength);
      at += 46 + nameLength + dir.readUInt16LE(at + 30) + dir.readUInt16LE(at + 32);
      if (!wanted(name) || (method !== 0 && method !== 8)) continue;
      const head = read(local, 30);
      const data = read(local + 30 + head.readUInt16LE(26) + head.readUInt16LE(28), packed);
      parts.set(name, method === 8 ? zlib.inflateRawSync(data) : data);
    }
    return parts;
  } finally {
    fs.closeSync(fd);
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => (e[0] === '#'
  ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  : ENTITIES[e] ?? all));

// Las letras que usa: las del tema (las de los títulos y del texto) y las que se eligieron a mano en las
// diapositivas, sus diseños y sus patrones (también las de las viñetas y los símbolos). Y las que trae dentro y DeckCraft
// sabe leer en las miniaturas: no las comprimidas (EOT con MicroType Express, la marca 4 en el byte 12), que solo lee
// la copia de Manna, en la proyección.
export function deckFonts(file) {
  const parts = readZip(file, (name) => /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|fonts\/[^/]+|(slides|slideLayouts|slideMasters|theme)\/[^/]+\.xml)$/.test(name));
  const used = new Map();
  const embedded = new Map();
  const add = (to, name) => { if (name && !name.startsWith('+')) to.set(name.toLowerCase(), name); };
  for (const [name, data] of parts) {
    if (!/^ppt\/(slides|slideLayouts|slideMasters|theme)\//.test(name)) continue;
    for (const [, typeface] of data.toString('utf8').matchAll(/<a:(?:latin|sym|buFont)\b[^>]*?\btypeface="([^"]*)"/g)) add(used, unescape(typeface).trim());
  }
  const rels = new Map([...(parts.get('ppt/_rels/presentation.xml.rels')?.toString('utf8') || '').matchAll(/<Relationship\b[^>]*?\bId="([^"]+)"[^>]*?\bTarget="([^"]+)"/g)].map(([, id, target]) => [id, `ppt/${target}`]));
  for (const [, block] of (parts.get('ppt/presentation.xml')?.toString('utf8') || '').matchAll(/<p:embeddedFont>([\s\S]*?)<\/p:embeddedFont>/g)) {
    const files = [...block.matchAll(/\br:id="([^"]+)"/g)].map(([, id]) => parts.get(rels.get(id)));
    if (files.length && files.every((f) => f?.length > 16 && !(f.readUInt32LE(12) & 4))) add(embedded, unescape(/<p:font\b[^>]*?\btypeface="([^"]*)"/.exec(block)?.[1] || '').trim());
  }
  return { used: [...used.values()].sort(), embedded: [...embedded.values()].sort() };
}

// ---- Las letras instaladas en el equipo ----
// Las mismas carpetas que mira DeckCraft para las miniaturas, también las que Office baja cuando hacen falta (Aptos…).
// Solo para pruebas: MANNA_LETRAS, una carpeta en vez de las del equipo.
export function fontDirs(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.MANNA_LETRAS) return [env.MANNA_LETRAS];
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [path.join(env.WINDIR || 'C:\\Windows', 'Fonts'), path.join(local, 'Microsoft', 'Windows', 'Fonts'), path.join(local, 'Microsoft', 'FontCache', '4', 'CloudFonts')];
  }
  if (platform === 'darwin') {
    return ['/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library/Fonts'), path.join(home, 'Library/Group Containers/UBF8T346G9.Office/FontCache/4/CloudFonts'),
      ...['PowerPoint', 'Word', 'Excel'].map((app) => `/Applications/Microsoft ${app}.app/Contents/Resources/DFonts`)];
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(home, '.fonts'), path.join(home, '.local/share/fonts')];
}

// Los nombres de familia de un archivo de letra (de su tabla «name»: el 1 y, si lo tiene, el 16), en minúsculas.
export function fontNames(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const read = (at, length) => {
      const buffer = Buffer.alloc(length);
      return fs.readSync(fd, buffer, 0, length, at) === length ? buffer : null;
    };
    const head = read(0, 12);
    if (!head) return [];
    let starts = [0];
    if (head.toString('latin1', 0, 4) === 'ttcf') {
      const list = read(12, 4 * Math.min(head.readUInt32BE(8), 64));
      starts = list ? Array.from({ length: list.length / 4 }, (_, i) => list.readUInt32BE(i * 4)) : [];
    }
    const names = new Set();
    for (const start of starts) {
      const count = read(start + 4, 2)?.readUInt16BE(0) || 0;
      const tables = read(start + 12, 16 * count);
      const index = tables && Array.from({ length: count }, (_, i) => i * 16).find((at) => tables.toString('latin1', at, at + 4) === 'name');
      if (index == null) continue;
      const table = read(tables.readUInt32BE(index + 8), Math.min(tables.readUInt32BE(index + 12), 256 * 1024));
      if (!table) continue;
      const strings = table.readUInt16BE(4);
      for (let i = 0; i < table.readUInt16BE(2) && 6 + i * 12 + 12 <= table.length; i += 1) {
        const at = 6 + i * 12;
        const [platform, , , id, length, offset] = [0, 2, 4, 6, 8, 10].map((o) => table.readUInt16BE(at + o));
        if ((id !== 1 && id !== 16) || strings + offset + length > table.length) continue;
        const bytes = Buffer.from(table.subarray(strings + offset, strings + offset + length));
        // Windows y Unicode, en UTF-16 big-endian; Mac, en una letra por byte.
        const text = platform === 1 ? bytes.toString('latin1') : bytes.length % 2 ? '' : bytes.swap16().toString('utf16le');
        if (text.trim()) names.add(text.trim().toLowerCase());
      }
    }
    return [...names];
  } catch {
    return [];
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function fontFiles(dir, depth = 3) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return depth > 0 ? fontFiles(full, depth - 1) : [];
    return FONT_FILE.test(e.name) ? [full] : [];
  });
}

// El índice (familia en minúsculas → archivos) se rehace solo si cambió alguna carpeta: instalar una letra la cambia.
let cached = { stamp: null, index: new Map() };
export function installedFonts(dirs = fontDirs()) {
  const stamp = dirs.map((dir) => { try { return fs.statSync(dir).mtimeMs; } catch { return 0; } }).join('|');
  if (stamp === cached.stamp) return cached.index;
  const index = new Map();
  for (const file of dirs.flatMap((dir) => fontFiles(dir))) {
    for (const name of fontNames(file)) index.set(name, [...(index.get(name) || []), file]);
  }
  cached = { stamp, index };
  return index;
}

// Lo que necesita DeckCraft para una presentación: los archivos de las letras que usa y están instaladas
// (todos los de cada familia: negrita, cursiva…), y las que no se encuentran en ninguna parte. Un archivo repetido
// (mismo nombre y tamaño) va una vez: en Mac, Word, Excel y PowerPoint traen cada uno su copia de las mismas.
export function fontsFor(file, index = installedFonts()) {
  const { used, embedded } = deckFonts(file);
  const inside = new Set(embedded.map((name) => name.toLowerCase()));
  const seen = new Set();
  let total = 0;
  const sent = [...new Set(used.flatMap((name) => index.get(name.toLowerCase()) || []))].filter((f) => {
    const size = fs.statSync(f, { throwIfNoEntry: false })?.size || 0;
    const key = `${path.basename(f).toLowerCase()}:${size}`;
    if (!size || size > MAX_FONT || total + size > MAX_TOTAL || seen.has(key)) return false;
    seen.add(key);
    total += size;
    return true;
  });
  const missing = used.filter((name) => !index.has(name.toLowerCase()) && !inside.has(name.toLowerCase()));
  return { files: sent, missing };
}

// ---- Instalar una que falta, de Google Fonts ----
// Se le pide a Google Fonts lo mismo que le pide una página web (su CSS, la versión 2: la 1 da algunas con otro nombre
// dentro): la normal, la negrita y las cursivas que tenga, en TTF. Ahí están también las que ya no muestra, como Fredoka One; de una que no es suya contesta 400. Cada
// archivo, solo de fonts.gstatic.com y si de verdad es una letra con ese nombre, se copia a la carpeta de letras de
// quien usa el equipo, sin pedir permisos de administrador. Solo para pruebas: MANNA_LETRAS_URL, uno de mentira.
const OFFLINE = 'No se pudo llegar a Google Fonts. Comprueba que el equipo principal tiene internet y vuelve a intentarlo.';

export function userFontDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.MANNA_LETRAS) return env.MANNA_LETRAS;
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts');
  if (platform === 'darwin') return path.join(home, 'Library', 'Fonts');
  return path.join(home, '.local', 'share', 'fonts');
}

const isFont = (data) => ['00010000', '4f54544f', '74727565', '74746366'].includes(data.subarray(0, 4).toString('hex'));

async function ask(url) {
  try {
    return await fetch(url, { headers: { 'User-Agent': 'Manna' }, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error(OFFLINE);
  }
}

// Los archivos instalados de esa familia; ninguno si no es de Google Fonts.
export async function installFont(family, dir = userFontDir()) {
  const test = process.env.MANNA_LETRAS_URL;
  const files = test ? new URL(test).origin : 'https://fonts.gstatic.com';
  const res = await ask(`${test || 'https://fonts.googleapis.com'}/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400;1,700`);
  if (res.status === 400) return [];
  if (!res.ok) throw new Error(`Google Fonts no contesta ahora (respuesta ${res.status}). Inténtalo en un rato.`);
  const saved = [];
  for (const face of (await res.text()).split('@font-face').slice(1)) {
    const url = /url\((https?:[^)\s]+)\)/.exec(face)?.[1];
    if (!url?.startsWith(`${files}/`)) continue;
    const bold = /font-weight:\s*700/.test(face);
    const italic = /font-style:\s*italic/.test(face);
    const got = await ask(url);
    const data = got.ok ? Buffer.from(await got.arrayBuffer()) : Buffer.alloc(0);
    if (!isFont(data) || data.length > MAX_FONT) throw new Error(`La letra ${family} no llegó entera. Vuelve a intentarlo.`);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${family.replace(/[^A-Za-z0-9]/g, '')}-${`${bold ? 'Bold' : ''}${italic ? 'Italic' : ''}` || 'Regular'}.ttf`);
    fs.writeFileSync(target, data);
    // Con otro nombre dentro no la encontraría nadie: se quita.
    if (!fontNames(target).includes(family.toLowerCase())) {
      fs.rmSync(target, { force: true });
      continue;
    }
    saved.push(target);
    // En Windows, además, se apunta para quien usa el equipo: así la ven también PowerPoint y los demás programas.
    if (process.platform === 'win32' && !process.env.MANNA_LETRAS) {
      execFile('reg', ['add', 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', `${path.parse(target).name} (TrueType)`, '/t', 'REG_SZ', '/d', target, '/f'], { windowsHide: true }, () => {});
    }
  }
  return saved;
}
