// Lógica de las imágenes que no depende del servidor: reconocer un archivo y calcular la vista.

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

export const EXTENSIONS = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif' };

// ---- La vista de una imagen al aire ----
// fit    'contain' = completa, con bandas negras si no tiene la forma de la pantalla
//        'cover'   = llena la pantalla, recortando lo que sobre
// zoom   1 (lo que da el ajuste) a MAX_ZOOM
// x, y   punto de la imagen que queda en el centro de la pantalla, de 0 a 1
export const FITS = ['contain', 'cover'];
export const MAX_ZOOM = 5;

export const validFit = (fit) => (FITS.includes(fit) ? fit : 'contain');
const between = (value, min, max, fallback) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback);

export function initialView(fit, saved = null) {
  const view = { fit: validFit(fit), zoom: 1, x: 0.5, y: 0.5 };
  return saved && typeof saved === 'object' ? applyView(view, saved) : view;
}

// Aplica una orden de los mandos. Lo que no se entiende se ignora; lo que se sale, se ajusta.
export function applyView(state, patch) {
  if (patch.reset) return { fit: FITS.includes(patch.fit) ? patch.fit : state.fit, zoom: 1, x: 0.5, y: 0.5 };
  return {
    fit: FITS.includes(patch.fit) ? patch.fit : state.fit,
    zoom: Math.round(between(patch.zoom, 1, MAX_ZOOM, state.zoom) * 100) / 100,
    x: Math.round(between(patch.x, 0, 1, state.x) * 1000) / 1000,
    y: Math.round(between(patch.y, 0, 1, state.y) * 1000) / 1000,
  };
}

// Nombre que se ve en la biblioteca y en el orden del culto.
export const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
