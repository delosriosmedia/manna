// Preparar una imagen en el propio dispositivo antes de enviarla al servidor: se reduce (una foto
// de celular pesa varias veces lo que hace falta para una pantalla) y, si se pide, se le hace una
// miniatura. El servidor no sabe encoger imágenes; por eso se hace aquí. Lo usan la biblioteca de
// Medios y los fondos de la proyección.
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const isImageFile = (file) => IMAGE_ACCEPT.split(',').includes(file.type);

const MAX_SIDE = 2560;  // lado mayor de lo que se guarda: alcanza para acercar en una pantalla de 1080
const THUMB_SIDE = 480;
const PNG_LIMIT = 6 * 1024 * 1024;

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

function draw(image, side, background) {
  const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Deja un archivo listo para subir: { blob, type, thumb, preview }.
//   thumb     miniatura en JPG (null con { thumb: false })
//   preview   dirección de la miniatura para mostrarla ya; quien la use la suelta con URL.revokeObjectURL
export async function prepareImage(file, { thumb: wantThumb = true } = {}) {
  const image = new Image();
  const source = URL.createObjectURL(file);
  try {
    image.src = source;
    await image.decode();
    const thumb = wantThumb ? await toBlob(draw(image, THUMB_SIDE, '#000'), 'image/jpeg', 0.8) : null;
    const preview = thumb ? URL.createObjectURL(thumb) : null;
    // Un GIF puede estar animado: se sube tal cual.
    if (file.type === 'image/gif') return { blob: file, type: file.type, thumb, preview };
    // El PNG se conserva (puede tener transparencia) salvo que pese demasiado; lo demás, JPG.
    let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    let blob = await toBlob(draw(image, MAX_SIDE, type === 'image/jpeg' ? '#000' : null), type, 0.9);
    if (type === 'image/png' && blob && blob.size > PNG_LIMIT) {
      type = 'image/jpeg';
      blob = await toBlob(draw(image, MAX_SIDE, '#000'), type, 0.9);
    }
    if (!blob || (wantThumb && !thumb)) throw new Error('Este navegador no pudo preparar la imagen.');
    return { blob, type, thumb, preview };
  } finally {
    URL.revokeObjectURL(source);
  }
}
