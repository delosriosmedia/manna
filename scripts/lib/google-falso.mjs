import http from 'node:http';

// Un Google de mentira para las copias en Drive (fase 38): da el permiso al volver de «Conectar» (/auth vuelve sola a
// redirect_uri con un código), cambia el código y la clave por un token (/token) y guarda carpetas y archivos en memoria
// (/drive/v3/files y /upload/drive/v3/files), como el de verdad con el permiso drive.file. Con MANNA_GOOGLE_PRUEBA.
// Devuelve { url, files, calls, stop }: files, lo que hay (id -> { id, name, mimeType, parents, content }).
export async function startFakeGoogle() {
  const files = new Map();
  const calls = [];
  let serial = 0;
  const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const read = async (req) => { const parts = []; for await (const c of req) parts.push(c); return Buffer.concat(parts).toString('utf8'); };
  const add = (meta, content = null) => {
    serial += 1;
    const file = { id: `f${serial}`, name: meta.name, mimeType: meta.mimeType || 'application/json', parents: meta.parents || [], content, createdTime: new Date().toISOString() };
    files.set(file.id, file);
    return file;
  };
  // Lo que pide Manna en q: name = '…', mimeType = / != '…', '<id>' in parents (y trashed = false).
  const matches = (file, q) => {
    const name = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, '$1');
    const type = /mimeType (=|!=) '([^']*)'/.exec(q);
    const parent = /'([^']*)' in parents/.exec(q)?.[1];
    return (!name || file.name === name) && (!type || (type[1] === '=') === (file.mimeType === type[2])) && (!parent || file.parents.includes(parent));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    calls.push(`${req.method} ${url.pathname}`);
    if (url.pathname === '/auth') {
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.search = new URLSearchParams({ code: 'codigo-de-prueba', state: url.searchParams.get('state') || '' }).toString();
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    if (url.pathname === '/token') {
      const form = new URLSearchParams(await read(req));
      if (form.get('client_secret') !== 'secreto-de-prueba') return json(res, 401, { error: 'invalid_client' });
      if (form.get('grant_type') === 'authorization_code' && form.get('code') === 'codigo-de-prueba') return json(res, 200, { access_token: 'acceso', refresh_token: 'renovar', expires_in: 3600 });
      if (form.get('grant_type') === 'refresh_token' && form.get('refresh_token') === 'renovar') return json(res, 200, { access_token: 'acceso', expires_in: 3600 });
      return json(res, 400, { error: 'invalid_grant' });
    }
    if (req.headers.authorization !== 'Bearer acceso') return json(res, 401, { error: { message: 'Sin permiso' } });
    const id = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname)?.[1];
    if (id) {
      const file = files.get(id);
      if (!file) return json(res, 404, { error: { message: 'No existe' } });
      if (req.method === 'DELETE') { files.delete(id); res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(file.content);
    }
    if (url.pathname === '/drive/v3/files' && req.method === 'GET') {
      const q = url.searchParams.get('q') || '';
      return json(res, 200, { files: [...files.values()].filter((f) => matches(f, q)).map(({ id: fid, name, createdTime, content }) => ({ id: fid, name, createdTime, size: String(content?.length ?? 0) })) });
    }
    if (url.pathname === '/drive/v3/files' && req.method === 'POST') return json(res, 200, { id: add(JSON.parse(await read(req))).id });
    if (url.pathname === '/upload/drive/v3/files' && req.method === 'POST') {
      const boundary = /boundary=(\S+)/.exec(req.headers['content-type'] || '')?.[1];
      const [meta, content] = (await read(req)).split(`--${boundary}`).slice(1, 3).map((part) => part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, ''));
      const file = add(JSON.parse(meta), content);
      return json(res, 200, { id: file.id, name: file.name });
    }
    json(res, 404, { error: { message: 'No existe' } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, files, calls, stop: () => new Promise((resolve) => server.close(resolve)) };
}
