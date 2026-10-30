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

// Un Google Fonts de mentira: con MANNA_LETRAS_URL apuntando a él, /css2?family=<familia>:… da el CSS que da el de
// verdad a Manna (una @font-face con su TTF) y /s/<carpeta>.ttf, el archivo; de una familia que no tiene, 400, como
// el de verdad. Solo tiene las que se le dan.
//
//   const server = await serveFonts(['Letra Que Falta']);  server.url  ->  'http://127.0.0.1:…'
export async function serveFonts(families) {
  const { default: http } = await import('node:http');
  const folder = (family) => family.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fonts = new Map(families.map((family) => [folder(family), { family, data: makeFont(family) }]));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, server.url);
    const asked = url.pathname === '/css2' && fonts.get(folder((url.searchParams.get('family') || '').split(':')[0]));
    const file = /^\/s\/([a-z0-9]+)\.ttf$/.exec(url.pathname)?.[1];
    if (asked) res.end(`@font-face {\n  font-family: '${asked.family}';\n  font-style: normal;\n  font-weight: 400;\n  src: url(${server.url}/s/${folder(asked.family)}.ttf) format('truetype');\n}\n`);
    else if (file && fonts.has(file)) res.end(fonts.get(file).data);
    else res.writeHead(400).end('');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  server.url = `http://127.0.0.1:${server.address().port}`;
  return server;
}
