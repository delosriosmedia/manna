import fs from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'El archivo o la petición es demasiado grande.'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createRouter({ webDir, mediaDir, sessions }) {
  const routes = [];

  // route('GET', '/api/bible/:id/books', handler). El handler devuelve un objeto (se envía como JSON)
  // o undefined si ya respondió por su cuenta.
  function route(method, pattern, handler) {
    const keys = [];
    const rx = new RegExp(`^${pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, rx, keys, handler });
  }

  function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  function serveFile(res, baseDir, relPath) {
    const file = path.join(baseDir, relPath);
    if (!file.startsWith(baseDir + path.sep)) return false;
    let stat;
    try { stat = fs.statSync(file); } catch { return false; }
    if (!stat.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  function serveStatic(pathname, res) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return false; }
    if (rel.startsWith('/media/')) return serveFile(res, mediaDir, rel.slice('/media/'.length));
    if (rel === '/') rel = '/index.html';
    else if (!path.extname(rel)) rel += '.html';
    return serveFile(res, webDir, rel.slice(1));
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.rx.exec(url.pathname);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        const ctx = {
          req, res, params,
          query: url.searchParams,
          isLocal: LOOPBACK.has(req.socket.remoteAddress),
          ip: req.socket.remoteAddress,
          session: sessions.fromRequest(req),
          async json() {
            if (!/^application\/json/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Se esperaba JSON.');
            const raw = await readBody(req, 1024 * 1024);
            try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new HttpError(400, 'JSON no válido.'); }
          },
          raw: (limit) => readBody(req, limit),
          require(permission) {
            if (!permission) return;
            if (!sessions.can(ctx.session, permission)) {
              throw new HttpError(ctx.session ? 403 : 401, 'Esta función no tiene permiso para hacer eso.');
            }
          },
        };
        const body = await r.handler(ctx);
        if (body !== undefined && !res.headersSent) sendJson(res, 200, body);
        return;
      }
      if (req.method === 'GET' && !url.pathname.startsWith('/api/') && serveStatic(url.pathname, res)) return;
      sendJson(res, 404, { error: 'No encontrado.' });
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : 'Error interno del servidor.' });
    }
  }

  return { route, handle };
}
