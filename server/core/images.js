import fs from 'node:fs';

// Reconocer una imagen por su contenido. Lo usa todo lo que recibe imágenes (la biblioteca de
// Medios, los fondos de la proyección): no se confía en el tipo que declara quien la envía.

// Qué imagen es un archivo y cuánto mide, leyendo solo su cabecera. null si no es una imagen
// de las que un navegador muestra (JPG, PNG, WebP o GIF). Así no se confía en lo que diga quien
// la sube: un archivo con otro contenido no entra en la biblioteca.
export function imageInfo(buffer) {
  if (!buffer || buffer.length < 16) return null;
  const size = (type, width, height) => (width > 0 && height > 0 ? { type, width, height } : null);

  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a) {
    if (buffer.length < 24 || buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
    return size('png', buffer.readUInt32BE(16), buffer.readUInt32BE(20));
  }

  const start = buffer.toString('latin1', 0, 6);
  if (start === 'GIF87a' || start === 'GIF89a') return size('gif', buffer.readUInt16LE(6), buffer.readUInt16LE(8));

  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP' && buffer.length >= 30) {
    const chunk = buffer.toString('latin1', 12, 16);
    if (chunk === 'VP8 ') return size('webp', buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return size('webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (chunk === 'VP8X') return size('webp', buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1);
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    // Un JPG es una fila de bloques; las medidas están en el que empieza la imagen (SOF).
    let at = 2;
    while (at + 9 < buffer.length) {
      if (buffer[at] !== 0xff) return null;
      const marker = buffer[at + 1];
      if (marker === 0xff) { at += 1; continue; }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) return size('jpeg', buffer.readUInt16BE(at + 7), buffer.readUInt16BE(at + 5));
      at += 2 + buffer.readUInt16BE(at + 2);
    }
    return null;
  }
  return null;
}

// Con qué extensión se guarda cada formato, y qué tipos se aceptan al subir.
export const EXTENSIONS = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif' };
export const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const HEADER_BYTES = 1024 * 1024; // un JPG de cámara puede traer mucho antes de sus medidas

// Lo mismo, leyendo solo el principio de un archivo ya guardado.
export function readImageInfo(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(HEADER_BYTES, fs.fstatSync(fd).size));
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    return imageInfo(buffer);
  } finally {
    fs.closeSync(fd);
  }
}
