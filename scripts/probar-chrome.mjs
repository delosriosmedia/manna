// Pruebas de extremo a extremo en un Chrome real (sin ventana). Cubren lo que no alcanzan
// las pruebas automáticas ni un navegador integrado:
//
//   0. La revisión del equipo: avisa de los programas que faltan y de qué módulos afecta, instala
//      uno mostrando el avance y no bloquea la app; dentro, el módulo afectado también avisa.
//      La descarga sale de un servidor de mentira en este mismo equipo.
//   1. La interfaz: Biblia (búsqueda por niveles), comparador de versiones, orden del culto (con
//      nombres propios), himnario (uno inventado: buscar por número, título y letra, cantado y pista), medios (subir imágenes, ajuste, encuadre al aire en dos pantallas; videos
//      y audios que van a la par; YouTube, con un yt-dlp de mentira), televisores (con uno de
//      mentira), diapositivas (un PDF de verdad, convertido por el propio Chrome, y un PowerPoint
//      con un PowerPoint de mentira), mandos en vivo que van a la par en dos pantallas, ajustes
//      y la función "Control del orden". También que Manna atiende por https.
//   2. Al entrar por la dirección numérica, la página pasa sola a la dirección con nombre.
//   3. El navegador pide confirmación al salir de la pestaña de control.
//   4. Con un dispositivo conectado por el nombre, el equipo principal "cambia de IP" y el
//      dispositivo reconecta solo, sin recargar y sin volver a pedir el PIN.
//   5. Lo que cierra la sesión: secciones, quitar y vaciar el orden; el aviso de que Manna se
//      actualizó estando abierto, "Reiniciar" y "Apagar".
//
// Además vigila toda la prueba: ningún botón puede responder con un aviso de error inesperado,
// no puede haber errores de JavaScript, y la interfaz tiene que haber usado, pulsando, todas las
// órdenes y direcciones del servidor (las que no se pueden pulsar aquí están en UNTOUCHED, con su motivo).
//
// Uso:  node scripts/probar-chrome.mjs          (unos 3 minutos)
//       node scripts/probar-chrome.mjs rapido   (pasos 0 y 1, menos de un minuto)
// Necesita Node 22 o superior (WebSocket integrado) y Chrome o Edge. No toca los datos reales:
// usa los puertos 8123 y 8125, el nombre "manna-prueba.local" y carpetas temporales de datos y de
// biblias (la Reina-Valera 1909 del repositorio y una versión de prueba de dos versículos).
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanInterfaces } from '../server/modules/system/network.js';
import { killOnExit, sleep, startChrome } from './lib/chrome.mjs';
import { startFakeTv } from './lib/tv-falso.mjs';
import { writeFakeYtDlp } from './lib/yt-dlp-falso.mjs';
import { fakePresentation, writeFakePowerPoint } from './lib/powerpoint-falso.mjs';
import { makePdf } from './lib/pdf.mjs';
import { HYMN_FACTS, hymnTitle, seedHymnal } from './lib/himnario-falso.mjs';
import { examplePoster } from './lib/png.mjs';
import { checkContract, sourceFiles } from './lib/codigo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const NAME = 'manna-prueba';
const QUICK = process.argv.includes('rapido');
const VERSION = 'reina-valera-1909';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-chrome-'));

// Biblias de la prueba: siempre las mismas, haya las que haya en la carpeta Biblias/ de este equipo.
const bibles = path.join(tmp, 'biblias');
fs.mkdirSync(bibles);
fs.copyFileSync(path.join(ROOT, 'Contenido', 'Biblias', 'Reina Valera 1909.xmm'), path.join(bibles, 'Reina Valera 1909.xmm'));
fs.writeFileSync(path.join(bibles, 'Versión de prueba.xmm'), `<bible>
  <b n="Salmos"><c n="23"><v n="1">El Señor es mi pastor; nada me falta.</v></c></b>
  <b n="Juan"><c n="3"><v n="16">Porque tanto amó Dios al mundo, que dio a su Hijo único.</v></c></b>
</bible>`);

const ip = (await lanInterfaces())[0]?.address;
if (!ip && !QUICK) {
  console.error('Este equipo no está conectado a ninguna red: solo se puede ejecutar el modo "rapido".');
  process.exit(1);
}
const local = `http://localhost:${PORT}`;
const byIp = `http://${ip}:${PORT}`;
const byName = `http://${NAME}.local:${PORT}`;

// Con otro Manna en estos puertos (por ejemplo, el de demostración), la prueba hablaría con él
// y fallaría de formas confusas: mejor decirlo de entrada.
for (const port of [PORT, 8125]) {
  const busy = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(700) }).then(() => true, () => false);
  if (busy) {
    console.error(`Ya hay un Manna abierto en el puerto ${port}. Ciérralo y vuelve a ejecutar la prueba.`);
    process.exit(1);
  }
}

// Lo que el servidor ofrece y esta prueba no puede usar pulsando, con el motivo. Todo lo demás
// tiene que usarse (ver "Vigilancia de toda la prueba", al final).
const UNTOUCHED = {
  'bible.rescan': 'no tiene botón: la carpeta de biblias se vigila sola',
  'projection.clear': 'no tiene botón: "Solo fondo" y "Negro" cubren su uso',
  'projection.display': 'necesita una segunda pantalla de verdad',
  'GET /api/state': 'para diagnóstico y pruebas: la interfaz recibe el estado por /api/events',
  'POST /api/action': 'es la puerta de todas las órdenes, que se cuentan una a una',
  'POST /api/events/sound': 'solo lo usa una página a la que el navegador no deja sonar, y aquí no se puede forzar; se prueba en test/medios-clips.test.js',
};

// Los videos y audios de la prueba se fabrican con ffmpeg. En un equipo sin él esa parte se salta,
// y lo que solo ella pulsa se declara como no probado.
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;
const sample = (name, args) => {
  const file = path.join(tmp, name);
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, file]);
  return file;
};
if (!HAS_FFMPEG) {
  for (const name of ['media.retry', 'media.subtitlesRemove', 'projection.volume', 'POST /api/media/clips', 'POST /api/media/clips/:id/thumb', 'POST /api/media/clips/:id/subtitles']) {
    UNTOUCHED[name] = 'este equipo no tiene ffmpeg para fabricar los videos de la prueba';
  }
}

// YouTube se prueba con un yt-dlp de mentira (un guion que hace el video con ffmpeg), puesto donde
// Manna guarda los programas que instala: nada sale a internet. El yt-dlp de verdad del equipo,
// si lo hay, no se usa nunca (MANNA_FALTA, más abajo).
const CAN_YOUTUBE = HAS_FFMPEG && process.platform !== 'win32';
const ytAsked = path.join(tmp, 'yt-dlp-pedido.json');
if (CAN_YOUTUBE) writeFakeYtDlp(path.join(tmp, 'data', 'herramientas'), { title: 'Saludo de la iglesia hermana', seconds: 6, log: ytAsked, pause: 600 });
else UNTOUCHED['media.youtube'] = 'el yt-dlp de mentira necesita ffmpeg y un sistema que ejecute guiones; se prueba en test/youtube.test.js';

// El himnario de la prueba es inventado (videos de colores con dos tonos, letras escritas aquí):
// no se usa el de Contenido/Himnario.
const hymnal = seedHymnal(path.join(tmp, 'himnario'), { count: 14, seconds: 14 });
if (!HAS_FFMPEG) UNTOUCHED['GET /api/hymns/:number/pista.mp4'] = 'este equipo no tiene ffmpeg para fabricar los himnos de la prueba ni para sacarles la pista';

// PowerPoint, igual: uno de mentira (un guion que deja tres imágenes), para no abrir el de verdad.
const fakePpt = writeFakePowerPoint(path.join(tmp, 'powerpoint'), { slides: 3, pause: 1200 });

// ---- Servidor de prueba ----
// Los televisores de la prueba son uno de mentira en este equipo: nada sale a la red.
const fakeTv = await startFakeTv();
function startServer(host, extra = {}) {
  // MANNA_SIN_VENTANA: la prueba no abre su proyección en el proyector de verdad, si lo hay.
  // MANNA_CONVERSION_LENTA: cada conversión tarda en empezar, para poder ver qué pasa mientras tanto.
  const env = { ...process.env, MANNA_NAME: NAME, MANNA_NO_OPEN: '1', MANNA_SIN_VENTANA: '1', MANNA_CONVERSION_LENTA: '6000', MANNA_FALTA: 'yt-dlp', MANNA_POWERPOINT_PRUEBA: fakePpt, MANNA_HIMNARIO: hymnal.dir, MANNA_DATA: path.join(tmp, 'data'), MANNA_BIBLIAS: bibles, PORT: String(PORT), MANNA_TV_PRUEBA: JSON.stringify({ ...fakeTv.endpoints, found: ['192.168.1.50'] }), ...extra };
  if (host) env.MANNA_HOST = host;
  // killOnExit: si la prueba se corta a medias, el servidor no se queda abierto ocupando el puerto.
  return killOnExit(spawn(process.execPath, ['server/index.js'], { cwd: ROOT, stdio: 'ignore', env }));
}
const stopServer = (child) => new Promise((resolve) => {
  if (child.exitCode !== null || child.signalCode) { resolve(); return; }
  child.on('exit', resolve);
  child.kill();
});
// Cierra lo que quede abierto en el puerto de la prueba, como lo haría el botón "Apagar". Hace
// falta tras probar "Reiniciar": la copia que Manna lanza al reiniciarse ya no es hija de esta prueba.
async function shutdownByPort() {
  try {
    const json = { 'Content-Type': 'application/json' };
    const login = await fetch(`http://127.0.0.1:${PORT}/api/session`, { method: 'POST', headers: json, body: JSON.stringify({ role: 'control' }), signal: AbortSignal.timeout(1500) });
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    await fetch(`http://127.0.0.1:${PORT}/api/action`, { method: 'POST', headers: { ...json, cookie }, body: JSON.stringify({ type: 'system.shutdown' }), signal: AbortSignal.timeout(1500) });
    await sleep(800);
  } catch { /* no había nada abierto */ }
}

let failed = 0;
function check(label, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` (${detail})` : ''}`);
}

let chrome;
const run = (js) => chrome.evaluate(`(async () => { ${js} })()`);

// ---- Vigilancia de toda la prueba ----
// Tres cosas se apuntan mientras se recorre la interfaz, para juzgarlas al final:
//   · cada aviso de error que sale en pantalla (un botón que falla avisa así, sin romper la página)
//   · cada error de JavaScript
//   · cada orden y dirección del servidor que la interfaz usó de verdad, pulsando
// Así se rompió la subida del fondo durante cuatro versiones: el botón fallaba con un aviso y
// ninguna prueba lo pulsaba.
const watched = { errors: [], exceptions: [], actions: new Set(), requests: new Set() };
const expectedErrors = [];
// Se llama antes de provocar un error a propósito, con un trozo de su texto.
const expectError = (fragment) => expectedErrors.push(fragment);
async function instrument() {
  await chrome.send('Network.enable', {});
  await chrome.send('Runtime.addBinding', { name: 'mannaAviso' });
  await chrome.send('Page.addScriptToEvaluateOnNewDocument', { source: `new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const toast = el && el.closest && el.closest('#toast');
      if (toast && toast.classList.contains('show') && toast.dataset.kind === 'error' && toast.textContent && window.mannaAviso) window.mannaAviso(toast.textContent);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-kind'] });` });
}
// Pasa a `watched` lo que Chrome ha ido contando. Se llama antes de vaciar los eventos o cerrar Chrome.
function harvest() {
  for (const e of chrome.events) {
    if (e.method === 'Runtime.bindingCalled' && e.params.name === 'mannaAviso' && watched.errors.at(-1) !== e.params.payload) watched.errors.push(e.params.payload);
    if (e.method === 'Runtime.exceptionThrown') watched.exceptions.push(e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text || 'error');
    if (e.method !== 'Network.requestWillBeSent') continue;
    const { url, method, postData, headers } = e.params.request;
    const { pathname } = new URL(url);
    if (!pathname.startsWith('/api/') || headers['X-Prueba']) continue;
    if (pathname === '/api/action') { try { watched.actions.add(JSON.parse(postData).type); } catch { /* cuerpo no legible */ } }
    else watched.requests.add(`${method} ${pathname}`);
  }
}
// Las órdenes que la prueba manda por su cuenta, sin pulsar nada, van marcadas: no cuentan como
// "la interfaz lo usó" (ver el recuento del final).
const post = (type, payload = {}) => `fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Prueba':'1'},body:JSON.stringify(${JSON.stringify({ type, payload })})}).then(r=>r.status)`;
const live = async () => JSON.parse(await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, ref: s.projection.item?.reference, kind: s.projection.item?.kind, order: s.order.items.map(i => i.title), size: s.projection.styles.fontSize, pattern: s.live.state?.pattern, clock: s.live.state?.clock })`));
// "1:02.5" -> 62.5
const seconds = (text) => String(text).split(':').reduce((total, part) => total * 60 + Number(part), 0);
const CODES = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37, b: 66 };
async function press(key) {
  for (const type of ['keyDown', 'keyUp']) await chrome.send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: CODES[key] });
  await sleep(450);
}
const type = (selector, value) => run(`const i = document.querySelector(${JSON.stringify(selector)}); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));`);
const click = (js) => run(`${js}.click()`);
const text = (selector) => run(`return document.querySelector(${JSON.stringify(selector)})?.textContent`);
// Espera (hasta unos 16 s) a que una condición de la página se cumpla.
const until = async (js, tries = 40) => { for (let i = 0; i < tries; i += 1) { if (await run(`return Boolean(${js})`)) return true; await sleep(400); } return false; };
// Elige archivos en un campo de la página, como haría la persona en la ventana del sistema.
async function chooseFiles(selector, files) {
  const doc = await chrome.send('DOM.getDocument', {});
  const input = await chrome.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector });
  await chrome.send('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files });
}
const menuItem = (label) => click(`[...document.querySelectorAll('.menu button')].find(b => b.textContent.includes(${JSON.stringify(label)}))`);
const modalButton = (label) => click(`[...document.querySelectorAll('.modal .btn')].find(b => b.textContent.trim() === ${JSON.stringify(label)})`);

// ================= 0. Revisión del equipo =================
// Un Manna aparte al que "le faltan" yt-dlp y el navegador, y un sitio de descargas de mentira que
// entrega despacio un programa mínimo, para ver el avance. En Windows no se ejecuta: el programa
// de mentira es de consola Unix.
async function reviewSection() {
  console.log('\n0. Revisión del equipo');
  const build = (version) => Buffer.from(`#!/bin/sh\necho ${version}\n${'#'.repeat(60_000)}\n`);
  let program = build('2026.01.01'); // lo que entrega el sitio de descargas; luego "sale" una versión nueva
  let failNext = true; // la primera descarga falla, para ver cómo se dice y cómo se quita el aviso
  const downloads = http.createServer(async (req, res) => {
    if (req.url === '/SUMAS') return res.end(`${crypto.createHash('sha256').update(program).digest('hex')}  yt-dlp-prueba\n`);
    if (failNext) {
      failNext = false;
      res.writeHead(500);
      return res.end();
    }
    res.writeHead(200, { 'Content-Length': program.length });
    for (let i = 0; i < program.length; i += 2000) {
      res.write(program.subarray(i, i + 2000));
      await sleep(90);
    }
    return res.end();
  });
  await new Promise((resolve) => downloads.listen(0, '127.0.0.1', resolve));
  const from = `http://127.0.0.1:${downloads.address().port}`;
  const review = startServer(null, {
    PORT: '8125', MANNA_NAME: 'manna-revision', MANNA_DATA: path.join(tmp, 'revision'), MANNA_FALTA: 'yt-dlp,navegador',
    MANNA_DESCARGAS: JSON.stringify({ 'yt-dlp': { url: `${from}/yt-dlp-prueba`, sums: `${from}/SUMAS`, file: 'yt-dlp', size: '60 KB' } }),
  });
  try {
    await sleep(3000);
    await chrome.send('Page.navigate', { url: 'http://localhost:8125/requisitos' });
    await sleep(2000);
    const card = `document.querySelector('.req[data-id="yt-dlp"]')`;
    const mod = (id) => `document.querySelector('#modules .mod[data-id=${id}]')`;
    check('la revisión lista los cuatro programas y marca los que faltan', await run(`return document.querySelectorAll('.req').length === 4 && ${card}.classList.contains('missing') && document.querySelector('.req[data-id=navegador]').classList.contains('missing')`));
    check('explica para qué sirve y cómo instalarlo a mano', await run(`return ${card}.textContent.includes('YouTube') && Boolean(${card}.querySelector('details code'))`));
    check('dice qué módulos funcionarán completos y cuáles no', await run(`return ${mod('biblia')}.textContent.includes('Completo') && !${mod('biblia')}.classList.contains('limited') && ${mod('medios')}.classList.contains('limited') && ${mod('medios')}.textContent.includes('YouTube: falta yt-dlp') && ${mod('ajustes')}.textContent.includes('falta Google Chrome')`));
    check('no bloquea: Manna se puede abrir aunque falten programas', await run(`const a = document.querySelector('#footer a'); return a.textContent === 'Abrir Manna' && a.getAttribute('href') === '/control' && document.querySelector('#lead').textContent.startsWith('Manna funciona')`));
    const install = () => click(`[...${card}.querySelectorAll('button')].find(b => b.textContent.includes('Instalar por mí'))`);
    await install();
    check('si la descarga falla, la tarjeta lo dice y el programa sigue faltando', await until(`${card}.querySelector('.job.error small')?.textContent.length > 5`) && await run(`return ${card}.classList.contains('missing')`), await run(`return ${card}.querySelector('.job.error small')?.textContent`));
    await click(`${card}.querySelector('.job.error .icon-btn')`);
    check('el aviso del fallo se puede quitar', await until(`!${card}.querySelector('.job')`));
    await click(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Volver a comprobar'))`);
    await sleep(900);
    check('"Volver a comprobar" revisa el equipo de nuevo', (await text('#toast')) === 'Equipo revisado' && await run(`return ${card}.classList.contains('missing')`));
    await install();
    await sleep(1300);
    const during = JSON.parse(await run(`const j = ${card}.querySelector('.job'); return JSON.stringify({ shown: Boolean(j), now: Number(j?.querySelector('.bar')?.getAttribute('aria-valuenow')), text: j?.querySelector('small')?.textContent, busy: ${card}.querySelector('.btn.primary')?.disabled })`));
    check('"Instalar por mí" muestra el avance sin detener la página', during.shown && during.now > 0 && during.now < 100 && during.text.includes('%') && during.busy, `${during.now} %: ${during.text}`);
    let installed = false;
    for (let i = 0; i < 30 && !installed; i += 1) {
      await sleep(500);
      installed = await run(`return !${card}.classList.contains('missing')`);
    }
    check('al terminar, el programa queda instalado y reconocido', installed && await run(`return ${card}.textContent.includes('Instalado por Manna') && ${card}.textContent.includes('versión 2026.01.01')`));
    check('el programa quedó en la carpeta de Manna, sin tocar el sistema', fs.existsSync(path.join(tmp, 'revision', 'herramientas', 'yt-dlp')) && fs.readdirSync(path.join(tmp, 'revision', 'herramientas')).length === 1);
    check('y el módulo afectado deja de avisar por ese programa', await run(`return !${mod('medios')}.textContent.includes('yt-dlp')`));
    await click(`document.querySelector('#footer a')`);
    await sleep(2000);
    check('de ahí se pasa al control, aunque siga faltando el navegador', (await chrome.evaluate('location.pathname')) === '/control' && await run(`return Boolean(document.querySelector('.rail'))`));
    const notice = `document.querySelector('.ws-notice')`;
    const goModule = async (id) => { await click(`document.querySelector('.rail-item[data-id=${id}]')`); await sleep(500); };
    await goModule('ajustes');
    check('dentro de la app, el módulo afectado avisa de lo que no podrá hacer y cómo resolverlo', await run(`return !${notice}.hidden && ${notice}.textContent.includes('Falta Google Chrome') && ${notice}.textContent.includes('segunda pantalla') && [...${notice}.querySelectorAll('button')].some(b => b.textContent === 'Cómo instalarlo')`));
    await goModule('biblia');
    check('un módulo al que no le falta nada no muestra aviso', await run(`return ${notice}.hidden`));
    await goModule('ajustes');
    await click(`${notice}.querySelector('.icon-btn')`);
    await goModule('biblia');
    await goModule('ajustes');
    check('el aviso se puede cerrar y no vuelve a salir en esa visita', await run(`return ${notice}.hidden`));
    // YouTube cambia a menudo y yt-dlp se queda atrás: Ajustes deja ponerlo al día con un botón.
    program = build('2026.02.02');
    const toolRow = `document.querySelector('.settings .tool[data-id="yt-dlp"]')`;
    check('Ajustes ofrece actualizar yt-dlp, y solo ese programa', await run(`return document.querySelectorAll('.settings .tool .btn').length === 1 && ${toolRow}.querySelector('.btn').textContent === 'Actualizar' && ${toolRow}.textContent.includes('2026.01.01')`));
    await click(`${toolRow}.querySelector('.btn')`);
    await sleep(900);
    check('"Actualizar" lo descarga de nuevo, a la vista y sin detener la app', await run(`const b = ${toolRow}.querySelector('.btn'); return b.disabled && b.textContent === 'Actualizando…' && [...document.querySelectorAll('.dock .job strong')].some(s => s.textContent === 'Descargando yt-dlp')`) && (await text('#toast')).includes('Actualizando yt-dlp'));
    check('y queda la versión nueva', await until(`${toolRow}.textContent.includes('2026.02.02') && !${toolRow}.querySelector('.btn').disabled`, 40), await run(`return ${toolRow}.textContent`));
    check('sin errores de JavaScript en la revisión', !chrome.events.some((e) => e.method === 'Runtime.exceptionThrown'));
  } finally {
    await stopServer(review);
    downloads.close();
  }
}

let server = startServer();
await sleep(3000);
chrome = await startChrome();
await instrument();
try {
  chrome.acceptDialogs = true;
  if (process.platform !== 'win32') await reviewSection();

  // ================= 1. La interfaz =================
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await chrome.send('Page.navigate', { url: `${local}/control#biblia` });
  await sleep(2500);

  console.log('\n1. Interfaz · Biblia');
  await type('.ws[data-module=biblia] .search input', 'jn 3 16-17');
  await sleep(900);
  check('la búsqueda por cita lleva al pasaje', (await text('.sel-ref')) === 'Juan 3:16-17');
  await press('Enter');
  check('Enter proyecta la selección', (await live()).ref === 'Juan 3:16-17');
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('la versión se ve junto al logo', (await text('.rail-version')) === `v${version}` && await run(`return document.querySelector('.rail .brand-mark img').naturalWidth > 0`), `v${version}`);
  check('el panel marca "Al aire"', await run(`return document.querySelector('.dock-head strong').textContent === 'Al aire' && document.querySelector('.dock .monitor').classList.contains('on-air')`));
  check('el pasaje queda en "Recientes"', await run(`return [...document.querySelectorAll('.chips .chip')].some(c => c.textContent === 'Juan 3:16-17')`));
  await press('ArrowRight');
  check('→ avanza al versículo siguiente', (await live()).ref === 'Juan 3:18');
  check('la selección acompaña a lo que está al aire', (await text('.sel-ref')) === 'Juan 3:18');
  await press('ArrowDown');
  check('↓ mueve la selección sin tocar la proyección', (await text('.sel-ref')) === 'Juan 3:19' && (await live()).ref === 'Juan 3:18');
  await click(`[...document.querySelectorAll('.abar .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(600);
  check('"Añadir al orden" agrega el pasaje', (await live()).order.includes('Juan 3:19'));

  console.log('\n1. Interfaz · Búsqueda en la Biblia');
  const box = `document.querySelector('.ws[data-module=biblia] .search input')`;
  const pop = `document.querySelector('.search-pop')`;
  // Escribir sin pulsar Enter: la búsqueda sale sola tras una pausa.
  const write = async (value) => { await run(`const i = ${box}; i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input'));`); await sleep(800); };
  const rows = () => run(`return JSON.stringify([...${pop}.querySelectorAll('.search-item')].map(r => ({ ref: r.querySelector('strong')?.textContent, marks: [...r.querySelectorAll('mark')].map(m => m.textContent), level: r.dataset.level, active: r.classList.contains('active') })))`).then(JSON.parse);
  const levels = () => run(`return JSON.stringify([...${pop}.querySelectorAll('.search-level span')].map(s => s.textContent))`).then(JSON.parse);
  await write('de tal manera amo');
  let found = await rows();
  check('busca mientras se escribe, sin tildes, y resalta la frase', await run(`return !${pop}.hidden`) && found[0]?.ref === 'Juan 3:16' && found[0].marks.join() === 'de tal manera amó' && (await levels())[0] === 'Frase exacta');
  await write('amor');
  check('ordena por niveles: frase exacta y después parecidas', JSON.stringify(await levels()) === JSON.stringify(['Frase exacta', 'Parecidas']) && (await rows()).some((r) => r.level === 'similar' && r.marks.some((m) => /^(amó|caridad)$/i.test(m))));
  check('dice cuántos hay y en qué versión se buscó, y ofrece ver más', await run(`return /^\\d+ resultados en Reina-Valera 1909/.test(${pop}.querySelector('.search-count').textContent) && ${pop}.querySelectorAll('.search-item').length === 80`));
  await click(`${pop}.querySelector('.search-more')`);
  await sleep(700);
  check('"ver más" amplía la lista', (await rows()).length > 80);
  await write('el buen pastor');
  found = await rows();
  await press('ArrowDown');
  check('las flechas recorren los resultados', found.length > 0 && (await rows())[0].active);
  await press('Enter');
  await sleep(700);
  check('Enter va al versículo señalado, en la versión elegida', await run(`return ${pop}.hidden && document.querySelector('.ws[data-module=biblia] select').value === ${JSON.stringify(VERSION)}`) && (await text('.sel-ref')) === found[0].ref, found[0]?.ref);
  await press('Enter');
  check('y un segundo Enter lo proyecta', (await live()).ref === found[0].ref);
  await write('en el principio');
  const scopeOf = (id) => `${pop}.querySelector('.search-scope [data-scope=${id}]')`;
  const firstRef = () => run(`return ${pop}.querySelector('.search-item strong')?.textContent`);
  const everywhere = await run(`return ${pop}.querySelectorAll('.search-item').length`);
  await click(scopeOf('nt'));
  await sleep(700);
  const onlyNew = { first: await firstRef(), count: await run(`return ${pop}.querySelectorAll('.search-item').length`), on: await run(`return ${scopeOf('nt')}.classList.contains('on')`) };
  await click(scopeOf('ot'));
  await sleep(700);
  check('se puede buscar solo en un testamento', onlyNew.on && onlyNew.first === 'Juan 1:1' && onlyNew.count < everywhere && (await firstRef()) === 'Génesis 1:1', `${everywhere} en total, ${onlyNew.count} en el Nuevo`);
  await click(scopeOf('all'));
  await sleep(600);
  await write('jn 3 18');
  check('una cita ofrece ir al pasaje', (await run(`return ${pop}.querySelector('.search-item.go')?.textContent`))?.includes('Ir a Juan 3:18'));
  await write('zzzz');
  check('sin resultados lo dice', (await run(`return ${pop}.textContent`)).includes('Sin resultados para "zzzz"'));
  await click(`${pop}.querySelector('.icon-btn')`);
  await type('.ws[data-module=biblia] .search input', 'jn 3 18');
  await sleep(900);
  await press('Enter');
  check('queda como estaba para seguir: Juan 3:18 al aire', (await live()).ref === 'Juan 3:18');
  await press('b');
  check('B pone la pantalla en negro', (await live()).mode === 'black');
  await press('b');
  check('B otra vez vuelve al contenido', (await live()).mode === 'live');

  console.log('\n1. Interfaz · Orden del culto');
  await click(`document.querySelector('.rail-item[data-id=orden]')`);
  await sleep(700);
  await type('.ws[data-module=orden] .search input', 'sal 23 1-3');
  await sleep(900);
  check('la cita rápida añade un pasaje', (await live()).order.includes('Salmos 23:1-3'));
  const salmoRow = `[...document.querySelectorAll('.orow')].find(r => r.textContent.includes('Salmos 23'))`;
  const renameTo = async (name) => {
    await click(`${salmoRow}.querySelector('.icon-btn[aria-label=Opciones]')`);
    await sleep(200);
    await click(`[...document.querySelectorAll('.menu button')].find(b => b.textContent.includes('Cambiar nombre'))`);
    await sleep(200);
    await run(`const i = document.querySelector('.modal input'); i.value = ${JSON.stringify(name)}; i.closest('form').requestSubmit();`);
    await sleep(500);
  };
  await renameTo('Lectura bíblica');
  check('un elemento admite un nombre propio y conserva a la vista el original', (await live()).order.includes('Lectura bíblica') && await run(`return ${salmoRow}.querySelector('strong').textContent === 'Lectura bíblica' && ${salmoRow}.querySelector('small').textContent.startsWith('Salmos 23:1-3 · Biblia')`));
  await renameTo('');
  check('con el nombre vacío vuelve al original', (await live()).order.includes('Salmos 23:1-3') && !(await live()).order.includes('Lectura bíblica'));
  await run(`await ${post('order.addSection', { title: 'Mensaje' })}`);
  await sleep(500);
  for (let i = 0; i < 2; i += 1) {
    await click(`document.querySelector('.osection .icon-btn')`);
    await sleep(200);
    await click(`[...document.querySelectorAll('.menu button')].find(b => b.textContent.includes('Subir'))`);
    await sleep(350);
  }
  check('el menú reordena los elementos', (await live()).order[0] === 'Mensaje', (await live()).order.join(' | '));
  const salmo = `[...document.querySelectorAll('.orow')].find(r => r.textContent.includes('Salmos 23'))`;
  const slides = () => run(`return document.querySelectorAll('.odetail .slide').length`);
  // Lo recién añadido queda elegido, así que sus pasos ya están desplegados.
  check('el elemento elegido muestra sus pasos', (await slides()) === 4, 'todo junto + 3 versículos');
  await click(salmo);
  await sleep(400);
  check('un clic en el elemento elegido lo recoge', (await slides()) === 0 && await run(`return !document.querySelector('.orow.selected')`));
  await run(`await ${post('order.addSection', { title: 'Cierre' })}`);
  await sleep(500);
  check('recogido, no se vuelve a abrir solo al cambiar el orden', await run(`return !document.querySelector('.orow.selected')`));
  await click(salmo);
  await sleep(900);
  check('y otro clic lo vuelve a desplegar', (await slides()) === 4);
  await press('Enter');
  check('Enter proyecta el primer paso', (await live()).ref === 'Salmos 23:1');
  await press('ArrowRight');
  await press('ArrowRight');
  check('→ recorre los pasos del elemento', (await live()).ref === 'Salmos 23:3');
  for (let i = 0; i < 3; i += 1) await press('ArrowLeft');
  check('← pasa al elemento anterior del orden', (await live()).ref === 'Juan 3:19');
  check('la fila al aire queda marcada y seleccionada', await run(`const r = document.querySelector('.orow.live'); return Boolean(r && r.textContent.includes('Juan 3:19') && r.classList.contains('selected'))`));

  console.log('\n1. Interfaz · Comparador de versiones');
  const cmp = `document.querySelector('.ws[data-module=comparador]')`;
  const shown = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items })`).then(JSON.parse);
  await click(`document.querySelector('.rail-item[data-id=comparador]')`);
  await sleep(1500);
  check('propone dos versiones distintas', await run(`const [a, b] = ${cmp}.querySelectorAll('.cmp-pick select'); return a.value === ${JSON.stringify(VERSION)} && b.value === 'version-de-prueba'`));
  await run(`const i = ${cmp}.querySelector('.search input'); i.value = 'jn 3 16'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));`);
  await sleep(1200);
  check('junto a cada versículo se lee el de la otra versión, y avisa si falta', await run(`const row = (n) => ${cmp}.querySelector('.verse[data-n="' + n + '"]'); return row(16).children.length === 3 && row(16).children[2].textContent.startsWith('Porque tanto amó') && Boolean(row(17).querySelector('.absent'))`));
  check('la vista previa muestra las dos versiones, cada una con el número del versículo', await run(`const m = document.querySelectorAll('.dock .monitor')[1]; return m.querySelectorAll('.cmp-side').length === 2 && [...m.querySelectorAll('.cmp-label')].map(l => l.textContent).join() === 'RV1909,Versión de prueba' && [...m.querySelectorAll('.stage-vn')].map(n => n.textContent).join() === '16,16'`));
  await click(`${cmp}.querySelector('.seg [data-layout=rows]')`);
  await sleep(300);
  check('la disposición se elige antes de proyectar', await run(`return document.querySelectorAll('.dock .monitor')[1].querySelector('.cmp').dataset.layout === 'rows'`));
  await click(`${cmp}.querySelector('.abar .btn.primary')`);
  await sleep(700);
  let on = await shown();
  check('proyecta el pasaje en las dos versiones', on.item.kind === 'compare' && on.item.reference === 'Juan 3:16' && on.item.sides[1].verses[0].text.startsWith('Porque tanto amó') && on.live.layout === 'rows' && (await text('.dock-ref')) === 'Juan 3:16 (RV1909 · Versión de prueba)');
  await click(`[...document.querySelectorAll('.dock .live-controls button')].find(b => b.textContent.includes('Lado a lado'))`);
  await sleep(500);
  on = await shown();
  check('la disposición también se cambia al aire', on.live.layout === 'columns' && await run(`return document.querySelector('.dock .monitor .cmp').dataset.layout === 'columns'`));
  await press('ArrowRight');
  on = await shown();
  check('"siguiente" sigue leyendo en las dos, y dice cuándo una no tiene el versículo', on.item.reference === 'Juan 3:17' && on.item.sides[1].verses.length === 0 && await run(`return document.querySelector('.dock .monitor .cmp-absent').textContent === 'Este pasaje no está en Versión de prueba'`));
  await click(`[...${cmp}.querySelectorAll('.abar .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(600);
  on = await shown();
  const added = on.order.find((i) => i.kind === 'compare');
  check('se añade al orden como elemento propio, con sus dos versiones', Boolean(added) && added.subtitle === 'RV1909 · Versión de prueba' && added.data.layout === 'rows');

  const modal = `document.querySelector('.modal')`;
  console.log('\n1. Interfaz · Medios (imágenes)');
  await click(`document.querySelector('.rail-item[data-id=medios]')`);
  await sleep(500);
  const med = `document.querySelector('.ws[data-module=medios]')`;
  check('sin imágenes, invita a subirlas', await run(`return ${med}.querySelector('.empty').textContent.includes('Aún no hay imágenes') && ${med}.querySelector('.media-bar').hidden`));
  // Dos imágenes hechas aquí mismo: una apaisada más grande de lo que se guarda y un cartel vertical.
  const wide = path.join(tmp, 'anuncios_de-octubre.png');
  const tall = path.join(tmp, 'cartel vertical.png');
  fs.writeFileSync(wide, examplePoster(3000, 1000));
  fs.writeFileSync(tall, examplePoster(600, 900, [[15, 118, 110], [202, 138, 4]]));
  await chooseFiles('.ws[data-module=medios] input[type=file]', [wide, tall]);
  await sleep(600);
  check('al elegir archivos propone un nombre para cada imagen', await run(`return ${modal}.querySelector('h2').textContent === 'Subir 2 imágenes' && [...${modal}.querySelectorAll('.up-row input')].map(i => i.value).join('|') === 'anuncios de octubre|cartel vertical'`));
  check('prepara cada imagen en el propio dispositivo antes de enviarla', await until(`[...${modal}.querySelectorAll('.up-row small')].every(s => s.textContent.startsWith('Lista')) && !${modal}.querySelector('.btn.primary').disabled`));
  await run(`const i = ${modal}.querySelector('.up-row input'); i.value = 'Anuncios de octubre';`);
  await click(`${modal}.querySelector('.btn.primary')`);
  check('sube las imágenes y cierra la ventana', await until(`!${modal} && ${med}.querySelectorAll('.media-card').length === 2`));
  let lib = JSON.parse(await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify(s.media.images)`));
  const ad = lib.find((i) => i.name === 'Anuncios de octubre');
  check('la imagen grande llega reducida y con su miniatura; la pequeña, con su tamaño', Boolean(ad) && ad.width === 2560 && ad.height === 853 && Boolean(ad.thumb) && lib.some((i) => i.name === 'cartel vertical' && i.width === 600 && i.height === 900), lib.map((i) => `${i.name} ${i.width}×${i.height}`).join(', '));
  const adCard = `${med}.querySelector('.media-card[data-id="${ad?.id}"]')`;
  await click(`${adCard}.querySelector('.media-pick')`);
  await sleep(500);
  check('al elegir una imagen se ve en la vista previa y aparecen sus acciones', await run(`const m = document.querySelectorAll('.dock .monitor')[1]; return ${adCard}.classList.contains('selected') && m.querySelector('.img-view img').getAttribute('src') === ${JSON.stringify(ad?.url)} && !${med}.querySelector('.media-bar').hidden && ${med}.querySelector('.fit.on').dataset.fit === 'contain'`));
  await click(`${med}.querySelector('.fit[data-fit=cover]')`);
  await sleep(500);
  check('el ajuste se elige sobre dos miniaturas de la imagen', await run(`return ${med}.querySelector('.fit.on').dataset.fit === 'cover' && ${med}.querySelectorAll('.fit-thumb img').length === 2`));
  await click(`${med}.querySelector('.media-bar .btn.primary')`);
  await sleep(900);
  let air = await shown();
  check('"Proyectar" pone la imagen al aire con ese ajuste, y la biblioteca lo marca', air.item.kind === 'image' && air.item.title === 'Anuncios de octubre' && air.live.fit === 'cover' && air.live.zoom === 1 && await run(`return Boolean(${adCard}.querySelector('.badge.live')) && document.querySelector('.dock-ref').textContent === 'Anuncios de octubre'`));
  // Otra pantalla de proyección, para ver que sigue el encuadre.
  await run(`const f = document.createElement('iframe'); f.id = 'pantalla'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:320px;height:180px;z-index:99;border:0'; document.body.append(f);`);
  await sleep(2500);
  const nav = `document.querySelector('.dock .live-controls .nav')`;
  await run(`const s = document.querySelector('.dock .live-controls input[type=range]'); s.value = 3; s.dispatchEvent(new Event('input'));`);
  await sleep(700);
  air = await shown();
  // Qué parte del ancho de la imagen se ve en cada pantalla: debe ser la misma.
  const seen = `((root) => { const i = root.querySelector('.img-view img'); const scale = Number(/scale\\(([\\d.]+)\\)/.exec(i.style.transform)?.[1]); return root.querySelector('.img-view').clientWidth / (i.naturalWidth * scale); })`;
  const parts = JSON.parse(await run(`return JSON.stringify([${seen}(document.querySelector('.dock .monitor')), ${seen}(document.querySelector('#pantalla').contentDocument)])`));
  // La imagen es más alargada que la pantalla: llenándola ya se ve solo una parte de su ancho, y con el zoom, un tercio de eso.
  const part = (16 / 9) / (ad.width / ad.height) / 3;
  check('el deslizador acerca la imagen, y las dos pantallas muestran la misma parte', air.live.zoom === 3 && Math.abs(parts[0] - part) < 0.01 && Math.abs(parts[0] - parts[1]) < 0.01, `se ve ${(parts[0] * 100).toFixed(1)} % y ${(parts[1] * 100).toFixed(1)} % del ancho`);
  const navBox = JSON.parse(await run(`const r = ${nav}.querySelector('.nav-img').getBoundingClientRect(); return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height })`));
  const pointer = (kind, fx, fy) => chrome.send('Input.dispatchMouseEvent', { type: kind, x: navBox.x + navBox.w * fx, y: navBox.y + navBox.h * fy, button: 'left', buttons: kind === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  await pointer('mousePressed', 0.5, 0.5);
  await pointer('mouseMoved', 0.6, 0.55);
  await pointer('mouseMoved', 0.7, 0.6);
  await pointer('mouseReleased', 0.7, 0.6);
  await sleep(700);
  air = await shown();
  check('arrastrar el recuadro mueve lo que se ve', Math.abs(air.live.x - 0.7) < 0.02 && Math.abs(air.live.y - 0.6) < 0.02 && await run(`const f = ${nav}.querySelector('.nav-frame'); return !f.hidden && Math.abs(parseFloat(f.style.left) + parseFloat(f.style.width) / 2 - 70) < 2`), `centro en ${air.live.x}, ${air.live.y}`);
  await pointer('mousePressed', 0.05, 0.5);
  await pointer('mouseReleased', 0.05, 0.5);
  await sleep(600);
  air = await shown();
  check('en el borde, el encuadre se detiene sin dejar huecos', Math.abs(air.live.x - part / 2) < 0.01, `centro en ${air.live.x}`);
  await click(`[...document.querySelectorAll('.dock .live-controls button')].find(b => b.textContent.includes('Vista completa'))`);
  await sleep(600);
  air = await shown();
  check('"Vista completa" deshace el zoom y el desplazamiento', air.live.zoom === 1 && air.live.x === 0.5 && air.live.fit === 'cover' && await run(`return [...document.querySelectorAll('.dock .live-controls button')].find(b => b.textContent.includes('Vista completa')).disabled`));
  await run(`document.querySelector('#pantalla').remove()`);
  await click(`[...${med}.querySelectorAll('.media-bar .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(600);
  air = await shown();
  const inOrder = air.order.find((i) => i.kind === 'image');
  check('la imagen se añade al orden del culto como elemento propio, con su ajuste', Boolean(inOrder) && inOrder.title === 'Anuncios de octubre' && inOrder.data.fit === 'cover' && inOrder.steps === 1);
  const pickMenu = async (cardJs, label) => { await click(`${cardJs}.querySelector('.media-more')`); await sleep(300); await click(`[...document.querySelectorAll('.menu button')].find(b => b.textContent.includes(${JSON.stringify(label)}))`); await sleep(300); };
  await pickMenu(adCard, 'Cambiar el nombre');
  await run(`${modal}.querySelector('input').value = 'Cartel de la campaña'; [...${modal}.querySelectorAll('.btn')].find(b => b.textContent === 'Guardar').click();`);
  await sleep(600);
  check('el nombre se puede cambiar', await run(`return !${modal} && ${adCard}.querySelector('strong').textContent === 'Cartel de la campaña'`));
  const otherCard = `[...${med}.querySelectorAll('.media-card')].find(c => c.dataset.id !== ${JSON.stringify(ad?.id)})`;
  await pickMenu(otherCard, 'Eliminar');
  await click(`${modal}.querySelector('.btn.danger')`);
  await sleep(600);
  check('una imagen se puede eliminar de la biblioteca', await run(`return !${modal} && ${med}.querySelectorAll('.media-card').length === 1 && (await fetch(${JSON.stringify(lib.find((i) => i.id !== ad?.id)?.url || '/x')})).status === 404`));
  // En el celular caben cinco pestañas y hay seis módulos: se ven los cuatro primeros y "Más",
  // que abre los demás (el reparto se prueba también en test/codigo.test.js).
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  check('en el celular, la barra muestra cuatro módulos y «Más»', await run(`return [...document.querySelectorAll('.tabbar button')].map(b => b.textContent).join('|') === 'Orden|Biblia|Himnario|Medios|Más' && document.querySelector('.tabbar button.on').textContent === 'Medios'`), await run(`return [...document.querySelectorAll('.tabbar button')].map(b => b.textContent).join('|')`));
  await click(`[...document.querySelectorAll('.tabbar button')].find(b => b.textContent === 'Más')`);
  await sleep(300);
  check('«Más» abre los que no caben', await run(`return [...document.querySelectorAll('.menu button')].map(b => b.textContent).join('|') === 'Comparador|Diapositivas|Ajustes'`), await run(`return [...document.querySelectorAll('.menu button')].map(b => b.textContent).join('|')`));
  await press('Escape');
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(400);

  console.log('\n1. Interfaz · Medios (videos y audios)');
  if (!HAS_FFMPEG) console.log('  (este equipo no tiene ffmpeg: no se pueden fabricar los videos de ejemplo y esta parte se salta)');
  else {
    const quiet = (frequency, seconds) => ['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${seconds}`, '-af', 'volume=0.05'];
    const welcome = sample('video_de-bienvenida.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=8', ...quiet(330, 8), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
    const oldVideo = sample('testimonio.avi', ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=4', ...quiet(220, 4), '-c:v', 'mpeg4', '-c:a', 'libmp3lame', '-shortest']);
    const track = sample('pista de piano.mp3', [...quiet(440, 5), '-c:a', 'libmp3lame']);
    const notVideo = path.join(tmp, 'falso.mp4');
    const captions = path.join(tmp, 'bienvenida.srt');
    fs.writeFileSync(notVideo, 'esto no es un video '.repeat(200));
    fs.writeFileSync(captions, '1\n00:00:00,000 --> 00:00:08,000\nBienvenidos\n');
    const tab = async (id) => { await click(`document.querySelector('.media-tabs [data-tab=${id}]')`); await sleep(400); };
    const vids = `document.querySelector('.media-body[data-panel=videos]')`;
    const vbar = `document.querySelector('.media-bar[data-panel=videos]')`;
    const controls = `document.querySelector('.dock .live-controls')`;
    const control = async (label) => { await click(`[...${controls}.querySelectorAll('button')].find(b => (b.textContent + ' ' + (b.getAttribute('aria-label') || '')).includes(${JSON.stringify(label)}))`); await sleep(700); };
    const videosNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).media.videos)`).then(JSON.parse);
    const air = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, volume: s.live.volume, sound: s.conexiones.sonido, order: s.order.items })`).then(JSON.parse);

    await click(`document.querySelector('.rail-item[data-id=medios]')`);
    await sleep(400);
    await tab('videos');
    check('la pestaña Videos empieza vacía y dice de dónde salen los videos', await run(`return ${vids}.querySelector('.empty').textContent.includes('Contenido/Medios') && document.querySelector('.ws[data-module=medios] .ws-head .btn').textContent === 'Subir videos'`));
    await chooseFiles('.media-body[data-panel=videos] input[type=file]', [notVideo]);
    await sleep(500);
    await modalButton('Subir');
    check('un archivo que no es un video se rechaza, y lo dice', await until(`${modal}.querySelector('.up-row.error small')?.textContent.includes('no contiene un video')`), await run(`return ${modal}.querySelector('.up-row small')?.textContent`));
    await modalButton('Cancelar');
    await chooseFiles('.media-body[data-panel=videos] input[type=file]', [welcome, oldVideo]);
    await sleep(500);
    check('propone un nombre para cada video', await run(`return ${modal}.querySelector('h2').textContent === 'Subir 2 videos' && [...${modal}.querySelectorAll('.up-row input')].map(i => i.value).join('|') === 'video de bienvenida|testimonio'`));
    await modalButton('Subir');
    check('sube los videos y cierra la ventana', await until(`!${modal} && ${vids}.querySelectorAll('.media-card').length === 2`, 80));
    check('el que el navegador no reproduce se convierte solo y queda listo', await until(`${vids}.querySelectorAll('.media-card[data-status=ready]').length === 2`, 100));
    let videos = await videosNow();
    const main = videos.find((v) => v.name === 'video de bienvenida');
    const converted = videos.find((v) => v.name === 'testimonio');
    check('lo habitual se usa tal cual y lo demás queda convertido; los dos con su imagen y su duración', Boolean(main && converted) && !main.converted && converted.converted && converted.url.endsWith('.mp4')
      && Math.round(main.duration) === 8 && await run(`return [...${vids}.querySelectorAll('.media-card')].every(c => c.querySelector('.media-thumb img')?.naturalWidth > 0 && /^0:0\\d$/.test(c.querySelector('.media-duration').textContent))`));
    // Un video que hay que convertir (viene en otro envoltorio), pero que este equipo reproduce tal
    // cual: se usa al instante, con el original, mientras se le hace la copia para las demás pantallas.
    const wrapped = sample('recien llegado.mkv', ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=8', ...quiet(262, 8), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
    await chooseFiles('.media-body[data-panel=videos] input[type=file]', [wrapped]);
    await sleep(500);
    await modalButton('Subir');
    const arrived = `[...${vids}.querySelectorAll('.media-card')].find(c => c.querySelector('strong').textContent === 'recien llegado')`;
    check('un video recién subido que este equipo reproduce tal cual se puede proyectar ya, mientras se le hace la copia', await until(`${arrived}?.dataset.usable === 'true' && ${arrived}.dataset.status === 'converting' && ${arrived}.querySelector('.media-status strong')?.textContent.includes('Ya se puede proyectar')`, 25), await run(`return ${arrived}?.querySelector('.media-status')?.textContent`));
    await click(`${arrived}.querySelector('.media-pick')`);
    await sleep(300);
    await click(`${vbar}.querySelector('.btn.primary')`);
    await sleep(1500);
    const instant = () => run(`const s = await (await fetch('/api/state')).json(); const v = document.querySelector('.dock .monitor video'); const c = s.media.videos.find(x => x.name === 'recien llegado'); return JSON.stringify({ local: s.projection.item.local, url: s.projection.item.url, uid: s.projection.item.uid, playing: s.live.state.clock.playing, src: v.getAttribute('src'), paused: v.paused, t: v.currentTime, status: c.status, job: s.jobs.list.find(j => j.ref === c.id)?.detail })`).then(JSON.parse);
    const early = await instant();
    check('se reproduce con el archivo original, y la conversión espera a que deje de sonar', Boolean(early.local?.endsWith('.mkv')) && early.url === null && early.src === early.local && !early.paused && early.t > 0.3 && early.status === 'converting' && early.job === 'En pausa mientras se reproduce', JSON.stringify(early));
    await control('Pausar');
    const copied = await until(`${arrived}.dataset.status === 'ready'`, 60);
    const settled = await instant();
    check('al dejar de reproducirse se termina la copia, y llega a lo que está en pantalla sin interrumpirlo', copied && Boolean(settled.url?.endsWith('.mp4')) && settled.local === early.local && settled.uid === early.uid && settled.src === early.local && Math.abs(settled.t - (await air()).live.clock.position) < 0.5, JSON.stringify(settled));
    await click(`${arrived}.querySelector('.media-more')`);
    await sleep(300);
    await menuItem('Eliminar');
    await sleep(300);
    await modalButton('Eliminar');
    await sleep(600);
    const mainCard = `${vids}.querySelector('.media-card[data-id="${main?.id}"]')`;
    await click(`${mainCard}.querySelector('.media-pick')`);
    await sleep(500);
    check('al elegir un video se ve su imagen en la vista previa y aparecen sus acciones', await run(`const m = document.querySelectorAll('.dock .monitor')[1]; return !${vbar}.hidden && m.querySelector('.clip-poster').getAttribute('src') === ${JSON.stringify(main?.poster)} && !m.querySelector('.clip-view').classList.contains('on-air')`));

    // Otra pantalla de proyección en este mismo equipo: es la que suena.
    await run(`const f = document.createElement('iframe'); f.id = 'pantalla'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:320px;height:180px;z-index:99;border:0'; document.body.append(f);`);
    await sleep(2500);
    // La ventana del proyector puede sonar sin que nadie la toque; una pestaña corriente, como esta
    // de la prueba, necesita un toque. Se le da antes de empezar.
    const tap = JSON.parse(await run(`const f = document.querySelector('#pantalla').getBoundingClientRect(); return JSON.stringify({ x: f.left + f.width / 2, y: f.top + f.height / 2 })`));
    for (const kind of ['mousePressed', 'mouseReleased']) await chrome.send('Input.dispatchMouseEvent', { type: kind, x: tap.x, y: tap.y, button: 'left', buttons: kind === 'mouseReleased' ? 0 : 1, clickCount: 1 });
    await click(`${vbar}.querySelector('.btn.primary')`);
    await sleep(1800);
    const far = `document.querySelector('#pantalla').contentDocument`;
    const screens = () => run(`const a = document.querySelector('.dock .monitor video'); const b = ${far}.querySelector('.clip-view video'); return JSON.stringify({ here: { t: a.currentTime, paused: a.paused, muted: a.muted }, there: { t: b.currentTime, paused: b.paused, muted: b.muted, volume: b.volume, subtitles: b.textTracks[0]?.mode }, notice: ${far}.body.textContent.includes('Toca aquí') })`).then(JSON.parse);
    // Apunta, cada pocos milisegundos, cómo va el sonido de un reproductor: para ver que se desvanece.
    const listen = (js) => run(`const v = ${js}; window.__oido = []; clearInterval(window.__reloj); window.__reloj = setInterval(() => window.__oido.push([v.paused, Math.round(v.volume * 1000) / 1000]), 15);`);
    const heard = async () => { const list = JSON.parse(await run(`clearInterval(window.__reloj); return JSON.stringify(window.__oido)`)); const playing = list.filter(([paused]) => !paused).map(([, volume]) => volume); return { steps: new Set(playing).size, min: Math.min(...playing), max: Math.max(...playing), ends: list.at(-1)?.[0] === true }; };
    let on = await air();
    let both = await screens();
    check('"Proyectar" pone el video al aire reproduciéndose', on.item.kind === 'video' && on.live.clock.playing === true && !both.here.paused && !both.there.paused && both.here.t > 0.3);
    check('suena una sola pantalla: la de proyección del equipo. El monitor del control va en silencio, y nada pide tocar la pantalla', Boolean(on.sound) && both.there.muted === false && both.here.muted === true && !both.notice);
    check('las dos pantallas van a la par', Math.abs(both.here.t - both.there.t) < 0.5, `${both.here.t.toFixed(2)} s y ${both.there.t.toFixed(2)} s`);
    await listen(`${far}.querySelector('.clip-view video')`);
    await control('Pausar');
    let sound = await heard();
    both = await screens();
    on = await air();
    check('"Pausar" detiene las dos pantallas en el mismo punto', on.live.clock.playing === false && both.here.paused && both.there.paused && Math.abs(both.here.t - on.live.clock.position) < 0.3 && Math.abs(both.there.t - on.live.clock.position) < 0.45, `${both.here.t.toFixed(2)}, ${both.there.t.toFixed(2)} y ${on.live.clock.position.toFixed(2)} s`);
    check('al pausar, el sonido no se corta de golpe: se desvanece en un instante', sound.ends && sound.steps >= 4 && sound.max > 0.9 && sound.min < 0.3, `${sound.steps} pasos de volumen, de ${sound.max} a ${sound.min}`);
    await run(`const b = ${controls}.querySelector('.clip-seek input'); b.value = 5; b.dispatchEvent(new Event('input')); b.dispatchEvent(new Event('change'));`);
    await sleep(900);
    both = await screens();
    on = await air();
    check('la barra de avance lleva las dos pantallas a ese punto', on.live.clock.position === 5 && Math.abs(both.here.t - 5) < 0.3 && Math.abs(both.there.t - 5) < 0.3 && (await run(`return ${controls}.querySelector('.clip-time').textContent`)) === '0:05');
    await control('−10');
    check('"−10" retrocede sin pasarse del principio', (await air()).live.clock.position === 0 && (await run(`return ${controls}.querySelector('.clip-time').textContent`)) === '0:00');
    await run(`const v = ${controls}.querySelector('.volume input'); v.value = 40; v.dispatchEvent(new Event('input'));`);
    await sleep(700);
    both = await screens();
    check('el volumen de Manna es uno solo y lo sigue la pantalla que suena', (await air()).volume === 0.4 && Math.abs(both.there.volume - 0.4) < 0.01 && (await run(`return ${controls}.querySelector('.vol-amount').textContent`)) === '40 %');
    await control('Silenciar');
    check('se puede silenciar y volver al volumen que había', (await air()).volume === 0 && await (async () => { await control('Quitar el silencio'); return (await air()).volume === 0.4; })());

    // Subtítulos: un archivo .srt junto al video.
    const cardMenu = async (cardJs, label) => { await click(`${cardJs}.querySelector('.media-more')`); await sleep(300); await menuItem(label); await sleep(400); };
    await cardMenu(mainCard, 'Añadir subtítulos');
    await chooseFiles('.media-body[data-panel=videos] input[accept*=".srt"]', [captions]);
    check('se le añaden subtítulos desde un archivo .srt', await until(`${mainCard}.querySelector('.media-cc')`) && (await videosNow()).find((v) => v.id === main.id).subtitles === true);
    await click(`${vbar}.querySelector('.btn.primary')`);
    await sleep(1500);
    await control('Pausar');
    await control('Subtítulos');
    both = await screens();
    check('y se muestran con su mando mientras el video está al aire', (await air()).live.subtitles === 'sub' && both.there.subtitles === 'showing' && await run(`return !${controls}.querySelector('select')`));
    await cardMenu(mainCard, 'Quitar los subtítulos');
    check('los subtítulos se pueden quitar', (await videosNow()).find((v) => v.id === main.id).subtitles === false && await run(`return !${mainCard}.querySelector('.media-cc')`));
    // «Negro» y «Solo fondo» también pausan; "Reproducir" lo vuelve a mostrar.
    await control('Reproducir');
    await sleep(500);
    await listen(`${far}.querySelector('.clip-view video')`);
    await click(`[...document.querySelectorAll('.dock .transport .btn')].find(b => b.textContent.startsWith('Negro'))`);
    await sleep(700);
    sound = await heard();
    on = await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, playing: s.live.state.clock.playing })`).then(JSON.parse);
    check('«Negro» pausa lo que suena, también con un desvanecido', on.mode === 'black' && on.playing === false && sound.ends && sound.steps >= 4, `${sound.steps} pasos de volumen`);
    await control('Reproducir');
    on = await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, playing: s.live.state.clock.playing })`).then(JSON.parse);
    check('"Reproducir" con la pantalla en negro la vuelve a mostrar', on.mode === 'live' && on.playing === true);
    // Al terminar, la proyección pasa sola a "Solo fondo".
    await run(`const b = ${controls}.querySelector('.clip-seek input'); b.value = Number(b.max) - 1.2; b.dispatchEvent(new Event('input')); b.dispatchEvent(new Event('change'));`);
    const ended = await until(`document.querySelector('.dock-head strong').textContent === 'Solo fondo'`, 12);
    on = await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, playing: s.live.state.clock.playing, far: ${far}.querySelector('.stage').dataset.mode })`).then(JSON.parse);
    check('al terminar el video, la proyección pasa sola a «Solo fondo»', ended && on.mode === 'clear' && on.playing === false && on.far === 'clear', JSON.stringify(on));
    // Cambiar lo que hay en pantalla: lo nuevo sale al instante y el sonido de lo anterior se desvanece.
    await control('Otra vez');
    await sleep(900);
    await run(`window.__anterior = ${far}.querySelector('.clip-view video');`);
    await listen('window.__anterior');
    await run(`await ${post('projection.show', { kind: 'testcard', data: {} })}`);
    const swapped = await run(`return ${far}.querySelector('.stage .tc') !== null && !${far}.querySelector('.clip-view')`);
    await sleep(700);
    sound = await heard();
    check('al cambiar lo que está en pantalla, lo nuevo sale enseguida y el sonido anterior se desvanece', swapped && sound.ends && sound.steps >= 4 && sound.min < 0.3, `${sound.steps} pasos de volumen`);
    await click(`${vbar}.querySelector('.btn.primary')`);
    await sleep(1500);
    await control('Pausar');
    await run(`document.querySelector('#pantalla').remove()`);
    await control('Reproducir');
    await sleep(900);
    both = JSON.parse(await run(`const a = document.querySelector('.dock .monitor video'); const api = await import('/core/api.js'); return JSON.stringify({ paused: a.paused, muted: a.muted, yo: api.connectionId(), suena: api.state.conexiones.sonido, tocada: navigator.userActivation.hasBeenActive })`));
    on = await air();
    check('sin ventana de proyección, el sonido sale por el control del equipo principal, sin tocar nada', Boolean(on.sound) && !both.paused && both.muted === false && await run(`return ${controls}.querySelector('.vol-nobody').hidden`), JSON.stringify(both));
    await control('Pausar');

    await click(`[...${vbar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
    await sleep(600);
    const videoInOrder = (await air()).order.find((i) => i.kind === 'video');
    check('el video se añade al orden del culto como elemento propio, con su duración', Boolean(videoInOrder) && videoInOrder.title === 'video de bienvenida' && videoInOrder.subtitle === 'Video · 0:08');
    await cardMenu(mainCard, 'Cambiar el nombre');
    await run(`${modal}.querySelector('input').value = 'Bienvenida';`);
    await modalButton('Guardar');
    await sleep(600);
    const oldCard = `${vids}.querySelector('.media-card[data-id="${converted?.id}"]')`;
    await cardMenu(oldCard, 'Eliminar');
    await modalButton('Eliminar');
    await sleep(700);
    videos = await videosNow();
    check('un video se renombra y se elimina', videos.length === 1 && videos[0].name === 'Bienvenida' && await run(`return (await fetch(${JSON.stringify(converted?.url || '/x')})).status === 404`));

    await tab('audios');
    const auds = `document.querySelector('.media-body[data-panel=audios]')`;
    await chooseFiles('.media-body[data-panel=audios] input[type=file]', [track]);
    await sleep(500);
    await modalButton('Subir');
    check('un audio se sube igual, desde su pestaña', await until(`!${modal} && ${auds}.querySelector('.media-card[data-status=ready]')`, 60) && await run(`return ${auds}.querySelector('.media-card strong').textContent === 'pista de piano' && ${auds}.querySelector('.media-duration').textContent === '0:05'`));
    await click(`${auds}.querySelector('.media-card .media-pick')`);
    await sleep(300);
    await click(`document.querySelector('.media-bar[data-panel=audios] .btn.primary')`);
    await sleep(1200);
    on = await air();
    check('al proyectarlo suena, y la pantalla muestra su nombre sobre el fondo', on.item.kind === 'audio' && on.live.clock.playing === true && await run(`const m = document.querySelector('.dock .monitor'); return m.querySelector('.clip-audio .stage-ref').textContent === 'pista de piano' && !m.querySelector('audio').paused && m.querySelector('.stage').dataset.fill === 'text'`));
    await control('Pausar');
    check('y se gobierna con los mismos mandos', (await air()).live.clock.playing === false && await run(`return ${controls}.querySelectorAll('button').length >= 5 && document.querySelector('.dock .monitor audio').paused`));

    console.log('\n1. Interfaz · Medios (YouTube)');
    if (!CAN_YOUTUBE) console.log('  (en este sistema no se puede usar el yt-dlp de mentira: esta parte se salta)');
    else {
      await tab('youtube');
      const tube = `document.querySelector('.media-body[data-panel=youtube]')`;
      const tubeBar = `document.querySelector('.media-bar[data-panel=youtube]')`;
      const linkBox = `document.querySelector('.yt-add input')`;
      const tubeCard = `${tube}.querySelector('.media-card[data-status=ready], .media-card[data-status=downloading]')`;
      const tubesNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).media.youtube)`).then(JSON.parse);
      const paste = async (value) => { await run(`const i = ${linkBox}; i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input'));`); await click(`document.querySelector('.yt-add .btn')`); await sleep(500); };
      check('la pestaña YouTube pide el enlace en vez de un archivo, y explica para qué sirve', await run(`const head = document.querySelector('.ws[data-module=medios] .ws-head'); return ${tube}.querySelector('.empty').textContent.includes('Aún no hay videos de YouTube') && ${tube}.querySelector('.empty').textContent.includes('sin internet') && Boolean(${linkBox}) && ![...head.querySelectorAll('.btn')].some(b => b.textContent.includes('Subir') && getComputedStyle(b).display !== 'none') && document.querySelector('.ws-notice').hidden`));
      expectError('no es un enlace de un video de YouTube');
      await paste('https://vimeo.com/123456789');
      check('lo que no es un enlace de YouTube se rechaza, y lo dice', (await text('#toast')).includes('no es un enlace de un video de YouTube') && (await tubesNow()).length === 0, await text('#toast'));
      await paste('https://youtu.be/pruebaManna?si=compartido');
      check('al pegar un enlace empieza a descargarse y lo muestra con su avance, sin detener la app', await until(`${tubeCard}?.dataset.status === 'downloading' && ${tubeCard}.querySelector('.media-status .bar')`, 10)
        && (await text('#toast')).includes('Descargando') && await run(`return ${linkBox}.value === '' && ${tubeBar}.querySelector('.btn.primary').disabled`));
      check('el título llega antes que el video, y el avance se mueve (también en las tareas del panel)', await until(`${tubeCard}.querySelector('strong').textContent === 'Saludo de la iglesia hermana' && Number(${tubeCard}.querySelector('.bar')?.getAttribute('aria-valuenow')) > 0 && [...document.querySelectorAll('.dock .job strong')].some(s => s.textContent === 'Descargando «Saludo de la iglesia hermana»')`, 20),
        await run(`return ${tubeCard}.querySelector('strong').textContent + ' · ' + ${tubeCard}.querySelector('.media-status small')?.textContent`));
      check('queda listo, con su imagen, su duración y sus subtítulos', await until(`${tubeCard}.dataset.status === 'ready' && ${tubeCard}.querySelector('.media-thumb img')?.naturalWidth > 0 && ${tubeCard}.querySelector('.media-duration')?.textContent === '0:06' && ${tubeCard}.querySelector('.media-cc')`, 60));
      const saved = (await tubesNow())[0];
      const asked = JSON.parse(fs.readFileSync(ytAsked, 'utf8'));
      check('a yt-dlp solo le llega la dirección que escribe Manna, con el identificador del video', asked.at(-1) === 'https://www.youtube.com/watch?v=pruebaManna' && asked.at(-2) === '--' && !asked.some((a) => a.includes('compartido')), asked.slice(-2).join(' '));
      check('el video queda guardado en el equipo: después ya no hace falta internet', saved.url === `/media/youtube/${saved.id}.mp4` && await run(`return (await fetch(${JSON.stringify(saved.url)}, { headers: { Range: 'bytes=0-9' } })).status === 206`), saved.url);
      await paste('https://www.youtube.com/watch?v=pruebaManna&t=30s');
      check('el mismo video no se descarga dos veces', (await text('#toast')).includes('ya está en la biblioteca') && (await tubesNow()).length === 1);

      // Al aire, como cualquier video.
      await click(`${tubeCard}.querySelector('.media-pick')`);
      await sleep(300);
      await click(`${tubeBar}.querySelector('.btn.primary')`);
      await sleep(1800);
      const tubeView = () => run(`const v = document.querySelector('.dock .monitor video'); return JSON.stringify({ src: v.getAttribute('src'), paused: v.paused, t: v.currentTime, tracks: [...v.textTracks].map(t => t.language + ':' + t.mode) })`).then(JSON.parse);
      let onTube = await air();
      let viewed = await tubeView();
      check('se proyecta como un video más, reproduciéndose desde el equipo', onTube.item.kind === 'youtube' && onTube.item.title === 'Saludo de la iglesia hermana' && onTube.live.clock.playing === true
        && viewed.src === saved.url && !viewed.paused && viewed.t > 0.3 && await run(`return Boolean(${tubeCard}.querySelector('.badge.live'))`), JSON.stringify(viewed));
      await control('Pausar');
      check('trae sus subtítulos en español y en inglés, y los mandos dejan elegir el idioma', onTube.item.subtitles.map((t) => t.lang).join() === 'es,en' && await run(`return [...${controls}.querySelectorAll('select option')].map(o => o.textContent).join() === 'Español,Inglés'`));
      await control('Subtítulos');
      onTube = await air();
      viewed = await tubeView();
      check('"Subtítulos" muestra los del primer idioma', onTube.live.subtitles === 'es' && viewed.tracks.join() === 'es:showing,en:hidden', viewed.tracks.join());
      await run(`const s = ${controls}.querySelector('select'); s.value = 'en'; s.dispatchEvent(new Event('change'));`);
      await sleep(700);
      onTube = await air();
      viewed = await tubeView();
      check('y al cambiar de idioma cambian en pantalla', onTube.live.subtitles === 'en' && viewed.tracks.join() === 'es:hidden,en:showing', viewed.tracks.join());
      const vtt = await run(`return await (await fetch(${JSON.stringify(onTube.item.subtitles[0].url)})).text()`);
      check('los subtítulos automáticos de YouTube llegan limpios: cada línea, una sola vez', vtt.split('texto de prueba').length === 2 && !vtt.includes('<c>') && !vtt.includes('align:'), vtt.replace(/\n+/g, ' / ').slice(0, 110));
      await control('Subtítulos');
      check('y se pueden quitar', (await air()).live.subtitles === false);
      await click(`[...${tubeBar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
      await sleep(600);
      const tubeInOrder = (await air()).order.find((i) => i.kind === 'youtube');
      check('se añade al orden del culto como elemento propio', Boolean(tubeInOrder) && tubeInOrder.title === 'Saludo de la iglesia hermana' && tubeInOrder.subtitle === 'YouTube · 0:06');

      // Un video que YouTube no deja bajar.
      await paste('https://www.youtube.com/watch?v=privado0001');
      const failedCard = `${tube}.querySelector('.media-card[data-status=error]')`;
      check('si YouTube no deja descargarlo, la ficha dice por qué y ofrece reintentar', await until(`${failedCard}?.querySelector('.media-status small')?.textContent.includes('privado o se quitó')`, 30)
        && await run(`return [...${failedCard}.querySelectorAll('.media-status .btn')].map(b => b.textContent).join() === 'Reintentar' && document.querySelectorAll('.dock .job.error').length === 1`));
      await click(`${failedCard}.querySelector('.media-status .btn')`);
      check('"Reintentar" lo descarga de nuevo', await until(`${tube}.querySelectorAll('.media-card[data-status=downloading]').length === 1`, 10) && await until(`${failedCard}`, 30));
      await cardMenu(failedCard, 'Eliminar');
      await modalButton('Eliminar');
      await sleep(700);
      check('y al eliminarlo no queda ningún aviso suyo', (await tubesNow()).length === 1 && await run(`return !document.querySelector('.dock .job.error')`));
    }
  }

  console.log('\n1. Interfaz · Himnario');
  {
    const ws = `document.querySelector('.ws[data-module=himnario]')`;
    const hbar = `${ws}.querySelector('.hymn-bar')`;
    const hymnBox = `${ws}.querySelector('.search input')`;
    const tile = (n) => `${ws}.querySelector('.hymn[data-n="${n}"]')`;
    const typeIn = async (value) => { await run(`const i = ${hymnBox}; i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input'));`); await sleep(800); };
    const hits = () => run(`return JSON.stringify([...${ws}.querySelectorAll('.hymn-hit')].map(r => ({ n: Number(r.dataset.n), title: r.querySelector('.hymn-title').textContent, label: r.querySelector('small b')?.textContent || null, text: r.querySelector('small')?.textContent || null, marks: [...r.querySelectorAll('mark')].map(m => m.textContent) })))`).then(JSON.parse);
    const onAir = () => run(`const s = await (await fetch('/api/state')).json(); const v = document.querySelector('.dock .monitor video'); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items, src: v ? decodeURIComponent(v.getAttribute('src') || '') : null, paused: v?.paused, t: v?.currentTime, pos: s.live.state?.clock ? s.live.state.clock.position + (s.live.state.clock.playing ? (Date.now() - s.live.state.clock.at) / 1000 : 0) : null })`).then(JSON.parse);
    const liveBox = `document.querySelector('.dock .live-controls')`;
    await click(`document.querySelector('.rail-item[data-id=himnario]')`);
    check('el himnario lee los videos de su carpeta: una ficha por himno, con su número y su título', await until(`${ws}.querySelectorAll('.hymn').length === 13`, 20)
      && await run(`return document.title === 'Manna · Himnario' && ${tile(1)}.querySelector('.hymn-n').textContent === '1' && ${tile(1)}.querySelector('.hymn-title').textContent === ${JSON.stringify(hymnTitle(1))} && !${tile(HYMN_FACTS.withoutVideo)} && ${hbar}.hidden`));
    check('el título lleva las tildes y los signos del archivo de letras, que el nombre del video no tiene', await run(`return ${tile(13)}.querySelector('.hymn-title').textContent === ${JSON.stringify(hymnTitle(13))} && ${JSON.stringify(hymnTitle(13))}.includes('¡')`));
    check('avisa de lo que conviene revisar en la carpeta', await run(`return !${ws}.querySelector('.hymn-notes').hidden && ${ws}.querySelector('.hymn-notes').textContent === '4 avisos'`), await run(`return ${ws}.querySelector('.hymn-notes')?.textContent`));
    await click(`${ws}.querySelector('.hymn-notes')`);
    await sleep(300);
    check('y lo dice con claridad: videos que faltan, letras que no corresponden a su video, himnos sin letra', await run(`const items = [...${modal}.querySelectorAll('.hymn-notes-list li')].map(l => l.textContent); return items.length === 4 && items[0].includes('Faltan los videos de un himno: 7') && items[1].includes('otro título que su video') && items[1].includes(': 4.') && items[2].includes('No hay letra para un himno: 6') && items[3].includes('sin video') && ${modal}.textContent.includes('13 himnos en video, 11 con letra')`), await run(`return ${modal}.textContent.slice(0, 200)`));
    await modalButton('Entendido');
    await click(`${ws}.querySelector('.hymn-views [data-view=categories]')`);
    await sleep(400);
    check('la vista por categorías agrupa los himnos bajo el nombre de cada una', await run(`const g = [...${ws}.querySelectorAll('.hymn-group')]; return g.length === 3 && g.map(x => x.querySelector('h2').textContent).join('|') === 'Cantos de la mañana|Cantos del camino|Cantos de gratitud y esperanza para todos los días' && g.map(x => x.querySelectorAll('.hymn').length).join() === '3,4,6' && g[0].querySelector('small').textContent === '1–3 · 3 himnos'`), await run(`return [...${ws}.querySelectorAll('.hymn-group')].map(x => x.querySelector('h2').textContent + ' ' + x.querySelectorAll('.hymn').length).join(' | ')`));
    await click(`${ws}.querySelector('.hymn-views [data-view=grid]')`);
    await sleep(300);

    // Buscar: por la letra, por el título y por el número.
    await typeIn('lampara encendida');
    let found = await hits();
    check('busca en la letra mientras se escribe, sin tildes, y muestra el renglón con lo encontrado', found.length === 1 && found[0].n === HYMN_FACTS.phrase.number && found[0].label === 'Estrofa 2' && found[0].marks.join() === 'lámpara encendida' && found[0].text.includes('en la ventana') && await run(`return ${ws}.querySelector('.hymn-level').textContent.startsWith('Frase exacta')`), JSON.stringify(found[0] || null));
    await typeIn('sendero');
    found = await hits();
    check('y en el título', found[0]?.n === 10 && found[0].label === null && found[0].marks.join() === 'Sendero', JSON.stringify(found[0] || null));
    await typeIn('titulo que no es el de su video');
    check('una letra que no corresponde a su video no se encuentra', (await hits()).length === 0 && await run(`return ${ws}.querySelector('.empty').textContent.includes('Ningún himno coincide')`));
    await typeIn('9');
    found = await hits();
    check('un número lleva a ese himno', found.length === 1 && found[0].n === 9 && found[0].title === hymnTitle(9));
    await press('Enter');
    check('Enter lo elige y deja el buscador: se ve en la vista previa, con su número', await run(`const m = document.querySelectorAll('.dock .monitor')[1]; return ${hymnBox}.value === '' && ${tile(9)}.classList.contains('selected') && ${hbar}.querySelector('.hymn-sel-n').textContent === '9' && !${hbar}.hidden && m.querySelector('.song-number').textContent === '9' && m.querySelector('.song-card .stage-ref').textContent === ${JSON.stringify(hymnTitle(9))} && document.activeElement !== ${hymnBox}`));
    await click(`${hbar}.querySelector('.btn')`);
    await sleep(500);
    check('«Letra» muestra la letra del himno, por partes', await run(`return ${modal}.querySelector('h2').textContent === ${JSON.stringify(`9 · ${hymnTitle(9)}`)} && [...${modal}.querySelectorAll('.hymn-lyrics h3')].map(h => h.textContent).join() === 'Estrofa 1,Coro,Estrofa 2' && ${modal}.querySelectorAll('.hymn-lyrics p').length === 10 && ${modal}.querySelector('.hymn-lyrics section:nth-child(2) p').textContent.startsWith(${JSON.stringify(HYMN_FACTS.chorus.text)})`));
    await modalButton('Cerrar');
    await click(tile(HYMN_FACTS.withoutLyrics));
    await sleep(300);
    check('un himno sin letra lo dice en su botón', await run(`const b = ${hbar}.querySelector('.btn'); return b.disabled && b.title.includes('No hay letra')`));

    if (!HAS_FFMPEG) console.log('  (este equipo no tiene ffmpeg: los himnos de la prueba no se pueden reproducir y esa parte se salta)');
    else {
      const chip = (id) => `${hbar}.querySelector('.hymn-sound [data-track=${id}]')`;
      check('Manna mira cada video: cuánto dura y si trae pista instrumental', await until(`(await (await fetch('/api/hymns', { headers: { 'X-Prueba': '1' } })).json()).hymns.every(h => h.instrumental != null)`, 50) && await (async () => { await click(tile(HYMN_FACTS.single)); await sleep(400); return run(`return ${hbar}.querySelector('.hint').textContent.endsWith('0:14') && ${chip('instrumental')}.disabled && ${chip('instrumental')}.title.includes('no trae pista') && ${chip('vocal')}.classList.contains('on')`); })(), await run(`return ${hbar}.querySelector('.hint').textContent`));
      await click(tile(9));
      await sleep(300);
      await click(chip('instrumental'));
      await sleep(300);
      check('antes de proyectar se elige el sonido: cantado o pista', await run(`const m = document.querySelectorAll('.dock .monitor')[1]; return ${chip('instrumental')}.classList.contains('on') && !${chip('vocal')}.classList.contains('on') && m.querySelector('.song-track').textContent === 'Pista'`));
      await press('Enter');
      await sleep(2200);
      let air = await onAir();
      check('Enter lo proyecta con la pista instrumental, reproduciéndose', air.item.kind === 'song' && air.item.number === 9 && air.live.track === 'instrumental' && air.live.clock.playing === true && /^\/api\/hymns\/9\/pista\.mp4/.test(air.src) && air.paused === false && air.t > 0.3
        && await run(`return ${tile(9)}.classList.contains('live') && document.querySelector('.dock-ref').textContent === ${JSON.stringify(`9 · ${hymnTitle(9)}`)}`), JSON.stringify({ src: air.src, t: air.t, track: air.live?.track }));
      check('los mandos de un himno: cantado o pista, y los de cualquier cosa que suena', await run(`const c = ${liveBox}; return [...c.querySelectorAll('.song-tracks button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join() === 'Cantado,Pista*' && Boolean(c.querySelector('.clip-seek input')) && Boolean(c.querySelector('.volume input')) && c.querySelector('.clip-seek .clip-time:last-child').textContent === '0:14'`), await run(`return ${liveBox}.textContent`));
      await click(`${liveBox}.querySelector('.song-tracks [data-track=vocal]')`);
      await sleep(2200);
      air = await onAir();
      check('al aire se pasa de la pista al himno cantado sin perder el punto', air.live.track === 'vocal' && air.src === `/himnos/009 ${hymnTitle(9)}.mp4` && air.paused === false && Math.abs(air.t - air.pos) < 0.7 && air.t > 2, JSON.stringify({ src: air.src, t: air.t, pos: air.pos }));
      await click(`[...${liveBox}.querySelectorAll('button')].find(b => b.textContent.includes('Pausar'))`);
      await sleep(700);
      check('y se pausa como cualquier video', (await onAir()).live.clock.playing === false);
    }
    await click(tile(9));
    await sleep(300);
    await click(`[...${hbar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
    await sleep(600);
    const inOrder = (await onAir()).order.find((i) => i.kind === 'song');
    check('un himno se añade al orden del culto con el sonido elegido', Boolean(inOrder) && inOrder.title === hymnTitle(9) && inOrder.subtitle === (HAS_FFMPEG ? 'N.º 9 · Pista' : 'N.º 9 · Cantado') && inOrder.steps === 1, JSON.stringify(inOrder || null));
    await press('ArrowDown');
    check('↓ pasa al himno siguiente sin tocar la proyección', await run(`return ${tile(10)}.classList.contains('selected') && ${hbar}.querySelector('.hymn-sel-n').textContent === '10'`));
  }

  console.log('\n1. Interfaz · Diapositivas');
  {
    const ws = `document.querySelector('.ws[data-module=diapositivas]')`;
    const dbar = `${ws}.querySelector('.deck-bar')`;
    const decksNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).slides.decks)`).then(JSON.parse);
    const onAir = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items })`).then(JSON.parse);
    const pickFile = async (file) => { await chooseFiles('.ws[data-module=diapositivas] input[type=file]', [file]); await sleep(600); };
    const slide = (n) => `${ws}.querySelector('.slide-pick[data-n="${n}"]')`;
    const deckMenu = async (cardJs, label) => { await click(`${cardJs}.querySelector('.deck-more')`); await sleep(300); await menuItem(label); await sleep(400); };
    const liveBox = `document.querySelector('.dock .live-controls')`;
    await click(`document.querySelector('.rail-item[data-id=diapositivas]')`);
    await sleep(500);
    check('Diapositivas ya es un módulo: sin presentaciones, invita a subir un PDF o un PowerPoint', await run(`return document.title === 'Manna · Diapositivas' && ${ws}.querySelector('.empty').textContent.includes('Aún no hay presentaciones') && ${ws}.querySelector('.empty').textContent.includes('PDF o una presentación de PowerPoint') && ${dbar}.hidden`));
    const notDeck = path.join(tmp, 'no-es-presentacion.txt');
    fs.writeFileSync(notDeck, 'unas notas');
    await pickFile(notDeck);
    check('un archivo que no es una presentación se explica, y dice cómo sacar el PDF', await run(`return ${modal}.querySelector('h2').textContent === 'Ese archivo no es una presentación' && ${modal}.textContent.includes('Exportar')`));
    await modalButton('Entendido');

    // Un PDF de verdad, de cuatro páginas, hecho aquí mismo. Lo convierte este Chrome con pdf.js.
    const COLORS = [[29, 78, 216], [15, 118, 110], [190, 18, 60], [124, 58, 237]];
    const report = path.join(tmp, 'informe_de-tesoreria.pdf');
    fs.writeFileSync(report, makePdf(COLORS.map((color, i) => ({ text: `Diapositiva ${i + 1}`, color }))));
    await pickFile(report);
    check('al elegir un PDF propone un nombre y dice cuántas diapositivas tiene', await run(`return ${modal}.querySelector('h2').textContent === 'Subir una presentación' && ${modal}.querySelector('input').value === 'informe de tesoreria'`)
      && await until(`${modal}.querySelector('.deck-up-status').textContent.startsWith('4 diapositivas') && !${modal}.querySelector('.btn.primary').disabled`, 40), await run(`return ${modal}.querySelector('.deck-up-status')?.textContent`));
    check('avisa de lo que se pierde: animaciones, transiciones y videos', await run(`return ${modal}.querySelector('.deck-up-note').textContent.includes('animaciones')`));
    await run(`${modal}.querySelector('input').value = 'Informe de tesorería';`);
    await modalButton('Subir');
    check('convierte cada página en una imagen, las sube y cierra la ventana', await until(`!${modal} && ${ws}.querySelectorAll('.slide-pick').length === 4`, 80), await run(`return ${modal}?.querySelector('.deck-up-status')?.textContent || ''`));
    let decks = await decksNow();
    const deck = decks[0] || {};
    check('queda en la biblioteca con sus cuatro diapositivas, grandes y con miniatura', decks.length === 1 && deck.name === 'Informe de tesorería' && deck.pages === 4 && deck.width === 2560 && deck.height === 1440 && deck.thumbs === true && deck.source === 'pdf'
      && await run(`const r = await fetch(${JSON.stringify(`${deck.base}4.jpg`)}); return r.status === 200 && r.headers.get('content-type') === 'image/jpeg'`), JSON.stringify(decks.map((d) => [d.name, d.pages, d.width, d.height, d.thumbs])));
    const deckCard = `${ws}.querySelector('.deck[data-id="${deck.id}"]')`;
    check('se abre sola, con la portada en su tarjeta y una miniatura por diapositiva', await until(`${deckCard}.classList.contains('selected') && ${deckCard}.querySelector('.deck-cover img').naturalWidth === 320 && [...${ws}.querySelectorAll('.slide-thumb img')].every(i => i.naturalWidth === 320)`, 20)
      && await run(`return ${deckCard}.querySelector('small').textContent.startsWith('4 diapositivas · PDF')`));
    await click(slide(2));
    await sleep(500);
    check('al elegir una diapositiva se ve en la vista previa y la barra dice cuál es', await run(`const m = document.querySelectorAll('.dock .monitor')[1]; return ${slide(2)}.classList.contains('selected') && m.querySelector('.img-view img').getAttribute('src') === ${JSON.stringify(`${deck.base}m2.jpg`)} && ${dbar}.querySelector('.sel-ref').textContent === 'Diapositiva 2 de 4' && ${dbar}.querySelector('.hint').textContent === 'Informe de tesorería'`));
    await press('Enter');
    await sleep(600);
    let air = await onAir();
    check('Enter la proyecta, y la rejilla marca cuál está al aire', air.item.kind === 'slides' && air.item.number === 2 && air.item.pages === 4 && await run(`return Boolean(${slide(2)}.querySelector('.badge.live')) && ${deckCard}.classList.contains('live') && document.querySelector('.dock-ref').textContent === 'Informe de tesorería · 2 de 4'`));
    check('los mandos dicen por dónde va, cuántas quedan y cuál sigue', await run(`const c = ${liveBox}; return c.querySelector('.slide-count strong').textContent === 'Diapositiva 2 de 4' && c.querySelector('.slide-count small').textContent === 'Quedan 2' && c.querySelector('.slide-next img').getAttribute('src') === ${JSON.stringify(`${deck.base}m3.jpg`)} && c.querySelector('.slide-next-text').textContent === 'SigueDiapositiva 3'`), await run(`return ${liveBox}.textContent`));
    // Otra pantalla de proyección: a tamaño completo carga la imagen grande.
    await run(`const f = document.createElement('iframe'); f.id = 'pantalla'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:640px;height:360px;z-index:99;border:0'; document.body.append(f);`);
    const far = `document.querySelector('#pantalla').contentDocument`;
    check('la pantalla de proyección muestra la diapositiva a su tamaño completo', await until(`${far}?.querySelector('.img-view img')?.naturalWidth === 2560 && ${far}.querySelector('.img-view img').getAttribute('src') === ${JSON.stringify(`${deck.base}2.jpg`)}`, 30));
    await press('ArrowRight');
    air = await onAir();
    check('→ pasa a la diapositiva siguiente en las dos pantallas, y la selección la acompaña', air.item.number === 3 && await until(`${far}.querySelector('.img-view img').getAttribute('src') === ${JSON.stringify(`${deck.base}3.jpg`)}`, 10) && await run(`return ${slide(3)}.classList.contains('selected') && Boolean(${slide(3)}.querySelector('.badge.live')) && !${slide(2)}.querySelector('.badge')`));
    await run(`const s = ${liveBox}.querySelector('input[type=range]'); s.value = 2; s.dispatchEvent(new Event('input'));`);
    await sleep(800);
    air = await onAir();
    const part = await run(`const root = ${far}; const i = root.querySelector('.img-view img'); const scale = Number(/scale\\(([\\d.]+)\\)/.exec(i.style.transform)?.[1]); return root.querySelector('.img-view').clientWidth / (i.naturalWidth * scale);`);
    check('una diapositiva se acerca como una imagen: la pantalla muestra la mitad de su ancho', air.live.zoom === 2 && Math.abs(part - 0.5) < 0.01 && await run(`return !${liveBox}.querySelector('.nav-frame').hidden && ![...${liveBox}.querySelectorAll('button')].some(b => b.textContent === 'Llenar')`), `se ve ${(part * 100).toFixed(1)} % del ancho`);
    await press('ArrowRight');
    air = await onAir();
    check('la siguiente empieza en vista completa, y en la última los mandos lo dicen', air.item.number === 4 && air.live.zoom === 1 && air.item.next === null && await run(`const c = ${liveBox}; return c.querySelector('.slide-count small').textContent === 'Es la última' && c.querySelector('.slide-next-text').textContent === 'SigueFin de la presentación' && c.querySelector('.slide-next').classList.contains('none')`));
    await press('ArrowRight');
    check('tras la última, → no hace nada', (await onAir()).item.number === 4);
    await press('ArrowUp');
    check('↑ mueve la selección sin tocar lo que está al aire', (await onAir()).item.number === 4 && await run(`return ${slide(3)}.classList.contains('selected') && ${dbar}.querySelector('.sel-ref').textContent === 'Diapositiva 3 de 4'`));
    await run(`document.querySelector('#pantalla').remove()`);

    await click(`[...${dbar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
    await sleep(600);
    const inOrder = (await onAir()).order.find((i) => i.kind === 'slides');
    check('la presentación se añade al orden del culto con una diapositiva por paso', Boolean(inOrder) && inOrder.title === 'Informe de tesorería' && inOrder.steps === 4 && inOrder.subtitle === 'PDF');
    await click(`document.querySelector('.rail-item[data-id=orden]')`);
    await sleep(500);
    await click(`[...document.querySelectorAll('.ws[data-module=orden] .orow')].find(r => r.textContent.includes('Informe de tesorería'))`);
    const detail = `document.querySelector('.ws[data-module=orden] .odetail')`;
    // Las miniaturas cargan la versión pequeña de cada diapositiva (320 px), no la imagen grande.
    // Se cuentan las imágenes: mientras se ve el esqueleto de carga aún no hay ninguna.
    check('en el orden se ven sus diapositivas en miniatura, rotuladas, con la imagen pequeña de cada una', await until(`${detail}.querySelectorAll('.slide img').length === 4 && [...${detail}.querySelectorAll('.slide img')].every(i => i.naturalWidth === 320 && /\\/m\\d\\.jpg$/.test(i.getAttribute('src')))
      && [...${detail}.querySelectorAll('.slide-cap span')].map(s => s.textContent).join() === 'Diapositiva 1,Diapositiva 2,Diapositiva 3,Diapositiva 4'`, 30)
      && await run(`return ${detail}.querySelector('.odetail-head small').textContent === 'Diapositivas · PDF · 4 diapositivas'`), await run(`return [...${detail}.querySelectorAll('.slide img')].map(i => (i.getAttribute('src') || '').split('/').pop() + ' ' + i.naturalWidth).join(', ')`));
    await click(`${detail}.querySelectorAll('.slide')[1]`);
    await sleep(600);
    air = await onAir();
    check('desde el orden se proyecta la que se toque, y «Siguiente» sigue por ahí', air.item.number === 2 && air.item.source.orderId === inOrder.id && await (async () => { await press('ArrowRight'); return (await onAir()).item.number === 3; })());

    // Un PowerPoint: lo convierte el PowerPoint del equipo principal (aquí, uno de mentira).
    await click(`document.querySelector('.rail-item[data-id=diapositivas]')`);
    await sleep(400);
    const lesson = path.join(tmp, 'escuela sabatica.pptx');
    fs.writeFileSync(lesson, fakePresentation());
    await pickFile(lesson);
    check('un PowerPoint se sube tal cual: lo convertirá el PowerPoint del equipo', await run(`return ${modal}.querySelector('input').value === 'escuela sabatica' && ${modal}.querySelector('.deck-up-status').textContent.includes('PowerPoint del equipo principal') && !${modal}.querySelector('.btn.primary').disabled`));
    await modalButton('Subir');
    const converting = `${ws}.querySelector('.deck[data-status=converting]')`;
    check('la conversión corre de fondo, con su avance en la tarjeta y en el panel', await until(`!${modal} && ${converting}?.querySelector('.deck-status .bar') && [...document.querySelectorAll('.dock .job strong')].some(s => s.textContent === 'Convirtiendo «escuela sabatica»')`, 15) && (await text('#toast')).includes('PowerPoint la está convirtiendo')
      && await until(`/Diapositiva \\d de 3/.test(${converting}?.querySelector('.deck-status small')?.textContent || '')`, 15), await run(`return ${converting}?.querySelector('.deck-status small')?.textContent`));
    check('al terminar quedan sus tres diapositivas', await until(`${ws}.querySelectorAll('.deck[data-status=ready]').length === 2`, 40) && await (async () => { decks = await decksNow(); const made = decks.find((d) => d.source === 'powerpoint'); return made?.pages === 3 && made.ext === 'png' && await run(`return ${ws}.querySelector('.deck[data-id="${made.id}"]').classList.contains('selected') && ${ws}.querySelectorAll('.slide-pick').length === 3 && [...${ws}.querySelectorAll('.slide-thumb img')].every(i => i.getAttribute('src').endsWith('.png'))`); })());
    const made = decks.find((d) => d.source === 'powerpoint') || {};
    await deckMenu(deckCard, 'Cambiar el nombre');
    await run(`${modal}.querySelector('input').value = 'Informe del trimestre';`);
    await modalButton('Guardar');
    await sleep(600);
    check('una presentación se renombra, también lo que está al aire', await run(`return !${modal} && ${deckCard}.querySelector('strong').textContent === 'Informe del trimestre' && document.querySelector('.dock-ref').textContent === 'Informe del trimestre · 3 de 4'`), await text('.dock-ref'));
    await deckMenu(`${ws}.querySelector('.deck[data-id="${made.id}"]')`, 'Eliminar');
    await modalButton('Eliminar');
    await sleep(700);
    check('y se elimina con todas sus imágenes', (await decksNow()).length === 1 && await run(`return (await fetch(${JSON.stringify(`${made.base}1.png`)})).status === 404`));

    // En el celular: primero las presentaciones; al tocar una, sus diapositivas.
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await chrome.send('Page.navigate', { url: `${local}/control?m=${Date.now()}#diapositivas` });
    await sleep(2500);
    const shownPane = () => run(`const vis = (s) => { const e = ${ws}.querySelector(s); return Boolean(e) && e.getClientRects().length > 0; }; return JSON.stringify({ list: vis('.deck-list'), pages: vis('.deck-pages'), back: vis('.deck-back'), tab: document.querySelector('.tabbar button.on')?.textContent })`).then(JSON.parse);
    let pane = await shownPane();
    check('en el celular se entra por «Más» y se ven primero las presentaciones', pane.list && !pane.pages && !pane.back && pane.tab === 'Más', JSON.stringify(pane));
    await click(`${ws}.querySelector('.deck-pick')`);
    await sleep(400);
    pane = await shownPane();
    check('al tocar una se ven sus diapositivas, con el botón para volver', !pane.list && pane.pages && pane.back && await run(`return ${ws}.querySelectorAll('.slide-pick').length === 4 && ${dbar}.querySelector('.sel-ref').textContent === 'Diapositiva 3 de 4'`), JSON.stringify(pane));
    await click(`${ws}.querySelector('.deck-back')`);
    await sleep(300);
    pane = await shownPane();
    check('«Presentaciones» vuelve a la lista', pane.list && !pane.pages);
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    await chrome.send('Page.navigate', { url: `${local}/control?d=${Date.now()}#diapositivas` });
    await sleep(2500);
  }

  console.log('\n1. Interfaz · Televisores');
  // El módulo está en pausa: no sale en la barra, pero sigue ahí y se entra por su dirección.
  check('Televisores, en pausa, no aparece en la barra de módulos', await run(`return !document.querySelector('.rail-item[data-id=televisores]') && !document.querySelector('.tabbar [data-id=televisores]')`));
  await run(`location.hash = '#televisores'`);
  await sleep(500);
  const tvs = `document.querySelector('.ws[data-module=televisores]')`;
  const toastText = () => text('#toast');
  const addTv = async (address) => {
    await run(`const i = ${modal}.querySelector('input'); i.value = ${JSON.stringify(address)}; [...${modal}.querySelectorAll('.btn')].find(b => b.textContent === 'Añadir').click();`);
    await sleep(900);
  };
  check('sin televisores, invita a añadir uno', await run(`return ${tvs}.querySelector('.empty').textContent.includes('Aún no hay televisores')`));
  await click(`${tvs}.querySelector('.ws-head .btn')`);
  await sleep(300);
  expectError('Escribe la dirección del televisor');
  await addTv('8.8.8.8');
  check('solo admite direcciones de la red local', (await toastText()).includes('dirección del televisor') && await run(`return Boolean(${modal})`));
  await click(`[...${modal}.querySelectorAll('.btn')].find(b => b.textContent.includes('Buscar en la red'))`);
  check('"Buscar en la red" encuentra el televisor y lo ofrece', await until(`${modal}.querySelector('.tv-row')?.textContent.includes('192.168.1.50')`), await run(`return ${modal}.querySelector('.tv-found')?.textContent`));
  await click(`${modal}.querySelector('.tv-row .btn')`);
  await sleep(900);
  const tvCard = `${tvs}.querySelector('.tv')`;
  check('añade el televisor con su nombre y modelo, y le pide permiso', await run(`return !${modal} && ${tvCard}.querySelector('strong').textContent === 'Tele "de prueba"' && ${tvCard}.querySelector('small').textContent === 'QN00PRUEBA · 192.168.1.50'`) && fakeTv.lastName === 'Manna');
  await sleep(600);
  check('al aceptarse en el televisor queda vinculado, y la clave no llega al navegador', await run(`const s = await (await fetch('/api/state')).json(); return s.tv.list[0].paired && !JSON.stringify(s).includes(${JSON.stringify(fakeTv.token)}) && ${tvCard}.querySelector('.tv-status').textContent === 'Encendido'`));
  await click(`[...${tvCard}.querySelectorAll('.btn')].find(b => b.textContent.includes('Abrir la proyección'))`);
  await sleep(900);
  check('"Abrir la proyección" abre el navegador del televisor', fakeTv.browser.visible && (await run(`return ${tvCard}.querySelector('.tv-status').textContent`)) === 'Encendido · navegador abierto');
  await click(`[...${tvCard}.querySelectorAll('.btn')].find(b => b.textContent === 'Control remoto')`);
  await sleep(500);
  check('el control remoto trae panel táctil, teclas y la dirección que hay que escribir', await run(`return Boolean(${modal}.querySelector('.pad')) && ${modal}.querySelectorAll('.remote-keys .btn').length === 9 && (${JSON.stringify(!ip)} || ${modal}.querySelector('.tv-address').textContent === ${JSON.stringify(`http://${ip}:${PORT}/proyeccion`)})`), await run(`return ${modal}.querySelector('.tv-address').textContent`));
  await click(`${modal}.querySelector('.remote-keys [aria-label=Aceptar]')`);
  await sleep(500);
  check('una tecla del control llega al televisor', fakeTv.received.at(-1)?.DataOfCmd === 'KEY_ENTER');
  // Deslizar el dedo por el panel mueve el puntero; un toque corto pulsa.
  const pad = JSON.parse(await run(`const r = ${modal}.querySelector('.pad').getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })`));
  const mouse = (kind, x, y) => chrome.send('Input.dispatchMouseEvent', { type: kind, x, y, button: 'left', buttons: kind === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  await mouse('mousePressed', pad.x, pad.y);
  await mouse('mouseMoved', pad.x + 30, pad.y + 10);
  await mouse('mouseMoved', pad.x + 60, pad.y + 20);
  await mouse('mouseReleased', pad.x + 60, pad.y + 20);
  await sleep(600);
  const moves = fakeTv.received.filter((p) => p.Cmd === 'Move');
  check('deslizar por el panel mueve el puntero del televisor', moves.length > 0 && moves.reduce((n, p) => n + p.Position.x, 0) === 120 && moves.reduce((n, p) => n + p.Position.y, 0) === 40 && !fakeTv.received.some((p) => p.Cmd === 'LeftClick'), `${moves.length} envíos`);
  await mouse('mousePressed', pad.x, pad.y);
  await mouse('mouseReleased', pad.x, pad.y);
  await sleep(500);
  check('un toque en el panel pulsa', fakeTv.received.at(-1)?.Cmd === 'LeftClick');
  await run(`${modal}.querySelector('details').open = true; [...${modal}.querySelectorAll('.steps .link')].find(b => b.textContent.includes('Escribe la dirección')).click();`);
  await sleep(700);
  const typedUrl = fakeTv.received.find((p) => p.TypeOfRemote === 'SendInputString');
  check('"Escribe la dirección de Manna" la teclea en el televisor', Boolean(typedUrl) && Buffer.from(typedUrl.Cmd, 'base64').toString().endsWith(`:${PORT}/proyeccion`) && fakeTv.received.at(-1)?.TypeOfRemote === 'SendInputEnd');
  await run(`const i = ${modal}.querySelector('input.input'); i.value = 'hola'; [...${modal}.querySelectorAll('.btn')].find(b => b.textContent.includes('Escribir')).click();`);
  await sleep(600);
  check('el texto escrito en el control llega al televisor', Buffer.from(fakeTv.received.at(-1)?.Cmd || '', 'base64').toString() === 'hola' && fakeTv.received.at(-1)?.TypeOfRemote === 'SendInputString');
  await click(`${modal}.querySelector('.modal-header .icon-btn')`);
  // Salir del módulo y volver: al mostrarse pregunta al televisor cómo está.
  await click(`document.querySelector('.rail-item[data-id=orden]')`);
  await sleep(300);
  fakeTv.browser = { running: true, visible: false };
  await run(`location.hash = '#televisores'`);
  check('al volver a la pantalla se pregunta al televisor por su estado', await until(`${tvCard}.querySelector('.tv-status').textContent === 'Encendido'`), await run(`return ${tvCard}.querySelector('.tv-status').textContent`));
  const tvMenu = async (label) => { await click(`${tvCard}.querySelector('.icon-btn')`); await sleep(300); await menuItem(label); await sleep(700); };
  const links = fakeTv.connections;
  await tvMenu('Vincular de nuevo');
  check('se puede volver a vincular', fakeTv.connections === links + 1 && await run(`return (await (await fetch('/api/state')).json()).tv.list[0].paired`));
  fakeTv.browser = { running: true, visible: true };
  await tvMenu('Cerrar el navegador');
  check('el navegador del televisor se cierra desde Manna', fakeTv.browser.visible === false);
  check('Manna atiende también por https en el mismo puerto', await run(`const s = await (await fetch('/api/state')).json(); return s.system.secure === true`) && await new Promise((resolve) => {
    import('node:https').then(({ default: https }) => https.get({ host: '127.0.0.1', port: PORT, path: '/api/ping', rejectUnauthorized: false, agent: false }, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false)));
  }));
  await tvMenu('Quitar');
  check('el televisor se puede quitar de la lista', await run(`return !${tvs}.querySelector('.tv') && Boolean(${tvs}.querySelector('.empty'))`));

  console.log('\n1. Interfaz · Ajustes, dispositivos y permisos');
  await click(`document.querySelector('.rail-item[data-id=ajustes]')`);
  await sleep(500);
  await run(`const s = document.querySelector('.settings input[type=range]'); s.value = 60; s.dispatchEvent(new Event('input'));`);
  await sleep(500);
  check('los estilos de proyección se aplican', (await live()).size === 60);
  check('Ajustes lista los programas del equipo principal', await run(`return document.querySelectorAll('.tools .tool').length === 4`));

  console.log('\n1. Interfaz · Ajustes: fondos de la proyección');
  // Aquí se rompió la subida del fondo durante cuatro versiones sin que ninguna prueba lo pulsara.
  const sw = `document.querySelector('.settings .swatches')`;
  const styles = () => run(`const p = (await (await fetch('/api/state')).json()).projection; return JSON.stringify({ type: p.styles.backgroundType, image: p.styles.bgImage, saved: p.backgrounds.map(b => b.url) })`).then(JSON.parse);
  check('junto a los colores está el botón para subir una imagen de fondo', await run(`return ${sw}.querySelectorAll('button').length === 7 && Boolean(${sw}.querySelector('.swatch-add')) && ${sw}.querySelectorAll('button.on').length === 1`));
  const bigBackground = path.join(tmp, 'fondo grande.png');
  const smallBackground = path.join(tmp, 'fondo pequeño.png');
  fs.writeFileSync(bigBackground, examplePoster(3200, 1800));
  fs.writeFileSync(smallBackground, examplePoster(640, 360, [[15, 118, 110], [202, 138, 4]]));
  await chooseFiles('.settings input[type=file]', [bigBackground]);
  check('subir una imagen de fondo la guarda junto a los colores y la pone', await until(`${sw}.querySelector('.swatch-image.on')`) && (await text('#toast')).includes('Imagen de fondo añadida'), await text('#toast'));
  let bg = await styles();
  const firstBackground = bg.image;
  check('la proyección usa esa imagen, que llegó reducida', bg.type === 'image' && bg.saved.length === 1 && firstBackground.startsWith('/media/fondos/')
    && await run(`const i = new Image(); i.src = ${JSON.stringify(firstBackground)}; await i.decode(); return i.naturalWidth === 2560 && document.querySelector('.dock .monitor .stage-bg').style.background.includes(${JSON.stringify(firstBackground)})`));
  await click(`${sw}.querySelector('[aria-label="Fondo Negro"]')`);
  await sleep(500);
  bg = await styles();
  check('al elegir un color la imagen sigue guardada', bg.type === 'solid' && bg.saved.length === 1 && await run(`return ${sw}.querySelectorAll('.swatch-image').length === 1 && !${sw}.querySelector('.swatch-image.on') && ${sw}.querySelector('[aria-label="Fondo Negro"]').classList.contains('on') && [...document.querySelectorAll('.settings .btn')].find(b => b.textContent.includes('Eliminar esta imagen')).hidden`));
  await chooseFiles('.settings input[type=file]', [smallBackground]);
  check('se pueden guardar varias', await until(`${sw}.querySelectorAll('.swatch-image').length === 2`) && (await styles()).saved.length === 2);
  await click(`${sw}.querySelector('.swatch-image')`);
  await sleep(500);
  check('una imagen guardada se vuelve a poner con un toque', (await styles()).image === firstBackground && await run(`return ${sw}.querySelector('.swatch-image').classList.contains('on')`));
  await chrome.send('Page.navigate', { url: `${local}/control?fondos=${Date.now()}#ajustes` });
  await sleep(2500);
  check('las imágenes de fondo siguen ahí al volver a abrir el control', await run(`return ${sw}.querySelectorAll('.swatch-image').length === 2 && ${sw}.querySelector('.swatch-image').classList.contains('on')`));
  await click(`[...document.querySelectorAll('.settings .btn')].find(b => b.textContent.includes('Eliminar esta imagen'))`);
  await sleep(300);
  await modalButton('Eliminar');
  await sleep(700);
  bg = await styles();
  check('una imagen de fondo se puede eliminar, y la proyección vuelve al color', bg.type !== 'image' && bg.image === '' && bg.saved.length === 1 && !bg.saved.includes(firstBackground)
    && await run(`return ${sw}.querySelectorAll('.swatch-image').length === 1 && (await fetch(${JSON.stringify(firstBackground)})).status === 404`));

  console.log('\n1. Interfaz · Mandos en vivo (imagen de prueba)');
  await click(`[...document.querySelectorAll('.settings .btn')].find(b => b.textContent.includes('imagen de prueba'))`);
  await sleep(700);
  const dockControls = `document.querySelector('.dock .live-controls')`;
  const pressControl = async (label) => { await click(`[...${dockControls}.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(label)}))`); await sleep(500); };
  check('la imagen de prueba sale al aire y el panel muestra sus mandos', (await live()).kind === 'testcard' && (await text('.dock-ref')) === 'Imagen de prueba' && await run(`return !${dockControls}.hidden && ${dockControls}.querySelectorAll('button').length === 5`));
  await pressControl('Colores');
  check('un mando cambia lo que se ve', (await live()).pattern === 'barras' && await run(`return document.querySelector('.dock .tc').dataset.pattern === 'barras'`));
  // Una segunda pantalla (la de proyección) dentro de un marco: debe ir a la par con el panel.
  await run(`const f = document.createElement('iframe'); f.id = 'otra'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:320px;height:180px;z-index:99;border:0'; document.body.append(f);`);
  await sleep(2500);
  await pressControl('Cronómetro');
  await sleep(2200);
  const pair = JSON.parse(await run(`const other = document.querySelector('#otra').contentDocument; return JSON.stringify({ here: document.querySelector('.dock .tc-time').textContent, there: other.querySelector('.tc-time')?.textContent, pattern: other.querySelector('.tc')?.dataset.pattern, at: Date.now() })`));
  const { clock } = await live();
  const expected = clock.position + (pair.at - clock.at) / 1000;
  check('la otra pantalla recibe los mandos', pair.pattern === 'barras');
  check('el reloj va a la par en las dos pantallas', Math.abs(seconds(pair.here) - seconds(pair.there)) <= 0.2, `${pair.here} y ${pair.there}`);
  check('y coincide con el del servidor', clock.playing && Math.abs(seconds(pair.here) - expected) <= 0.4, `${pair.here} frente a ${expected.toFixed(1)} s`);
  await pressControl('Pausar');
  const paused = await text('.dock .tc-time');
  await sleep(700);
  check('en pausa el reloj se detiene', (await live()).clock.playing === false && (await text('.dock .tc-time')) === paused);
  await run(`document.querySelector('#otra').remove()`);
  const card = await run(`const r = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Prueba':'1'},body:JSON.stringify({type:'order.add',payload:{kind:'testcard',data:{}}})}); return (await r.json()).result.id`);
  await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(card)));
  await click(`document.querySelector('.rail-item[data-id=orden]')`);
  await sleep(900);
  check('los mandos aparecen también en el detalle del elemento al aire', await run(`const c = document.querySelector('.odetail .live-controls'); return Boolean(c) && !c.hidden && c.querySelectorAll('button').length === 5 && document.querySelector('.orow.live').textContent.includes('Imagen de prueba')`));
  await click(`document.querySelector('.rail-item[data-id=ajustes]')`);
  await sleep(400);
  await click(`document.querySelector('.rail-item[data-id=dispositivos]')`);
  await sleep(700);
  check('"Dispositivos" muestra un solo QR y el PIN', await run(`return document.querySelectorAll('.modal .qr').length === 1 && document.querySelector('.modal input').value.length >= 4`));
  await run(`document.querySelector('.modal input').value = '246810';`);
  await modalButton('Cambiar');
  await sleep(600);
  check('el PIN se cambia desde el equipo principal', (await text('#toast')).startsWith('PIN cambiado') && await run(`return (await (await fetch('/api/system/pin')).json()).pin === '246810'`));
  await click(`document.querySelector('.modal-header .icon-btn')`);
  check('sin errores de JavaScript', !chrome.events.some((e) => e.method === 'Runtime.exceptionThrown'));
  await chrome.send('Page.navigate', { url: `${local}/orden` });
  await sleep(2200);
  check('"Control del orden" no ofrece editar', await run(`return !document.querySelector('.ws-head .search') && !document.querySelector('.orow .grip') && !document.querySelector('.orow .icon-btn[aria-label=Opciones]')`));
  check('el servidor rechaza una edición desde esa función', (await run(`return await ${post('order.clear')}`)) === 403);
  check('esa función gobierna lo que está al aire, pero no instala programas', await run(`return !document.querySelector('.dock .live-controls').hidden`) && (await run(`return await ${post('projection.control', { pattern: 'blanco' })}`)) === 200 && (await live()).pattern === 'blanco' && (await run(`return await ${post('tools.install', { id: 'yt-dlp' })}`)) === 403);
  await click(`[...document.querySelectorAll('.orow')].find(r => r.textContent.includes('Salmos 23')).querySelector('.icon-btn')`);
  await sleep(600);
  check('pero sí puede proyectar', (await live()).ref === 'Salmos 23:1');

  if (!QUICK) {
    // ================= 2. Paso a la dirección con nombre =================
    console.log('\n2. Paso automático a la dirección con nombre');
    await chrome.send('Page.navigate', { url: `${byIp}/` });
    await sleep(4000);
    check('entra por la IP y termina en el nombre', (await chrome.evaluate('location.origin')) === byName, await chrome.evaluate('location.origin'));

    // ================= 3. Confirmación al salir =================
    console.log('\n3. Confirmación al salir del control');
    chrome.acceptDialogs = false;
    await chrome.send('Page.navigate', { url: `${local}/control#biblia` });
    await sleep(2500);
    for (const t of ['mousePressed', 'mouseReleased']) await chrome.send('Input.dispatchMouseEvent', { type: t, x: 700, y: 400, button: 'left', clickCount: 1 });
    await sleep(300);
    const asked = () => chrome.events.some((e) => e.method === 'Page.javascriptDialogOpening');
    harvest();
    chrome.events.length = 0;
    chrome.send('Page.navigate', { url: 'about:blank' });
    await sleep(1000);
    check('pide confirmación al salir tras haber hecho un clic', asked());
    await chrome.send('Page.handleJavaScriptDialog', { accept: false });
    await sleep(500);
    harvest();
    chrome.events.length = 0;
    await click(`document.querySelector('a.brand-mark')`);
    await sleep(1200);
    check('"cambiar de función" no pide confirmación', !asked() && (await chrome.evaluate('location.pathname')) === '/');

    // ================= 4. Cambio de IP =================
    console.log('\n4. Cambio de IP del equipo principal (IP vieja: 127.0.0.1, IP nueva: la de la red)');
    await stopServer(server);
    server = startServer('127.0.0.1');
    // Chrome nuevo: el anterior recordaría durante un minuto la dirección del paso 2.
    harvest();
    chrome.close();
    chrome = await startChrome();
    await instrument();
    await sleep(3000);
    await chrome.send('Page.navigate', { url: `${byName}/control#biblia` });
    await sleep(3000);
    await chrome.evaluate('window.__marca = true');
    const shown = await run(`return await ${post('projection.show', { kind: 'verses', data: { versionId: VERSION, ref: { book: 19, chapter: 23, verseStart: 1, verseEnd: 1 } } })}`);
    check('conectado por el nombre y proyectando', shown === 200 && await chrome.evaluate('!document.body.classList.contains("offline")'));

    await stopServer(server);
    server = startServer(ip);
    const t0 = Date.now();
    await sleep(4000);
    check('avisa de la desconexión', await chrome.evaluate('!document.querySelector(".offline-bar").hidden'));
    let seconds = null;
    for (let i = 0; i < 60 && seconds === null; i += 1) {
      await sleep(2500);
      if (await chrome.evaluate('!document.body.classList.contains("offline")')) seconds = Math.round((Date.now() - t0) / 1000);
    }
    check('reconecta sola por el mismo nombre', seconds !== null, seconds === null ? 'no en 150 s' : `${seconds} s`);
    check('sin recargar la página', await chrome.evaluate('window.__marca === true'));
    check('recupera lo que estaba en pantalla', /Salmos 23:1/.test(await text('.dock-ref')));
    check('acepta órdenes sin volver a pedir el PIN', (await run(`return await ${post('projection.mode', { mode: 'black' })}`)) === 200);
  }

  // ================= 5. Lo que cierra la sesión =================
  // Un Manna que "arrancó con el código de antes" (huella fingida): debe notarlo y decirlo.
  await stopServer(server);
  // De paso, sin ffmpeg: para ver cómo se comporta Medios en un equipo que no lo tiene.
  server = startServer(null, { MANNA_HUELLA: 'de-antes', MANNA_REVISAR_CODIGO_MS: '300', MANNA_FALTA: 'ffmpeg,yt-dlp,powerpoint' });
  await sleep(3000);
  await chrome.send('Page.navigate', { url: `${local}/control?fin=${Date.now()}#orden` });
  await sleep(2500);

  console.log('\n5. Orden del culto: secciones, quitar y vaciar');
  const ord = `document.querySelector('.ws[data-module=orden]')`;
  const orderRows = () => run(`return ${ord}.querySelectorAll('.orow').length`);
  await click(`[...${ord}.querySelectorAll('.ws-head .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(300);
  await menuItem('Imagen');
  await sleep(500);
  check('desde "Añadir" se llega a la biblioteca de imágenes', (await chrome.evaluate('document.title')) === 'Manna · Medios');
  await click(`document.querySelector('.rail-item[data-id=orden]')`);
  await sleep(400);
  await click(`[...${ord}.querySelectorAll('.ws-head .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(300);
  await menuItem('Sección');
  await sleep(300);
  await run(`document.querySelector('.modal input').value = 'Despedida';`);
  await modalButton('Guardar');
  await sleep(600);
  check('se añade una sección', await run(`return [...${ord}.querySelectorAll('.osection span')].some(s => s.textContent === 'Despedida')`));
  const before = await orderRows();
  await click(`${ord}.querySelector('.orow .icon-btn[aria-label=Opciones]')`);
  await sleep(300);
  await menuItem('Quitar del orden');
  await sleep(600);
  check('un elemento se quita del orden', before > 1 && (await orderRows()) === before - 1, `de ${before} a ${await orderRows()}`);
  await click(`${ord}.querySelector('.ws-head .icon-btn[aria-label="Más opciones"]')`);
  await sleep(300);
  await menuItem('Vaciar el orden');
  await sleep(300);
  await modalButton('Vaciar');
  await sleep(600);
  check('"Vaciar el orden" lo deja vacío tras confirmar', (await orderRows()) === 0 && await run(`return ${ord}.querySelector('.empty').textContent.includes('está vacío') && (await (await fetch('/api/state')).json()).order.items.length === 0`));

  if (HAS_FFMPEG) {
    console.log('\n5. Medios en un equipo sin ffmpeg');
    await click(`document.querySelector('.rail-item[data-id=medios]')`);
    await sleep(400);
    await click(`document.querySelector('.media-tabs [data-tab=videos]')`);
    await sleep(400);
    const vids = `document.querySelector('.media-body[data-panel=videos]')`;
    const notice = `document.querySelector('.ws-notice')`;
    check('el módulo avisa de que sin ffmpeg no podrá convertir', await run(`return !${notice}.hidden && ${notice}.textContent.includes('Falta ffmpeg') && ${notice}.textContent.includes('convertir')`));
    const before = await run(`return ${vids}.querySelectorAll('.media-card').length`);
    const dummy = path.join(tmp, 'grabacion antigua.avi');
    fs.writeFileSync(dummy, Buffer.alloc(4000, 3));
    await chooseFiles('.media-body[data-panel=videos] input[type=file]', [path.join(tmp, 'video_de-bienvenida.mp4'), dummy]);
    await sleep(500);
    await modalButton('Subir');
    check('lo habitual se sube y queda listo, con la imagen y la duración que saca el propio navegador', await until(`!${modal} && ${vids}.querySelectorAll('.media-card').length === ${before} + 2`, 60)
      && await until(`[...${vids}.querySelectorAll('.media-card[data-status=ready]')].some(c => c.querySelector('strong').textContent === 'video de bienvenida' && c.querySelector('.media-thumb img')?.naturalWidth > 0 && c.querySelector('.media-duration')?.textContent === '0:08')`, 20));
    const waiting = `${vids}.querySelector('.media-card[data-status=needs-ffmpeg]')`;
    check('lo que hay que convertir queda a la espera, y dice que hace falta ffmpeg y cómo instalarlo', await run(`const c = ${waiting}; return Boolean(c) && c.querySelector('strong').textContent === 'grabacion antigua' && c.querySelector('.media-status small').textContent.includes('ffmpeg') && [...c.querySelectorAll('.media-status .btn')].map(b => b.textContent).join('|') === 'Reintentar|Instalar ffmpeg'`));
    await click(`${waiting}.querySelector('.media-pick')`);
    await sleep(300);
    check('y no se puede proyectar mientras tanto', await run(`return document.querySelector('.media-bar[data-panel=videos] .btn.primary').disabled`));
    await click(`[...${waiting}.querySelectorAll('.media-status .btn')].find(b => b.textContent === 'Reintentar')`);
    await sleep(700);
    check('"Reintentar" lo vuelve a mirar (sin ffmpeg, sigue esperando)', await run(`return Boolean(${waiting})`));
  }

  console.log('\n5. Himnario en un equipo sin ffmpeg');
  await click(`document.querySelector('.rail-item[data-id=himnario]')`);
  check('sin ffmpeg el himnario avisa de que no habrá pista, y los himnos se proyectan cantados', await until(`document.querySelectorAll('.ws[data-module=himnario] .hymn').length === 13`, 20) && await (async () => {
    await click(`document.querySelector('.ws[data-module=himnario] .hymn[data-n="2"]')`);
    await sleep(400);
    return run(`const n = document.querySelector('.ws-notice'); const c = document.querySelector('.hymn-sound [data-track=instrumental]'); return !n.hidden && n.textContent.includes('Falta ffmpeg') && n.textContent.includes('pista instrumental') && c.disabled && c.title.includes('ffmpeg') && document.querySelector('.hymn-sound [data-track=vocal]').classList.contains('on')`);
  })());

  console.log('\n5. Diapositivas en un equipo sin PowerPoint');
  await click(`document.querySelector('.rail-item[data-id=diapositivas]')`);
  await sleep(500);
  const withoutPpt = path.join(tmp, 'sermon del sabado.pptx');
  fs.writeFileSync(withoutPpt, fakePresentation());
  await chooseFiles('.ws[data-module=diapositivas] input[type=file]', [withoutPpt]);
  await sleep(600);
  check('sin PowerPoint, al elegir uno se explica cómo guardarlo como PDF, sin subir nada', await run(`return ${modal}.querySelector('h2').textContent === 'Hace falta el PDF de la presentación' && ${modal}.textContent.includes('Exportar') && !${modal}.querySelector('input')`) && await run(`return document.querySelector('.ws-notice').hidden`));
  await modalButton('Entendido');
  check('y lo que ya estaba en la biblioteca sigue ahí tras reabrir Manna', await run(`return document.querySelectorAll('.ws[data-module=diapositivas] .deck[data-status=ready]').length === 1`));

  console.log('\n5. Actualización con Manna abierto, reinicio y apagado');
  const bar = `document.querySelector('.update-bar')`;
  check('si el programa se actualizó con Manna abierto, todas las pantallas de control lo avisan', await until(`!${bar}.hidden`) && await run(`return ${bar}.textContent.includes('Manna se actualizó mientras estaba abierto') && (await (await fetch('/api/state')).json()).system.stale === true`));
  await chrome.evaluate('window.__marca = true');
  await click(`[...${bar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Reiniciar ahora'))`);
  await sleep(300);
  await modalButton('Reiniciar ahora');
  // Manna se cierra y vuelve a abrirse solo; la página nota que el servidor es otro y se carga de nuevo.
  const back = await until(`window.__marca !== true && document.querySelector('.rail') && !document.body.classList.contains('offline')`, 60);
  const after = back ? JSON.parse(await run(`const s = (await (await fetch('/api/state')).json()).system; return JSON.stringify({ stale: s.stale, build: s.build })`)) : {};
  check('"Reiniciar ahora" lo vuelve a abrir con el código nuevo, y la página se recarga sola', back && after.stale === false && after.build !== 'de-antes' && await run(`return ${bar}.hidden`), JSON.stringify(after));
  await click(`document.querySelector('.rail-item[data-id=ajustes]')`);
  await sleep(500);
  check('Ajustes ofrece reiniciar y apagar', await run(`const b = [...document.querySelectorAll('.settings .btn')].map(x => x.textContent); return b.includes('Reiniciar Manna') && b.includes('Apagar Manna')`));
  await click(`[...document.querySelectorAll('.settings .btn')].find(b => b.textContent === 'Apagar Manna')`);
  await sleep(300);
  await modalButton('Apagar Manna');
  await sleep(1500);
  const gone = await fetch(`http://127.0.0.1:${PORT}/api/ping`, { signal: AbortSignal.timeout(800) }).then(() => false, () => true);
  check('"Apagar Manna" lo apaga y lo dice', gone && await run(`return document.querySelector('.goodbye h1')?.textContent === 'Manna está apagado'`));

  // ================= Lo vigilado durante toda la prueba =================
  console.log('\nVigilancia de toda la prueba');
  harvest();
  const surprise = watched.errors.filter((text) => !expectedErrors.some((fragment) => text.includes(fragment)));
  check('ningún botón respondió con un aviso de error que no se esperaba', surprise.length === 0, surprise.join(' | '));
  check('sin errores de JavaScript en ninguna pantalla', watched.exceptions.length === 0, watched.exceptions.join(' | ').slice(0, 300));
  // Todo lo que el servidor ofrece tiene que haberse usado desde la interfaz, pulsando. Lo que no
  // se puede pulsar en esta prueba se declara aquí, con su motivo: así no queda nada sin mirar.
  const offered = checkContract(sourceFiles(path.join(ROOT, 'web')), sourceFiles(path.join(ROOT, 'server')), { root: ROOT });
  const idle = [...offered.actions].filter((name) => !watched.actions.has(name) && !UNTOUCHED[name]).sort();
  const quiet = offered.endpoints.filter(({ method, path: route }) => route.startsWith('/api/') && !UNTOUCHED[`${method} ${route}`]
    && ![...watched.requests].some((used) => used.startsWith(`${method} `) && offered.matches(route, used.slice(method.length + 1)))).map((e) => `${e.method} ${e.path}`).sort();
  const stale = Object.keys(UNTOUCHED).filter((name) => (name.includes(' ') ? !offered.endpoints.some((e) => `${e.method} ${e.path}` === name) : !offered.actions.has(name)));
  if (QUICK) console.log(`  (modo rápido: quedan para la prueba completa ${[...idle, ...quiet].join(', ') || 'ninguna'})`);
  else {
    check('la interfaz usó, pulsando, todas las órdenes del servidor', idle.length === 0, idle.join(', '));
    check('y todas sus direcciones', quiet.length === 0, quiet.join(', '));
  }
  check('la lista de lo que no se puede pulsar aquí está al día', stale.length === 0, stale.join(', '));
} finally {
  chrome.close();
  await stopServer(server);
  await shutdownByPort();
  await fakeTv.stop();
  await sleep(800);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}

console.log(failed ? `\n${failed} comprobación(es) fallaron.` : '\nTodo correcto.');
process.exit(failed ? 1 : 0);
