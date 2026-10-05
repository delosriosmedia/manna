// Hace un PDF de verdad para las pruebas, sin depender de ninguno guardado en el repositorio:
// una página apaisada (16:9) por cada entrada, con un fondo de color y un rótulo grande.
//
//   makePdf([{ text: 'Diapositiva 1', color: [29, 78, 216] }, …])  -> Buffer
// El rótulo usa una tipografía estándar que el PDF no lleva dentro (Helvetica), así que quien lo
// dibuje tiene que poner la suya: es lo que hace pdf.js con web/vendor/pdfjs/standard_fonts.
// Solo admite letras sin tilde y cifras.
export function makePdf(pages) {
  const objects = [];
  const add = (body) => objects.push(body);
  const literal = (text) => String(text).replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
  add(''); // 1: el catálogo, que se escribe al final
  add(''); // 2: la lista de páginas
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // 3
  const kids = [];
  for (const { text, color = [29, 78, 216] } of pages) {
    const [r, g, b] = color.map((c) => (c / 255).toFixed(3));
    const stream = `${r} ${g} ${b} rg 0 0 960 540 re f 1 1 1 rg 60 60 840 6 re f BT /F1 72 Tf 60 240 Td (${literal(text)}) Tj ET`;
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let file = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = Buffer.byteLength(file, 'latin1');
    file += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(file, 'latin1');
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(file, 'latin1');
}
