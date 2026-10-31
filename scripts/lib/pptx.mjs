import { CONTENT_TYPES, HEAD, LAYOUT, MASTER, NS, rels, THEME, TREE, writeZip } from '../../server/modules/slides/pptx.js';

// Hace una presentación de PowerPoint (.pptx) para las pruebas, sin depender de ninguna guardada en el repositorio: lo
// mínimo que PowerPoint y DeckCraft aceptan (un patrón, un diseño, un tema y las diapositivas), con un recuadro de color
// y un texto en cada una. Una diapositiva con `hidden` va oculta (show="0"); con `transition`, entra con un fundido; con `font`, su texto lleva esa letra (si
// no, Arial). `embedded`: las letras que trae dentro, cada una con su parte (solo la cabecera EOT, sin la letra), comprimida
// como la guarda PowerPoint (MicroType Express) si lleva `compressed`.
//
//   makePptx([{ text: 'Uno' }, { text: 'Dos', hidden: true }, { text: 'Tres', font: 'Otra' }], { embedded: [{ name: 'Otra' }] })  -> Buffer
const COLORS = ['2E75B6', 'C55A11', '548235', '7030A0', 'BF8F00'];
const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slide({ text = '', hidden = false, font = 'Arial', transition = false }, i) {
  const box = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Texto"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1500000" y="2500000"/><a:ext cx="9000000" cy="1800000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${COLORS[i % COLORS.length]}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="es-CO" sz="3200"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${escape(font)}"/></a:rPr><a:t>${escape(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
  return `${HEAD}<p:sld ${NS}${hidden ? ' show="0"' : ''}><p:cSld><p:spTree>${TREE}${box}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transition ? '<p:transition spd="med"><p:fade/></p:transition>' : ''}</p:sld>`;
}

export function makePptx(slides, { embedded = [] } = {}) {
  const n = slides.length;
  const types = CONTENT_TYPES(n, '<Default Extension="fntdata" ContentType="application/x-fontdata"/>');
  const presentation = `${HEAD}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>${embedded.length ? `<p:embeddedFontLst>${embedded.map((f, i) => `<p:embeddedFont><p:font typeface="${escape(f.name)}"/><p:regular r:id="rIdFont${i + 1}"/></p:embeddedFont>`).join('')}</p:embeddedFontLst>` : ''}</p:presentation>`;
  // La cabecera EOT de cada una: sus marcas en el byte 12 (4: MicroType Express) y la firma 0x504C en el 34.
  const eot = (f) => { const b = Buffer.alloc(82); b.writeUInt32LE(0x00020001, 8); b.writeUInt32LE(f.compressed ? 4 : 0, 12); b.writeUInt16LE(0x504c, 34); return b; };
  const files = [
    ['[Content_Types].xml', types],
    ['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
    ['ppt/presentation.xml', presentation],
    ['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml'], ...slides.map((_, i) => [`rId${10 + i}`, 'slide', `slides/slide${i + 1}.xml`]), ...embedded.map((_, i) => [`rIdFont${i + 1}`, 'font', `fonts/font${i + 1}.fntdata`])])],
    ...embedded.map((f, i) => [`ppt/fonts/font${i + 1}.fntdata`, eot(f)]),
    ['ppt/slideMasters/slideMaster1.xml', MASTER],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])],
    ['ppt/slideLayouts/slideLayout1.xml', LAYOUT],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
    ['ppt/theme/theme1.xml', THEME],
    ...slides.flatMap((s, i) => [[`ppt/slides/slide${i + 1}.xml`, slide(s, i)], [`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']])]]),
  ];
  if (!n) throw new Error('Una presentación necesita alguna diapositiva.');
  return writeZip(files);
}

export { writeZip as zip };
