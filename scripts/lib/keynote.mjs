import { writeZip } from '../../server/modules/slides/pptx.js';

// Hace una presentación de Keynote (.key) para las pruebas, sin guardar ninguna en el repositorio: el mismo formato (Index/*.iwa,
// protobuf con Snappy; ver server/modules/slides/iwa.js) y solo lo que Manna lee. Textos e imágenes, los que se le den.
//
//   makeKey([{ background: 'FFFFFF', items: [
//     { type: 'text', x, y, w, h, text, font, size, color, bold, align, anchor, shrink, spacing, fill, radius, angle, styleless, placeholder, field },   h: 0, alto sin calcular
//     { type: 'image', x, y, w, h, png, mask: { x, y, w, h } },
//     { type: 'group', x, y, w, h, items: [...] },
//     { type: 'chart', x, y, w, h },
//   ], hidden, number, thumbnail, template: { background, items, sample } }])  -> Buffer

const varint = (n) => {
  const out = [];
  let value = BigInt(n);
  do {
    let byte = Number(value & 0x7fn);
    value >>= 7n;
    if (value > 0n) byte |= 0x80;
    out.push(byte);
  } while (value > 0n);
  return Buffer.from(out);
};
const u = (field, n) => Buffer.concat([varint(field << 3), varint(n)]);
const by = (field, b) => { const data = Buffer.from(b); return Buffer.concat([varint((field << 3) | 2), varint(data.length), data]); };
const fl = (field, x) => { const b = Buffer.alloc(4); b.writeFloatLE(x); return Buffer.concat([varint((field << 3) | 5), b]); };
const m = (...parts) => Buffer.concat(parts.filter(Boolean));
const rf = (field, id) => by(field, u(1, id));
const color = ([r, g, b]) => m(u(1, 1), fl(3, r), fl(4, g), fl(5, b), fl(6, 1));
const rgb = (hex) => color([0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));

// Snappy solo con literales, y un único trozo: es válido, aunque no comprima nada.
function frame(data) {
  const tag = data.length <= 60 ? Buffer.from([(data.length - 1) << 2]) : Buffer.from([63 << 2, ...[0, 1, 2, 3].map((i) => ((data.length - 1) >>> (8 * i)) & 0xff)]);
  const body = Buffer.concat([varint(data.length), tag, data]);
  return Buffer.concat([Buffer.from([0, body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff]), body]);
}

export function makeKey(slides, { width = 960, height = 540 } = {}) {
  const objects = [];
  const files = [];
  let next = 100;
  const add = (type, data) => { const id = next; next += 1; objects.push({ id, type, data }); return id; };
  const dataFile = (name, content) => { const id = next; next += 1; files.push([`Data/${name}-${id}.png`, content]); return id; };

  const geometry = ({ x = 0, y = 0, w = 100, h = 50, angle = 0 }) => m(
    by(1, m(fl(1, x), fl(2, y))), by(2, m(fl(1, w), fl(2, h))), u(3, h === 0 ? 1 : 3), fl(4, angle));
  const drawable = (item) => by(1, by(1, geometry(item)));

  function paragraphStyle({ font, size = 24, color: ink, bold, align, spacing }) {
    return add(2022, m(by(1, m()),
      by(11, m(bold && u(1, 1), fl(3, size), font && by(5, font), ink && by(7, rgb(ink)))),
      by(12, m(align !== undefined && u(1, align), spacing && by(13, m(u(1, 0), fl(2, spacing)))))));
  }
  function text(item) {
    const para = paragraphStyle(item);
    const style = add(2025, m(
      by(1, m(by(1, m()), by(11, m(item.fill && by(1, by(1, rgb(item.fill))))))),
      by(11, m(item.shrink && u(1, 1), item.anchor !== undefined && u(2, item.anchor), by(6, m(fl(1, 4), fl(2, 4), fl(3, 4), fl(4, 4)))))));
    const paragraphs = [{ at: 0, style: para }, ...(item.styleless ? [{ at: item.styleless }] : [])]; // un párrafo sin estilo, desde esa letra
    const number = item.field ? add(2043, m()) : null;
    const storage = add(2001, m(by(3, item.text ?? ''),
      by(5, m(...paragraphs.map((p) => by(1, m(u(1, p.at), p.style && rf(2, p.style)))))),
      number && by(9, by(1, m(u(1, 0), rf(2, number))))));
    const source = item.radius !== undefined ? by(3, by(4, m(u(1, 0), fl(2, item.radius)))) : null;
    return add(item.placeholder ? 7 : 2011, item.placeholder
      ? m(by(1, m(by(1, m(by(1, by(1, geometry(item))), rf(2, style), source)), rf(4, storage))), u(2, item.placeholder))
      : m(by(1, m(by(1, by(1, geometry(item))), rf(2, style), source)), rf(4, storage)));
  }
  function image(item) {
    const data = dataFile('imagen', item.png);
    const mask = item.mask ? add(3006, m(drawable(item.mask))) : null;
    return add(3005, m(drawable(item), rf(11, data), mask && rf(5, mask)));
  }
  function draw(item) {
    if (item.type === 'image') return image(item);
    if (item.type === 'chart') return add(5021, drawable(item));
    if (item.type === 'group') return add(3008, m(drawable(item), ...item.items.map((child) => rf(2, draw(child)))));
    return text(item);
  }
  const slideStyle = (background) => add(9, m(by(1, m()), background && by(11, by(1, by(1, rgb(background))))));

  const nodes = slides.map((slide) => {
    let template;
    if (slide.template) {
      const sample = slide.template.sample ? image(slide.template.sample) : null;
      const items = (slide.template.items || []).map(draw);
      template = add(6, m(rf(1, slideStyle(slide.template.background)), ...items.map((id) => rf(42, id)), sample && rf(42, sample), sample && by(28, m(by(1, 'Placeholder-1'), rf(2, sample)))));
    }
    const data = m(rf(1, slideStyle(slide.background)), template && rf(17, template), ...(slide.items || []).map((item) => rf(42, draw(item))));
    const thumbnail = slide.thumbnail ? dataFile('st-prueba', slide.thumbnail) : null;
    return add(4, m(rf(2, add(5, data)), u(4, slide.hidden ? 1 : 0), thumbnail && rf(16, thumbnail), slide.number && u(18, 1)));
  });
  add(2, m(by(3, m(...nodes.map((id) => rf(2, id)))), by(4, m(fl(1, width), fl(2, height)))));

  const packed = Buffer.concat(objects.flatMap(({ id, type, data }) => {
    const info = m(u(1, id), by(2, m(u(1, type), u(3, data.length))));
    return [varint(info.length), info, data];
  }));
  return writeZip([['Index/Document.iwa', frame(packed)], ['Metadata/Properties.plist', 'de prueba'], ...files]);
}
