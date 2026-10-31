import fs from 'node:fs';
import zlib from 'node:zlib';

// Leer por dentro un PowerPoint (.pptx): las letras que usa (fuentes.js) y si algo se mueve (hasMotion).

// Un .pptx es un .zip: se leen solo las partes que se piden, sin cargar el archivo entero.
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


// Si alguna diapositiva tiene animaciones, transiciones, video o sonido: entonces se pasa «con animaciones» si nadie
// eligió otra cosa. Un archivo que no se puede leer cuenta como que no.
export function hasMotion(file) {
  try {
    const slides = readZip(file, (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    return [...slides.values()].some((data) => /<p:transition\b|<p:timing\b[\s\S]*?<p:par\b|<p:video\b|<p:audio\b|<a:videoFile\b|<a:audioFile\b/.test(data.toString('utf8')));
  } catch {
    return false;
  }
}

// ---- Escribir un .pptx: lo mínimo que PowerPoint y DeckCraft aceptan (un patrón, un diseño y un tema) ----
export const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
export const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const TREE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

export const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Manna"><a:themeElements><a:clrScheme name="Manna"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Manna"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Manna"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
export const MASTER = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${TREE}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4000"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
export const LAYOUT = `${HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="En blanco"><p:spTree>${TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
export const rels = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith('http') ? type : `${REL}/${type}`}" Target="${target}"/>`).join('')}</Relationships>`;
export const CONTENT_TYPES = (slides, extra = '') => `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${extra}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${Array.from({ length: slides }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`;

// Un .zip con la suma de comprobación de cada archivo (PowerPoint y DeckCraft la comprueban). Lo que ya viene comprimido
// (imágenes) va tal cual: comprimirlo otra vez gasta tiempo y no gana nada.
export function writeZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [fileName, text] of files) {
    const name = Buffer.from(fileName);
    const raw = Buffer.from(text);
    const stored = /\.(png|jpe?g|gif)$/i.test(fileName);
    const data = stored ? raw : zlib.deflateRawSync(raw);
    const method = stored ? 0 : 8;
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, name, data);
    central.push(entry, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((total, b) => total + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
