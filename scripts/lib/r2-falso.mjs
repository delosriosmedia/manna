// Un R2 de mentira para las pruebas (fase 36): sirve una carpeta como si fuera el depósito, con lo poco de la API de S3
// que usa Manna (listar con list-type=2, pedir y subir un objeto) y apunta lo que le piden. No comprueba la firma: eso
// lo prueban los ejemplos de AWS (test/r2.test.js). Nada sale a internet.
//   const r2 = await startFakeR2(carpeta, { bucket })  ->  { endpoint, env, requests, stop() }
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export async function startFakeR2(dir, { bucket = 'manna-prueba' } = {}) {
  const requests = [];
  const walk = (base) => (fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(base, e.name);
    return e.isDirectory() ? walk(full) : [full];
  }) : []);
  const xml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://r2');
    const [, name, ...rest] = url.pathname.split('/').map(decodeURIComponent);
    const key = rest.join('/');
    requests.push({ method: req.method, key, signed: url.searchParams.has('X-Amz-Signature') || Boolean(req.headers.authorization) });
    if (name !== bucket) { res.writeHead(404).end(); return; }
    if (req.method === 'GET' && !key) {
      const prefix = url.searchParams.get('prefix') || '';
      const items = walk(dir).map((full) => ({ key: path.relative(dir, full).split(path.sep).join('/').normalize('NFC'), size: fs.statSync(full).size }))
        .filter((o) => o.key.startsWith(prefix));
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(`<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><IsTruncated>false</IsTruncated>${items.map((o) => `<Contents><Key>${xml(o.key)}</Key><Size>${o.size}</Size></Contents>`).join('')}</ListBucketResult>`);
      return;
    }
    const file = path.join(dir, ...key.split('/'));
    if (!path.resolve(file).startsWith(path.resolve(dir) + path.sep)) { res.writeHead(400).end(); return; }
    if (req.method === 'PUT') {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const chunks = [];
      for await (const c of req) chunks.push(c);
      fs.writeFileSync(file, Buffer.concat(chunks));
      res.writeHead(200).end();
      return;
    }
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Length': fs.statSync(file).size, 'Content-Type': file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  return {
    endpoint,
    requests,
    // Las variables con las que un servidor de prueba en modo nube usa este R2.
    env: { R2_ACCOUNT_ID: 'cuenta-de-prueba', R2_ACCESS_KEY_ID: 'clave-de-prueba', R2_SECRET_ACCESS_KEY: 'secreto-de-prueba', R2_BUCKET: bucket, R2_ENDPOINT: endpoint },
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
