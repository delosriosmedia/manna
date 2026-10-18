import zlib from 'node:zlib';

// Hace un Word (.docx) para las pruebas, sin depender de ninguno guardado en el repositorio: un .zip con solo
// word/document.xml, comprimido como lo comprime Word (deflate), y un párrafo por entrada.
//
//   makeDocx(['Texto: Juan 3:16', 'Y Romanos 8:28'])  -> Buffer
// El texto va tal cual dentro del XML: quien lo use escribe ya las entidades que quiera probar (&amp;, &#160;).
export function makeDocx(paragraphs) {
  const xml = `<w:document><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
  const name = Buffer.from('word/document.xml');
  const raw = Buffer.from(xml);
  const data = zlib.deflateRawSync(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(30 + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
