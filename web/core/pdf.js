// pdf.js (Mozilla, en web/vendor/pdfjs). Pesa, así que no se carga hasta que alguien elige un PDF. Lo usan las
// presentaciones (cada página, una imagen: modules/slides/pdf.js) y las citas de un documento (su texto: documentos.js;
// si el PDF es solo imágenes, también las páginas dibujadas, para leer su texto en el equipo principal).
const BASE = '/vendor/pdfjs/';

let library = null;
async function load() {
  if (!library) {
    library = await import('/vendor/pdfjs/pdf.min.mjs');
    library.GlobalWorkerOptions.workerSrc = `${BASE}pdf.worker.min.mjs`;
  }
  return library;
}

// Abre un PDF (sus bytes). Devuelve { doc, close() }, o lanza un Error con un mensaje para quien lo usa.
export async function openPdfDocument(bytes) {
  const pdfjs = await load();
  const task = pdfjs.getDocument({
    data: bytes,
    cMapUrl: `${BASE}cmaps/`, cMapPacked: true, standardFontDataUrl: `${BASE}standard_fonts/`, wasmUrl: `${BASE}wasm/`, iccUrl: `${BASE}iccs/`,
    // Un PDF puede llevar código dentro: aquí no se ejecuta.
    isEvalSupported: false, enableXfa: false,
  });
  try {
    return { doc: await task.promise, close: () => task.destroy() };
  } catch (err) {
    throw new Error(err?.name === 'PasswordException'
      ? 'Ese PDF está protegido con contraseña. Quítasela y vuelve a elegirlo.'
      : 'No se pudo leer ese PDF. Puede estar dañado o no ser un PDF.');
  }
}

// Dibuja una página (desde 1) en un lienzo cuyo lado mayor mide `side`, sobre blanco como en papel. Quien lo usa lo
// suelta al terminar (canvas.width = 0): varias páginas a la vez agotan la memoria de un celular.
export async function renderPage(doc, n, side) {
  const page = await doc.getPage(n);
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: side / Math.max(natural.width, natural.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

export const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.'))), 'image/jpeg', quality);
});
