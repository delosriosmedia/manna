// Convierte las páginas de un PDF en imágenes en este mismo navegador, con pdf.js (Mozilla,
// en web/vendor/pdfjs). El servidor no sabe leer un PDF: recibe las imágenes ya hechas.
// La biblioteca la carga core/pdf.js la primera vez que alguien elige un PDF.
import { openPdfDocument } from '/core/pdf.js';
// Lado mayor de cada diapositiva (como las imágenes de Medios) y ancho de su miniatura.
export const SLIDE_SIDE = 2560;
export const THUMB_SIDE = 320;

const toBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.'))), 'image/jpeg', quality);
});

// Abre un PDF. Devuelve { pages, render(n) -> { blob, thumb, width, height }, close() }.
// Las páginas se numeran desde 1 y se convierten de una en una: varias a la vez agotan la memoria de un celular.
export async function openPdf(file) {
  const { doc, close } = await openPdfDocument(new Uint8Array(await file.arrayBuffer()));
  return {
    pages: doc.numPages,
    async render(n) {
      const page = await doc.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: SLIDE_SIDE / Math.max(natural.width, natural.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      // Una página sin fondo propio es blanca, como en papel.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const small = document.createElement('canvas');
      small.width = THUMB_SIDE;
      small.height = Math.max(1, Math.round(THUMB_SIDE * canvas.height / canvas.width));
      const reduced = small.getContext('2d', { alpha: false });
      reduced.imageSmoothingQuality = 'high';
      reduced.drawImage(canvas, 0, 0, small.width, small.height);
      const made = { blob: await toBlob(canvas, 0.9), thumb: await toBlob(small, 0.8), width: canvas.width, height: canvas.height };
      // Se suelta la memoria de la página antes de pasar a la siguiente.
      page.cleanup();
      canvas.width = 0;
      small.width = 0;
      return made;
    },
    close,
  };
}
