// Convierte las páginas de un PDF en imágenes en este mismo navegador, con pdf.js (Mozilla,
// en web/vendor/pdfjs). El servidor no sabe leer un PDF: recibe las imágenes ya hechas.
// La biblioteca la carga core/pdf.js la primera vez que alguien elige un PDF.
import { canvasBlob, openPdfDocument, renderPage } from '/core/pdf.js';
// Lado mayor de cada diapositiva (como las imágenes de Medios) y ancho de su miniatura.
export const SLIDE_SIDE = 2560;
export const THUMB_SIDE = 320;

// Abre un PDF. Devuelve { pages, render(n) -> { blob, thumb, width, height }, close() }.
// Las páginas se numeran desde 1 y se convierten de una en una: varias a la vez agotan la memoria de un celular.
export async function openPdf(file) {
  const { doc, close } = await openPdfDocument(new Uint8Array(await file.arrayBuffer()));
  return {
    pages: doc.numPages,
    async render(n) {
      const canvas = await renderPage(doc, n, SLIDE_SIDE);
      const small = document.createElement('canvas');
      small.width = THUMB_SIDE;
      small.height = Math.max(1, Math.round(THUMB_SIDE * canvas.height / canvas.width));
      const reduced = small.getContext('2d', { alpha: false });
      reduced.imageSmoothingQuality = 'high';
      reduced.drawImage(canvas, 0, 0, small.width, small.height);
      const made = { blob: await canvasBlob(canvas, 0.9), thumb: await canvasBlob(small, 0.8), width: canvas.width, height: canvas.height };
      // Se suelta la memoria de la página antes de pasar a la siguiente.
      canvas.width = 0;
      small.width = 0;
      return made;
    },
    close,
  };
}
