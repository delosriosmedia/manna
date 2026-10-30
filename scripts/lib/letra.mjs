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

// Los repositorios de letras de mentira (MANNA_LETRAS_URL): hacen de Google Fonts (/google/css2?family=…: el CSS que
// da a Manna, con su TTF; 400 si no la tiene), de Fontsource (/fontsource/<carpeta>: sus variantes) y de Font Squirrel
// (/fontsquirrel/api/familyinfo/<carpeta> y /fontsquirrel/fonts/download/<carpeta>: un .zip, con otra familia dentro
// que no se debe instalar). Cada uno solo tiene las familias que se le dan.
//
//   const server = await serveFonts(['Letra Que Falta'], { fontsource: ['Otra'], squirrel: ['Otra Más'] });  server.url
export async function serveFonts(google, { fontsource = [], squirrel = [] } = {}) {
  const { default: http } = await import('node:http');
  const { zip } = await import('./pptx.mjs');
  const folder = (family) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const has = (list, slug) => list.find((family) => folder(family) === slug || folder(family).replace(/-/g, '') === slug);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, server.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const family = parts[0] === 'google' && parts[1] === 'css2' ? google.find((f) => f === (url.searchParams.get('family') || '').split(':')[0]) : null;
    if (family) return res.end(`@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-weight: 400;\n  src: url(${server.url}/s/${folder(family)}.ttf) format('truetype');\n}\n`);
    if (parts[0] === 's') return res.end(makeFont([...google, ...fontsource].find((f) => `${folder(f)}.ttf` === parts[1]) || 'nada'));
    const source = parts[0] === 'fontsource' && has(fontsource, parts[1]);
    if (source) return res.end(JSON.stringify({ family: source, variants: { 400: { normal: { latin: { url: { ttf: `${server.url}/s/${folder(source)}.ttf` } } } } } }));
    const squirrelled = parts[0] === 'fontsquirrel' && has(squirrel, parts.at(-1));
    if (squirrelled && parts[1] === 'api') return res.end(JSON.stringify([{ family_name: squirrelled }]));
    if (squirrelled && parts[1] === 'fonts') return res.end(zip([[`${squirrelled}-Regular.otf`, makeFont(squirrelled)], ['Otra-Regular.ttf', makeFont(`${squirrelled} Rounded`)], ['LEEME.txt', 'licencia']]));
    res.writeHead(parts[0] === 'google' ? 400 : 404).end(parts[0] === 'fontsquirrel' ? '{}' : '');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  server.url = `http://127.0.0.1:${server.address().port}`;
  return server;
}
