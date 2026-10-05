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
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  // Chrome reproduce un .mov con H.264 si se le entrega como MP4.
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/mp4',
  '.webm': 'video/webm',
  // Estos no los reproduce cualquier navegador, pero el del equipo principal a veces sí (ver Medios).
  '.mkv': 'video/x-matroska',
  '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const TOO_BIG = 'El archivo o la petición es demasiado grande.';

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, TOO_BIG));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Guarda el cuerpo de la petición directamente en disco, sin tenerlo entero en memoria:
// así se puede subir un video de varios gigas. Escribe en un archivo provisional y solo al
// terminar le da su nombre, para que nunca quede un archivo a medias. Devuelve el tamaño.
function saveBody(req, res, file, limit) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > limit) {
      // No se lee lo que falta por llegar: se responde y se corta la conexión.
      res.setHeader('Connection', 'close');
      reject(new HttpError(413, TOO_BIG));
      return;
    }
    const partial = `${file}.parcial`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = fs.createWriteStream(partial);
    let size = 0;
    let failed = false;
    const fail = (err) => {
      if (failed) return;
      failed = true;
      req.unpipe(out);
      out.destroy();
      fs.rm(partial, { force: true }, () => {});
      reject(err);
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        res.setHeader('Connection', 'close');
        fail(new HttpError(413, TOO_BIG));
      }
    });
    req.on('aborted', () => fail(new HttpError(400, 'La subida se interrumpió.')));
    req.on('error', fail);
    out.on('error', fail);
    out.on('finish', () => {
      if (failed) return;
      if (!size) {
        fail(new HttpError(400, 'El archivo está vacío.'));
        return;
      }
      fs.rename(partial, file, (err) => (err ? fail(err) : resolve(size)));
    });
    req.pipe(out);
  });
}

// Interpreta la cabecera Range ("bytes=0-499", "bytes=500-", "bytes=-500"), que es lo que
// usa un video para saltar a un punto sin descargar el archivo entero.
// Devuelve { start, end } (ambos incluidos); null si no pide un trozo (se envía entero);
// false si pide un trozo que no existe.
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) {
    const last = Number(m[2]);
    return last > 0 && size > 0 ? { start: Math.max(0, size - last), end: size - 1 } : false;
  }
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start < size && start <= end ? { start, end } : false;
}

// Envía un archivo. Atiende trozos (Range) y evita reenviar lo que el navegador ya tiene (ETag).
// Devuelve false si el archivo no existe.
function sendFile(req, res, file) {
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    ETag: etag,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  // Si el archivo cambió desde que el navegador pidió el primer trozo, se envía entero.
  const stale = req.headers['if-range'] && req.headers['if-range'] !== etag;
  const range = stale ? null : parseRange(req.headers.range, stat.size);
  if (range === false) {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
    res.end();
    return true;
  }
  if (range) {
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`, 'Content-Length': range.end - range.start + 1 });
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  }
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  const stream = fs.createReadStream(file, range || undefined);
  stream.on('error', () => res.destroy());
  // Al saltar dentro de un video el navegador abandona la petición anterior: se suelta el archivo.
  res.on('close', () => stream.destroy());
  stream.pipe(res);
  return true;
}

export function createRouter({ webDir, sessions }) {
  const routes = [];
  const mounts = []; // carpetas de contenido servidas bajo un prefijo: { prefix: '/media/', dir }

  // route('GET', '/api/bible/:id/books', handler). El handler devuelve un objeto (se envía como JSON)
  // o undefined si ya respondió por su cuenta.
  function route(method, pattern, handler) {
    const keys = [];
    const rx = new RegExp(`^${pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, rx, keys, handler });
  }

  // mount('/himnario/', carpeta): sirve los archivos de esa carpeta bajo ese prefijo.
  function mount(prefix, dir) {
    mounts.push({ prefix, dir: path.resolve(dir) });
  }

  function sendJson(res, status, body) {
    res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  function serveFrom(req, res, baseDir, relPath) {
    const file = path.join(baseDir, relPath);
    if (!file.startsWith(baseDir + path.sep)) return false;
    return sendFile(req, res, file);
  }

  function serveStatic(pathname, req, res) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return false; }
    const mounted = mounts.find((m) => rel.startsWith(m.prefix));
    if (mounted) return serveFrom(req, res, mounted.dir, rel.slice(mounted.prefix.length));
    if (rel === '/') rel = '/index.html';
    else if (!path.extname(rel)) rel += '.html';
    return serveFrom(req, res, webDir, rel.slice(1));
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const isLocal = LOOPBACK.has(req.socket.remoteAddress);
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
          isLocal,
          ip: req.socket.remoteAddress,
          session: sessions.fromRequest(req),
          async json() {
            if (!/^application\/json/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Se esperaba JSON.');
            const raw = await readBody(req, 1024 * 1024);
            try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new HttpError(400, 'JSON no válido.'); }
          },
          // Cuerpo pequeño, en memoria. Para archivos, save().
          raw: (limit) => readBody(req, limit),
          // Guarda el cuerpo en un archivo, sin límite de memoria. Devuelve el tamaño en bytes.
          save: (file, limit) => saveBody(req, res, file, limit),
          // Responde con un archivo del equipo (con saltos, para video y audio).
          file(absolute) {
            if (!sendFile(req, res, absolute)) throw new HttpError(404, 'Ese archivo ya no está disponible.');
          },
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
      const reads = req.method === 'GET' || req.method === 'HEAD';
      if (reads && !url.pathname.startsWith('/api/') && serveStatic(url.pathname, req, res)) return;
      // Una dirección de /api/ que no existe suele ser una interfaz más nueva que el servidor abierto.
      sendJson(res, 404, { error: url.pathname.startsWith('/api/') ? 'Manna no reconoce esa orden. Si acabas de actualizarlo, reinícialo desde Ajustes.' : 'No encontrado.' });
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : 'Error interno del servidor.' });
    }
  }

  return { route, mount, handle };
}
