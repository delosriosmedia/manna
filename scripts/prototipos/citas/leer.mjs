// Sacar el texto de un .docx y de un PDF en el navegador, sin programas nuevos.
// .docx: es un .zip; se busca word/document.xml en su índice y se descomprime con DecompressionStream (del navegador).
export async function docxText(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // Fin del índice del zip (EOCD): firma 0x06054b50, buscada desde el final.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('No es un documento de Word (.docx).');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n += 1) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extra + comment;
    if (name !== 'word/document.xml') continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    const xml = method === 0 ? new TextDecoder().decode(data)
      : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    // Un párrafo por línea; los saltos y tabulaciones de Word, como espacios.
    return xml.replace(/<w:tab\/>|<w:br\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  throw new Error('El documento no tiene texto.');
}

// PDF: pdf.js (ya está en Manna para las presentaciones) da los trozos de texto con su posición; se juntan por líneas.
export async function pdfText(buffer, pdfjs) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    let line = '';
    for (const it of items) {
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
  }
  return lines.join('\n');
}
