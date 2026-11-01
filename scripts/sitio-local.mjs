// Abre data/sitio en este equipo, con los himnos y las biblias de Contenido en vez de los de Cloudflare.
//   node scripts/sitio-local.mjs [puerto]    MANNA_HIMNARIO: otra carpeta del himnario (las biblias, a su lado)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVOS, porLibro } from './himnos-publicos/biblias.mjs';
import worker from './himnos-publicos/worker.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = path.join(ROOT, 'data', 'sitio');
const HIMNARIO = process.env.MANNA_HIMNARIO || path.join(ROOT, 'Contenido', 'Himnario');
const VIDEOS = path.join(HIMNARIO, 'videos');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };

// Las citas pasan por el mismo Worker que en internet, con un depósito que lee las biblias de este equipo.
const leidas = new Map();
const deposito = {
  async get(clave) {
    const [, version, libro] = /^Portada\/biblias\/(\w+)\/(\d+)\.json$/.exec(clave) ?? [];
    if (!ARCHIVOS[version]) return null;
    if (!leidas.has(version)) leidas.set(version, porLibro(fs.readFileSync(path.join(HIMNARIO, '..', 'Biblias', ARCHIVOS[version]), 'utf8')));
    const capitulos = leidas.get(version)[libro];
    return capitulos ? { json: async () => capitulos } : null;
  },
};

http.createServer(async (pet, res) => {
  const ruta = decodeURIComponent(new URL(pet.url, 'http://x').pathname);
  if (ruta.startsWith('/himnos/biblia/')) {
    const respuesta = await worker.fetch(new Request(`https://himnos.manna-iglesia.es${ruta.slice('/himnos'.length)}`, { headers: { referer: 'https://manna-iglesia.es/' } }), { CONTENIDO: deposito });
    res.writeHead(respuesta.status, { 'content-type': 'application/json' });
    res.end(await respuesta.text());
    return;
  }
  const archivo = ruta.startsWith('/himnos/')
    ? path.join(VIDEOS, path.basename(ruta).normalize('NFD'))
    : path.join(SITIO, ruta.endsWith('/') ? `${ruta}index.html` : ruta);
  const real = [archivo, archivo.normalize('NFC')].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!real || !(real.startsWith(SITIO) || real.startsWith(VIDEOS))) { res.writeHead(404); res.end(); return; }
  const { size } = fs.statSync(real);
  const cabeceras = { 'content-type': TIPOS[path.extname(real)] || 'application/octet-stream', 'accept-ranges': 'bytes' };
  const rango = /^bytes=(\d*)-(\d*)$/.exec(pet.headers.range ?? '');
  if (!rango) { res.writeHead(200, { ...cabeceras, 'content-length': size }); fs.createReadStream(real).pipe(res); return; }
  const desde = rango[1] ? Number(rango[1]) : size - Number(rango[2]);
  const hasta = rango[1] && rango[2] ? Math.min(Number(rango[2]), size - 1) : size - 1;
  res.writeHead(206, { ...cabeceras, 'content-length': hasta - desde + 1, 'content-range': `bytes ${desde}-${hasta}/${size}` });
  fs.createReadStream(real, { start: desde, end: hasta }).pipe(res);
}).listen(Number(process.argv[2]) || 8766, '127.0.0.1', function listo() {
  console.log(`Sitio en http://localhost:${this.address().port}/`);
});
