import zlib from 'node:zlib';

// Hace un archivo PNG de verdad, punto a punto, para las pruebas y la demostración: así no
// dependen de imágenes guardadas en el repositorio ni de las de ninguna iglesia.
//
//   makePng(1600, 900, (x, y) => [rojo, verde, azul])   x, y de 0 a 1; colores de 0 a 255
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, check]);
}

export function makePng(width, height, color = () => [40, 90, 200]) {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = color(x / width, y / height);
      raw.set([r, g, b], y * row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits por color
  header[9] = 2; // rojo, verde y azul
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Un cartel de ejemplo: degradado con un marco y franjas, para que se note el encuadre y el zoom.
export function examplePoster(width, height, [from, to] = [[29, 78, 216], [147, 51, 234]]) {
  return makePng(width, height, (x, y) => {
    const edge = Math.min(x, y, 1 - x, 1 - y);
    if (edge > 0.04 && edge < 0.05) return [255, 255, 255];
    if (y > 0.44 && y < 0.56 && x > 0.15 && x < 0.85) return (Math.floor(x * 28) % 2 ? [255, 255, 255] : [250, 204, 21]);
    const t = (x + y) / 2;
    return from.map((c, i) => Math.round(c + (to[i] - c) * t));
  });
}
