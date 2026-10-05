// Auditoría de adaptación a pantallas: abre la app real en un Chrome sin ventana, con los tamaños
// de los dispositivos que se usan en la iglesia, y comprueba lo que importa para operar:
//
//   - nada se sale por los lados (sin desplazamiento horizontal)
//   - la navegación entre módulos está a la vista
//   - "Al aire" y sus mandos (anterior / siguiente) están siempre a la vista
//   - la acción principal de cada pantalla (Proyectar) se alcanza sin desplazarse
//   - queda sitio útil para el contenido (lista de versículos, orden del culto)
//   - en pantallas táctiles, los botones tienen tamaño para el dedo (40 px o más)
//   - los títulos largos del orden del culto se leen (no se cortan en una sola línea)
//   - los mandos en vivo de lo que está al aire caben, en el panel y en el orden
//   - los resultados de la búsqueda y el aviso de un módulo al que le falta un programa caben
//   - la tarjeta de un televisor y su control remoto caben, con teclas para el dedo
//   - la biblioteca de imágenes deja a la vista su acción principal, y los mandos de una imagen
//     al aire caben en el panel
//
// Uso:  node scripts/auditar-responsive.mjs             resumen en la terminal
//       node scripts/auditar-responsive.mjs capturas    además guarda una imagen de cada pantalla
// Necesita Node 22 o superior y Chrome o Edge. Usa el puerto 8124 y datos temporales.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep, startChrome } from './lib/chrome.mjs';
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

// Pantallas a revisar. prepare: lo que hay que hacer tras cargar. primary: la acción principal.
// show: se revisa con ese elemento del ejemplo al aire ('testcard' o 'image': los dos tienen mandos en vivo).
const SCREENS = [
  { name: 'Biblia', url: '/control#biblia', primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Biblia: búsqueda', url: '/control#biblia', inside: '.search-pop', settle: 1200,
    prepare: `(() => { const i = document.querySelector('.ws[data-module=biblia] .search input'); i.focus(); i.value = 'amor'; i.dispatchEvent(new Event('input')); })()` },
  { name: 'Biblia: libros', url: '/control#biblia', narrowOnly: true, prepare: `document.querySelector('.crumbs button').click()`, primary: '.abar .btn.primary', content: '.col-books' },
  { name: 'Comparador', url: '/control#comparador', primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Orden del culto', url: '/control#orden', content: '.olist', longTitles: true },
  // El equipo de la auditoría "no tiene" navegador para la proyección: Ajustes lleva su aviso.
  { name: 'Ajustes, con aviso', url: '/control#ajustes', content: '.settings', inside: '.ws-notice' },
  { name: 'Al aire desplegado', url: '/control#orden', narrowOnly: true, prepare: `document.querySelector('.dock-mini-main').click()`, sheet: true },
  { name: 'Control del orden', url: '/orden', content: '.olist', longTitles: true },
  { name: 'Orden con mandos en vivo', url: '/control#orden', show: 'testcard', controls: '.odetail .live-controls' },
  { name: 'Al aire con mandos en vivo', url: '/control#ajustes', show: 'testcard', controls: '.dock .live-controls', prepare: `document.querySelector('.dock-mini-main')?.click()`, sheet: 'narrow' },
  { name: 'Medios: imágenes', url: '/control#medios', content: '.media-body[data-panel=imagenes]', primary: '.media-bar[data-panel=imagenes] .btn.primary', inside: '.media-bar[data-panel=imagenes]', settle: 600,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=imagenes]').click(); document.querySelector('.media-body[data-panel=imagenes] .media-card .media-pick').click(); })()` },
  { name: 'Medios: videos', url: '/control#medios', content: '.media-body[data-panel=videos]', primary: '.media-bar[data-panel=videos] .btn.primary', inside: '.media-bar[data-panel=videos]', settle: 700,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=videos]').click(); document.querySelector('.media-body[data-panel=videos] .media-card .media-pick').click(); })()` },
  { name: 'Medios: audios', url: '/control#medios', content: '.media-body[data-panel=audios]', settle: 500,
    prepare: `document.querySelector('.media-tabs [data-tab=audios]').click()` },
  { name: 'Al aire con un video', url: '/control#orden', show: 'video', controls: '.dock .live-controls', prepare: `document.querySelector('.dock-mini-main')?.click()`, sheet: 'narrow' },
  { name: 'Orden con un video al aire', url: '/control#orden', show: 'video', controls: '.odetail .live-controls' },
  { name: 'Al aire con una imagen', url: '/control#medios', show: 'image', controls: '.dock .live-controls', prepare: `document.querySelector('.dock-mini-main')?.click()`, sheet: 'narrow' },
  { name: 'Televisores', url: '/control#televisores', content: '.tvs', inside: '.tv' },
  { name: 'Televisores: control remoto', url: '/control#televisores', inside: '.modal', settle: 700,
    prepare: `[...document.querySelectorAll('.tv-actions .btn')].find((b) => b.textContent === 'Control remoto').click()` },
  { name: 'Inicio', url: '/', plain: '.role' },
  { name: 'Revisión del equipo', url: '/requisitos', plain: '.req' },
];

// ---- Lo que se mide dentro de la página ----
const MEASURE = (screen, touch) => `(() => {
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
  const nav = shown(q('.rail')) ? '.rail .rail-item:not(.soon)' : '.tabbar button';
  const navItems = [...document.querySelectorAll(nav)];
  // Con un solo módulo (función "Control del orden") no hay nada entre lo que navegar.
  out.navegacion = navItems.length <= 1 || navItems.every(inView);
  if (${JSON.stringify(Boolean(screen.sheet))} && !shown(q('.rail'))) {
    out.alAire = inView(q('.dock-body .monitor')) && [...document.querySelectorAll('.dock-body > .transport .btn')].every(inView);
    const m = box(q('.dock-body .monitor'));
    out.monitorProporcion = Math.abs(m.width / m.height - 16 / 9) < 0.08;
  } else {
    const wideDock = shown(q('.dock-body'));
    out.alAire = wideDock
      ? inView(q('.dock-body .monitor')) && [...document.querySelectorAll('.dock-body > .transport .btn')].every(inView)
      : inView(q('.dock-mini')) && [...document.querySelectorAll('.dock-mini .icon-btn')].every(inView);
  }
  ${screen.primary ? `out.accion = inView(q(${JSON.stringify(screen.primary)}));` : ''}
  ${screen.content ? `{ const c = [...document.querySelectorAll(${JSON.stringify(screen.content)})].find(shown); out.espacioContenido = c ? Math.round(Math.min(box(c).bottom, vh) - Math.max(box(c).top, 0)) : 0; }` : ''}
  ${screen.longTitles ? `{ const t = [...document.querySelectorAll('.orow .item-text strong')].find((e) => e.textContent.length > 60); out.tituloLargo = Boolean(t) && t.scrollHeight <= t.clientHeight + 1; }` : ''}
  ${screen.inside ? `{ const e = q(${JSON.stringify(screen.inside)}); const r = box(e); out.dentro = shown(e) && r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1 && [...e.querySelectorAll('button')].every((b) => !shown(b) || (box(b).left >= r.left - 1 && box(b).right <= r.right + 1)); }` : ''}
  ${screen.controls ? `{ const c = q(${JSON.stringify(screen.controls)}); const r = box(c); out.mandos = shown(c) && r.left >= -1 && r.right <= vw + 1 && [...c.querySelectorAll('button')].every((b) => { const x = box(b); return shown(b) && x.left >= r.left - 1 && x.right <= r.right + 1; }); }` : ''}
  return out;
})()`;

// Espera a que la pantalla haya terminado de dibujarse (hasta 8 s), en vez de una pausa fija.
async function ready(screen) {
  const done = screen.plain ? `document.querySelector(${JSON.stringify(screen.plain)})`
    : `document.querySelector('.ws:not([hidden])') && (!document.querySelector('.ws:not([hidden]) .picker') || document.querySelector('.ws:not([hidden]) .verse')) && document.querySelector('.dock-ref')?.textContent`;
  for (let i = 0; i < 40; i += 1) {
    await sleep(200);
    if (await chrome.evaluate(`Boolean(${done})`)) break;
  }
  await sleep(350);
}

const LABELS = { sinDesborde: 'sin desborde lateral', navegacion: 'navegación a la vista', alAire: '"Al aire" y mandos a la vista', monitorProporcion: 'monitor sin deformar', accion: 'acción principal a la vista', tituloLargo: 'títulos largos legibles', mandos: 'mandos en vivo completos y sin salirse', dentro: 'el recuadro cabe en la pantalla', dedos: 'botones para el dedo' };
const MIN_CONTENT = 150;

// Un televisor de mentira, ya vinculado, para revisar su tarjeta y su control remoto.
const fakeTv = await startFakeTv();
fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'data', 'televisores.json'), JSON.stringify({
  list: [{ id: 'tele', ip: '192.168.1.50', name: 'Televisor del salón de jóvenes', model: 'QN00PRUEBA', token: fakeTv.token }],
}));
// El ejemplo se escribe antes de arrancar: el servidor lee el orden y la biblioteca al abrirse.
const example = seedExample(path.join(tmp, 'data'));
const server = spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, MANNA_NAME: 'manna-auditoria', MANNA_NO_OPEN: '1', MANNA_SIN_VENTANA: '1', MANNA_DATA: path.join(tmp, 'data'), PORT: String(PORT), MANNA_FALTA: 'navegador,yt-dlp', MANNA_TV_PRUEBA: JSON.stringify(fakeTv.endpoints) },
});
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
      // La dirección cambia en cada visita para forzar una carga limpia de la página.
      const [pathname, hash = ''] = screen.url.split('#');
      await chrome.send('Page.navigate', { url: `${base}${pathname}?t=${Date.now()}${hash ? `#${hash}` : ''}` });
      await ready(screen);
      if (screen.prepare) { await chrome.evaluate(screen.prepare); await sleep(screen.settle || 500); }
      const result = await chrome.evaluate(`JSON.stringify(${MEASURE(screen, device.touch)})`);
      const m = JSON.parse(result || '{}');
      const failures = Object.keys(LABELS).filter((k) => m[k] === false).map((k) => LABELS[k] + (k === 'dedos' ? `: ${m.pequenos.join(', ')}` : ''));
      if (m.espacioContenido !== undefined && m.espacioContenido < MIN_CONTENT) failures.push(`poco espacio para el contenido (${m.espacioContenido} px)`);
      problems += failures.length;
      const room = m.espacioContenido !== undefined ? ` · contenido ${m.espacioContenido} px` : '';
      console.log(`  ${failures.length ? '✖' : '✔'} ${screen.name}${room}${failures.length ? `\n      ${failures.join('\n      ')}` : ''}`);
      if (SHOTS) {
        const png = await chrome.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(tmp, `${device.w}x${device.h} ${screen.name.replace(/[:"]/g, '')}.png`);
        fs.writeFileSync(file, Buffer.from(png.result.data, 'base64'));
      }
      if (screen.show) await showInOrder(example.live);
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
