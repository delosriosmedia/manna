// El texto de un documento, en el navegador de quien lo elige (fase 27, citas de un documento): Word (.docx), PDF y
// texto. Al servidor solo va el texto, y solo al buscar las citas. Un PDF devuelve sus páginas separadas por «\f».
// Lanza un Error con un mensaje para quien lo usa.

export async function documentText(file) {
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (ext === 'doc') throw new Error('Ese es un Word antiguo (.doc). Ábrelo en Word y guárdalo como .docx o como PDF.');
  let text;
  if (ext === 'txt' || /^text\//.test(file.type)) text = await file.text();
  else if (ext === 'docx') text = await docxText(await file.arrayBuffer());
  else if (ext === 'pdf' || file.type === 'application/pdf') {
    const { openPdfDocument } = await import('/core/pdf.js');
    const { doc, close } = await openPdfDocument(new Uint8Array(await file.arrayBuffer()));
    try { text = await pdfText(doc); } finally { close(); }
  } else throw new Error('Ese archivo no se puede leer. Elige un Word (.docx), un PDF o un texto.');
  if (!text.replace(/\f/g, '').trim()) {
    throw new Error(ext === 'pdf' ? 'Ese PDF no tiene texto que leer: parece escaneado (una foto del papel).' : 'Ese documento no tiene texto.');
  }
  return text;
}

// Un .docx es un .zip: se busca word/document.xml en su índice y se descomprime con DecompressionStream (del
// navegador). Un párrafo por línea.
export async function docxText(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // El final del índice del .zip: su firma, buscada desde el final.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('No se pudo abrir ese documento de Word. Puede estar dañado.');
  let at = view.getUint32(eocd + 16, true);
  for (let n = view.getUint16(eocd + 10, true); n > 0; n -= 1) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (name !== 'word/document.xml') continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    const xml = method === 0 ? new TextDecoder().decode(data)
      : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    // Los saltos y tabulaciones de Word, como espacios; las marcas, fuera.
    return xml.replace(/<w:tab\/>|<w:br\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&#(x?)([\da-f]+);/gi, (_, hex, n) => String.fromCodePoint(parseInt(n, hex ? 16 : 10)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  throw new Error('Ese documento de Word no tiene texto.');
}

// El texto de un PDF ya abierto con pdf.js: los trozos de cada página juntados por líneas.
export async function pdfText(doc) {
  const pages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    let page = '';
    for (const it of items) page += it.str + (it.hasEOL ? '\n' : '');
    pages.push(page);
  }
  return pages.join('\f');
}
