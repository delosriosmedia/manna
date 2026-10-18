// pdf.js (Mozilla, en web/vendor/pdfjs). Pesa, así que no se carga hasta que alguien elige un PDF. Lo usan las
// presentaciones (cada página, una imagen: modules/slides/pdf.js) y las citas de un documento (su texto: documentos.js).
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
