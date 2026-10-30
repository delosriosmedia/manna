import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readZip } from './pptx.js';

// Las letras (fuentes) de una presentación de PowerPoint. DeckCraft con animaciones corre en el navegador y no ve
// las letras del equipo: Manna busca entre las instaladas las que usa la presentación y se las entrega al abrirla
// (GET /api/slides/:id/fuentes). Las que no encuentra en el equipo ni vienen dentro de la presentación las dice,
// para que se instalen; las que son de Google Fonts las instala Manna (installFont).

const MAX_FONT = 32 * 1024 ** 2; // una letra más grande (las de chino o japonés) no se manda
const MAX_TOTAL = 64 * 1024 ** 2;
const FONT_FILE = /\.(ttf|otf|ttc|otc)$/i;

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

// Las carpetas que existen pero no se dejan leer: en Mac, la de Office está protegida (macOS pide permiso para leer
// lo de otro programa).
let blocked = new Set();
function fontFiles(dir, depth = 3) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') blocked.add(dir);
    return [];
  }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return depth > 0 ? fontFiles(full, depth - 1) : [];
    return FONT_FILE.test(e.name) ? [full] : [];
  });
}

// El índice (familia, sin mayúsculas ni espacios → archivos) se rehace solo si cambió alguna carpeta: instalar una
// letra la cambia.
let cached = { stamp: null, index: new Map() };
export function installedFonts(dirs = fontDirs()) {
  const stamp = dirs.map((dir) => { try { return fs.statSync(dir).mtimeMs; } catch { return 0; } }).join('|');
  if (stamp === cached.stamp) return cached.index;
  blocked = new Set();
  const index = new Map();
  for (const file of dirs.flatMap((dir) => fontFiles(dir))) {
    for (const name of fontNames(file).map(same)) index.set(name, [...(index.get(name) || []), file]);
  }
  cached = { stamp, index };
  return index;
}

// Si el sistema no deja leer las letras que baja Office (en Mac, sin permiso; se sabe tras revisar las carpetas).
export const officeBlocked = () => [...blocked].some((dir) => /UBF8T346G9\.Office|FontCache/i.test(dir));

// Lo que necesita DeckCraft para una presentación: los archivos de las letras que usa y están instaladas
// (todos los de cada familia: negrita, cursiva…), y las que no se encuentran en ninguna parte. Un archivo repetido
// (mismo nombre y tamaño) va una vez: en Mac, Word, Excel y PowerPoint traen cada uno su copia de las mismas.
export function fontsFor(file, index = installedFonts()) {
  const { used, embedded } = deckFonts(file);
  const inside = new Set(embedded.map(same));
  const seen = new Set();
  let total = 0;
  const sent = [...new Set(used.flatMap((name) => index.get(same(name)) || []))].filter((f) => {
    const size = fs.statSync(f, { throwIfNoEntry: false })?.size || 0;
    const key = `${path.basename(f).toLowerCase()}:${size}`;
    if (!size || size > MAX_FONT || total + size > MAX_TOTAL || seen.has(key)) return false;
    seen.add(key);
    total += size;
    return true;
  });
  const missing = used.filter((name) => !index.has(same(name)) && !inside.has(same(name)));
  return { files: sent, missing };
}

// ---- Instalar una que falta, de un repositorio de letras libres ----
// Se busca, en orden, en Google Fonts (lo mismo que le pide una página web: su CSS, la versión 2, porque la 1 da algunas
// con otro nombre dentro), en Fontsource (las de Google y otras libres) y en Font Squirrel (libres para uso comercial).
// Cada archivo, solo de esos sitios y si de verdad es una letra con ese nombre dentro, se copia a la carpeta de letras
// de quien usa el equipo, sin pedir permisos de administrador. Las de Microsoft Office (Aptos, Jumble…) no están en
// ninguno. Font Squirrel a veces no contesta a un programa (se protege de los robots): entonces cuenta como que no la
// tiene. Solo para pruebas: MANNA_LETRAS_URL, un servidor de mentira que hace de los tres (scripts/lib/letra.mjs).
const OFFLINE = 'No se pudo llegar a los repositorios de letras. Comprueba que el equipo principal tiene internet y vuelve a intentarlo.';
const ZIP_LIMIT = 64 * 1024 ** 2;

export function userFontDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.MANNA_LETRAS) return env.MANNA_LETRAS;
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts');
  if (platform === 'darwin') return path.join(home, 'Library', 'Fonts');
  return path.join(home, '.local', 'share', 'fonts');
}

const isFont = (data) => ['00010000', '4f54544f', '74727565', '74746366'].includes(data.subarray(0, 4).toString('hex'));
// Para comparar nombres: «Chunk Five», «ChunkFive» y «chunk-five» son la misma.
const same = (name) => name.toLowerCase().replace(/[\s_-]+/g, '');
const compact = (family) => family.replace(/[^A-Za-z0-9]/g, '');

async function ask(url) {
  try {
    return await fetch(url, { headers: { 'User-Agent': 'Manna' }, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error(OFFLINE);
  }
}
async function bytes(url, limit = MAX_FONT) {
  const res = await ask(url);
  const data = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
  return data.length <= limit ? data : Buffer.alloc(0);
}

// Cada repositorio da los archivos que tiene de esa familia, [[nombre, datos]]; ninguno si no la tiene.
function sources(test = process.env.MANNA_LETRAS_URL) {
  const at = (real, part) => (test ? `${test}/${part}` : real);
  const origin = (real) => (test ? new URL(test).origin : real);
  // Cómo se llama su carpeta: «chunk-five» o «chunkfive» (también separando «ChunkFive»).
  const slugs = (family) => [...new Set([family.replace(/([a-z])([A-Z])/g, '$1 $2'), family].flatMap((f) => {
    const words = f.toLowerCase().match(/[a-z0-9]+/g) || [];
    return [words.join('-'), words.join('')];
  }).filter(Boolean))];
  return [
    async function google(family) {
      const res = await ask(`${at('https://fonts.googleapis.com', 'google')}/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400;1,700`);
      if (res.status === 400) return [];
      if (!res.ok) throw new Error(`Google Fonts no contesta ahora (respuesta ${res.status}).`);
      const files = [];
      for (const face of (await res.text()).split('@font-face').slice(1)) {
        const url = /url\((https?:[^)\s]+)\)/.exec(face)?.[1];
        if (!url?.startsWith(`${origin('https://fonts.gstatic.com')}/`)) continue;
        const style = `${/font-weight:\s*700/.test(face) ? 'Bold' : ''}${/font-style:\s*italic/.test(face) ? 'Italic' : ''}` || 'Regular';
        files.push([`${compact(family)}-${style}.ttf`, await bytes(url)]);
      }
      return files;
    },
    async function fontsource(family) {
      for (const slug of slugs(family)) {
        const res = await ask(`${at('https://api.fontsource.org/v1/fonts', 'fontsource')}/${slug}`);
        if (!res.ok) continue;
        const files = [];
        for (const [weight, styles] of Object.entries((await res.json())?.variants || {})) {
          for (const [style, subsets] of Object.entries(styles || {})) {
            // El juego «latin» basta para el español; con más, Windows vería dos letras con el mismo nombre.
            const url = subsets?.latin?.url?.ttf;
            if (typeof url === 'string' && url.startsWith(`${origin('https://cdn.jsdelivr.net')}/`)) {
              files.push([`${compact(family)}-${weight}${style === 'italic' ? 'Italic' : ''}.ttf`, await bytes(url)]);
            }
          }
        }
        if (files.length) return files;
      }
      return [];
    },
    async function fontSquirrel(family) {
      const base = at('https://www.fontsquirrel.com', 'fontsquirrel');
      for (const slug of slugs(family)) {
        const info = await ask(`${base}/api/familyinfo/${slug}`);
        const list = info.ok ? await info.json().catch(() => null) : null;
        if (!Array.isArray(list) || !list.length) continue;
        const packed = await bytes(`${base}/fonts/download/${slug}`, ZIP_LIMIT);
        if (!packed.length) continue;
        const work = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-letras-'));
        try {
          fs.writeFileSync(path.join(work, 'letras.zip'), packed);
          return [...readZip(path.join(work, 'letras.zip'), (name) => FONT_FILE.test(name) && !name.includes('__MACOSX'))].map(([name, data]) => [path.basename(name), data]);
        } catch {
          return [];
        } finally {
          fs.rmSync(work, { recursive: true, force: true });
        }
      }
      return [];
    },
  ];
}

// Los archivos instalados de esa familia; ninguno si no está en ningún repositorio.
export async function installFont(family, dir = userFontDir()) {
  if (!compact(family)) return [];
  let failed = null;
  for (const source of sources()) {
    let files;
    try {
      files = await source(family);
    } catch (err) {
      failed = err;
      continue;
    }
    const saved = [];
    for (const [name, data] of files) {
      if (!isFont(data) || data.length > MAX_FONT) continue;
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, path.basename(name));
      fs.writeFileSync(target, data);
      // Con otro nombre dentro (otra familia del mismo paquete) no la encontraría nadie: se quita.
      if (!fontNames(target).some((n) => same(n) === same(family))) {
        fs.rmSync(target, { force: true });
        continue;
      }
      saved.push(target);
      // En Windows, además, se apunta para quien usa el equipo: así la ven también PowerPoint y los demás programas.
      if (process.platform === 'win32' && !process.env.MANNA_LETRAS) {
        execFile('reg', ['add', 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', `${path.parse(target).name} (TrueType)`, '/t', 'REG_SZ', '/d', target, '/f'], { windowsHide: true }, () => {});
      }
    }
    if (saved.length) return saved;
  }
  if (failed) throw failed;
  return [];
}
