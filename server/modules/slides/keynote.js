import fs from 'node:fs';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { bool, float, floats, ints, msg, msgs, readObjects, ref, refs, text, val } from './iwa.js';
import { CONTENT_TYPES, HEAD, LAYOUT, MASTER, NS, readZip, rels, THEME, TREE, writeZip } from './pptx.js';

// Keynote a PowerPoint: lee un .key y escribe un .pptx con lo mismo en el mismo sitio (formas, textos, imágenes, grupos y
// fondos). Lo demás de Manna (DeckCraft, las letras que faltan, la nube) lo recibe como un PowerPoint más y no se entera.
// No hace falta Keynote, que no existe en Windows. Los números de campo son los del formato (protobuf; ver iwa.js).
//
// Lo que no se traduce (un gráfico, una tabla, un video sin imagen) sale de la miniatura que Keynote guarda de cada
// diapositiva, de 356 × 200: se ve, con menos nitidez, y se avisa (`soft`, los números de esas diapositivas). Las animaciones y
// las transiciones no se conservan: de cada diapositiva queda cómo acaba.

const T = { SHOW: 2, PLACEHOLDER: 7, STORAGE: 2001, SHAPE_INFO: 2011, TEXT_SHAPE_STYLE: 2025, NUMBER: 2043, SHAPE: 3004, IMAGE: 3005, MASK: 3006, MOVIE: 3007, GROUP: 3008, LINE: 3009, PACKAGE: 11006 };
const SKIP_FILES = /\.(mov|mp4|m4v|m4a|mp3|aac|wav)$/i;
// Lo que un .pptx no puede llevar como imagen.
const NOT_RASTER = /\.(heic|heif|pdf)$/i;
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp' };

const emu = (pt) => Math.round((pt || 0) * 12700);
const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const hex = (x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0').toUpperCase();
const percent = (x) => Math.round(x * 100000);
const NO_FILL = '<a:noFill/>';
const NO_LINE = '<a:ln><a:noFill/></a:ln>';
const RECT = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
const custom = (w, h, path) => `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom>`;
const pointXml = (p) => `<a:pt x="${emu(float(p, 1))}" y="${emu(float(p, 2))}"/>`;

// «MulishRoman-Bold» -> { family: 'Mulish', bold: true, italic: false }: Keynote guarda el nombre PostScript de la letra.
export function fontOf(name) {
  if (!name || name.startsWith('.')) return null; // la letra del sistema de Apple
  const cut = name.lastIndexOf('-');
  const base = (cut > 0 ? name.slice(0, cut) : name).replace(/(PS)?MT$|PS$/, '');
  const style = (cut > 0 ? name.slice(cut + 1) : '').replace(/MT$/, '');
  const family = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/(?<!New) Roman$/, '');
  const plain = style.replace(/Italic|Oblique/i, '');
  const bold = /^bold$/i.test(plain);
  const weight = bold || !plain || /^(regular|roman|normal)$/i.test(plain) ? '' : plain;
  return { family: weight ? `${family} ${weight}` : family, bold, italic: /italic|oblique/i.test(style) };
}

function colorXml(c, opacity = 1) {
  if (!c) return '<a:srgbClr val="000000"/>';
  const model = val(c, 1);
  let r;
  let g;
  let b;
  if (model === 3) r = g = b = float(c, 11) ?? 0;
  else if (model === 2) {
    const k = float(c, 10) ?? 0;
    [r, g, b] = [7, 8, 9].map((f) => (1 - (float(c, f) ?? 0)) * (1 - k));
  } else [r, g, b] = [3, 4, 5].map((f) => float(c, f) ?? 0);
  const alpha = (float(c, 6) ?? 1) * opacity;
  return `<a:srgbClr val="${hex(r)}${hex(g)}${hex(b)}">${alpha < 0.999 ? `<a:alpha val="${percent(alpha)}"/>` : ''}</a:srgbClr>`;
}

function lineEnd(tag, end) {
  const id = text(end, 5) || '';
  if (!end || /none/i.test(id) || (!id && !msg(end, 1))) return '';
  return `<a:${tag} type="${/circle/i.test(id) ? 'oval' : /square|diamond/i.test(id) ? 'diamond' : 'triangle'}"/>`;
}
function lineXml(stroke, opacity = 1, head = null, tail = null) {
  const width = float(stroke, 2) ?? 0;
  const pattern = msg(stroke, 6);
  const color = msg(stroke, 1);
  if (!stroke || !width || !color || val(pattern, 1) === 2) return NO_LINE;
  const dash = val(pattern, 1) === 0 && (val(pattern, 3) ?? 0) > 0 ? '<a:prstDash val="dash"/>' : '';
  return `<a:ln w="${emu(width)}"${val(stroke, 3) === 1 ? ' cap="rnd"' : ''}><a:solidFill>${colorXml(color, opacity)}</a:solidFill>${dash}${lineEnd('headEnd', head)}${lineEnd('tailEnd', tail)}</a:ln>`;
}
function shadowXml(shadow) {
  const color = msg(shadow, 1);
  if (!color || bool(shadow, 6) === false) return ''; // un mensaje vacío quiere decir «sin sombra»
  const dir = ((-(float(shadow, 2) ?? 315) % 360) + 360) % 360;
  return `<a:effectLst><a:outerShdw blurRad="${emu(val(shadow, 4) ?? 1)}" dist="${emu(Math.max(0, float(shadow, 3) ?? 5))}" dir="${Math.round(dir * 60000)}" algn="ctr" rotWithShape="0">${colorXml(color, float(shadow, 5) ?? 1)}</a:outerShdw></a:effectLst>`;
}

function pathXml(elements) {
  const TAGS = { 1: 'moveTo', 2: 'lnTo', 3: 'quadBezTo', 4: 'cubicBezTo' };
  return elements.map((e) => {
    const type = val(e, 1);
    if (type === 5) return '<a:close/>';
    return TAGS[type] ? `<a:${TAGS[type]}>${msgs(e, 2).map(pointXml).join('')}</a:${TAGS[type]}>` : '';
  }).join('');
}
// La forma, por su fuente de trazado: en su espacio natural, que el .pptx escala igual que Keynote.
function geomXml(source, w, h) {
  const scalar = msg(source, 4);
  if (scalar) {
    const type = val(scalar, 1) ?? 0;
    const value = float(scalar, 2) ?? 0;
    if (type === 2) return '<a:prstGeom prst="chevron"><a:avLst/></a:prstGeom>';
    if (type === 0) {
      if (value <= 0) return RECT;
      return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, percent(value / (Math.min(w, h) || 1)))}"/></a:avLst></a:prstGeom>`;
    }
    const sides = Math.max(3, Math.round(value));
    const corner = (i) => {
      const angle = -Math.PI / 2 + i * 2 * Math.PI / sides;
      return `<a:pt x="${emu((w / 2) * (1 + Math.cos(angle)))}" y="${emu((h / 2) * (1 + Math.sin(angle)))}"/>`;
    };
    return custom(w, h, `<a:moveTo>${corner(0)}</a:moveTo>${Array.from({ length: sides - 1 }, (_, i) => `<a:lnTo>${corner(i + 1)}</a:lnTo>`).join('')}<a:close/>`);
  }
  const point = msg(source, 3);
  if (point) {
    const prst = { 0: 'leftArrow', 1: 'rightArrow', 10: 'leftRightArrow', 100: 'star5', 200: 'mathPlus' }[val(point, 1) ?? 0] || 'rect';
    return `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>`;
  }
  const bezier = msg(source, 5) || msg(msg(source, 7), 1);
  if (msg(bezier, 3)) {
    const natural = msg(bezier, 2);
    return custom(float(natural, 1) || w || 1, float(natural, 2) || h || 1, pathXml(msgs(msg(bezier, 3), 1)));
  }
  const editable = msg(source, 8);
  if (editable) {
    const natural = msg(editable, 2);
    const curve = (a, b) => `<a:cubicBezTo>${pointXml(msg(a, 3))}${pointXml(msg(b, 1))}${pointXml(msg(b, 2))}</a:cubicBezTo>`;
    const paths = msgs(editable, 1).map((sub) => {
      const nodes = msgs(sub, 1);
      if (!nodes.length) return '';
      const open = `<a:moveTo>${pointXml(msg(nodes[0], 2))}</a:moveTo>${nodes.slice(1).map((n, i) => curve(nodes[i], n)).join('')}`;
      return bool(sub, 2) ? `${open}${curve(nodes[nodes.length - 1], nodes[0])}<a:close/>` : open;
    }).join('');
    return custom(float(natural, 1) || w || 1, float(natural, 2) || h || 1, paths);
  }
  return RECT;
}

const geometry = (drawable) => {
  const g = msg(drawable, 1);
  const position = msg(g, 1);
  const size = msg(g, 2);
  return { x: float(position, 1) ?? 0, y: float(position, 2) ?? 0, w: float(size, 1) ?? 0, h: float(size, 2) ?? 0, flags: val(g, 3) ?? 3, angle: float(g, 4) ?? 0 };
};
// Los bits de la geometría: 1, el ancho vale; 2, el alto vale; 4 y 8, volteada. Keynote gira al revés que PowerPoint.
function xfrm(g, extra = '') {
  const rotation = ((-g.angle % 360) + 360) % 360;
  return `<a:xfrm${rotation > 0.001 ? ` rot="${Math.round(rotation * 60000)}"` : ''}${g.flags & 4 ? ' flipH="1"' : ''}${g.flags & 8 ? ' flipV="1"' : ''}><a:off x="${emu(g.x)}" y="${emu(g.y)}"/><a:ext cx="${emu(g.w)}" cy="${emu(g.h)}"/>${extra}</a:xfrm>`;
}

// Cuánto ocupa un texto, sin tener las letras a mano: un ancho medio por clase de letra. Solo para decidir cuánto encoger.
const glyph = (ch) => (/[A-ZÁÉÍÓÚÑ]/.test(ch) ? 0.68 : /[mwMW]/.test(ch) ? 0.8 : /[iljtfr.,:;'’!¡|]/.test(ch) ? 0.3 : /\d/.test(ch) ? 0.56 : 0.53);
function textHeight(paragraphs, width, k) {
  let total = 0;
  for (const p of paragraphs) {
    const room = Math.max(10, width - p.margin);
    let x = 0;
    let tallest = 0;
    let sum = 0;
    for (const word of p.words) {
      const w = word.width * word.size * k;
      if (x && x + w > room) {
        sum += tallest;
        tallest = 0;
        x = 0;
      }
      x += w + word.space * word.size * k;
      tallest = Math.max(tallest, word.size * k);
    }
    sum += tallest || p.size * k;
    total += sum * 1.2 * p.ratio + (p.before + p.after) * k;
  }
  return total;
}

export function keynoteToPptx(file) {
  const parts = readZip(file, (name) => !SKIP_FILES.test(name));
  if (!parts.has('Index/Document.iwa')) throw new Error('No trae Index/Document.iwa: con contraseña, o de una versión muy antigua.');
  const objects = readObjects(parts);
  const get = (id) => objects.get(id);
  const list = [...objects.values()];
  const show = list.find((o) => o.type === T.SHOW);
  if (!show) throw new Error('No trae la presentación.');
  const size = msg(show.data, 4);
  const W = float(size, 1) || 1024;
  const H = float(size, 2) || 768;

  // Los archivos de Data/, por su identificador: lo dice el paquete; si no, va al final del nombre.
  const dataFiles = new Map();
  for (const name of parts.keys()) {
    const m = /^Data\/.*-(\d+)\.[^.]+$/.exec(name);
    if (m) dataFiles.set(Number(m[1]), name);
  }
  for (const d of msgs(list.find((o) => o.type === T.PACKAGE)?.data, 4)) {
    const name = `Data/${text(d, 4) || text(d, 3)}`;
    if (parts.has(name)) dataFiles.set(val(d, 1), name);
  }

  // Lo que un estilo no dice, lo dice su padre. El padre está en TSS.StyleArchive: el campo 1, o el 1 del 1 en una forma con texto.
  function inherit(id, read) {
    for (let i = 0; id !== undefined && i < 64; i += 1) {
      const style = get(id);
      if (!style) return undefined;
      const value = read(style.data, style);
      if (value !== undefined) return value;
      id = ref(style.type === T.TEXT_SHAPE_STYLE ? msg(msg(style.data, 1), 1) : msg(style.data, 1), 3);
    }
    return undefined;
  }
  const charProp = (ids, read) => {
    for (const id of ids) {
      const value = inherit(id, (d) => { const p = msg(d, 11); return p ? read(p) : undefined; });
      if (value !== undefined) return value;
    }
    return undefined;
  };
  const paraProp = (id, read) => inherit(id, (d) => { const p = msg(d, 12); return p ? read(p) : undefined; });
  // De una forma: sus propiedades de dibujo; con texto, van un nivel más adentro.
  const drawProp = (id, read) => inherit(id, (d, style) => { const p = msg(style.type === T.TEXT_SHAPE_STYLE ? msg(d, 1) : d, 11); return p ? read(p) : undefined; });
  const layoutProp = (id, read) => inherit(id, (d, style) => { const p = style.type === T.TEXT_SHAPE_STYLE ? msg(d, 11) : null; return p ? read(p) : undefined; });
  const ownProp = (id, read) => inherit(id, (d) => { const p = msg(d, 11); return p ? read(p) : undefined; });

  const media = new Map();
  const slides = [];
  const soft = [];

  function makeSlide(node, page) {
    let nextId = 2;
    const links = new Map();
    const overlays = [];
    const nameTag = () => `<p:cNvPr id="${nextId++}" name=""/>`;
    const thumbnail = val(msg(node.data, 16), 1);
    // Una imagen de Data/ en esta diapositiva: su enlace, o null si no está.
    const link = (dataId) => {
      const name = dataFiles.get(dataId);
      if (!name) return null;
      const target = `${dataId}.${/\.([^.]+)$/.exec(name)?.[1].toLowerCase() || 'png'}`;
      if (!media.has(target)) media.set(target, parts.get(name));
      if (!links.has(target)) links.set(target, `rId${links.size + 2}`);
      return links.get(target);
    };

    function fillXml(fill, opacity = 1, w = 0, h = 0) {
      const color = msg(fill, 1);
      if (color) return `<a:solidFill>${colorXml(color, opacity)}</a:solidFill>`;
      const gradient = msg(fill, 2);
      const stops = msgs(gradient, 2);
      if (stops.length) {
        const all = (float(gradient, 3) ?? 1) * opacity;
        const list2 = stops.map((s) => `<a:gs pos="${percent(float(s, 2) ?? 0)}">${colorXml(msg(s, 1), all)}</a:gs>`).join('');
        if (val(gradient, 1) === 1) return `<a:gradFill rotWithShape="1"><a:gsLst>${list2}</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>`;
        const byAngle = msg(gradient, 5);
        const span = msg(gradient, 6);
        let angle = 0;
        if (byAngle) angle = -(float(byAngle, 2) ?? 0) * 180 / Math.PI;
        else if (span) {
          const [a, b] = [msg(span, 1), msg(span, 2)];
          angle = Math.atan2((float(b, 2) ?? 0) - (float(a, 2) ?? 0), (float(b, 1) ?? 0) - (float(a, 1) ?? 0)) * 180 / Math.PI;
        }
        return `<a:gradFill rotWithShape="1"><a:gsLst>${list2}</a:gsLst><a:lin ang="${Math.round((((angle % 360) + 360) % 360) * 60000)}" scaled="0"/></a:gradFill>`;
      }
      const image = msg(fill, 3);
      const id = image && link(val(msg(image, 6), 1) ?? val(msg(image, 7), 1));
      if (!id) return NO_FILL;
      const technique = val(image, 2) ?? 0;
      const natural = msg(image, 4);
      const [nw, nh] = [float(natural, 1) || 0, float(natural, 2) || 0];
      let crop = '';
      // «Llenar a escala»: se recorta lo que sobra, en vez de deformarla.
      if (technique === 3 && nw && nh && w && h) {
        const scale = Math.max(w / nw, h / nh);
        const [cx, cy] = [(1 - w / scale / nw) / 2, (1 - h / scale / nh) / 2];
        crop = `<a:srcRect l="${percent(cx)}" t="${percent(cy)}" r="${percent(cx)}" b="${percent(cy)}"/>`;
      }
      const mode = technique === 2 ? '<a:tile tx="0" ty="0" sx="100000" sy="100000" flip="none" algn="tl"/>' : '<a:stretch><a:fillRect/></a:stretch>';
      return `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${id}">${opacity < 0.999 ? `<a:alphaModFix amt="${percent(opacity)}"/>` : ''}</a:blip>${crop}${mode}</a:blipFill>`;
    }

    function runProps(styles, k, opacity) {
      const pick = (read) => charProp(styles, read);
      const font = fontOf(pick((p) => (bool(p, 4) ? undefined : text(p, 5))));
      const points = (pick((p) => float(p, 3)) ?? 18) * k;
      const attrs = ['lang="es-CO"', `sz="${Math.max(100, Math.min(400000, Math.round(points * 100)))}"`,
        `b="${font?.bold || pick((p) => bool(p, 1)) ? 1 : 0}"`, `i="${font?.italic || pick((p) => bool(p, 2)) ? 1 : 0}"`];
      if (pick((p) => val(p, 11))) attrs.push('u="sng"');
      if (pick((p) => val(p, 12))) attrs.push('strike="sngStrike"');
      const caps = pick((p) => val(p, 13));
      if (caps === 1) attrs.push('cap="all"');
      else if (caps === 2) attrs.push('cap="small"');
      const script = pick((p) => val(p, 10));
      if (script === 1) attrs.push('baseline="30000"');
      else if (script === 2) attrs.push('baseline="-25000"');
      const tracking = pick((p) => float(p, 27));
      if (tracking) attrs.push(`spc="${Math.max(-400000, Math.min(400000, Math.round(tracking * points * 100)))}"`);
      // El orden es el que pide el formato: contorno, relleno, sombra, resaltado y letra.
      const outline = pick((p) => (bool(p, 43) ? undefined : msg(p, 44) ?? undefined));
      const color = pick((p) => (bool(p, 6) ? undefined : msg(p, 7) ?? undefined));
      const fill = pick((p) => (bool(p, 45) ? undefined : msg(p, 46) ?? undefined));
      const shadow = pick((p) => (bool(p, 20) ? undefined : msg(p, 21) ?? undefined));
      const mark = pick((p) => (bool(p, 25) ? undefined : msg(p, 26) ?? undefined));
      const paint = fill && msg(fill, 2) ? fillXml(fill, opacity) : color ? `<a:solidFill>${colorXml(color, opacity)}</a:solidFill>` : fill ? fillXml(fill, opacity) : '';
      const face = font?.family ? `<a:latin typeface="${escapeXml(font.family)}"/><a:ea typeface="${escapeXml(font.family)}"/><a:cs typeface="${escapeXml(font.family)}"/>` : '';
      const edge = outline && lineXml(outline) !== NO_LINE ? lineXml(outline) : '';
      return { attrs: attrs.join(' '), inner: `${edge}${paint}${shadow ? shadowXml(shadow) : ''}${mark ? `<a:highlight>${colorXml(mark)}</a:highlight>` : ''}${face}`, points, heavy: attrs[2] === 'b="1"' };
    }

    function paragraphsXml(storage, { k = 1, opacity = 1, fallback } = {}) {
      const all = (storage.get(3) || []).map((b) => b.toString('utf8')).join('');
      const table = (field) => msgs(msg(storage, field), 1).map((e) => ({ at: val(e, 1) ?? 0, ref: ref(e, 2) }));
      const [paraStyles, charStyles, listStyles, attachments] = [table(5), table(8), table(7), table(9)];
      const levels = msgs(msg(storage, 6), 1).map((e) => ({ at: val(e, 1) ?? 0, level: val(e, 2) ?? 0 }));
      const entryAt = (rows, i) => {
        let found;
        for (const row of rows) {
          if (row.at > i) break;
          found = row;
        }
        return found;
      };
      // Un párrafo sin estilo sigue con el anterior.
      const paraStyleAt = (i) => {
        let found = fallback;
        for (const row of paraStyles) {
          if (row.at > i) break;
          if (row.ref !== undefined) found = row.ref;
        }
        return found;
      };
      const out = [];
      const metrics = [];
      let shown = '';
      for (let a = 0, b = 0; b <= all.length; b += 1) {
        if (b < all.length && all[b] !== '\n' && all[b] !== '\u2029') continue;
        const style = paraStyleAt(a);
        const pad = (read) => paraProp(style, read);
        const left = pad((p) => float(p, 11)) ?? 0;
        const right = pad((p) => float(p, 19)) ?? 0;
        const before = pad((p) => float(p, 21)) ?? 0;
        const after = pad((p) => float(p, 20)) ?? 0;
        const spacing = pad((p) => msg(p, 13) ?? undefined);
        let marL = left;
        let indent = (pad((p) => float(p, 7)) ?? 0) - left;
        let bullet = '<a:buNone/>';
        const listDef = get(entryAt(listStyles, a)?.ref ?? pad((p) => ref(p, 40)))?.data;
        if (listDef) {
          const level = entryAt(levels, a)?.level ?? 0;
          const labels = ints(listDef, 11);
          const label = labels[level] ?? labels.at(-1) ?? 0;
          const outer = floats(listDef, 13)[level] ?? 0;
          const inner = floats(listDef, 12)[level] ?? 0;
          if (label === 2) {
            const strings = (listDef.get(16) || []).map((v) => v.toString('utf8'));
            bullet = `<a:buFont typeface="Arial"/><a:buChar char="${escapeXml(strings[level] ?? strings.at(-1) ?? '•')}"/>`;
          } else if (label === 3) {
            const AUTO = { 2: 'arabicParenR', 3: 'romanUcPeriod', 5: 'romanUcParenR', 6: 'romanLcPeriod', 8: 'romanLcParenR', 9: 'alphaUcPeriod', 11: 'alphaUcParenR', 12: 'alphaLcPeriod', 14: 'alphaLcParenR' };
            bullet = `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="${AUTO[ints(listDef, 15)[level]] || 'arabicPeriod'}"/>`;
          }
          marL = left + outer + (label ? inner : 0);
          if (label) indent = -inner;
        }
        const align = { 0: 'l', 1: 'r', 2: 'ctr', 3: 'just' }[pad((p) => val(p, 1))];
        const attrs = [`${align ? `algn="${align}" ` : ''}marL="${emu(Math.max(0, marL))}" indent="${emu(indent)}"`, right ? `marR="${emu(Math.max(0, right))}"` : ''].filter(Boolean).join(' ');
        let inner = '';
        if (spacing) {
          const mode = val(spacing, 1) ?? 0;
          const amount = float(spacing, 2) ?? 1;
          if (mode === 0) inner += `<a:lnSpc><a:spcPct val="${percent(amount)}"/></a:lnSpc>`;
          else if (mode !== 4) inner += `<a:lnSpc><a:spcPts val="${Math.max(0, Math.round(amount * k * 100))}"/></a:lnSpc>`;
        }
        inner += `<a:spcBef><a:spcPts val="${Math.max(0, Math.round(before * k * 100))}"/></a:spcBef><a:spcAft><a:spcPts val="${Math.max(0, Math.round(after * k * 100))}"/></a:spcAft>${bullet}`;
        // Cada trozo con su estilo de carácter; un salto de línea dentro del párrafo es <a:br>.
        const words = [];
        let tallest = 0;
        let runs = '';
        const flush = (from, to) => {
          if (to <= from) return;
          let piece = '';
          for (let i = from; i < to; i += 1) {
            if (all[i] !== '\uFFFC') piece += all[i];
            else if (get(attachments.find((row) => row.at === i)?.ref)?.type === T.NUMBER) piece += String(page);
          }
          const props = runProps([entryAt(charStyles, from)?.ref, style].filter((x) => x !== undefined), k, opacity);
          tallest = Math.max(tallest, props.points);
          shown += piece;
          for (const m of piece.matchAll(/(\S+)(\s*)/g)) words.push({ width: [...m[1]].reduce((sum, c) => sum + glyph(c), 0) * (props.heavy ? 1.07 : 1), space: 0.28 * m[2].length, size: props.points / k });
          piece.split(/[\u2028\u000b]/).forEach((line, i) => {
            if (i) runs += `<a:br><a:rPr ${props.attrs}>${props.inner}</a:rPr></a:br>`;
            if (line) runs += `<a:r><a:rPr ${props.attrs}>${props.inner}</a:rPr><a:t>${escapeXml(line)}</a:t></a:r>`;
          });
        };
        let cut = a;
        for (const row of charStyles) {
          if (row.at <= a || row.at >= b) continue;
          flush(cut, row.at);
          cut = row.at;
        }
        flush(cut, b);
        const end = runProps([entryAt(charStyles, Math.max(a, b - 1))?.ref, style].filter((x) => x !== undefined), k, opacity);
        metrics.push({ size: (tallest || end.points) / k, words, margin: Math.max(0, marL) + Math.max(0, right), ratio: spacing && (val(spacing, 1) ?? 0) === 0 ? float(spacing, 2) ?? 1 : 1, before, after });
        out.push(`<a:p><a:pPr ${attrs}>${inner}</a:pPr>${runs}<a:endParaRPr ${end.attrs}>${end.inner}</a:endParaRPr></a:p>`);
        a = b + 1;
      }
      return { xml: out.join(''), shown, metrics };
    }

    function shape(o) {
      const info = o.type === T.PLACEHOLDER ? msg(o.data, 1) : o.data;
      const withText = o.type === T.PLACEHOLDER || o.type === T.SHAPE_INFO;
      const body = withText || o.type === T.LINE ? msg(info, 1) : info;
      const g = geometry(msg(body, 1));
      const style = ref(body, 2);
      const opacity = drawProp(style, (p) => float(p, 3)) ?? 1;
      const source = msg(body, 3);
      if (bool(source, 1)) g.flags |= 4;
      if (bool(source, 2)) g.flags |= 8;
      let txBody = '';
      const storage = withText ? get(ref(info, 4)) ?? get(ref(info, 3)) : null;
      if (storage?.type === T.STORAGE) {
        const fallback = layoutProp(style, (p) => ref(p, 10));
        let paragraphs = paragraphsXml(storage.data, { opacity, fallback });
        if (paragraphs.shown.trim()) {
          const padding = layoutProp(style, (p) => msg(p, 6) ?? undefined);
          const [li, ti, ri, bi] = [1, 2, 3, 4].map((f) => float(padding, f) ?? 4);
          const anchor = layoutProp(style, (p) => val(p, 2));
          const usable = Math.max(10, g.w - li - ri);
          let k = 1;
          if (!(g.flags & 2) || !g.h) {
            // Sin alto, Keynote lo calcula al dibujar, y su «y» es por donde se ancla: arriba, al centro o abajo.
            const height = textHeight(paragraphs.metrics, usable, 1) + ti + bi;
            if (anchor === 1) g.y -= height / 2;
            else if (anchor === 2) g.y -= height;
            g.h = height;
          } else if (layoutProp(style, (p) => bool(p, 1))) {
            // «Encoger para que quepa»: se escribe ya encogido, porque no todo lo que dibuja un .pptx lo calcula.
            while (k > 0.3 && textHeight(paragraphs.metrics, usable, k) > g.h - ti - bi) k -= 0.02;
            if (k < 1) paragraphs = paragraphsXml(storage.data, { k, opacity, fallback });
          }
          const wrap = (g.flags & 1) && g.w ? 'square' : 'none';
          // Con interlineado menor que 1, un .pptx sube también la primera línea; Keynote, no.
          const first = paragraphs.metrics[0];
          const lift = Math.max(0, 1 - first.ratio) * first.size * k * 1.2;
          txBody = `<p:txBody><a:bodyPr wrap="${wrap}" lIns="${emu(li)}" tIns="${emu(ti + lift)}" rIns="${emu(ri)}" bIns="${emu(bi)}" rtlCol="0" anchor="${{ 1: 'ctr', 2: 'b' }[anchor] || 't'}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs.xml}</p:txBody>`;
        }
      }
      const fill = drawProp(style, (p) => msg(p, 1) ?? undefined);
      const stroke = drawProp(style, (p) => msg(p, 2) ?? undefined);
      const fillPart = fillXml(fill, opacity, g.w, g.h);
      const linePart = lineXml(stroke, opacity, drawProp(style, (p) => msg(p, 6) ?? undefined), drawProp(style, (p) => msg(p, 7) ?? undefined));
      if (!txBody && fillPart === NO_FILL && linePart === NO_LINE) return '';
      return `<p:sp><p:nvSpPr>${nameTag()}<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(g)}${geomXml(source, g.w, g.h)}${fillPart}${linePart}${shadowXml(drawProp(style, (p) => msg(p, 4) ?? undefined))}</p:spPr>${txBody || '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="es-CO"/></a:p></p:txBody>'}</p:sp>`;
    }

    // Lo que no se traduce: ese trozo de la miniatura, encima de todo (ya trae dibujado lo que tuviera encima).
    function fromThumbnail(drawable, origin) {
      const id = link(thumbnail);
      if (!soft.includes(page)) soft.push(page);
      if (!id) return '';
      const g = geometry(drawable);
      const [x, y] = [g.x + (origin.x || 0), g.y + (origin.y || 0)];
      overlays.push(`<p:pic><p:nvPicPr>${nameTag()}<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${id}"/><a:srcRect l="${percent(x / W)}" t="${percent(y / H)}" r="${percent(1 - (x + g.w) / W)}" b="${percent(1 - (y + g.h) / H)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(g.w)}" cy="${emu(g.h)}"/></a:xfrm>${RECT}</p:spPr></p:pic>`);
      return '';
    }

    function picture(o, origin) {
      if (o.type === T.MOVIE && bool(o.data, 9)) return ''; // solo sonido
      const drawable = msg(o.data, 1);
      const g = geometry(drawable);
      const data = (field) => val(msg(o.data, field), 1);
      let dataId = o.type === T.MOVIE ? data(15) : data(15) ?? data(17) ?? data(11) ?? data(13) ?? data(12);
      if (NOT_RASTER.test(dataFiles.get(dataId) || '')) dataId = data(12);
      const id = NOT_RASTER.test(dataFiles.get(dataId) || '') ? null : link(dataId);
      if (!id) return fromThumbnail(drawable, origin);
      const style = ref(o.data, 3);
      const opacity = ownProp(style, (p) => float(p, 2)) ?? 1;
      const stroke = ownProp(style, (p) => msg(p, 1) ?? undefined);
      let crop = '';
      let frame = g;
      let geom = RECT;
      const mask = get(ref(o.data, 5));
      if (mask?.type === T.MASK) {
        // La máscara va en las coordenadas de la imagen, y lo visible es esa ventana; el giro es alrededor del centro de la imagen.
        const m = geometry(msg(mask.data, 1));
        const [l, t, r, b] = [m.x / g.w, m.y / g.h, 1 - (m.x + m.w) / g.w, 1 - (m.y + m.h) / g.h];
        if ([l, t, r, b].some((v) => Math.abs(v) > 1e-3)) {
          crop = `<a:srcRect l="${percent(l)}" t="${percent(t)}" r="${percent(r)}" b="${percent(b)}"/>`;
          const [dx, dy] = [m.x + m.w / 2 - g.w / 2, m.y + m.h / 2 - g.h / 2];
          const turn = -g.angle * Math.PI / 180;
          frame = { ...g, x: g.x + g.w / 2 + dx * Math.cos(turn) - dy * Math.sin(turn) - m.w / 2, y: g.y + g.h / 2 + dx * Math.sin(turn) + dy * Math.cos(turn) - m.h / 2, w: m.w, h: m.h };
        }
        geom = geomXml(msg(mask.data, 2), m.w, m.h);
      }
      return `<p:pic><p:nvPicPr>${nameTag()}<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${id}">${opacity < 0.999 ? `<a:alphaModFix amt="${percent(opacity)}"/>` : ''}</a:blip>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(frame)}${geom}${stroke ? lineXml(stroke, opacity) : ''}${shadowXml(ownProp(style, (p) => msg(p, 3) ?? undefined))}</p:spPr></p:pic>`;
    }

    function draw(id, depth = 0, origin = {}) {
      const o = get(id);
      if (!o || depth > 32) return '';
      if ([T.PLACEHOLDER, T.SHAPE_INFO, T.SHAPE, T.LINE].includes(o.type)) return shape(o);
      if (o.type === T.IMAGE || o.type === T.MOVIE) return picture(o, origin);
      const drawable = msg(o.data, 1);
      if (!msg(drawable, 1)) return '';
      if (o.type !== T.GROUP) return fromThumbnail(drawable, origin);
      const g = geometry(drawable);
      const inner = { x: (origin.x || 0) + g.x, y: (origin.y || 0) + g.y };
      const children = refs(o.data, 2).map((child) => draw(child, depth + 1, inner)).join('');
      if (!children) return '';
      return `<p:grpSp><p:nvGrpSpPr>${nameTag()}<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm(g, `<a:chOff x="0" y="0"/><a:chExt cx="${emu(g.w)}" cy="${emu(g.h)}"/>`)}</p:grpSpPr>${children}</p:grpSp>`;
    }

    const slide = get(ref(node.data, 2));
    const template = get(ref(slide.data, 17));
    const styles = [ref(slide.data, 1), ref(template?.data, 1)];
    const slideProp = (read) => {
      for (const id of styles) {
        const value = ownProp(id, read);
        if (value !== undefined) return value;
      }
      return undefined;
    };
    // De la plantilla salen sus objetos, debajo; sus lugares (título, cuerpo, la imagen de muestra, que lleva etiqueta) no,
    // porque cada diapositiva tiene los suyos.
    const samples = new Set(msgs(template?.data, 28).map((tag) => ref(tag, 2)));
    let tree = '';
    for (const id of refs(template?.data, 42)) if (get(id)?.type !== T.PLACEHOLDER && !samples.has(id)) tree += draw(id);
    for (const id of refs(slide.data, 42)) {
      const o = get(id);
      if (o?.type === T.PLACEHOLDER) {
        const kind = val(o.data, 2) ?? 0;
        if (kind === 1 ? !bool(node.data, 18) : slideProp((p) => bool(p, { 2: 4, 3: 5, 4: 7 }[kind])) === false) continue;
      }
      tree += draw(id);
    }
    const background = slideProp((p) => msg(p, 1) ?? undefined);
    const bg = background ? fillXml(background, 1, W, H) : NO_FILL;
    const white = '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
    slides.push({
      xml: `${HEAD}<p:sld ${NS}${bool(node.data, 4) ? ' show="0"' : ''}><p:cSld><p:bg><p:bgPr>${bg === NO_FILL ? white : bg}<a:effectLst/></p:bgPr></p:bg><p:spTree>${TREE}${tree}${overlays.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
      links: [...links.entries()],
    });
  }

  // En orden, con las diapositivas agrupadas debajo de la suya. El número es el que se ve: las ocultas no cuentan.
  const seen = new Set();
  let page = 0;
  const walk = (id) => {
    const node = get(id);
    if (!node || seen.has(id)) return;
    seen.add(id);
    if (get(ref(node.data, 2))) {
      if (!bool(node.data, 4)) page += 1;
      makeSlide(node, Math.max(1, page));
    }
    refs(node.data, 1).forEach(walk);
  };
  refs(msg(show.data, 3), 2).forEach(walk);
  if (!slides.length) throw new Error('No trae diapositivas.');

  const imageTypes = [...new Set([...media.keys()].map((m) => m.split('.').pop()))].map((e) => `<Default Extension="${e}" ContentType="${IMAGE_TYPES[e] || 'application/octet-stream'}"/>`).join('');
  const presentation = `${HEAD}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${emu(W)}" cy="${emu(H)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  return {
    soft,
    pptx: writeZip([
      ['[Content_Types].xml', CONTENT_TYPES(slides.length, imageTypes)],
      ['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
      ['ppt/presentation.xml', presentation],
      ['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml'], ...slides.map((_, i) => [`rId${10 + i}`, 'slide', `slides/slide${i + 1}.xml`])])],
      ['ppt/slideMasters/slideMaster1.xml', MASTER],
      ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])],
      ['ppt/slideLayouts/slideLayout1.xml', LAYOUT],
      ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
      ['ppt/theme/theme1.xml', THEME],
      ...slides.flatMap((s, i) => [[`ppt/slides/slide${i + 1}.xml`, s.xml], [`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ...s.links.map(([target, id]) => [id, 'image', `../media/${target}`])])]]),
      ...[...media.entries()].map(([name, data]) => [`ppt/media/${name}`, data]),
    ]),
  };
}

// En otro hilo y con tiempo límite: una presentación grande no deja a Manna sin contestar durante el culto, y una rota no lo tumba.
const LIMIT_MS = 3 * 60 * 1000;
export function translateKeynote(input, output) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { keynote: { input, output } } });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Tardó demasiado.'));
    }, LIMIT_MS);
    const finish = (settle, value) => {
      clearTimeout(timer);
      settle(value);
    };
    worker.once('message', (said) => (said.error ? finish(reject, new Error(said.error)) : finish(resolve, said)));
    worker.once('error', (err) => finish(reject, err));
    worker.once('exit', () => finish(reject, new Error('El hilo se cerró antes de terminar.')));
  });
}
if (!isMainThread && workerData?.keynote) {
  try {
    const { pptx, soft } = keynoteToPptx(workerData.keynote.input);
    fs.writeFileSync(workerData.keynote.output, pptx);
    parentPort.postMessage({ soft });
  } catch (err) {
    parentPort.postMessage({ error: String(err?.message || err) });
  }
}
