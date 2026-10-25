import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { cleanName } from '../../core/names.js';

// Módulo Páginas web: presentaciones y juegos que viven en una página (Canva, Google Slides,
// Genially, Kahoot) o en un archivo HTML propio, proyectados a pantalla completa.
//
// Llegan de dos formas:
//   - una dirección: se proyecta tal cual y necesita internet durante el culto. Al agregarla, Manna
//     pide la página y mira si se deja mostrar dentro de otra (framable). Si se deja, se ve en todas
//     las pantallas; si no, el proyector la abre en su propia ventana (`window`, ver el módulo de
//     proyección) y las demás pantallas muestran una tarjeta;
//   - un archivo .html: se guarda en data/paginas/ (no en data/media/, que se sirve sin encerrar) y
//     se sirve encerrado (sandbox): con un origen propio, no puede dar órdenes a Manna. Lleva un
//     puente (BRIDGE) que recibe las flechas, para pasarla desde cualquier dispositivo.
//
// Ficha en data/paginas.json: { id, name, source: 'file' | 'url', url, framable, added }

const FILE_LIMIT = 50 * 1024 * 1024;
const CHECK_MS = 10_000;
const KEYS = ['ArrowLeft', 'ArrowRight'];
// shortcut: se recuerdan las últimas pulsaciones; una pantalla que se abre tarde no repite las anteriores a estas.
const MAX_PRESSES = 300;
// Lo que se añade al final de cada archivo HTML: las flechas que manda Manna llegan a la página
// como si se pulsaran en ella (con keyCode, que es lo que miran muchas presentaciones).
const BRIDGE = `
<script>addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||d.manna!=='tecla')return;var c={ArrowLeft:37,ArrowRight:39}[d.key];if(!c)return;['keydown','keyup'].forEach(function(t){var k=new KeyboardEvent(t,{key:d.key,code:d.key,bubbles:true,cancelable:true});try{Object.defineProperty(k,'keyCode',{get:function(){return c}});Object.defineProperty(k,'which',{get:function(){return c}})}catch(_){}(document.activeElement||document.body||document).dispatchEvent(k)})})</script>
`;

// ¿Se deja mostrar dentro de otra página? Lo dicen sus cabeceras X-Frame-Options y frame-ancestors
// (de Content-Security-Policy). Lo que una página impida con su propio JavaScript no se ve aquí.
export function framable(header) {
  if (/deny|sameorigin/i.test(header('x-frame-options') || '')) return false;
  const ancestors = /(?:^|;)\s*frame-ancestors([^;]*)/i.exec(header('content-security-policy') || '');
  return !ancestors || /(^|\s)\*(\s|$)/.test(ancestors[1]);
}

// ¿Es del propio equipo o de la red local? Esas solo las agrega el equipo principal (auditoría de la fase 9, cerrado en la
// 36): desde fuera, Manna no se pone a pedir direcciones de la red de la iglesia.
// shortcut: se mira la dirección escrita, no la IP a la que lleva su nombre; si hiciera falta, resolverla antes de pedirla.
export function isLocalPage(address) {
  const host = new URL(address).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(localhost|local)$/.test(host) || host === '::1' || /^(fc|fd|fe80)/.test(host)) return true;
  const ip = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

// La dirección que escribe la persona, completa ("canva.com/…" → "https://canva.com/…").
export function parseAddress(text) {
  const raw = String(text ?? '').trim();
  let url = null;
  try { url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { /* no es una dirección */ }
  if (!url || !/^https?:$/.test(url.protocol) || (!url.hostname.includes('.') && url.hostname !== 'localhost') || raw.length > 2000) {
    throw new HttpError(400, 'Escribe la dirección de la página, por ejemplo https://www.canva.com/…');
  }
  return url.href;
}

// Se reconoce por su contenido: texto (sin bytes nulos) con alguna etiqueta de HTML al principio.
function isHtml(file) {
  const head = Buffer.alloc(4096);
  const fd = fs.openSync(file, 'r');
  const size = fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  const text = head.subarray(0, size);
  return !text.includes(0) && /<(!doctype\s+html|html|head|body|meta|title|script|style|div|section|svg)\b/i.test(text.toString('latin1'));
}

export default function setup(app) {
  const { store } = app;
  const dir = path.join(app.dataDir, 'paginas');
  const saved = app.storage('paginas', { pages: [] });
  const pages = () => saved.data.pages;
  const fileOf = (id) => path.join(dir, `${id}.html`);
  const src = (page) => (page.source === 'file' ? `/paginas/${page.id}` : page.url);
  const subtitle = (page) => (page.source === 'file' ? 'Archivo HTML' : `${new URL(page.url).hostname}${page.framable ? '' : ' · en su propia ventana'}`);
  const view = (page) => ({ id: page.id, name: page.name, source: page.source, url: src(page), framable: page.framable, added: page.added, subtitle: subtitle(page) });
  const publish = () => store.set('web', { pages: [...pages()].sort((a, b) => b.added - a.added).map(view) });
  const commit = () => {
    saved.save();
    publish();
  };
  const find = (id) => {
    const page = pages().find((p) => p.id === id);
    if (!page) throw new HttpError(404, 'Esa página ya no está en la biblioteca.');
    return page;
  };
  store.register('web', { pages: [] });
  publish();

  // ---- Tipo de contenido ----
  // data = { id }. Un solo paso. Un archivo propio y lo que va en su propia ventana tienen mandos: las
  // flechas que se han pulsado, en orden, y cuántas van. Al archivo se las entrega cada pantalla (también
  // la que se abra tarde); a la ventana, el módulo de proyección.
  // Va también en una capa (módulo layers), si se deja mostrar dentro de Manna.
  app.kind('web', {
    label: 'Página web',
    layer: true,
    describe(data) {
      const page = pages().find((p) => p.id === data?.id);
      return page ? { title: page.name, subtitle: subtitle(page), steps: 1, data: { id: page.id } } : null;
    },
    resolve(data) {
      const page = pages().find((p) => p.id === data?.id);
      if (!page) return null;
      return { id: page.id, title: page.name, url: src(page), file: page.source === 'file', window: page.framable ? null : page.url };
    },
    live: (content, previous) => (content.file || content.window ? { presses: previous?.state?.presses ?? [], count: previous?.state?.count ?? 0 } : null),
    control(state, { key }, { content }) {
      if (!(content.file || content.window) || !KEYS.includes(key)) throw new HttpError(400, 'Esa página no se puede pasar desde aquí.');
      return { presses: [...(state?.presses || []), key].slice(-MAX_PRESSES), count: (state?.count || 0) + 1 };
    },
  });

  // ---- Agregar ----
  app.action('web.add', { permission: 'web.edit' }, async ({ url, name }, ctx) => {
    const address = parseAddress(url);
    // ctx falta cuando la pide otro módulo (app.run): eso es del propio Manna.
    if (ctx && !ctx.isLocal && isLocalPage(address)) throw new HttpError(403, 'Una página del propio equipo o de la red de la iglesia solo se agrega desde el equipo principal.');
    let response;
    try {
      // Como un navegador: algunos sitios no responden igual a un programa.
      response = await fetch(address, { redirect: 'follow', signal: AbortSignal.timeout(CHECK_MS), headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
    } catch {
      throw new HttpError(502, 'No se pudo abrir esa dirección. Comprueba que está bien escrita y que el equipo principal tiene internet.');
    }
    response.body?.cancel().catch(() => {});
    // Una página que responde con un error a Manna puede abrirse en un navegador: va en su propia ventana, que siempre sirve.
    const page = {
      id: crypto.randomBytes(6).toString('hex'), name: cleanName(name) || new URL(address).hostname.replace(/^www\./, ''),
      source: 'url', url: address, framable: response.ok && framable((h) => response.headers.get(h)), added: Date.now(),
    };
    pages().push(page);
    commit();
    return view(page);
  });

  app.route('POST', '/api/web', async (ctx) => {
    ctx.require('web.edit');
    const id = crypto.randomBytes(6).toString('hex');
    await ctx.save(fileOf(id), FILE_LIMIT);
    if (!isHtml(fileOf(id))) {
      fs.rmSync(fileOf(id), { force: true });
      throw new HttpError(415, 'Ese archivo no es una página HTML.');
    }
    const page = { id, name: cleanName(ctx.query.get('name')) || 'Página', source: 'file', url: null, framable: true, added: Date.now() };
    pages().push(page);
    commit();
    return view(page);
  });

  // El archivo, encerrado: la cabecera le da un origen propio aunque se abra suelto, fuera de la proyección.
  app.route('GET', '/paginas/:id', (ctx) => {
    let html;
    try { html = fs.readFileSync(fileOf(find(ctx.params.id).id)); } catch { throw new HttpError(404, 'Esa página ya no está.'); }
    // En UTF-8 aunque el archivo no lo diga: si no, el navegador lee las tildes como Windows-1252 («pÃ¡gina»).
    ctx.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': 'sandbox allow-scripts', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    ctx.res.end(Buffer.concat([html, Buffer.from(BRIDGE)]));
  });

  // ---- Órdenes ----
  app.action('web.rename', { permission: 'web.edit' }, ({ id, name }) => {
    const clean = cleanName(name);
    if (!clean) throw new HttpError(400, 'Escribe un nombre.');
    find(id).name = clean;
    commit();
    app.services.projection?.refresh();
  });

  app.action('web.remove', { permission: 'web.edit' }, ({ id }) => {
    const page = find(id);
    if (page.source === 'file') fs.rmSync(fileOf(page.id), { force: true });
    saved.data.pages = pages().filter((p) => p.id !== id);
    commit();
  });
}
