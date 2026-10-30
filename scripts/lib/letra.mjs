// Un archivo de letra (.ttf) para las pruebas: solo lo que Manna lee de él, la tabla «name» con el nombre de la familia
// (como lo escribe Windows, en UTF-16). No dibuja nada: DeckCraft de verdad no lo aceptaría.
//
//   makeFont('Letra de Prueba')  -> Buffer
export function makeFont(family) {
  const text = Buffer.from(family, 'utf16le').swap16();
  const name = Buffer.alloc(18 + text.length);
  [0, 1, 18, 3, 1, 0x409, 1, text.length, 0].forEach((value, i) => name.writeUInt16BE(value, i * 2));
  text.copy(name, 18);
  const head = Buffer.alloc(28);
  head.writeUInt32BE(0x00010000, 0);
  head.writeUInt16BE(1, 4);
  head.write('name', 12, 'latin1');
  head.writeUInt32BE(28, 20);
  head.writeUInt32BE(name.length, 24);
  return Buffer.concat([head, name]);
}
