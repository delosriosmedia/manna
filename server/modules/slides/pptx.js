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
