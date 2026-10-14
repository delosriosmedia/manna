// Auditoría de adaptación a pantallas: abre la app real en un Chrome sin ventana, con los tamaños
// de los dispositivos que se usan en la iglesia, y comprueba lo que importa para operar:
//
//   - nada se sale por los lados (sin desplazamiento horizontal)
//   - el dock de módulos está a la vista (en el celular va abajo, con nombres, y se desliza si no caben)
//   - lo que está al aire se ve y se gobierna siempre. Escritorio y tableta horizontal (860 px o más): la barra
//     de estado y los botones de la barra de transporte, a la vista, y las piezas flotantes (cajón, cola, tarjeta
//     «Preparado», barras, dock) sin pisarse. Celular: el
//     recuadro de «Historias» por encima del cajón (o, con el cajón a pantalla completa, el estado «AL AIRE»)
//   - la acción principal de cada pantalla (Proyectar), dentro del cajón, se alcanza sin desplazarse y nada la tapa
//   - queda sitio útil para el contenido (lista de versículos, orden del culto)
//   - en pantallas táctiles, los botones tienen tamaño para el dedo (40 px o más)
//   - los títulos largos del orden del culto se leen (no se cortan en una sola línea)
//   - los mandos en vivo de lo que está al aire caben, en la capa «Mandos» y en el orden
//   - los resultados de la búsqueda y el aviso de un módulo al que le falta un programa caben
//   - la tarjeta de un televisor y su control remoto caben, con teclas para el dedo
//   - la biblioteca de imágenes deja a la vista su acción principal, y los mandos de una imagen
//     al aire caben en la capa de mandos
//   - el himnario (todos, por categorías y lo encontrado al buscar) deja a la vista «Proyectar» y el
//     sonido elegido, y los mandos de un himno al aire (cantado o pista, avance, volumen) caben
//   - en Diapositivas, las presentaciones y las diapositivas de la elegida dejan a la vista
//     «Proyectar», y los mandos de una diapositiva al aire (por dónde va, la que sigue, acercar) caben
//   - el Presentador (sin escenario) deja a la vista la diapositiva grande, Anterior / Siguiente /
//     Negro, las herramientas de señalar y mover y los mandos en vivo, y su lista de presentaciones cabe
//   - Páginas web: la lista (una de internet que se deja mostrar, otra que no y un archivo HTML, con nombres
//     largos) y la barra de la elegida caben y dejan a la vista «Proyectar»
//   - en la función de alabanza, el volumen de Manna está a la vista (barra de transporte; en el celular, grande bajo el recuadro)
//   - en YouTube, el campo del enlace cabe en la cabecera y los mandos de un video con subtítulos
//     en dos idiomas (botón y lista) caben en la capa de mandos
//
// Uso:  node scripts/auditar-responsive.mjs             resumen en la terminal
//       node scripts/auditar-responsive.mjs capturas    además guarda una imagen de cada pantalla
// Necesita Node 22 o superior y Chrome o Edge. Usa el puerto 8124 y datos temporales.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { killOnExit, sleep, startChrome } from './lib/chrome.mjs';
import { seedExample } from './lib/ejemplo.mjs';
import { startFakeTv } from './lib/tv-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8124;
const SHOTS = process.argv.includes('capturas');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-responsive-'));
const base = `http://localhost:${PORT}`;

const DEVICES = [
  { name: 'Celular pequeño, vertical', w: 360, h: 640, touch: true },
  { name: 'Celular, vertical', w: 390, h: 844, touch: true },
  { name: 'Celular grande, vertical', w: 430, h: 932, touch: true },
  { name: 'Celular, horizontal', w: 844, h: 390, touch: true },
  { name: 'Tableta, vertical', w: 768, h: 1024, touch: true },
  { name: 'Tableta, horizontal', w: 1024, h: 768, touch: true },
  { name: 'Tableta grande, horizontal', w: 1366, h: 1024, touch: true },
  { name: 'Portátil', w: 1280, h: 720, touch: false },
  { name: 'Escritorio', w: 1920, h: 1080, touch: false },
];

// Abre la capa «Mandos» (en el celular, con el botón de la tarjeta de lo al aire; en el resto, el de la barra de transporte).
const OPEN_CONTROLS = `(matchMedia('(max-width: 859px)').matches ? document.querySelector('.story-controls') : document.querySelector('.transport-bar .btn[aria-haspopup=dialog]')).click()`;

// Pantallas a revisar. prepare: lo que hay que hacer tras cargar. primary: la acción principal.
// page: se revisa con esa página web (id de data/paginas.json) al aire.
// show: se revisa con ese elemento del ejemplo al aire ('testcard', 'image', 'video', 'youtube' o 'slides': todos tienen mandos en vivo).
const SCREENS = [
  { name: 'Biblia', url: '/control#biblia', primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Biblia: búsqueda', url: '/control#biblia', inside: '.search-pop', settle: 1200,
    prepare: `(() => { const i = document.querySelector('.ws[data-module=biblia] .search input'); i.focus(); i.value = 'amor'; i.dispatchEvent(new Event('input')); })()` },
  { name: 'Biblia: libros', url: '/control#biblia', narrowOnly: true, prepare: `document.querySelector('.crumbs button').click()`, primary: '.abar .btn.primary', content: '.col-books' },
  { name: 'Comparador', url: '/control#comparador', primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Orden del culto', url: '/control#orden', content: '.olist', longTitles: true },
  // El equipo de la auditoría "no tiene" navegador para la proyección: Ajustes lleva su aviso.
  { name: 'Ajustes, con aviso', url: '/control#ajustes', content: '.settings', inside: '.ws-notice' },
  // La capa de mandos abierta: su recuadro cabe en la pantalla y trae los mandos de lo que está al aire.
  { name: 'Capa de mandos', url: '/control#orden', show: 'testcard', inside: '.controls-pop', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Control del orden', url: '/orden#orden', content: '.olist', longTitles: true },
  // La función de alabanza lleva el volumen de Manna siempre a la vista: en el celular, bajo la barra de "Al aire".
  { name: 'Servicio de alabanza', url: '/alabanza#himnario', content: '.hymns-body', primary: '.hymn-bar .btn.primary', inside: { wide: '.transport-bar .tb-volume', narrow: '.story-volume.big' }, settle: 700,
    prepare: `document.querySelector('.ws[data-module=himnario] .hymn')?.click()` },
  { name: 'Orden con mandos en vivo', url: '/control#orden', show: 'testcard', controls: '.odetail .live-controls' },
  { name: 'Al aire con mandos en vivo', url: '/control#ajustes', show: 'testcard', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Medios: imágenes', url: '/control#medios', content: '.media-body[data-panel=imagenes]', primary: '.media-bar[data-panel=imagenes] .btn.primary', inside: '.media-bar[data-panel=imagenes]', settle: 600,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=imagenes]').click(); document.querySelector('.media-body[data-panel=imagenes] .media-card .media-pick').click(); })()` },
  { name: 'Medios: videos', url: '/control#medios', content: '.media-body[data-panel=videos]', primary: '.media-bar[data-panel=videos] .btn.primary', inside: '.media-bar[data-panel=videos]', settle: 700,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=videos]').click(); document.querySelector('.media-body[data-panel=videos] .media-card .media-pick').click(); })()` },
  { name: 'Medios: audios', url: '/control#medios', content: '.media-body[data-panel=audios]', settle: 500,
    prepare: `document.querySelector('.media-tabs [data-tab=audios]').click()` },
  // El equipo de la auditoría "no tiene" yt-dlp: las pestañas de Medios llevan su aviso encima.
  { name: 'Medios: YouTube', url: '/control#medios', content: '.media-body[data-panel=youtube]', primary: '.media-bar[data-panel=youtube] .btn.primary', inside: '.yt-add', settle: 700,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=youtube]').click(); document.querySelector('.media-body[data-panel=youtube] .media-card[data-status=ready] .media-pick').click(); })()` },
  { name: 'Al aire con un video de YouTube', url: '/control#orden', show: 'youtube', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Al aire con un video', url: '/control#orden', show: 'video', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Orden con un video al aire', url: '/control#orden', show: 'video', controls: '.odetail .live-controls' },
  { name: 'Al aire con una imagen', url: '/control#medios', show: 'image', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Himnario', url: '/control#himnario', content: '.hymns-body', primary: '.hymn-bar .btn.primary', inside: '.hymn-bar', settle: 700,
    prepare: `document.querySelector('.ws[data-module=himnario] .hymn')?.click()` },
  { name: 'Himnario: categorías', url: '/control#himnario', content: '.hymns-body', inside: '.hymn-group header', settle: 700,
    prepare: `document.querySelector('.hymn-views [data-view=categories]').click()` },
  { name: 'Himnario: búsqueda', url: '/control#himnario', content: '.hymns-body', inside: '.hymn-hit', settle: 1100,
    prepare: `(() => { document.querySelector('.hymn-views [data-view=grid]').click(); const i = document.querySelector('.ws[data-module=himnario] .search input'); i.value = 'renglon inventado'; i.dispatchEvent(new Event('input')); })()` },
  { name: 'Al aire con un himno', url: '/control#himnario', show: 'song', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Orden con un himno al aire', url: '/control#orden', show: 'song', controls: '.odetail .live-controls' },
  { name: 'Diapositivas: presentaciones', url: '/control#diapositivas', content: '.decks', inside: '.deck' },
  { name: 'Diapositivas: una presentación', url: '/control#diapositivas', content: '.deck-pages', primary: '.deck-bar .btn.primary', inside: '.deck-bar', settle: 600,
    prepare: `document.querySelector('.ws[data-module=diapositivas] .deck-pick').click()` },
  { name: 'Al aire con una diapositiva', url: '/control#diapositivas', show: 'slides', controls: '.controls-pop .live-controls', prepare: OPEN_CONTROLS },
  { name: 'Orden con una diapositiva al aire', url: '/control#orden', show: 'slides', controls: '.odetail .live-controls' },
  // El Presentador no lleva escenario: noDock cambia ese control por la diapositiva grande y su fila de botones.
  { name: 'Presentador: elegir presentación', url: '/presentador', noDock: true, content: '.pr-choose', inside: '.pr-list .deck', settle: 600 },
  { name: 'Presentador: presentando', url: '/presentador', show: 'slides', noDock: true, primary: '.pr-main .transport .btn.primary', inside: '.pr-tools', controls: '.pr-side .live-controls', settle: 800 },
  // Con una página web al aire (un archivo propio): sin rejilla ni siguiente; la grande y Anterior / Siguiente / Negro a la vista (sus flechas van en la fila de botones, no en los mandos).
  { name: 'Presentador: una página web', url: '/presentador', page: 'archivo1', noDock: true, primary: '.pr-main .transport .btn.primary', inside: '.pr-tools', settle: 800 },
  { name: 'Páginas web', url: '/control#paginas', content: '.web-list', inside: '.web-item', settle: 400 },
  { name: 'Páginas web: una elegida', url: '/control#paginas', content: '.web-list', primary: '.ws[data-module=paginas] .abar .btn.primary', inside: '.ws[data-module=paginas] .abar', settle: 600,
    prepare: `document.querySelector('.ws[data-module=paginas] .web-pick').click()` },
  { name: 'Televisores', url: '/control#televisores', content: '.tvs', inside: '.tv' },
  { name: 'Televisores: control remoto', url: '/control#televisores', inside: '.modal', settle: 700,
    prepare: `[...document.querySelectorAll('.tv-actions .btn')].find((b) => b.textContent === 'Control remoto').click()` },
  { name: 'Inicio', url: '/', plain: '.role' },
  { name: 'Revisión del equipo', url: '/requisitos', plain: '.req' },
];

// ---- Lo que se mide dentro de la página ----
const MEASURE = (screen, touch, narrow) => {
  const inside = typeof screen.inside === 'object' ? (narrow ? screen.inside.narrow : screen.inside.wide) : screen.inside;
  return `(() => {
  const vw = innerWidth, vh = innerHeight;
  const box = (el) => el && el.getBoundingClientRect();
  const shown = (el) => { if (!el) return false; const r = box(el); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const inView = (el) => { if (!shown(el)) return false; const r = box(el); return r.top >= -1 && r.left >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1; };
  const q = (s) => document.querySelector(s);
  const out = {};
  out.sinDesborde = document.documentElement.scrollWidth <= vw + 1 && document.body.scrollWidth <= vw + 1;
  if (${JSON.stringify(touch)}) {
    const small = [...document.querySelectorAll('button, a[href], select, summary, input:not([type=range]):not([type=color]):not([type=file])')]
      .filter((el) => shown(el) && !el.disabled && !el.closest('.soon') && !el.closest('[hidden]'))
      .filter((el) => { const r = box(el); const p = el.closest('label.search'); const b = p ? box(p) : r; return Math.min(b.width, b.height) < 39.5; })
      .map((el) => (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 24));
    out.dedos = small.length === 0;
    if (small.length) out.pequenos = [...new Set(small)].slice(0, 6);
  }
  if (${JSON.stringify(Boolean(screen.plain))}) return out;
  // El dock de módulos: a la vista y con sus iconos al alcance. Si no caben todos, se desliza, pero al menos cuatro se ven.
  // La función "Control del orden" (un solo módulo) no lo lleva; el Presentador, tampoco (sin escenario).
  const items = [...document.querySelectorAll('.dockbar .dock-item')];
  const bar = q('.dockbar');
  // Con una capa abierta (los mandos, una ventana) lo de debajo queda tapado a propósito: ahí solo cuenta la geometría.
  const covered = Boolean(q('.controls-layer:not([hidden])') || q('.modal-backdrop'));
  const topmost = (el) => { if (covered) return true; const r = box(el); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(t) && el.contains(t); };
  if (!${JSON.stringify(Boolean(screen.noDock))}) {
    const seen = items.filter((b) => inView(b) && topmost(b)).length;
    const slides = bar && (bar.scrollWidth > bar.clientWidth + 1 || bar.scrollHeight > bar.clientHeight + 1);
    out.navegacion = items.length <= 1 || (inView(bar) && (seen === items.length || (slides && seen >= Math.min(4, items.length))));
  }
  if (${JSON.stringify(Boolean(screen.noDock))}) {
    out.alAire = shown(q('.pr-live')) ? inView(q('.pr-live')) && [...document.querySelectorAll('.pr-main .transport .btn')].every(inView) : true;
  } else {
    const drawer = q('.drawer');
    const dr = shown(drawer) ? box(drawer) : null;
    if (!${JSON.stringify(narrow)}) {
      // Escritorio y tableta horizontal: la barra de estado y los botones de transporte, a la vista y fuera del cajón.
      const buttons = [...document.querySelectorAll('.transport-bar .btn')].filter(shown);
      out.alAire = inView(q('.scene-status')) && buttons.length >= 4 && buttons.every((b) => inView(b) && topmost(b));
      // Las piezas flotantes (barra de estado, función, dock, cajón, cola, «Preparado» y transporte) no se pisan.
      const names = ['.scene-status', '.role-chip', '.dockbar', '.drawer', '.queue', '.prep', '.transport-bar'].filter((n) => shown(q(n)));
      const hits = [];
      names.forEach((a, i) => names.slice(i + 1).forEach((b) => { const x = box(q(a)), y = box(q(b)); if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1) hits.push(a + ' con ' + b + ' (' + Math.round(Math.min(x.right, y.right) - Math.max(x.left, y.left)) + ' × ' + Math.round(Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)) + ' px)'); }));
      out.solape = names.length >= 5 && hits.length === 0;
      if (hits.length) out.solapan = hits;
    } else {
      // Celular: el recuadro de «Historias» por encima del cajón; con el cajón a pantalla completa, el estado arriba.
      const frame = q('.story-frame');
      out.alAire = dr && drawer.classList.contains('wide') ? inView(q('.drawer .scene-mini .live-pill')) : inView(frame) && (!dr || box(frame).bottom <= dr.top + 1);
      if (shown(frame)) { const m = box(frame); out.monitorProporcion = Math.abs(m.width / m.height - 16 / 9) < 0.08; }
    }
  }
  ${screen.primary ? `{ const a = q(${JSON.stringify(screen.primary)}); out.accion = inView(a) && topmost(a) && (${JSON.stringify(Boolean(screen.noDock))} || Boolean(a.closest('.drawer'))); }` : ''}
  ${screen.content ? `{ const c = [...document.querySelectorAll(${JSON.stringify(screen.content)})].find(shown); out.espacioContenido = c ? Math.round(Math.min(box(c).bottom, vh) - Math.max(box(c).top, 0)) : 0; }` : ''}
  ${screen.longTitles ? `{ const t = [...document.querySelectorAll('.orow .item-text strong')].find((e) => e.textContent.length > 60); out.tituloLargo = Boolean(t) && t.scrollHeight <= t.clientHeight + 1; }` : ''}
  ${inside ? `{ const e = q(${JSON.stringify(inside)}); const r = box(e); out.dentro = shown(e) && r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1 && [...e.querySelectorAll('button')].every((b) => !shown(b) || (box(b).left >= r.left - 1 && box(b).right <= r.right + 1)); }` : ''}
  ${screen.controls ? `{ const c = q(${JSON.stringify(screen.controls)}); const r = box(c);
    // El volumen general no va en los mandos de la capa (vive en la barra de transporte): su CSS lo oculta a propósito.
    const list = [...c.querySelectorAll('button, select')].filter((b) => !b.closest('.volume'));
    out.mandos = shown(c) && list.length > 0 && r.left >= -1 && r.right <= vw + 1 && list.every((b) => { const x = box(b); return shown(b) && x.left >= r.left - 1 && x.right <= r.right + 1; }); }` : ''}
  return out;
})()`;
};

// Espera a que la pantalla haya terminado de dibujarse (hasta 8 s), en vez de una pausa fija.
async function ready(screen) {
  const done = screen.plain ? `document.querySelector(${JSON.stringify(screen.plain)})`
    : `document.querySelector('.ws:not([hidden])') && (!document.querySelector('.ws:not([hidden]) .picker') || document.querySelector('.ws:not([hidden]) .verse')) && document.querySelector('.scene-caption')?.textContent`;
  for (let i = 0; i < 40; i += 1) {
    await sleep(200);
    if (await chrome.evaluate(`Boolean(${done})`)) break;
  }
  await sleep(350);
}

const LABELS = { sinDesborde: 'sin desborde lateral', navegacion: 'dock de módulos a la vista', alAire: 'lo que está al aire y sus botones a la vista', solape: 'cajón, cola, tarjeta «Preparado» y barras sin pisarse', monitorProporcion: 'recuadro de la proyección sin deformar', accion: 'acción principal a la vista y sin nada encima', tituloLargo: 'títulos largos legibles', mandos: 'mandos en vivo completos y sin salirse', dentro: 'el recuadro cabe en la pantalla', dedos: 'botones para el dedo' };
const MIN_CONTENT = 150;

// Un televisor de mentira, ya vinculado, para revisar su tarjeta y su control remoto.
const fakeTv = await startFakeTv();
fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'data', 'televisores.json'), JSON.stringify({
  list: [{ id: 'tele', ip: '192.168.1.50', name: 'Televisor del salón de jóvenes', model: 'QN00PRUEBA', token: fakeTv.token }],
}));
// Tres páginas web, sin internet: se escriben ya "agregadas" (dos direcciones, una que se deja mostrar y otra
// que no, y un archivo HTML), con nombres largos para ver que no desbordan.
fs.mkdirSync(path.join(tmp, 'data', 'paginas'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'data', 'paginas', 'archivo1.html'), '<!doctype html><title>Juego</title><body>Juego de la iglesia</body>');
fs.writeFileSync(path.join(tmp, 'data', 'paginas.json'), JSON.stringify({ pages: [
  { id: 'enlace1', name: 'Presentación de la escuela sabática con un nombre muy largo para ver cómo se corta en el celular', source: 'url', url: 'http://localhost:9/design/ejemplo-de-una-direccion-larga/view', framable: true, added: 3 },
  { id: 'enlace2', name: 'Concurso bíblico', source: 'url', url: 'https://kahoot.it/', framable: false, added: 2 },
  { id: 'archivo1', name: 'Juego de la iglesia', source: 'file', url: null, framable: true, added: 1 },
] }));
// El ejemplo se escribe antes de arrancar: el servidor lee el orden y la biblioteca al abrirse.
const example = seedExample(path.join(tmp, 'data'));
const server = killOnExit(spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, MANNA_NAME: 'manna-auditoria', MANNA_NO_OPEN: '1', MANNA_SIN_VENTANA: '1', MANNA_DATA: path.join(tmp, 'data'), PORT: String(PORT), MANNA_HIMNARIO: example.hymnal, MANNA_FALTA: 'navegador,yt-dlp', MANNA_TV_PRUEBA: JSON.stringify(fakeTv.endpoints) },
}));
const showInOrder = (id) => chrome.evaluate(`fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'order.show',payload:{id:${JSON.stringify(id)}}})}).then((r) => r.status)`);
await sleep(3000);
const chrome = await startChrome();
chrome.acceptDialogs = true;
let problems = 0;
try {
  await chrome.send('Page.navigate', { url: `${base}/control` });
  await sleep(2000);
  await showInOrder(example.live);

  for (const device of DEVICES) {
    const narrow = device.w < 860;
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: device.w, height: device.h, deviceScaleFactor: 1, mobile: device.touch });
    await chrome.send('Emulation.setTouchEmulationEnabled', { enabled: device.touch });
    console.log(`\n${device.name} (${device.w} × ${device.h})`);
    for (const screen of SCREENS) {
      if (screen.narrowOnly && !narrow) continue;
      if (screen.show) await showInOrder(example[screen.show]);
      if (screen.page) await chrome.evaluate(`fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'projection.show',payload:{kind:'web',data:{id:${JSON.stringify(screen.page)}}}})}).then((r) => r.status)`);
      // La dirección cambia en cada visita para forzar una carga limpia de la página.
      const [pathname, hash = ''] = screen.url.split('#');
      await chrome.send('Page.navigate', { url: `${base}${pathname}?t=${Date.now()}${hash ? `#${hash}` : ''}` });
      await ready(screen);
      if (screen.prepare) { await chrome.evaluate(screen.prepare); await sleep(screen.settle || 500); }
      const result = await chrome.evaluate(`JSON.stringify(${MEASURE(screen, device.touch, narrow)})`);
      const m = JSON.parse(result || '{}');
      const failures = Object.keys(LABELS).filter((k) => m[k] === false).map((k) => LABELS[k] + (k === 'dedos' ? `: ${m.pequenos.join(', ')}` : k === 'solape' && m.solapan ? `: ${m.solapan.join('; ')}` : ''));
      if (m.espacioContenido !== undefined && m.espacioContenido < MIN_CONTENT) failures.push(`poco espacio para el contenido (${m.espacioContenido} px)`);
      problems += failures.length;
      const room = m.espacioContenido !== undefined ? ` · contenido ${m.espacioContenido} px` : '';
      console.log(`  ${failures.length ? '✖' : '✔'} ${screen.name}${room}${failures.length ? `\n      ${failures.join('\n      ')}` : ''}`);
      if (SHOTS) {
        const png = await chrome.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(tmp, `${device.w}x${device.h} ${screen.name.replace(/[:"]/g, '')}.png`);
        fs.writeFileSync(file, Buffer.from(png.result.data, 'base64'));
      }
      if (screen.show || screen.page) await showInOrder(example.live);
    }
  }
} finally {
  chrome.close();
  server.kill();
  await fakeTv.stop();
  await sleep(800);
  if (!SHOTS) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}

if (SHOTS) console.log(`\nCapturas en: ${tmp}`);
console.log(problems ? `\n${problems} problema(s) encontrados.` : '\nSin problemas en ninguna pantalla.');
process.exit(problems ? 1 : 0);
