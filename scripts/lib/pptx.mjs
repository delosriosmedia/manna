import zlib from 'node:zlib';

// Hace una presentación de PowerPoint (.pptx) para las pruebas, sin depender de ninguna guardada en el repositorio: lo
// mínimo que PowerPoint y DeckCraft aceptan (un patrón, un diseño, un tema y las diapositivas), con un recuadro de color
// y un texto en cada una. Una diapositiva con `hidden` va oculta (show="0"); con `font`, su texto lleva esa letra (si
// no, Arial). `embedded`: las letras que dice traer dentro (solo la lista, sin los archivos).
//
//   makePptx([{ text: 'Uno' }, { text: 'Dos', hidden: true }, { text: 'Tres', font: 'Otra' }], { embedded: ['Otra'] })  -> Buffer
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const TREE = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const COLORS = ['2E75B6', 'C55A11', '548235', '7030A0', 'BF8F00'];
const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Prueba"><a:themeElements><a:clrScheme name="Prueba"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Prueba"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Prueba"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const MASTER = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${TREE}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4000"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
const LAYOUT = `${HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="En blanco"><p:spTree>${TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const rels = (list) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith('http') ? type : `${REL}/${type}`}" Target="${target}"/>`).join('')}</Relationships>`;

function slide({ text = '', hidden = false, font = 'Arial' }, i) {
  const box = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Texto"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1500000" y="2500000"/><a:ext cx="9000000" cy="1800000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${COLORS[i % COLORS.length]}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="es-CO" sz="3200"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${escape(font)}"/></a:rPr><a:t>${escape(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
  return `${HEAD}<p:sld ${NS}${hidden ? ' show="0"' : ''}><p:cSld><p:spTree>${TREE}${box}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export function makePptx(slides, { embedded = [] } = {}) {
  const n = slides.length;
  const types = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`;
  const presentation = `${HEAD}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>${embedded.length ? `<p:embeddedFontLst>${embedded.map((f) => `<p:embeddedFont><p:font typeface="${escape(f)}"/></p:embeddedFont>`).join('')}</p:embeddedFontLst>` : ''}</p:presentation>`;
  const files = [
    ['[Content_Types].xml', types],
    ['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
    ['ppt/presentation.xml', presentation],
    ['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml'], ...slides.map((_, i) => [`rId${10 + i}`, 'slide', `slides/slide${i + 1}.xml`])])],
    ['ppt/slideMasters/slideMaster1.xml', MASTER],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])],
    ['ppt/slideLayouts/slideLayout1.xml', LAYOUT],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
    ['ppt/theme/theme1.xml', THEME],
    ...slides.flatMap((s, i) => [[`ppt/slides/slide${i + 1}.xml`, slide(s, i)], [`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']])]]),
  ];
  if (!n) throw new Error('Una presentación necesita alguna diapositiva.');
  return zip(files);
}

// Un .zip con deflate y la suma de comprobación de cada archivo (PowerPoint y DeckCraft la comprueban).
function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [fileName, text] of files) {
    const name = Buffer.from(fileName);
    const raw = Buffer.from(text);
    const data = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
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
