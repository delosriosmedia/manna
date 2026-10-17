// Pruebas de extremo a extremo en un Chrome real (sin ventana). Cubren lo que no alcanzan
// las pruebas automáticas ni un navegador integrado:
//
//   0. La revisión del equipo: avisa de los programas que faltan y de qué módulos afecta, instala
//      uno mostrando el avance y no bloquea la app; dentro, el módulo afectado también avisa.
//      La descarga sale de un servidor de mentira en este mismo equipo.
//   1. La interfaz: Biblia (búsqueda por niveles, comparar versiones, «Varios»), orden del culto (con
//      nombres propios), himnario (uno inventado: buscar por número, título y letra, cantado y pista), medios (subir imágenes, ajuste, encuadre al aire en dos pantallas; videos
//      y audios que van a la par; categorías, con el ratón y el dedo; YouTube, con un yt-dlp de mentira), televisores (con uno de
//      mentira), diapositivas (un PDF de verdad, convertido por el propio Chrome, y un PowerPoint
//      con un PowerPoint de mentira), el Presentador (pasar diapositivas, señalar con el dedo, acercar y mover, páginas web; también en 375 px), Páginas web (direcciones que se dejan mostrar y que no, y un archivo HTML encerrado que recibe las flechas desde los mandos al aire), mandos en vivo que van a la par en dos pantallas, ajustes
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
// Corre en tres grupos a la vez, cada uno con su servidor, su nombre en la red y su Chrome (GROUPS, abajo):
// «control» (Biblia, orden, escenario, ajustes, PIN, escuchar y salir), «biblioteca» (imágenes, videos y audios,
// diapositivas, presentador, páginas web y el paso 5) y «red» (pasos 0 y 4, YouTube e himnario). Al final se
// junta lo vigilado.
//
// Uso:  node scripts/probar-chrome.mjs                 los tres grupos (menos de 3 minutos)
//       node scripts/probar-chrome.mjs biblioteca      solo los grupos nombrados
//       node scripts/probar-chrome.mjs rapido          sin los pasos 2 a 4
// Necesita Node 22 o superior (WebSocket integrado) y Chrome o Edge. No toca los datos reales:
// usa los puertos 8123, 8125, 8131 y 8133, los nombres "manna-prueba…local" y carpetas temporales de
// datos y de biblias (la Reina-Valera 1909 del repositorio y una versión de prueba de dos versículos).
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
import { writeFakeCloudflared } from './lib/cloudflared-falso.mjs';
import { fakePresentation, writeFakePowerPoint } from './lib/powerpoint-falso.mjs';
import { makePdf } from './lib/pdf.mjs';
import { HYMN_FACTS, hymnTitle, seedHymnal } from './lib/himnario-falso.mjs';
import { examplePoster } from './lib/png.mjs';
import { checkContract, sourceFiles } from './lib/codigo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('rapido');
// Los grupos, con su puerto (separados de dos en dos: si uno está ocupado, el servidor prueba el siguiente; la
// auditoría de pantallas usa 8124, 8126 y 8128). Cada grupo es este mismo guion con MANNA_PRUEBA_GRUPO.
const GROUPS = {
  control: { port: 8123, label: 'Biblia, orden, escenario, ajustes, PIN, escuchar y salir' },
  biblioteca: { port: 8131, label: 'Imágenes, videos, diapositivas, presentador, páginas web y cierre' },
  red: { port: 8133, label: 'Revisión del equipo, YouTube, himnario y cambio de IP' },
};
const GROUP = process.env.MANNA_PRUEBA_GRUPO || null;
const inGroup = (name) => GROUP === name;
if (!GROUP) await runGroups();
const PORT = GROUPS[GROUP].port;
const NAME = GROUP === 'control' ? 'manna-prueba' : `manna-prueba-${GROUP}`;

// Lanza los grupos pedidos (todos si no se nombra ninguno), enseña lo de cada uno al terminar y junta lo vigilado:
// cada orden y dirección del servidor tuvo que usarla, pulsando, algún grupo.
async function runGroups() {
  const asked = Object.keys(GROUPS).filter((name) => process.argv.includes(name));
  const names = asked.length ? asked : Object.keys(GROUPS);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-grupos-'));
  const t0 = Date.now();
  let bad = 0;
  await Promise.all(names.map((name) => new Promise((resolve) => {
    const out = [];
    const child = killOnExit(spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MANNA_PRUEBA_GRUPO: name, MANNA_PRUEBA_VIGILANCIA: path.join(dir, `${name}.json`) },
    }));
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => out.push(d));
    child.on('exit', (code) => {
      if (code !== 0) bad += 1;
      console.log(`\n===== Grupo «${name}»: ${GROUPS[name].label} (${Math.round((Date.now() - t0) / 1000)} s) =====`);
      process.stdout.write(Buffer.concat(out).toString());
      resolve();
    });
  })));
  if (names.length === Object.keys(GROUPS).length && !QUICK) {
    console.log('\nVigilancia de todos los grupos');
    const reports = names.map((name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')); } catch { return null; } });
    if (reports.includes(null)) {
      bad += 1;
      console.log('✖ algún grupo terminó sin dejar lo que vigiló');
    } else {
      // Queda sin usar lo que no usó ningún grupo.
      const unused = (key) => reports.map((r) => r[key]).reduce((a, b) => a.filter((x) => b.includes(x)));
      for (const [key, label] of [['idle', 'la interfaz usó, pulsando, todas las órdenes del servidor'], ['quiet', 'y todas sus direcciones']]) {
        const left = unused(key);
        if (left.length) bad += 1;
        console.log(`${left.length ? '✖' : '✔'} ${label}${left.length ? ` (${left.join(', ')})` : ''}`);
      }
    }
  } else console.log('\n(Con solo algunos grupos, o en modo rápido, no se comprueba que se pulsaran todas las órdenes.)');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(bad ? `\n${bad} grupo(s) o comprobación(es) con fallos.` : '\nTodo correcto.');
  process.exit(bad ? 1 : 0);
}
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
for (const port of [PORT, ...(inGroup('red') ? [8125] : [])]) {
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
  for (const name of ['media.retry', 'media.subtitlesRemove', 'media.categoryAdd', 'media.categoryRename', 'media.categoryRemove', 'media.categoryMove', 'POST /api/media/clips', 'POST /api/media/clips/:id/thumb', 'POST /api/media/clips/:id/subtitles']) {
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

// La conexión por internet, igual: un cloudflared de mentira (un guion que escribe lo mismo que el de
// verdad) en la carpeta de programas del servidor de prueba. Nunca se abre un túnel de verdad.
const CAN_TUNNEL = process.platform !== 'win32';
const tunnelAsked = path.join(tmp, 'cloudflared-pedido.json');
if (CAN_TUNNEL) writeFakeCloudflared(path.join(tmp, 'data', 'herramientas'), { log: tunnelAsked });
else for (const name of ['internet.set', 'internet.own']) UNTOUCHED[name] = 'el cloudflared de mentira es un guion y este sistema no los ejecuta; se prueba en test/internet.test.js';

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
  const env = { ...process.env, MANNA_NAME: NAME, MANNA_NO_OPEN: '1', MANNA_SIN_VENTANA: '1', MANNA_CONVERSION_LENTA: '6000', MANNA_FALTA: 'yt-dlp,cloudflared', MANNA_POWERPOINT_PRUEBA: fakePpt, MANNA_HIMNARIO: hymnal.dir, MANNA_DATA: path.join(tmp, 'data'), MANNA_BIBLIAS: bibles, PORT: String(PORT), MANNA_TV_PRUEBA: JSON.stringify({ ...fakeTv.endpoints, found: ['192.168.1.50'] }), MANNA_TUNEL_PRUEBA: `http://127.0.0.1:${PORT}`, MANNA_TUNEL_COMPROBAR_MS: '300', ...extra };
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
// Un clic de ratón de verdad (varios seguidos hacen un doble clic) en el centro de un elemento: prueba también que nada lo tapa.
const clickAt = async (x, y, clicks = 1) => {
  for (let n = 1; n <= clicks; n += 1) for (const t of ['mousePressed', 'mouseReleased']) await chrome.send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', buttons: t === 'mouseReleased' ? 0 : 1, clickCount: n });
  await sleep(450);
};
// Arrastrar con el ratón de verdad, de (x1, y1) a (x2, y2), en cinco pasos.
const dragMouse = async (x1, y1, x2, y2) => {
  await chrome.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 5; i += 1) await chrome.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + ((x2 - x1) * i) / 5, y: y1 + ((y2 - y1) * i) / 5, button: 'left', buttons: 1 });
  await chrome.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(400);
};
// El centro de un elemento (llevándolo antes a la vista).
const centerOf = async (js) => JSON.parse(await run(`const e = ${js}; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })`));
// Arrastrar con el dedo de verdad: tocar, mantener (Medios espera 350 ms antes de empezar a arrastrar) y mover.
const dragTouch = async (x1, y1, x2, y2, hold = 450) => {
  const touch = (type, x, y) => chrome.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', x1, y1);
  await sleep(hold);
  for (let i = 1; i <= 6; i += 1) { await touch('touchMove', x1 + ((x2 - x1) * i) / 6, y1 + ((y2 - y1) * i) / 6); await sleep(40); }
  await touch('touchEnd');
  await sleep(500);
};
// Lo de Medios: los grupos que se ven («Imágenes 2»), las categorías y el aviso de cuando no hay nada que mostrar.
const groupsNow = () => run(`return JSON.stringify([...document.querySelectorAll('.ws[data-module=medios] .media-group')].filter((g) => !g.hidden).map((g) => g.querySelector('h2').textContent + ' ' + g.querySelector('.media-group-head small').textContent))`).then(JSON.parse);
const mediaCats = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).media.categories)`).then(JSON.parse);
const dragCard = async (fromJs, toJs) => { const a = await centerOf(fromJs); const b = await centerOf(toJs); await dragMouse(a.x, a.y, b.x, b.y); };
const drawerBox = () => run(`const r = document.querySelector('.drawer').getBoundingClientRect(); return JSON.stringify({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width })`).then(JSON.parse);
const gripAt = () => run(`const r = document.querySelector('.drawer-grip').getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })`).then(JSON.parse);
const tapEl = async (js, clicks = 1) => {
  const c = JSON.parse(await run(`const e = ${js}; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })`));
  await clickAt(c.x, c.y, clicks);
};
// Abre un módulo en el cajón. Pulsar el icono del que ya está abierto lo cierra: solo se pulsa si no está.
const goTo = (id) => run(`const b = document.querySelector('.dock-item[data-id=${id}]'); if (!b.classList.contains('on')) b.click();`);
// Las presentaciones son un grupo de Medios (fase 22): se abre Medios y se lleva el grupo a la vista.
const openSlides = async () => { await goTo('medios'); await sleep(500); await run(`document.querySelector('.media-group[data-group=diapositivas]')?.scrollIntoView()`); await sleep(200); };
// El único campo de archivos de Medios (hijo directo de su pantalla): acepta imágenes, videos, audios, PDF y PowerPoint.
const MEDIA_FILES = '.ws[data-module=medios] > input[type=file]';
// Los mandos del tipo al aire: en el escritorio, siempre a la vista en la barra de abajo (fase 14); en el celular, en
// una capa que se abre con el botón de la tarjeta de lo al aire. LIVE es el que se ve.
const LIVE = `([...document.querySelectorAll('.tb-extra .live-controls, .controls-pop .live-controls')].find((c) => c.getClientRects().length) || document.querySelector('.tb-extra .live-controls'))`;
const openControls = async () => { await run(`if (!document.querySelector('.tb-extra .live-controls')?.getClientRects().length && document.querySelector('.controls-layer').hidden) document.querySelector('.story-controls').click();`); await sleep(250); };
const closeControls = async () => { await run(`document.querySelector('.controls-layer').hidden = true`); };
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
    PORT: '8125', MANNA_NAME: 'manna-revision', MANNA_DATA: path.join(tmp, 'revision'), MANNA_FALTA: 'yt-dlp,navegador,cloudflared',
    // cloudflared «se descarga» del mismo sitio, pero su lista de huellas no lo nombra: «Instalar» se pulsa sin salir a internet y falla.
    MANNA_DESCARGAS: JSON.stringify({ 'yt-dlp': { url: `${from}/yt-dlp-prueba`, sums: `${from}/SUMAS`, file: 'yt-dlp', size: '60 KB' }, cloudflared: { url: `${from}/cloudflared-prueba`, sums: `${from}/SUMAS`, file: 'cloudflared', size: '60 KB' } }),
  });
  try {
    await sleep(3000);
    await chrome.send('Page.navigate', { url: 'http://localhost:8125/requisitos' });
    await sleep(2000);
    const card = `document.querySelector('.req[data-id="yt-dlp"]')`;
    const mod = (id) => `document.querySelector('#modules .mod[data-id=${id}]')`;
    check('la revisión lista los seis programas y marca los que faltan', await run(`return document.querySelectorAll('.req').length === 6 && ${card}.classList.contains('missing') && document.querySelector('.req[data-id=navegador]').classList.contains('missing') && document.querySelector('.req[data-id=cloudflared]').classList.contains('missing') && !document.querySelector('.req[data-id=node]').classList.contains('missing')`));
    check('explica para qué sirve y cómo instalarlo a mano', await run(`return ${card}.textContent.includes('YouTube') && Boolean(${card}.querySelector('details code'))`));
    check('dice qué módulos funcionarán completos y cuáles no', await run(`return ${mod('biblia')}.textContent.includes('Completo') && !${mod('biblia')}.classList.contains('limited') && ${mod('medios')}.classList.contains('limited') && ${mod('medios')}.textContent.includes('YouTube: falta yt-dlp') && !${mod('videos')} && ${mod('ajustes')}.textContent.includes('falta Google Chrome')`));
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
    check('de ahí se pasa al control, aunque siga faltando el navegador', (await chrome.evaluate('location.pathname')) === '/control' && await run(`return document.body.classList.contains('app')`));
    const notice = `document.querySelector('.ws-notice')`;
    const goModule = async (id) => { await goTo(id); await sleep(500); };
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
    check('Ajustes ofrece actualizar yt-dlp e instalar lo que falta y Manna sabe instalar', await run(`return [...document.querySelectorAll('.settings .tool .btn')].map(b => b.closest('.tool').dataset.id + ':' + b.textContent).join() === 'yt-dlp:Actualizar,cloudflared:Instalar' && ${toolRow}.textContent.includes('2026.01.01')`), await run(`return [...document.querySelectorAll('.settings .tool .btn')].map(b => b.closest('.tool').dataset.id + ':' + b.textContent).join()`));
    await click(`${toolRow}.querySelector('.btn')`);
    await sleep(900);
    check('"Actualizar" lo descarga de nuevo, a la vista y sin detener la app', await run(`const b = ${toolRow}.querySelector('.btn'); return b.disabled && b.textContent === 'Actualizando…' && [...document.querySelectorAll('.queue .scene-jobs .job strong')].some(s => s.textContent === 'Descargando yt-dlp')`) && (await text('#toast')).includes('Actualizando yt-dlp'));
    check('y queda la versión nueva', await until(`${toolRow}.textContent.includes('2026.02.02') && !${toolRow}.querySelector('.btn').disabled`, 40), await run(`return ${toolRow}.textContent`));
    expectError('falta su huella');
    await click(`document.querySelector('.settings .tool[data-id="cloudflared"] .btn')`);
    check('«Instalar» de Ajustes pone a descargar lo que falta, y dice si no se pudo', await until(`[...document.querySelectorAll('.queue .scene-jobs .job')].some(j => j.textContent.includes('Descargando cloudflared') && j.textContent.includes('falta su huella'))`, 25), await run(`return [...document.querySelectorAll('.queue .scene-jobs .job')].map(j => j.textContent).join(' | ')`));
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
  if (inGroup('red') && process.platform !== 'win32') await reviewSection();

  // ================= 1. La interfaz =================
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await chrome.send('Page.navigate', { url: `${local}/control#biblia` });
  await sleep(2500);
  const modal = `document.querySelector('.modal')`;
  // Lo que está al aire y el orden, según el servidor (lo usan varios grupos).
  const shown = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items })`).then(JSON.parse);

  // ---- Grupo «control» (1): Biblia, orden y escenario ----
  if (inGroup('control')) {
  console.log('\n1. Interfaz · Biblia');
  await type('.ws[data-module=biblia] .search input', 'jn 3 16-17');
  await sleep(900);
  check('la búsqueda por cita lleva al pasaje', (await text('.sel-ref')) === 'Juan 3:16-17');
  await press('Enter');
  check('Enter proyecta la selección', (await live()).ref === 'Juan 3:16-17');
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('la versión se ve junto al logo', (await text('.role-version')) === `Manna ${version}` && await run(`return document.querySelector('.topbar .brand-mark img').naturalWidth > 0`), `Manna ${version}`);
  check('la barra de arriba marca «AL AIRE» y la proyección de fondo lo muestra', await run(`const p = document.querySelector('.scene-status .live-pill'); return p.textContent === '● AL AIRE' && p.dataset.state === 'live' && document.querySelector('.scene-bg').dataset.state === 'live' && document.querySelector('.scene-bg > .stage').dataset.mode === 'live'`));
  check('en el control del equipo principal, junto al estado «Al aire» está el botón del proyector (sin segunda pantalla, apagado)', await run(`const b = document.querySelector('.scene-status > .btn'); return Boolean(b) && b.disabled && b.textContent === 'Sin pantalla' && b.getAttribute('aria-label') === 'Sin segunda pantalla' && !document.querySelector('.scene-status .status')`));
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
  await goTo('orden');
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

  console.log('\n1. Interfaz · Escenario (escritorio)');
  const queueRow = (title) => `[...document.querySelectorAll('.queue-item')].find(r => r.querySelector('strong').textContent.includes(${JSON.stringify(title)}))`;
  const drawerOpen = () => run(`return !document.querySelector('.drawer').hidden && document.body.classList.contains('drawer-open')`);
  const dockOn = () => run(`return JSON.stringify([...document.querySelectorAll('.dock-item.on')].map(b => b.dataset.id))`).then(JSON.parse);
  const queueDetail = () => run(`return JSON.stringify({ rows: [...document.querySelectorAll('.queue-item')].map(r => r.className + ':' + r.querySelector('strong').textContent), sections: document.querySelectorAll('.queue-section').length, pos: document.querySelector('.queue-head small').textContent })`);
  check('la cola del culto lista el orden, marca lo que está al aire y dice en qué lugar va', await run(`return document.querySelectorAll('.queue-item').length === 2 && document.querySelector('.queue-item.live').textContent.includes('Juan 3:19') && document.querySelectorAll('.queue-section').length === 2 && document.querySelector('.queue-head small').textContent === '1 de 2'`), await queueDetail());
  check('sin nada con mandos al aire, la barra de abajo no muestra la fila de mandos', await run(`return document.querySelector('.tb-extra').hidden`));
  // Como en un reproductor de video: sin mover el ratón ni pulsar teclas, la barra se aparta; un movimiento la trae.
  const barShown = () => run(`return !document.body.classList.contains('bar-idle') && getComputedStyle(document.querySelector('.transport-bar')).opacity === '1'`);
  await chrome.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 300 });
  await sleep(3200);
  check('la barra de abajo se aparta sola tras unos segundos sin usar el ratón', await run(`return document.body.classList.contains('bar-idle') && getComputedStyle(document.querySelector('.transport-bar')).opacity === '0'`));
  await chrome.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720, y: 320 });
  await sleep(500);
  check('y vuelve al mover el ratón', await barShown());
  await sleep(2800);
  // Mayús: una tecla que no hace nada más.
  for (const type of ['keyDown', 'keyUp']) await chrome.send('Input.dispatchKeyEvent', { type, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await sleep(500);
  check('o al pulsar una tecla', await barShown());
  check('con un módulo abierto, su icono está marcado y el cajón trae su título y su pantalla', await drawerOpen() && (await dockOn()).join() === 'orden' && await run(`return document.querySelector('.dock-item[data-id=orden]').getAttribute('aria-pressed') === 'true' && document.querySelector('.drawer-head h2').textContent === 'Orden' && Boolean(document.querySelector('.drawer .work .ws[data-module=orden]:not([hidden])'))`));
  await tapEl(`document.querySelector('.dock-item[data-id=orden]')`);
  check('pulsar otra vez el icono del módulo abierto cierra el cajón', !await drawerOpen() && (await dockOn()).length === 0);
  await tapEl(`document.querySelector('.dock-item[data-id=biblia]')`);
  check('pulsar el icono de otro módulo lo abre en el cajón, y el anterior queda oculto', await drawerOpen() && (await dockOn()).join() === 'biblia' && await run(`return !document.querySelector('.drawer .work .ws[data-module=biblia]').hidden && document.querySelector('.drawer .work .ws[data-module=orden]').hidden`));
  await run(`document.activeElement?.blur()`);
  await press('Escape');
  check('Esc cierra el cajón', !await drawerOpen() && (await dockOn()).length === 0 && await run(`return document.querySelector('.prep').hidden`));
  await tapEl(`document.querySelector('.dock-item[data-id=orden]')`);
  const wideAt = () => run(`const b = document.querySelector('.drawer-wide'); return JSON.stringify({ wide: document.querySelector('.drawer').classList.contains('wide'), label: b.getAttribute('aria-label') })`).then(JSON.parse);
  const wide0 = await wideAt();
  await tapEl(`document.querySelector('.drawer-wide')`);
  const wide1 = await wideAt();
  await tapEl(`document.querySelector('.drawer-wide')`);
  const wide2 = await wideAt();
  check('el botón de ampliar alterna el cajón ancho y estrecho, y cambia su nombre', wide1.wide === !wide0.wide && wide2.wide === wide0.wide && wide1.label !== wide0.label && wide2.label === wide0.label, JSON.stringify([wide0, wide1, wide2]));
  // El cajón estrecho se ensancha arrastrando su borde derecho, sin moverse y sin tapar la cola, y se recuerda.
  if ((await wideAt()).wide) await tapEl(`document.querySelector('.drawer-wide')`);
  const narrow0 = await drawerBox();
  let g = await gripAt();
  await dragMouse(g.x, g.y, g.x + 200, g.y);
  const narrow1 = await drawerBox();
  check('arrastrar el borde derecho del cajón estrecho lo ensancha, sin moverlo, y lo recuerda', Math.abs(narrow1.width - narrow0.width - 200) < 8 && narrow1.left === narrow0.left
    && Math.abs(Number(await run(`return localStorage.getItem('manna.cajon.medida')`)) - narrow1.width) < 2, JSON.stringify([narrow0.width, narrow1.width]));
  g = await gripAt();
  await dragMouse(g.x, g.y, g.x + 2000, g.y);
  const queueLeft = await run(`return document.querySelector('.queue').getBoundingClientRect().left`);
  check('por mucho que se arrastre, no tapa la cola', (await drawerBox()).right <= queueLeft, `${(await drawerBox()).right} / ${queueLeft}`);
  g = await gripAt();
  await dragMouse(g.x, g.y, 0, g.y);
  check('ni se hace más estrecho que 360 px', Math.round((await drawerBox()).width) === 360);
  await run(`localStorage.removeItem('manna.cajon.medida'); document.querySelector('.drawer').style.removeProperty('--drawer-w')`);
  // Tocar el fondo (la proyección) cierra el cajón también en el escritorio.
  const bgAt = await run(`for (let y = 120; y < innerHeight - 140; y += 10) for (let x = innerWidth / 2; x < innerWidth - 400; x += 10) { const e = document.elementFromPoint(x, y); if (e && e.closest('.scene-bg')) return JSON.stringify({ x, y }); } return 'null'`).then(JSON.parse);
  if (bgAt) await clickAt(bgAt.x, bgAt.y);
  check('tocar el fondo, fuera del cajón, lo cierra', Boolean(bgAt) && !await drawerOpen(), JSON.stringify(bgAt));
  // Lo que sigue empieza con el Orden abierto en el cajón ancho, como estaba (su icono lo cierra), y sin nada con el foco.
  await goTo('orden');
  await sleep(300);
  if (!(await wideAt()).wide) await tapEl(`document.querySelector('.drawer-wide')`);
  await run(`document.activeElement?.blur()`);
  await tapEl(`document.querySelector('.dock-item[data-id=orden]')`);
  await tapEl(`document.querySelector('.queue-head')`);
  check('la cabecera de la cola la pliega: sin filas a la vista, y lo recuerda en su estado', await run(`const q = document.querySelector('.queue'); return q.classList.contains('closed') && document.querySelector('.queue-head').getAttribute('aria-expanded') === 'false' && document.body.classList.contains('queue-closed') && document.querySelector('.queue-list').getClientRects().length === 0`));
  await tapEl(`document.querySelector('.queue-head')`);
  check('y otro clic la despliega', await run(`const q = document.querySelector('.queue'); return !q.classList.contains('closed') && document.querySelector('.queue-head').getAttribute('aria-expanded') === 'true' && document.querySelectorAll('.queue-item').length === 2 && document.querySelector('.queue-list').getClientRects().length > 0`));
  await tapEl(queueRow('Salmos 23'));
  check('un clic en una fila de la cola la deja en «Preparado» sin proyectarla', await run(`const p = document.querySelector('.prep'); return !p.hidden && p.querySelector('.prep-label').textContent === 'PREPARADO' && p.querySelector('.prep-text .item-text strong').textContent.includes('Salmos 23') && ${queueRow('Salmos 23')}.classList.contains('prepared') && Boolean(p.querySelector('.prep-actions .btn.primary'))`) && (await live()).ref === 'Juan 3:19');
  await press('Enter');
  check('Intro proyecta lo preparado, y la tarjeta se va', (await live()).ref === 'Salmos 23:1' && await run(`return document.querySelector('.prep').hidden && ${queueRow('Salmos 23')}.classList.contains('live') && document.querySelector('.queue-head small').textContent === '2 de 2'`));
  const cells = () => run(`return JSON.stringify([...document.querySelectorAll('.queue-steps .step-cell')].map(c => c.className.replace('step-cell', '').trim() + c.textContent))`).then(JSON.parse);
  check('con un elemento de varios pasos al aire, la cola muestra sus pasos y marca el actual', JSON.stringify(await cells()) === JSON.stringify(['on1', '2', '3']), JSON.stringify(await cells()));
  await tapEl(`document.querySelector('.step-cell[aria-label="Paso 3"]')`);
  check('un paso de la cola lleva a ese paso', (await live()).ref === 'Salmos 23:3' && JSON.stringify(await cells()) === JSON.stringify(['done1', 'done2', 'on3']), JSON.stringify(await cells()));
  await tapEl(queueRow('Juan 3:19'), 2);
  check('doble clic en otra fila la proyecta', (await live()).ref === 'Juan 3:19' && await run(`return ${queueRow('Juan 3:19')}.classList.contains('live') && document.querySelectorAll('.queue-steps .step-cell').length === 0`));
  const nextHint = await text('.up-next strong');
  await tapEl(`document.querySelector('.transport-bar .btn.next')`);
  check('«Siguiente» pasa al elemento que decía «Sigue»', nextHint.includes('Salmos 23') && (await live()).ref === 'Salmos 23:1', nextHint);
  await tapEl(`document.querySelector('.transport-bar .btn[aria-label=Anterior]')`);
  check('«Anterior» vuelve', (await live()).ref === 'Juan 3:19');
  const pill = () => run(`const p = document.querySelector('.scene-status .live-pill'); return JSON.stringify([p.textContent, p.dataset.state, document.querySelector('.scene-bg').dataset.state])`).then(JSON.parse);
  // «Solo fondo» y «Negro» van arriba, junto a «AL AIRE» (fase 14).
  const transportBtn = (label) => `[...document.querySelectorAll('.scene-modes .mode-chip')].find(b => b.textContent.startsWith(${JSON.stringify(label)}))`;
  await tapEl(transportBtn('Negro'));
  check('«Negro» pone la pantalla en negro, y la barra de arriba y el fondo lo dicen', (await live()).mode === 'black' && JSON.stringify(await pill()) === JSON.stringify(['NEGRO', 'black', 'black']) && await run(`return ${transportBtn('Negro')}.classList.contains('on')`));
  await tapEl(transportBtn('Negro'));
  check('y otro toque vuelve al contenido', (await live()).mode === 'live' && JSON.stringify(await pill()) === JSON.stringify(['● AL AIRE', 'live', 'live']));
  await tapEl(transportBtn('Solo fondo'));
  check('«Solo fondo» deja solo el fondo', (await live()).mode === 'clear' && JSON.stringify(await pill()) === JSON.stringify(['SOLO FONDO', 'clear', 'clear']) && await run(`return ${transportBtn('Solo fondo')}.classList.contains('on')`));
  await tapEl(transportBtn('Solo fondo'));
  check('y otro toque lo devuelve', (await live()).mode === 'live');

  console.log('\n1. Interfaz · Escenario (celular, 375 px)');
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await sleep(700);
  check('en el celular lo al aire va en «Historias»: recuadro con la proyección, tres modos y lo que sigue; sin cola ni barra de transporte', await run(`const shown = (s) => document.querySelector(s).getClientRects().length > 0; return shown('.story-frame > .stage') && !document.querySelector('.scene-bg > .stage') && shown('.story-caption .live-pill') && document.querySelectorAll('.story-modes .seg-btn').length === 3 && document.querySelectorAll('.story-next-list .story-card').length >= 1 && !shown('.queue') && !shown('.transport-bar')`));
  await goTo('orden');
  await sleep(600);
  const backdropAt = () => run(`const b = document.querySelector('.drawer-backdrop'); if (b.hidden) return 'null'; for (let y = 6; y < innerHeight; y += 8) for (let x = 6; x < innerWidth; x += 20) if (document.elementFromPoint(x, y) === b) return JSON.stringify({ x, y }); return 'null'`).then(JSON.parse);
  const outside = await backdropAt();
  check('con un cajón abierto, el fondo de atrás está a la vista para tocarlo', Boolean(outside) && await drawerOpen());
  if (outside) await clickAt(outside.x, outside.y);
  check('tocar fuera del cajón lo cierra', !await drawerOpen() && await run(`return document.querySelector('.drawer-backdrop').hidden`));
  // De partida el cajón se abre reducido, con solo lo esencial: en la Biblia, la versión y el buscador en una fila, la
  // cita, los versículos y abajo «Añadir» (el icono) y «Proyectar». Se agranda arrastrando su borde de arriba.
  await goTo('biblia');
  await sleep(700);
  check('en el celular el cajón se abre reducido y la Biblia enseña solo lo esencial', await run(`const d = document.querySelector('.drawer'); const ws = d.querySelector('.ws[data-module=biblia]'); const head = ws.querySelector('.ws-head'); const sel = head.querySelector('.select').getBoundingClientRect(); const search = head.querySelector('.search').getBoundingClientRect(); const seen = (e) => Boolean(e) && e.getClientRects().length > 0;
    return d.classList.contains('compact') && !d.classList.contains('wide') && d.querySelector('.drawer-head h2').textContent === 'Biblia' && Math.abs(sel.top - search.top) < 4 && ![...head.querySelectorAll(':scope > .btn')].some(seen) && seen(ws.querySelector('.abar .btn.primary')) && !seen(ws.querySelector('.abar .sel-ref')) && ws.querySelector('.col-verses').getBoundingClientRect().height > 150`));
  const short0 = await drawerBox();
  g = await gripAt();
  await dragMouse(g.x, g.y, g.x, g.y - 120);
  const short1 = await drawerBox();
  check('arrastrar el borde de arriba lo agranda (sin moverse de abajo) y lo recuerda', Math.abs(short0.top - short1.top - 120) < 8 && short1.bottom === short0.bottom && Number(await run(`return localStorage.getItem('manna.cajon.alto')`)) > 0, JSON.stringify([short0.top, short1.top]));
  g = await gripAt();
  await dragMouse(g.x, g.y, g.x, 0);
  check('y no tapa la barra de arriba', (await drawerBox()).top >= await run(`return document.querySelector('.topbar').getBoundingClientRect().bottom`));
  await run(`localStorage.removeItem('manna.cajon.alto'); document.querySelector('.drawer').style.removeProperty('--drawer-top')`);
  await goTo('ajustes');
  await sleep(500);
  check('Ajustes se abre siempre completo, sin el botón de reducir', await run(`const d = document.querySelector('.drawer'); return d.classList.contains('wide') && !d.classList.contains('compact') && document.querySelector('.drawer-wide').hidden`));
  await goTo('biblia');
  await sleep(300);
  check('y al volver a otro módulo, el cajón vuelve a su tamaño reducido', await run(`return document.querySelector('.drawer').classList.contains('compact')`));
  await run(`document.querySelector('.drawer-backdrop').click()`);
  await sleep(300);
  await tapEl(`document.querySelector('.story-zone.next')`);
  await sleep(400);
  check('tocar la zona derecha del recuadro avanza', (await live()).ref === 'Salmos 23:1');
  await tapEl(`document.querySelector('.story-zone.prev')`);
  await sleep(400);
  check('y la izquierda retrocede', (await live()).ref === 'Juan 3:19');
  const storyMode = (mode) => `document.querySelector('.story-modes [data-mode=${mode}]')`;
  const modeIs = (mode) => run(`return ${storyMode(mode)}.getAttribute('aria-pressed') === 'true' && ${storyMode(mode)}.classList.contains('on') && document.querySelectorAll('.story-modes [aria-pressed=true]').length === 1 && document.querySelector('.story-frame').dataset.state === ${JSON.stringify(mode)}`);
  await tapEl(storyMode('black'));
  check('el modo «Negro» de Historias pone la pantalla en negro', (await live()).mode === 'black' && await modeIs('black'));
  await tapEl(storyMode('clear'));
  check('«Solo fondo»', (await live()).mode === 'clear' && await modeIs('clear'));
  await tapEl(storyMode('live'));
  check('y «Al aire» la devuelve', (await live()).mode === 'live' && await modeIs('live'));
  await tapEl(`document.querySelector('.story-card')`);
  check('tocar una tarjeta de «A continuación» la prepara, sin proyectarla', await run(`const p = document.querySelector('.prep'); return !p.hidden && p.getClientRects().length > 0 && p.querySelector('.prep-label').textContent === 'PREPARADO' && p.querySelector('.prep-text .item-text strong').textContent.includes('Salmos 23')`) && (await live()).ref === 'Juan 3:19');
  await tapEl(`document.querySelector('.prep-actions .btn.primary')`);
  check('«Proyectar» de la tarjeta la proyecta', (await live()).ref === 'Salmos 23:1' && await run(`return document.querySelector('.prep').hidden`));
  await run(`await ${post('projection.show', { kind: 'testcard', data: {} })}`);
  await sleep(500);
  await tapEl(`document.querySelector('.story-controls')`);
  check('el botón de mandos de Historias abre la capa con los mandos', await run(`const l = document.querySelector('.controls-layer'); return !l.hidden && document.querySelectorAll('.controls-pop .live-controls button').length === 5 && document.querySelector('.controls-pop').getClientRects().length > 0`));
  await clickAt(10, 10);
  check('y tocar fuera la cierra', await run(`return document.querySelector('.controls-layer').hidden`));
  const juan = await run(`return (await (await fetch('/api/state')).json()).order.items.find(i => i.title === 'Juan 3:19').id`);
  await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(juan)));
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(600);

  console.log('\n1. Interfaz · Buscar en todo');
  {
    const layerOpen = () => run(`return !document.querySelector('.finder-layer').hidden && document.body.classList.contains('finding')`);
    const seen = () => run(`return JSON.stringify([...document.querySelectorAll('.finder-list .finder-group, .finder-list .finder-row')].map(e => e.classList.contains('finder-group') ? '# ' + e.textContent : e.querySelector('strong')?.textContent))`).then(JSON.parse);
    const ask = async (q) => { await run(`const i = document.querySelector('.finder-input input'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input'));`); await sleep(800); };
    const ctrlK = async () => { for (const t of ['keyDown', 'keyUp']) await chrome.send('Input.dispatchKeyEvent', { type: t, key: 'k', code: 'KeyK', modifiers: 2, windowsVirtualKeyCode: 75 }); await sleep(300); };
    await run(`document.activeElement?.blur()`);
    await ctrlK();
    check('Ctrl K abre «Buscar en todo», con el cursor en su campo', await layerOpen() && await run(`return document.activeElement === document.querySelector('.finder-input input')`));
    await ask('jn 3 16');
    let rows = await seen();
    check('una cita sale en «Biblia»', rows[0] === '# Biblia' && rows[1] === 'Juan 3:16', JSON.stringify(rows));
    await ask('de tal manera amo');
    rows = await seen();
    check('unas palabras buscan el texto de la Biblia, con lo hallado resaltado', rows[1] === 'Juan 3:16' && await run(`return document.querySelector('.finder-row mark')?.textContent === 'de tal manera amó'`), JSON.stringify(rows));
    await ask('3');
    rows = await seen();
    check('un número busca el himno', rows.includes('# Himnario') && rows[rows.indexOf('# Himnario') + 1]?.startsWith('3 · '), JSON.stringify(rows));
    await ask('luz');
    check('en el escritorio, los grupos principales (Biblia, Himnario, Medios) van en columnas, uno al lado de otro', await run(`const c = [...document.querySelectorAll('.finder-col')]; return document.querySelector('.finder').classList.contains('wide') && c.length >= 2 && c.every(e => Math.abs(e.getBoundingClientRect().top - c[0].getBoundingClientRect().top) < 2) && c[1].getBoundingClientRect().left >= c[0].getBoundingClientRect().right`), JSON.stringify(await seen()));
    await ask('sal 23 2');
    await press('Enter');
    check('Intro proyecta el primero y cierra la búsqueda', (await live()).ref === 'Salmos 23:2' && !await layerOpen());
    await tapEl(`document.querySelector('.finder-chip')`);
    await ask('3');
    await tapEl(`[...document.querySelectorAll('.finder-row')].find(r => r.textContent.startsWith('3 · '))`);
    check('un toque prepara: la tarjeta «Preparado» se ve encima de la búsqueda, sin proyectar', await layerOpen() && await run(`const p = document.querySelector('.prep'); const r = p.getBoundingClientRect(); return !p.hidden && document.elementFromPoint(r.left + r.width / 2, r.top + 12)?.closest('.prep') === p && p.querySelector('.prep-text strong').textContent.startsWith('3 · ') && !p.querySelector('.prep-actions .btn:not(.primary)').hidden`) && (await live()).ref === 'Salmos 23:2');
    await clickAt(20, 780);
    check('tocar fuera cierra la búsqueda, y lo preparado sigue en su tarjeta', !await layerOpen() && await run(`return !document.querySelector('.prep').hidden`));
    const count = (await live()).order.length;
    await tapEl(`document.querySelector('.prep-actions .btn:not(.primary)')`);
    const added = await run(`return (await (await fetch('/api/state')).json()).order.items.at(-1)`);
    check('«Añadir al orden» de la tarjeta añade el himno', (await live()).order.length === count + 1 && added?.kind === 'song' && added.data.number === 3);
    if (added?.id) await run(`await ${post('order.remove', { id: 'ID' })}`.replace('"ID"', JSON.stringify(added.id)));
    await run(`document.querySelector('.prep [aria-label="Quitar lo preparado"]').click()`);
    await tapEl(`document.querySelector('.finder-chip')`);
    await ask('jn 3 16');
    await tapEl(`document.querySelector('.finder-row')`, 2);
    check('doble clic en un resultado lo proyecta y cierra la búsqueda', (await live()).ref === 'Juan 3:16' && !await layerOpen() && await run(`return document.querySelector('.prep').hidden`));
    await ctrlK();
    await press('Escape');
    check('Esc cierra la búsqueda', !await layerOpen());
    await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(juan)));
    await sleep(400);
  }

  console.log('\n1. Interfaz · Teclado');
  {
    await goTo('orden');
    await sleep(500);
    check('al abrir un módulo, el foco entra en su cajón', await run(`return document.querySelector('.drawer').contains(document.activeElement)`));
    await run(`document.querySelector('.ws[data-module=orden] .orow:not(.selected)').focus()`);
    const rowId = await run(`return document.activeElement.dataset.id`);
    await press('Enter');
    await sleep(500);
    check('una fila del orden del culto se alcanza con Tab y se abre con Intro', await run(`const r = document.querySelector('.ws[data-module=orden] .orow[data-id="${rowId}"]'); return r.getAttribute('role') === 'button' && r.getAttribute('aria-expanded') === 'true' && document.activeElement === r`));
    await press('Escape');
    await sleep(400);
    check('Esc cierra el cajón y el foco vuelve a su botón del dock', await run(`return document.querySelector('.drawer').hidden && document.activeElement === document.querySelector('.dock-item[data-id=orden]')`));
    await goTo('orden');
    await sleep(400);
  }

  console.log('\n1. Interfaz · Biblia: comparar versiones');
  const cmp = `document.querySelector('.ws[data-module=biblia]')`;
  const headBtn = (label) => `[...${cmp}.querySelectorAll('.ws-head .btn')].find(b => b.textContent.includes(${JSON.stringify(label)}))`;
  check('el Comparador ya no es un módulo del dock: es «Comparar», dentro de la Biblia', await run(`return !document.querySelector('.dock-item[data-id=comparador]')`));
  await goTo('biblia');
  await sleep(800);
  check('«Comparar» empieza apagado: sin segunda versión a la vista', await run(`return ${cmp}.querySelector('.cmp-bar').hidden && !${cmp}.querySelector('.verse.two') && ${headBtn('Comparar')}.getAttribute('aria-pressed') === 'false'`));
  await click(headBtn('Comparar'));
  await sleep(1500);
  check('al encenderlo propone dos versiones distintas', await run(`return ${headBtn('Comparar')}.getAttribute('aria-pressed') === 'true' && !${cmp}.querySelector('.cmp-bar').hidden && ${cmp}.querySelector('.ws-head select').value === ${JSON.stringify(VERSION)} && ${cmp}.querySelector('.cmp-bar select').value === 'version-de-prueba'`));
  await run(`const i = ${cmp}.querySelector('.search input'); i.value = 'jn 3 16'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));`);
  await sleep(1200);
  check('junto a cada versículo se lee el de la otra versión, y avisa si falta', await run(`const row = (n) => ${cmp}.querySelector('.verse[data-n="' + n + '"]'); return row(16).children.length === 3 && row(16).children[2].textContent.startsWith('Porque tanto amó') && Boolean(row(17).querySelector('.absent'))`));
  check('la vista previa muestra las dos versiones, cada una con el número del versículo', await run(`const m = document.querySelector('.prep-monitor'); return m.querySelectorAll('.cmp-side').length === 2 && [...m.querySelectorAll('.cmp-label')].map(l => l.textContent).join() === 'RV1909,Versión de prueba' && [...m.querySelectorAll('.stage-vn')].map(n => n.textContent).join() === '16,16'`));
  await click(`${cmp}.querySelector('.seg [data-layout=rows]')`);
  await sleep(300);
  check('la disposición se elige antes de proyectar', await run(`return document.querySelector('.prep-monitor').querySelector('.cmp').dataset.layout === 'rows'`));
  await click(`${cmp}.querySelector('.abar .btn.primary')`);
  await sleep(700);
  let on = await shown();
  check('proyecta el pasaje en las dos versiones', on.item.kind === 'compare' && on.item.reference === 'Juan 3:16' && on.item.sides[1].verses[0].text.startsWith('Porque tanto amó') && on.live.layout === 'rows' && (await text('.scene-caption')) === 'Juan 3:16 (RV1909 · Versión de prueba)');
  await click(`[...${LIVE}.querySelectorAll('button')].find(b => b.textContent.includes('Lado a lado'))`);
  await sleep(500);
  on = await shown();
  check('la disposición también se cambia al aire', on.live.layout === 'columns' && await run(`return document.querySelector('.scene-bg > .stage .cmp').dataset.layout === 'columns'`));
  await press('ArrowRight');
  on = await shown();
  check('"siguiente" sigue leyendo en las dos, y dice cuándo una no tiene el versículo', on.item.reference === 'Juan 3:17' && on.item.sides[1].verses.length === 0 && await run(`return document.querySelector('.scene-bg > .stage .cmp-absent').textContent === 'Este pasaje no está en Versión de prueba'`));
  await click(`[...${cmp}.querySelectorAll('.abar .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(600);
  on = await shown();
  const added = on.order.find((i) => i.kind === 'compare');
  check('se añade al orden como elemento propio, con sus dos versiones', Boolean(added) && added.subtitle === 'RV1909 · Versión de prueba' && added.data.layout === 'rows');
  await click(headBtn('Comparar'));
  await sleep(1200);
  check('al apagarlo, la Biblia vuelve a una versión y la vista previa también', await run(`return ${cmp}.querySelector('.cmp-bar').hidden && !${cmp}.querySelector('.verse.two') && !document.querySelector('.prep-monitor .cmp')`));

  console.log('\n1. Interfaz · Biblia: «Varios»');
  await click(headBtn('Varios'));
  await click(`${cmp}.querySelector('.verse[data-n="3"]')`);
  check('con «Varios», el primer toque marca dónde empieza el tramo y lo dice', await run(`return ${headBtn('Varios')}.getAttribute('aria-pressed') === 'true' && ${cmp}.querySelector('.multi-hint').textContent.startsWith('Desde el 3') && ${cmp}.querySelector('.verse[data-n="3"]').classList.contains('anchor')`));
  await click(`${cmp}.querySelector('.verse[data-n="5"]')`);
  check('y el segundo lo cierra: del 3 al 5', await run(`return ${cmp}.querySelector('.sel-ref').textContent === 'Juan 3:3-5' && ${cmp}.querySelectorAll('.verse.sel').length === 3 && !${cmp}.querySelector('.verse.anchor') && ${cmp}.querySelector('.multi-hint').textContent.startsWith('Toca el primer')`));
  await click(headBtn('Varios'));
  check('apagado, un toque vuelve a elegir un solo versículo', await run(`${cmp}.querySelector('.verse[data-n="7"]').click(); return ${cmp}.querySelector('.multi-hint').hidden && ${cmp}.querySelector('.sel-ref').textContent === 'Juan 3:7'`));

  console.log('\n1. Interfaz · Biblia al aire (versión, comparar y otro versículo desde los mandos)');
  {
    const ref = (book, chapter, a, b = a) => ({ book, chapter, verseStart: a, verseEnd: b });
    const verses = (r) => ({ kind: 'verses', data: { versionId: VERSION, ref: r } });
    // Tres elementos propios en el orden, que se quitan al terminar: uno de un paso, otro de un paso y otro de tres.
    for (const r of [ref(43, 3, 16), ref(19, 23, 1), ref(43, 3, 16, 18)]) await run(`await ${post('order.add', verses(r))}`);
    const [one, next, three] = (await shown()).order.slice(-3).map((i) => i.id);
    const bar = `${LIVE}.querySelector('.bible-bar')`;
    const barBtn = (n) => `${bar}.querySelectorAll('.bar-btn')[${n}]`;
    const menuNow = () => run(`return JSON.stringify([...document.querySelectorAll('.menu button')].map((b) => b.textContent))`).then(JSON.parse);
    const pop = `document.querySelector('.verse-pop')`;
    const cell = (n) => `${pop}.querySelector('.vp-n[data-n="${n}"]')`;
    const liveCells = () => run(`return [...${pop}.querySelectorAll('.vp-n.live')].map((b) => b.textContent).join()`);

    await run(`await ${post('order.show', { id: one })}`);
    await sleep(600);
    check('un pasaje al aire trae tres botones: versión, comparar y versículos', await run(`const b = [...${bar}.querySelectorAll('.bar-btn')]; return b.length === 3 && b[0].textContent.trim() === 'RV1909' && b[2].textContent.trim() === 'Juan 3:16' && !b[1].disabled`));

    // Versión: se cambia al aire sin salir del orden; «Siguiente» sigue por el orden.
    await tapEl(barBtn(0));
    check('«Versión» ofrece las versiones instaladas y marca la que está al aire', JSON.stringify(await menuNow()) === JSON.stringify(['Reina-Valera 1909 (RV1909)al aire', 'Versión de prueba']), JSON.stringify(await menuNow()));
    await menuItem('Versión de prueba');
    await sleep(600);
    let on = await shown();
    check('elegir otra versión pone el mismo pasaje en ella y sigue en su sitio del orden', on.item.kind === 'verses' && on.item.versionId === 'version-de-prueba' && on.item.source.orderId === one && on.item.source.step === 0 && (await text('.scene-caption')) === 'Juan 3:16 (Versión de prueba)');
    check('el elemento del orden no cambia', on.order.find((i) => i.id === one).data.versionId === VERSION);
    await press('ArrowRight');
    on = await shown();
    check('«Siguiente» sigue por el orden, y el elemento que viene se proyecta en su versión', on.item.source.orderId === next && on.item.versionId === VERSION && on.item.reference === 'Salmos 23:1');

    // Comparar: dentro de un elemento de varios pasos, los pasos siguen en la comparación.
    await run(`await ${post('order.show', { id: three })}`);
    await sleep(500);
    await tapEl(barBtn(1));
    check('«Comparar» ofrece las demás versiones, sin «Una sola» mientras no se compara', JSON.stringify(await menuNow()) === JSON.stringify(['Versión de prueba']), JSON.stringify(await menuNow()));
    await menuItem('Versión de prueba');
    await sleep(600);
    on = await shown();
    check('elegirla pone el pasaje en las dos versiones, sin salir del orden', on.item.kind === 'compare' && on.item.source.orderId === three && on.item.source.step === 0 && on.item.sides[1].versionId === 'version-de-prueba' && await run(`return ${barBtn(1)}.classList.contains('on') && ${barBtn(1)}.textContent.trim() === 'Versión de prueba'`));
    await press('ArrowRight');
    on = await shown();
    check('«Siguiente» sigue por el orden dentro del mismo elemento, en las dos versiones', on.item.kind === 'compare' && on.item.source.orderId === three && on.item.source.step === 1 && on.item.reference === 'Juan 3:17' && on.item.sides[1].verses.length === 0);
    await tapEl(barBtn(1));
    check('con una comparación al aire, el menú añade «Una sola»', JSON.stringify(await menuNow()) === JSON.stringify(['Una sola', 'Versión de pruebaal aire']), JSON.stringify(await menuNow()));
    await menuItem('Una sola');
    await sleep(600);
    on = await shown();
    check('«Una sola» vuelve al pasaje en la primera versión, en el mismo paso del orden', on.item.kind === 'verses' && on.item.versionId === VERSION && on.item.source.orderId === three && on.item.source.step === 1 && on.order.find((i) => i.id === three).kind === 'verses');
    await press('ArrowRight');
    on = await shown();
    check('y «Siguiente» sigue con el versículo 18, del orden', on.item.source.orderId === three && on.item.source.step === 2 && on.item.reference === 'Juan 3:18');

    // Versículos: la capa con los números del capítulo.
    await tapEl(barBtn(2));
    await sleep(700);
    check('«Versículos» abre una capa con los números del capítulo y marca el que está al aire', await run(`return Boolean(${pop}) && ${pop}.querySelector('.vp-title').textContent === 'Juan 3' && ${pop}.querySelectorAll('.vp-n').length === 36`) && (await liveCells()) === '18');
    await tapEl(cell(20));
    await sleep(600);
    on = await shown();
    check('un toque proyecta ese versículo y lo saca del orden', on.item.kind === 'verses' && on.item.reference === 'Juan 3:20' && on.item.source.orderId === null && (await liveCells()) === '20' && await run(`return Boolean(${pop})`));
    await run(`${cell(22)}.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
    await sleep(600);
    on = await shown();
    check('Mayús + clic amplía el tramo desde lo que está al aire: 20 a 22', on.item.reference === 'Juan 3:20-22' && (await liveCells()) === '20,21,22');
    await run(`${cell(25)}.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
    await sleep(700);
    await run(`${cell(25)}.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); ${cell(25)}.click()`);
    await sleep(600);
    on = await shown();
    check('un toque largo también amplía el tramo (y el clic que lo sigue no lo deshace): 20 a 25', on.item.reference === 'Juan 3:20-25' && (await liveCells()) === '20,21,22,23,24,25');
    await run(`${pop}.querySelector('.icon-btn[aria-label="Capítulo siguiente"]').click()`);
    await sleep(700);
    check('las flechas de la capa cambian de capítulo sin proyectar', await run(`return ${pop}.querySelector('.vp-title').textContent === 'Juan 4' && ${pop}.querySelectorAll('.vp-n.live').length === 0`) && (await shown()).item.reference === 'Juan 3:20-25');
    await press('Escape');
    check('Esc cierra la capa, y no el cajón de la Biblia', await run(`return !${pop} && document.querySelector('.drawer').getClientRects().length > 0`));
    await tapEl(barBtn(2));
    await sleep(600);
    await clickAt(10, 10);
    check('y tocar fuera también', await run(`return !${pop}`));
    // «Siguiente», ahora fuera del orden, sigue leyendo por la Biblia.
    await press('ArrowRight');
    check('fuera del orden, «Siguiente» sigue por la Biblia', (await shown()).item.reference === 'Juan 3:26');

    // En el celular, los mismos botones están en la capa de mandos y la rejilla cabe sobre ella.
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(700);
    await openControls();
    await tapEl(`document.querySelector('.controls-pop .bar-btn:nth-child(3)')`);
    await sleep(700);
    check('en el celular, la capa de versículos se abre sobre la de mandos y cabe en la pantalla', await run(`const r = ${pop}?.getBoundingClientRect(); return Boolean(r) && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && !document.querySelector('.controls-layer').hidden`));
    await tapEl(cell(30));
    await sleep(600);
    check('con el dedo, un toque proyecta el versículo', (await shown()).item.reference === 'Juan 3:30');
    await press('Escape');
    check('Esc cierra la capa de versículos y deja abierta la de mandos', await run(`return !${pop} && !document.querySelector('.controls-layer').hidden`));
    await closeControls();
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(600);
    for (const id of [one, next, three]) await run(`await ${post('order.remove', { id })}`);
  }

  console.log('\n1. Interfaz · Orden: Mapa del culto');
  {
    const om = `document.querySelector('.ws[data-module=orden]')`;
    const col = (title) => `[...${om}.querySelectorAll('.omap-item')].find(c => c.title.includes(${JSON.stringify(title)}))`;
    await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(juan)));
    await goTo('orden');
    await sleep(500);
    await click(`${om}.querySelector('[data-view=mapa]')`);
    await sleep(300);
    const content = (await live()).order.length - 2;
    check('el Mapa del culto pone una columna por elemento (sin secciones) y marca la que está al aire', await run(`return !${om}.querySelector('.omap').hidden && ${om}.querySelector('.olist').hidden && ${om}.querySelectorAll('.omap-item').length === ${content} && ${om}.querySelector('.omap-item.live').title === 'Juan 3:19' && /^${content} elementos · \\d+ pasos$/.test(${om}.querySelector('.order-bar small').textContent)`));
    await tapEl(col('Salmos 23'));
    check('un toque en una columna enseña sus pasos, sin proyectar', await run(`return ${col('Salmos 23')}.classList.contains('on') && ${om}.querySelector('.omap-steps strong').textContent.startsWith('Pasos de «Salmos 23') && ${om}.querySelectorAll('.omap-cells .step-cell').length === 3`) && (await live()).ref === 'Juan 3:19');
    await tapEl(`${om}.querySelector('.omap-cells .step-cell[aria-label="Paso 2"]')`);
    check('un paso del mapa lo proyecta, y lo anterior queda marcado como hecho', (await live()).ref === 'Salmos 23:2' && await run(`return ${col('Salmos 23')}.classList.contains('live') && ${om}.querySelectorAll('.omap-mark.done').length === 1 && ${om}.querySelector('.omap-mark b').textContent === '2'`));
    await tapEl(col('Juan 3:19'), 2);
    check('doble toque en una columna la proyecta', (await live()).ref === 'Juan 3:19');
    await click(`${om}.querySelector('[data-view=lista]')`);
    check('y «Lista» vuelve a la lista', await run(`return !${om}.querySelector('.olist').hidden && ${om}.querySelector('.omap').hidden`));
  }

  }

  // ---- Grupo «biblioteca» (1): imágenes, videos y audios ----
  if (inGroup('biblioteca')) {
  // El Presentador necesita un versículo en el orden del culto (en el grupo «control» lo pone la Biblia).
  await run(`return await ${post('order.add', { kind: 'verses', data: { versionId: VERSION, ref: { book: 43, chapter: 3, verseStart: 19, verseEnd: 19 } } })}`);
  console.log('\n1. Interfaz · Medios (imágenes)');
  await goTo('medios');
  await sleep(500);
  const med = `document.querySelector('.ws[data-module=medios]')`;
  check('sin nada, Medios invita a subir lo que sea y no muestra ningún grupo ni barra', await run(`const g = [...${med}.querySelectorAll('.media-group')]; return ${med}.querySelector('.empty').textContent.includes('Aún no hay nada en Medios') && g.length === 4 && g.every((x) => x.hidden) && ${med}.querySelectorAll('.media-bar').length === 4 && [...${med}.querySelectorAll('.media-bar')].every((b) => b.hidden)`));
  check('la cabecera trae el enlace de YouTube, un solo «Subir» y las categorías, sin pestañas ni campos de archivo por tipo', await run(`const head = ${med}.querySelector('.ws-head'); const input = ${med}.querySelector(':scope > input[type=file]'); const chips = [...${med}.querySelectorAll('.media-cats .chip')].map((c) => c.textContent); return head.querySelector('h1').textContent === 'Medios' && Boolean(head.querySelector('.media-entry .yt-add')) && head.querySelector('.btn.media-upload').textContent.trim() === 'Subir' && !${med}.querySelector('.media-tabs') && Boolean(input) && ['image/png', '.mp4', '.mp3', '.pdf', '.pptx'].every((t) => input.accept.includes(t)) && [...${med}.querySelectorAll('input[type=file]')].filter((i) => !i.accept.includes('.srt')).length === 1 && chips.join() === 'Principal0,Nueva categoría' && ${med}.querySelector('.media-cats .chip.on').dataset.category === ''`), await run(`const input = ${med}.querySelector(':scope > input[type=file]'); const head = ${med}.querySelector('.ws-head'); return JSON.stringify({ h1: head.querySelector('h1').textContent, yt: Boolean(head.querySelector('.media-entry .yt-add')), up: head.querySelector('.btn.media-upload')?.textContent, tabs: Boolean(${med}.querySelector('.media-tabs')), accept: input?.accept, files: ${med}.querySelectorAll('input[type=file]').length, on: ${med}.querySelector('.media-cats .chip.on')?.dataset.category })`));
  // Dos imágenes hechas aquí mismo: una apaisada más grande de lo que se guarda y un cartel vertical.
  const wide = path.join(tmp, 'anuncios_de-octubre.png');
  const tall = path.join(tmp, 'cartel vertical.png');
  fs.writeFileSync(wide, examplePoster(3000, 1000));
  fs.writeFileSync(tall, examplePoster(600, 900, [[15, 118, 110], [202, 138, 4]]));
  await chooseFiles(MEDIA_FILES, [wide, tall]);
  await sleep(600);
  check('al elegir archivos propone un nombre para cada imagen', await run(`return ${modal}.querySelector('h2').textContent === 'Subir 2 imágenes' && [...${modal}.querySelectorAll('.up-row input')].map(i => i.value).join('|') === 'anuncios de octubre|cartel vertical'`));
  check('prepara cada imagen en el propio dispositivo antes de enviarla', await until(`[...${modal}.querySelectorAll('.up-row small')].every(s => s.textContent.startsWith('Lista')) && !${modal}.querySelector('.btn.primary').disabled`));
  await run(`const i = ${modal}.querySelector('.up-row input'); i.value = 'Anuncios de octubre';`);
  await click(`${modal}.querySelector('.btn.primary')`);
  check('sube las imágenes y cierra la ventana; salen en su grupo, con su título y su cuenta', await until(`!${modal} && ${med}.querySelectorAll('.media-card').length === 2`) && JSON.stringify(await groupsNow()) === JSON.stringify(['Imágenes 2']) && await run(`return ${med}.querySelector('.media-body > :first-child').textContent === ''`));
  let lib = JSON.parse(await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify(s.media.images)`));
  const ad = lib.find((i) => i.name === 'Anuncios de octubre');
  check('la imagen grande llega reducida y con su miniatura; la pequeña, con su tamaño', Boolean(ad) && ad.width === 2560 && ad.height === 853 && Boolean(ad.thumb) && lib.some((i) => i.name === 'cartel vertical' && i.width === 600 && i.height === 900), lib.map((i) => `${i.name} ${i.width}×${i.height}`).join(', '));
  const adCard = `${med}.querySelector('.media-card[data-id="${ad?.id}"]')`;
  await click(`${adCard}.querySelector('.media-pick')`);
  await sleep(500);
  check('al elegir una imagen se ve en la vista previa y aparecen sus acciones', await run(`const m = document.querySelector('.prep-monitor'); return ${adCard}.classList.contains('selected') && m.querySelector('.img-view img').getAttribute('src') === ${JSON.stringify(ad?.url)} && !${med}.querySelector('.media-bar').hidden && ${med}.querySelector('.fit.on').dataset.fit === 'contain'`));
  await click(`${med}.querySelector('.fit[data-fit=cover]')`);
  await sleep(500);
  check('el ajuste se elige sobre dos miniaturas de la imagen', await run(`return ${med}.querySelector('.fit.on').dataset.fit === 'cover' && ${med}.querySelectorAll('.fit-thumb img').length === 2`));
  await click(`${med}.querySelector('.media-bar .btn.primary')`);
  await sleep(900);
  let air = await shown();
  check('"Proyectar" pone la imagen al aire con ese ajuste, y la biblioteca lo marca', air.item.kind === 'image' && air.item.title === 'Anuncios de octubre' && air.live.fit === 'cover' && air.live.zoom === 1 && await run(`return Boolean(${adCard}.querySelector('.badge.live')) && document.querySelector('.scene-caption').textContent === 'Anuncios de octubre'`));
  // Otra pantalla de proyección, para ver que sigue el encuadre.
  await run(`const f = document.createElement('iframe'); f.id = 'pantalla'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:320px;height:180px;z-index:99;border:0'; document.body.append(f);`);
  await sleep(2500);
  await run(`const s = ${LIVE}.querySelector('input[type=range]'); s.value = 3; s.dispatchEvent(new Event('input'));`);
  await sleep(700);
  air = await shown();
  // Qué parte del ancho de la imagen se ve en cada pantalla: debe ser la misma.
  const seen = `((root) => { const i = root.querySelector('.img-view img'); const scale = Number(/scale\\(([\\d.]+)\\)/.exec(i.style.transform)?.[1]); return root.querySelector('.img-view').clientWidth / (i.naturalWidth * scale); })`;
  const parts = JSON.parse(await run(`return JSON.stringify([${seen}(document.querySelector('.scene-bg > .stage')), ${seen}(document.querySelector('#pantalla').contentDocument)])`));
  // La imagen es más alargada que la pantalla: llenándola ya se ve solo una parte de su ancho, y con el zoom, un tercio de eso.
  const part = (16 / 9) / (ad.width / ad.height) / 3;
  check('el deslizador acerca la imagen, y las dos pantallas muestran la misma parte', air.live.zoom === 3 && Math.abs(parts[0] - part) < 0.01 && Math.abs(parts[0] - parts[1]) < 0.01, `se ve ${(parts[0] * 100).toFixed(1)} % y ${(parts[1] * 100).toFixed(1)} % del ancho`);
  // En el escritorio el encuadre se mueve sobre la propia proyección de fondo, con «Mover» (como en el Presentador).
  const moveChip = `document.querySelector('.tb-extra .tool-chip[data-tool=move]')`;
  check('con una imagen al aire, la barra trae «Señalar» y «Mover»', await run(`return Boolean(${moveChip}) && !${moveChip}.hidden && !document.querySelector('.tb-extra .tool-chip[data-tool=point]').hidden`));
  await tapEl(moveChip);
  // Con el cajón cerrado se ve la proyección entera (abierto, solo lo que deja).
  await run(`document.activeElement?.blur()`);
  await press('Escape');
  await sleep(400);
  const bgBox = JSON.parse(await run(`const r = document.querySelector('.scene-bg > .stage').getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width })`));
  await dragMouse(bgBox.x, bgBox.y, bgBox.x - bgBox.w * 0.05, bgBox.y);
  await sleep(600);
  air = await shown();
  check('«Mover»: arrastrar sobre la proyección mueve lo que se ve', air.live.x > 0.5 && air.live.zoom === 3 && await run(`return document.querySelector('.scene-bg').dataset.tool === 'move'`), `centro en ${air.live.x}, ${air.live.y}`);
  // Varios arrastres hacia la derecha: con el zoom en 3, uno solo no llega al borde de la imagen.
  for (let i = 0; i < 6; i += 1) await dragMouse(bgBox.x - bgBox.w * 0.3, bgBox.y, bgBox.x + bgBox.w * 0.4, bgBox.y);
  await sleep(600);
  air = await shown();
  check('en el borde, el encuadre se detiene sin dejar huecos', Math.abs(air.live.x - part / 2) < 0.01, `centro en ${air.live.x}`);
  await tapEl(moveChip);
  await goTo('medios');
  await sleep(500);
  await click(`[...${LIVE}.querySelectorAll('button')].find(b => b.textContent.includes('Vista completa'))`);
  await sleep(600);
  air = await shown();
  check('"Vista completa" deshace el zoom y el desplazamiento', air.live.zoom === 1 && air.live.x === 0.5 && air.live.fit === 'cover' && await run(`return [...${LIVE}.querySelectorAll('button')].find(b => b.textContent.includes('Vista completa')).disabled`));
  await closeControls();
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
  // En el celular (< 860 px) el mismo dock va abajo con todos los módulos y su nombre, sin «Más»; se desliza si no caben.
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  const dockNames = `[...document.querySelectorAll('.dockbar .dock-item')].map(b => b.querySelector('.dock-name').textContent).join('|')`;
  check('en el celular, el dock va abajo con todos los módulos y su nombre, sin «Más»', await run(`const r = document.querySelector('.dockbar').getBoundingClientRect(); return ${dockNames} === 'Orden|Biblia|Himnario|Medios|Textos|Páginas web|Ajustes' && getComputedStyle(document.querySelector('.dock-name')).display !== 'none' && r.bottom > innerHeight - 30 && r.top > innerHeight / 2 && !document.querySelector('.tabbar') && ![...document.querySelectorAll('.dockbar button')].some(b => b.textContent === 'Más') && document.querySelector('.dock-item.on').dataset.id === 'medios'`), await run(`return ${dockNames}`));
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(400);

  console.log('\n1. Interfaz · Medios (videos, audios y categorías)');
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
    const vids = `${med}.querySelector('.media-list[data-panel=videos]')`;
    const vbar = `document.querySelector('.media-bar[data-panel=videos]')`;
    const controls = LIVE;
    const control = async (label) => { await click(`[...${controls}.querySelectorAll('button')].find(b => (b.textContent + ' ' + (b.getAttribute('aria-label') || '')).includes(${JSON.stringify(label)}))`); await sleep(700); };
    const videosNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).media.videos)`).then(JSON.parse);
    const air = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, volume: s.live.volume, sound: s.conexiones.sonido, order: s.order.items })`).then(JSON.parse);

    check('ya no existe el módulo Videos: todo está en Medios', await run(`return !document.querySelector('.dock-item[data-id=videos]') && !document.querySelector('.ws[data-module=videos]') && Boolean(document.querySelector('.dock-item[data-id=medios]'))`));
    await chooseFiles(MEDIA_FILES, [notVideo]);
    await sleep(500);
    await modalButton('Subir');
    check('un archivo que no es un video se rechaza, y lo dice', await until(`${modal}.querySelector('.up-row.error small')?.textContent.includes('no contiene un video')`), await run(`return ${modal}.querySelector('.up-row small')?.textContent`));
    await modalButton('Cancelar');
    await chooseFiles(MEDIA_FILES, [welcome, oldVideo]);
    await sleep(500);
    check('propone un nombre para cada video', await run(`return ${modal}.querySelector('h2').textContent === 'Subir 2 videos' && [...${modal}.querySelectorAll('.up-row input')].map(i => i.value).join('|') === 'video de bienvenida|testimonio'`));
    await modalButton('Subir');
    check('sube los videos y cierra la ventana', await until(`!${modal} && ${vids}.querySelectorAll('.media-card').length === 2`, 80));
    // Pasó el 2026-10-17 con los himnos: si el archivo acaba un poco antes que su reloj, el reproductor le daba
    // «reproducir» al video ya terminado, que volvía a empezar, y sonaba su principio hasta la pausa.
    const replay = await run(`const url = (await (await fetch('/api/state')).json()).media.videos.find((v) => v.url && v.name === 'video de bienvenida')?.url;
      const { createPlayer } = await import('/modules/projection/player.js'); const { serverNow } = await import('/core/api.js');
      const v = document.createElement('video'); document.body.append(v); const p = createPlayer(v); p.load(url);
      await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); });
      const real = v.duration; let reached = false; let back = null;
      v.addEventListener('timeupdate', () => { if (v.currentTime > real - 0.3) reached = true; else if (reached) back = v.currentTime; });
      p.apply({ playing: true, position: real - 0.8, at: serverNow(), duration: real + 1.5 });
      await new Promise((r) => { setTimeout(r, 2600); });
      p.release();
      return JSON.stringify({ real, reached, back });`).then(JSON.parse);
    check('un video que termina antes que su reloj se queda en el final, sin volver a sonar desde el principio', replay.reached && replay.back === null, JSON.stringify(replay));
    check('el que el navegador no reproduce se convierte solo y queda listo', await until(`${vids}.querySelectorAll('.media-card[data-status=ready]').length === 2`, 100));
    let videos = await videosNow();
    const main = videos.find((v) => v.name === 'video de bienvenida');
    const converted = videos.find((v) => v.name === 'testimonio');
    check('lo habitual se usa tal cual y lo demás queda convertido; los dos con su imagen y su duración', Boolean(main && converted) && !main.converted && converted.converted && converted.url.endsWith('.mp4')
      && Math.round(main.duration) === 8 && await run(`return [...${vids}.querySelectorAll('.media-card')].every(c => c.querySelector('.media-thumb img')?.naturalWidth > 0 && /^0:0\\d$/.test(c.querySelector('.media-duration').textContent))`));
    // Los grupos de Medios van por tipo, y dentro de cada uno, del más antiguo al más reciente.
    const inDom = await run(`return JSON.stringify([...${vids}.querySelectorAll('.media-card')].map((c) => c.dataset.id))`).then(JSON.parse);
    check('cada tipo es un grupo con su título y su cuenta (Imágenes 1, Videos 2), y dentro de cada uno van del más antiguo al más reciente', JSON.stringify(await groupsNow()) === JSON.stringify(['Imágenes 1', 'Videos 2']) && inDom.length === 2
      && inDom.join() === [...videos].sort((x, y) => x.added - y.added).map((v) => v.id).join() && await run(`return ${med}.querySelector('.media-body > :first-child').textContent === ''`), JSON.stringify(inDom));

    // Categorías (fase 22): «Principal» tiene lo que no está en ninguna; cada elemento está en una sola.
    const cats = `${med}.querySelector('.media-cats')`;
    const catChip = (label) => `[...${cats}.querySelectorAll('.chip')].find(c => c.textContent.startsWith(${JSON.stringify(label)}))`;
    const emptyText = `${med}.querySelector('.media-body > :first-child').textContent`;
    const mainOnly = `${vids}.querySelector('.media-card[data-id="${main?.id}"]')`;
    const cardMore = `${mainOnly}.querySelector('.media-more')`;
    const moveFromMenu = async (toLabel) => {
      await click(cardMore);
      await sleep(300);
      await menuItem('Mover a una categoría');
      await sleep(300);
      await menuItem(toLabel);
      await sleep(600);
    };
    await click(catChip('Nueva categoría'));
    await sleep(300);
    await run(`${modal}.querySelector('input').value = 'Niños';`);
    await modalButton('Crear');
    await sleep(600);
    check('«Nueva categoría» la crea con el nombre que se escriba y la deja elegida, aún vacía', await run(`return ${catChip('Niños')}?.classList.contains('on') && ${emptyText}.includes('«Niños» aún no tiene nada') && [...${med}.querySelectorAll('.media-group')].every((g) => g.hidden)`), await run(`return ${cats}.textContent`));
    await click(catChip('Principal'));
    await sleep(300);
    await moveFromMenu('Niños');
    check('«Mover a una categoría…» del menú lleva el video a ella: sale de Principal y la cuenta de cada una lo dice', (await mediaCats())[0]?.items.join() === main?.id && await run(`return !${mainOnly} && ${catChip('Niños')}.textContent === 'Niños1' && ${catChip('Principal')}.textContent === 'Principal2'`));
    await click(catChip('Niños'));
    await sleep(400);
    check('al elegir la categoría solo se ve lo suyo', JSON.stringify(await groupsNow()) === JSON.stringify(['Videos 1']) && await run(`return ${med}.querySelectorAll('.media-body .media-card').length === 1 && Boolean(${mainOnly})`));
    await click(`${cats}.querySelector('.icon-btn')`);
    await sleep(300);
    await menuItem('Cambiar el nombre');
    await sleep(300);
    await run(`${modal}.querySelector('input').value = 'Niños y adolescentes';`);
    await modalButton('Guardar');
    await sleep(600);
    check('la categoría elegida se renombra desde su menú', (await mediaCats())[0]?.name === 'Niños y adolescentes' && await run(`return Boolean(${catChip('Niños y adolescentes')})`));
    await click(cardMore);
    await sleep(300);
    await menuItem('Sacar de');
    await sleep(600);
    check('«Sacar de…» lo devuelve a Principal sin borrarlo', (await mediaCats())[0]?.items.length === 0 && (await videosNow()).length === 2 && await run(`return ${emptyText}.includes('aún no tiene nada')`));
    // Arrastrar con el ratón de verdad: de Principal hasta el nombre de la categoría.
    await click(catChip('Principal'));
    await sleep(300);
    await dragCard(mainOnly, catChip('Niños y adolescentes'));
    await sleep(300);
    check('arrastrar con el ratón una tarjeta hasta una categoría la lleva a ella, sale de Principal y lo dice', (await mediaCats())[0]?.items.join() === main?.id && (await text('#toast')).includes('video de bienvenida') && (await text('#toast')).includes('está ahora en «Niños y adolescentes»')
      && await run(`return !${mainOnly} && ${catChip('Niños y adolescentes')}.textContent === 'Niños y adolescentes1' && ${catChip('Principal')}.textContent === 'Principal2' && !document.querySelector('.drag-ghost') && !document.documentElement.classList.contains('media-dragging') && !document.querySelector('.drop-on')`), await text('#toast'));
    // Con el dedo: mantener pulsado y mover hasta «Principal»; si se mueve antes de tiempo, es que se desplaza la lista.
    await click(catChip('Niños y adolescentes'));
    await sleep(400);
    let from = await centerOf(mainOnly);
    let to = await centerOf(catChip('Principal'));
    await dragTouch(from.x, from.y, to.x, to.y, 60);
    check('con el dedo, moverse antes de tiempo no arrastra: la tarjeta sigue donde estaba', (await mediaCats())[0]?.items.join() === main?.id && await run(`return !document.querySelector('.drag-ghost') && Boolean(${mainOnly})`));
    from = await centerOf(mainOnly);
    to = await centerOf(catChip('Principal'));
    await dragTouch(from.x, from.y, to.x, to.y);
    check('con el dedo, mantener pulsado y mover hasta «Principal» devuelve la tarjeta, y lo dice', (await mediaCats())[0]?.items.length === 0 && (await text('#toast')).includes('volvió a Principal')
      && await run(`return !${mainOnly} && ${catChip('Principal')}.textContent === 'Principal3' && !document.querySelector('.drag-ghost') && !document.documentElement.classList.contains('media-dragging')`), await text('#toast'));
    await click(catChip('Principal'));
    await sleep(400);
    check('y en Principal vuelve a estar con los otros dos videos', await run(`return Boolean(${mainOnly}) && ${vids}.querySelectorAll('.media-card').length === 2`));
    // Eliminar una categoría devuelve lo suyo a Principal.
    await moveFromMenu('Niños y adolescentes');
    await click(catChip('Niños y adolescentes'));
    await sleep(400);
    await click(`${cats}.querySelector('.icon-btn')`);
    await sleep(300);
    await menuItem('Eliminar la categoría');
    await sleep(300);
    await modalButton('Eliminar');
    await sleep(600);
    check('al eliminar la categoría se vuelve a Principal, con todo lo que tenía de vuelta', (await mediaCats()).length === 0 && (await videosNow()).length === 2 && await run(`return ${catChip('Principal')}.classList.contains('on') && ${catChip('Principal')}.textContent === 'Principal3' && ${vids}.querySelectorAll('.media-card').length === 2 && Boolean(${mainOnly})`));
    // Subir con una categoría elegida deja lo subido en ella (fuera de Principal).
    await click(catChip('Nueva categoría'));
    await sleep(300);
    await run(`${modal}.querySelector('input').value = 'Jóvenes';`);
    await modalButton('Crear');
    await sleep(600);
    // Un video que hay que convertir (viene en otro envoltorio), pero que este equipo reproduce tal
    // cual: se usa al instante, con el original, mientras se le hace la copia para las demás pantallas.
    const wrapped = sample('recien llegado.mkv', ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=8', ...quiet(262, 8), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
    await chooseFiles(MEDIA_FILES, [wrapped]);
    await sleep(500);
    await modalButton('Subir');
    const arrived = `[...${vids}.querySelectorAll('.media-card')].find(c => c.querySelector('strong').textContent === 'recien llegado')`;
    check('un video recién subido que este equipo reproduce tal cual se puede proyectar ya, mientras se le hace la copia', await until(`${arrived}?.dataset.usable === 'true' && ${arrived}.dataset.status === 'converting' && ${arrived}.querySelector('.media-status strong')?.textContent.includes('Ya se puede proyectar')`, 25), await run(`return ${arrived}?.querySelector('.media-status')?.textContent`));
    await until(`(await (await fetch('/api/state')).json()).media.categories[0]?.items.length === 1`, 20);
    const arrivedId = (await videosNow()).find((v) => v.name === 'recien llegado')?.id;
    check('lo que se sube con una categoría elegida queda en ella y no sale en Principal', Boolean(arrivedId) && (await mediaCats())[0]?.name === 'Jóvenes' && (await mediaCats())[0].items.join() === arrivedId
      && await run(`return ${catChip('Jóvenes')}.textContent === 'Jóvenes1' && ${catChip('Principal')}.textContent === 'Principal3'`), JSON.stringify(await mediaCats()));
    await click(`${arrived}.querySelector('.media-pick')`);
    await sleep(300);
    await click(`${vbar}.querySelector('.btn.primary')`);
    await sleep(1500);
    const instant = () => run(`const s = await (await fetch('/api/state')).json(); const v = document.querySelector('.scene-bg > .stage video'); const c = s.media.videos.find(x => x.name === 'recien llegado'); return JSON.stringify({ local: s.projection.item.local, url: s.projection.item.url, uid: s.projection.item.uid, playing: s.live.state.clock.playing, src: v.getAttribute('src'), paused: v.paused, t: v.currentTime, status: c.status, job: s.jobs.list.find(j => j.ref === c.id)?.detail })`).then(JSON.parse);
    const early = await instant();
    check('se reproduce con el archivo original, y la conversión espera a que deje de sonar', Boolean(early.local?.endsWith('.mkv')) && early.url === null && early.src === early.local && !early.paused && early.t > 0.3 && early.status === 'converting' && early.job === 'En pausa mientras se reproduce', JSON.stringify(early));
    await control('Pausar');
    const copied = await until(`${arrived}.dataset.status === 'ready'`, 60);
    const settled = await instant();
    // Al pausar, el video sigue un instante mientras se desvanece y el reproductor lo deja ahí (hasta SEEK_OVER + FADE_MS,
    // 0,75 s, en projection/player.js). Con el equipo ocupado, el desvanecido dura más y pasaba de 0,5 s.
    check('al dejar de reproducirse se termina la copia, y llega a lo que está en pantalla sin interrumpirlo', copied && Boolean(settled.url?.endsWith('.mp4')) && settled.local === early.local && settled.uid === early.uid && settled.src === early.local && Math.abs(settled.t - (await air()).live.clock.position) < 0.75, JSON.stringify(settled));
    await click(`${arrived}.querySelector('.media-more')`);
    await sleep(300);
    await menuItem('Eliminar');
    await sleep(300);
    await modalButton('Eliminar');
    await sleep(600);
    await click(`${cats}.querySelector('.icon-btn')`);
    await sleep(300);
    await menuItem('Eliminar la categoría');
    await sleep(300);
    await modalButton('Eliminar');
    await sleep(600);
    check('una categoría vacía se elimina sin más, y se vuelve a Principal', (await mediaCats()).length === 0 && await run(`return ${catChip('Principal')}.classList.contains('on') && ${vids}.querySelectorAll('.media-card').length === 2`));
    const mainCard = `${vids}.querySelector('.media-card[data-id="${main?.id}"]')`;
    await click(`${mainCard}.querySelector('.media-pick')`);
    await sleep(500);
    check('al elegir un video se ve su imagen en la vista previa y aparecen sus acciones', await run(`const m = document.querySelector('.prep-monitor'); return !${vbar}.hidden && m.querySelector('.clip-poster').getAttribute('src') === ${JSON.stringify(main?.poster)} && !m.querySelector('.clip-view').classList.contains('on-air')`));

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
    const screens = () => run(`const a = document.querySelector('.scene-bg > .stage video'); const b = ${far}.querySelector('.clip-view video'); return JSON.stringify({ here: { t: a.currentTime, paused: a.paused, muted: a.muted }, there: { t: b.currentTime, paused: b.paused, muted: b.muted, volume: b.volume, subtitles: b.textTracks[0]?.mode }, notice: ${far}.body.textContent.includes('Toca aquí') })`).then(JSON.parse);
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
    await chooseFiles('.media-list[data-panel=videos] input[accept*=".srt"]', [captions]);
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
    await click(`[...document.querySelectorAll('.scene-modes .mode-chip')].find(b => b.textContent.startsWith('Negro'))`);
    await sleep(700);
    sound = await heard();
    on = await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, playing: s.live.state.clock.playing })`).then(JSON.parse);
    check('«Negro» pausa lo que suena, también con un desvanecido', on.mode === 'black' && on.playing === false && sound.ends && sound.steps >= 4, `${sound.steps} pasos de volumen`);
    await control('Reproducir');
    on = await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, playing: s.live.state.clock.playing })`).then(JSON.parse);
    check('"Reproducir" con la pantalla en negro la vuelve a mostrar', on.mode === 'live' && on.playing === true);
    // Al terminar, la proyección pasa sola a "Solo fondo".
    await run(`const b = ${controls}.querySelector('.clip-seek input'); b.value = Number(b.max) - 1.2; b.dispatchEvent(new Event('input')); b.dispatchEvent(new Event('change'));`);
    const ended = await until(`document.querySelector('.scene-status .live-pill').textContent === 'SOLO FONDO'`, 12);
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
    both = JSON.parse(await run(`const a = document.querySelector('.scene-bg > .stage video'); const api = await import('/core/api.js'); return JSON.stringify({ paused: a.paused, muted: a.muted, yo: api.connectionId(), suena: api.state.conexiones.sonido, tocada: navigator.userActivation.hasBeenActive })`));
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

    await goTo('medios');
    await sleep(400);
    const auds = `${med}.querySelector('.media-list[data-panel=audios]')`;
    await chooseFiles(MEDIA_FILES, [track]);
    await sleep(500);
    await modalButton('Subir');
    check('un audio se sube igual, con el mismo botón, y sale en su grupo', await until(`!${modal} && ${auds}.querySelector('.media-card[data-status=ready]')`, 60) && JSON.stringify(await groupsNow()) === JSON.stringify(['Imágenes 1', 'Videos 1', 'Audios 1']) && await run(`return ${auds}.querySelector('.media-card strong').textContent === 'pista de piano' && ${auds}.querySelector('.media-duration').textContent === '0:05'`));
    await click(`${auds}.querySelector('.media-card .media-pick')`);
    await sleep(300);
    await click(`document.querySelector('.media-bar[data-panel=audios] .btn.primary')`);
    await sleep(1200);
    on = await air();
    check('al proyectarlo suena, y la pantalla muestra su nombre sobre el fondo', on.item.kind === 'audio' && on.live.clock.playing === true && await run(`const m = document.querySelector('.scene-bg > .stage'); return m.querySelector('.clip-audio .stage-ref').textContent === 'pista de piano' && !m.querySelector('audio').paused && m.querySelector('.stage').dataset.fill === 'text'`));
    await control('Pausar');
    check('y se gobierna con los mismos mandos', (await air()).live.clock.playing === false && await run(`return ${controls}.querySelectorAll('button').length >= 5 && document.querySelector('.scene-bg > .stage audio').paused`));

  }
  }

  // ---- Grupo «red» (1): YouTube e himnario (aquí para que los tres grupos tarden parecido) ----
  if (inGroup('red')) {
  console.log('\n1. Interfaz · Medios (YouTube)');
  if (!CAN_YOUTUBE) console.log('  (en este sistema no se puede usar el yt-dlp de mentira: esta parte se salta)');
  else {
    await goTo('medios');
    await sleep(500);
    const controls = LIVE;
    const control = async (label) => { await openControls(); await click(`[...${controls}.querySelectorAll('button')].find(b => (b.textContent + ' ' + (b.getAttribute('aria-label') || '')).includes(${JSON.stringify(label)}))`); await sleep(700); };
    const air = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items })`).then(JSON.parse);
    const cardMenu = async (cardJs, label) => { await click(`${cardJs}.querySelector('.media-more')`); await sleep(300); await menuItem(label); await sleep(400); };
    const tube = `document.querySelector('.ws[data-module=medios] .media-list[data-panel=videos]')`;
    const tubeBar = `document.querySelector('.media-bar[data-panel=videos]')`;
    const linkBox = `document.querySelector('.yt-add input')`;
    const tubeCard = `${tube}.querySelector('.media-card[data-status=ready], .media-card[data-status=downloading]')`;
    const tubesNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).media.youtube)`).then(JSON.parse);
    const paste = async (value) => { await run(`const i = ${linkBox}; i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input'));`); await click(`document.querySelector('.yt-add .btn')`); await sleep(500); };
    check('Medios pide el enlace de YouTube en su cabecera, junto a «Subir», y sin nada aún lo explica', await run(`const head = document.querySelector('.ws[data-module=medios] .ws-head'); const empty = document.querySelector('.ws[data-module=medios] .media-body > :first-child'); return empty.textContent.includes('Aún no hay nada en Medios') && empty.textContent.includes('YouTube') && head.contains(document.querySelector('.yt-add')) && [...head.querySelectorAll('.btn')].some(b => b.textContent.includes('Subir')) && document.querySelector('.ws-notice').hidden`));
    expectError('no es un enlace de un video de YouTube');
    await paste('https://vimeo.com/123456789');
    check('lo que no es un enlace de YouTube se rechaza, y lo dice', (await text('#toast')).includes('no es un enlace de un video de YouTube') && (await tubesNow()).length === 0, await text('#toast'));
    await paste('https://youtu.be/pruebaManna?si=compartido');
    check('al pegar un enlace empieza a descargarse y lo muestra con su avance, sin detener la app', await until(`${tubeCard}?.dataset.status === 'downloading' && ${tubeCard}.querySelector('.media-status .bar')`, 10)
      && (await text('#toast')).includes('Descargando') && await run(`return ${linkBox}.value === '' && ${tubeBar}.querySelector('.btn.primary').disabled`));
    check('el título llega antes que el video y el avance se mueve en su ficha, con la velocidad, sin salir en la cola del culto', await until(`${tubeCard}.querySelector('strong').textContent === 'Saludo de la iglesia hermana' && Number(${tubeCard}.querySelector('.bar')?.getAttribute('aria-valuenow')) > 0 && ${tubeCard}.querySelector('.media-status small')?.textContent.includes('2,5 MB/s') && ![...document.querySelectorAll('.queue .scene-jobs .job strong')].some(s => s.textContent.startsWith('Descargando'))`, 20),
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
    const tubeView = () => run(`const v = document.querySelector('.scene-bg > .stage video'); return JSON.stringify({ src: v.getAttribute('src'), paused: v.paused, t: v.currentTime, tracks: [...v.textTracks].map(t => t.language + ':' + t.mode) })`).then(JSON.parse);
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
      && await run(`return [...${failedCard}.querySelectorAll('.media-status .btn')].map(b => b.textContent).join() === 'Reintentar' && !document.querySelector('.queue .scene-jobs .job.error')`));
    await click(`${failedCard}.querySelector('.media-status .btn')`);
    check('"Reintentar" lo descarga de nuevo', await until(`${tube}.querySelectorAll('.media-card[data-status=downloading]').length === 1`, 10) && await until(`${failedCard}`, 30));
    await cardMenu(failedCard, 'Eliminar');
    await modalButton('Eliminar');
    await sleep(700);
    check('y al eliminarlo no queda ningún aviso suyo', (await tubesNow()).length === 1 && await run(`return !document.querySelector('.queue .scene-jobs .job.error')`));
  }

  console.log('\n1. Interfaz · Himnario');
  {
    const ws = `document.querySelector('.ws[data-module=himnario]')`;
    const hbar = `${ws}.querySelector('.hymn-bar')`;
    const hymnBox = `${ws}.querySelector('.search input')`;
    const tile = (n) => `${ws}.querySelector('.hymn[data-n="${n}"]')`;
    const typeIn = async (value) => { await run(`const i = ${hymnBox}; i.focus(); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input'));`); await sleep(800); };
    const hits = () => run(`return JSON.stringify([...${ws}.querySelectorAll('.hymn-hit')].map(r => ({ n: Number(r.dataset.n), title: r.querySelector('.hymn-title').textContent, label: r.querySelector('small b')?.textContent || null, text: r.querySelector('small')?.textContent || null, marks: [...r.querySelectorAll('mark')].map(m => m.textContent) })))`).then(JSON.parse);
    const onAir = () => run(`const s = await (await fetch('/api/state')).json(); const v = document.querySelector('.scene-bg > .stage video'); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items, src: v ? decodeURIComponent(v.getAttribute('src') || '') : null, paused: v?.paused, t: v?.currentTime, pos: s.live.state?.clock ? s.live.state.clock.position + (s.live.state.clock.playing ? (Date.now() - s.live.state.clock.at) / 1000 : 0) : null })`).then(JSON.parse);
    const liveBox = LIVE;
    await goTo('himnario');
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
    const openGroups = () => run(`return [...${ws}.querySelectorAll('.hymn-group')].map(g => g.querySelector('.hymn-grid').hidden ? '-' : '+').join('')`);
    check('las categorías empiezan plegadas', await openGroups() === '---');
    await click(`${ws}.querySelectorAll('.hymn-group-head')[1]`);
    await sleep(300);
    check('tocar una la despliega', await openGroups() === '-+-');
    await click(`${ws}.querySelectorAll('.hymn-group-head')[0]`);
    await sleep(300);
    check('tocar otra la despliega y pliega la anterior', await openGroups() === '+--');
    check('la vista por categorías agrupa los himnos bajo el nombre de cada una', await run(`const g = [...${ws}.querySelectorAll('.hymn-group')]; return g.length === 3 && g.map(x => x.querySelector('h2').textContent).join('|') === 'Cantos de la mañana|Cantos del camino|Cantos de gratitud y esperanza para todos los días' && g.map(x => x.querySelectorAll('.hymn').length).join() === '3,4,6' && g[0].querySelector('small').textContent === '1–3 · 3 himnos'`), await run(`return [...${ws}.querySelectorAll('.hymn-group')].map(x => x.querySelector('h2').textContent + ' ' + x.querySelectorAll('.hymn').length).join(' | ')`));
    check('las categorías de una misma sección van bajo su nombre', await run(`const s = [...${ws}.querySelectorAll('.hymn-section')]; return s.length === 1 && s[0].textContent === 'El día' && s[0].nextElementSibling.classList.contains('hymn-group')`));
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
    check('Enter lo elige y deja el buscador: se ve en la vista previa, con su número', await run(`const m = document.querySelector('.prep-monitor'); return ${hymnBox}.value === '' && ${tile(9)}.classList.contains('selected') && ${hbar}.querySelector('.hymn-sel-n').textContent === '9' && !${hbar}.hidden && m.querySelector('.song-number').textContent === '9' && m.querySelector('.song-card .stage-ref').textContent === ${JSON.stringify(hymnTitle(9))} && document.activeElement !== ${hymnBox}`));
    await click(`${hbar}.querySelector('.btn')`);
    await sleep(500);
    check('«Letra» muestra la letra del himno, por partes', await run(`return ${modal}.querySelector('h2').textContent === ${JSON.stringify(`9 · ${hymnTitle(9)}`)} && [...${modal}.querySelectorAll('.hymn-lyrics h3')].map(h => h.textContent).join() === 'Estrofa 1,Coro,Estrofa 2' && ${modal}.querySelectorAll('.hymn-lyrics p').length === 10 && ${modal}.querySelector('.hymn-lyrics section:nth-child(2) p').textContent.startsWith(${JSON.stringify(HYMN_FACTS.chorus.text)})`));
    await modalButton('Cerrar');
    // Con más sitio en el cajón, la ficha del elegido va al lado de la rejilla.
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    check('con el cajón ancho, la ficha del elegido va al lado de la rejilla, con su letra, y el botón «Letra» sobra', await until(`${ws}.querySelector('.hymn-card').getClientRects().length > 0 && ${ws}.querySelector('.hymn-card-n')?.textContent === '9' && ${ws}.querySelectorAll('.hymn-card .hymn-lyrics h3').length > 0 && ${hbar}.querySelector('.hymn-lyrics-btn').getClientRects().length === 0`, 15));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    check('en uno más estrecho, la ficha no se ve y vuelve «Letra»', await until(`${ws}.querySelector('.hymn-card').getClientRects().length === 0 && ${hbar}.querySelector('.hymn-lyrics-btn').getClientRects().length > 0`, 15));
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
      check('antes de proyectar se elige el sonido: cantado o pista', await run(`const m = document.querySelector('.prep-monitor'); return ${chip('instrumental')}.classList.contains('on') && !${chip('vocal')}.classList.contains('on') && m.querySelector('.song-track').textContent === 'Pista'`));
      await press('Enter');
      await sleep(2200);
      let air = await onAir();
      check('Enter lo proyecta con la pista instrumental, reproduciéndose', air.item.kind === 'song' && air.item.number === 9 && air.live.track === 'instrumental' && air.live.clock.playing === true && /^\/api\/hymns\/9\/pista\.mp4/.test(air.src) && air.paused === false && air.t > 0.3
        && await run(`return ${tile(9)}.classList.contains('live') && document.querySelector('.scene-caption').textContent === ${JSON.stringify(`9 · ${hymnTitle(9)}`)}`), JSON.stringify({ src: air.src, t: air.t, track: air.live?.track }));
      check('los mandos de un himno: cantado o pista, y los de cualquier cosa que suena', await run(`const c = ${liveBox}; return [...c.querySelectorAll('.song-tracks button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join() === 'Cantado,Pista*,Letra' && Boolean(c.querySelector('.clip-seek input')) && Boolean(c.querySelector('.volume input')) && c.querySelector('.clip-seek .clip-time:last-child').textContent === '0:14'`), await run(`return ${liveBox}.textContent`));
      await click(`${liveBox}.querySelector('.song-tracks [data-track=vocal]')`);
      await sleep(2200);
      air = await onAir();
      check('al aire se pasa de la pista al himno cantado sin perder el punto', air.live.track === 'vocal' && air.src === `/himnos/009 ${hymnTitle(9)}.mp4` && air.paused === false && Math.abs(air.t - air.pos) < 0.7 && air.t > 2, JSON.stringify({ src: air.src, t: air.t, pos: air.pos }));
      await click(`[...${liveBox}.querySelectorAll('button')].find(b => b.textContent.includes('Pausar'))`);
      await sleep(700);
      check('y se pausa como cualquier video', (await onAir()).live.clock.playing === false);
      await click(`${liveBox}.querySelector('.song-lyrics')`);
      await sleep(600);
      check('«Letra» abre la letra entera del himno al aire', await run(`const m = document.querySelector('.modal'); return Boolean(m) && m.querySelector('h2').textContent === ${JSON.stringify(`9 · ${hymnTitle(9)}`)} && m.querySelectorAll('.hymn-lyrics p').length > 2`));
      await modalButton('Cerrar');
    }
    await click(tile(9));
    await sleep(300);
    await click(`[...${hbar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
    await sleep(600);
    const inOrder = (await onAir()).order.find((i) => i.kind === 'song');
    check('un himno se añade al orden del culto con el sonido elegido', Boolean(inOrder) && inOrder.title === hymnTitle(9) && inOrder.subtitle === (HAS_FFMPEG ? 'N.º 9 · Pista' : 'N.º 9 · Cantado') && inOrder.steps === 1, JSON.stringify(inOrder || null));
    await press('ArrowDown');
    check('↓ pasa al himno siguiente sin tocar la proyección', await run(`return ${tile(10)}.classList.contains('selected') && ${hbar}.querySelector('.hymn-sel-n').textContent === '10'`));
    // Favoritos: los que más se cantan, a un toque y los mismos en todos los dispositivos.
    const favBtn = `${hbar}.querySelector('.hymn-fav-btn')`;
    const favsNow = () => run(`return (await (await fetch('/api/state')).json()).hymns.favorites.join()`);
    await click(favBtn);
    await sleep(500);
    check('«Favorito» marca el himno elegido para todos, y su ficha lleva una estrella', await favsNow() === '10' && await run(`return ${favBtn}.getAttribute('aria-pressed') === 'true' && Boolean(${tile(10)}.querySelector('.hymn-star'))`), await favsNow());
    await click(`${ws}.querySelector('.hymn-views [data-view=favorites]')`);
    await sleep(400);
    check('la vista «Favoritos» muestra solo esos', await run(`return ${ws}.querySelectorAll('.hymns-body .hymn').length === 1 && Boolean(${tile(10)})`));
    await click(favBtn);
    await sleep(500);
    check('y al quitarlo, la vista lo dice', await favsNow() === '' && await run(`return ${ws}.querySelector('.hymns-body .empty')?.textContent.includes('Aún no hay favoritos') && !${ws}.querySelector('.hymn-star')`));

    // Letras sin música: las diapositivas de cada himno, que se pasan a mano y vuelven a la portada.
    await click(`${ws}.querySelector('.hymn-views [data-view=letras]')`);
    await sleep(400);
    check('«Letras sin música» muestra solo los himnos con diapositivas', await run(`return [...${ws}.querySelectorAll('.hymns-body .hymn')].map(b => b.dataset.n).join() === '1,2,3,9'`), await run(`return [...${ws}.querySelectorAll('.hymns-body .hymn')].map(b => b.dataset.n).join()`));
    await click(tile(9));
    await sleep(400);
    check('elegido uno, no hay sonido que elegir ni escuchar', await run(`return ${hbar}.querySelector('.hymn-sound').hidden && ${hbar}.querySelector('.hymn-lyrics-btn').hidden && [...${hbar}.querySelectorAll('.hymn-act')].every(b => !b.disabled)`));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    check('con el cajón ancho, su ficha muestra las diapositivas, empezando por la portada', await until(`${ws}.querySelectorAll('.hymn-card .hymn-slide').length === 4 && ${ws}.querySelector('.hymn-card .hymn-slide').title === 'Portada'`, 15));
    await click(`${ws}.querySelector('.hymn-card .hymn-slide[data-i="2"]')`);
    await sleep(700);
    let words = (await onAir()).item;
    check('tocar una diapositiva la proyecta', words.kind === 'lyrics' && words.number === 9 && words.index === 3 && words.pages === 4, JSON.stringify(words));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    await click(`${hbar}.querySelector('.btn.primary.hymn-act')`);
    await sleep(700);
    words = (await onAir()).item;
    check('«Proyectar» la pone desde la portada', words.kind === 'lyrics' && words.index === 1 && words.reference === 'Portada', JSON.stringify(words));
    for (let i = 0; i < 3; i++) { await press('ArrowRight'); await sleep(500); }
    check('se pasa a mano, una a una, hasta la última', (await onAir()).item.index === 4);
    await press('ArrowRight');
    await sleep(600);
    words = (await onAir()).item;
    check('tras la última, «Siguiente» vuelve a la portada del mismo himno', words.kind === 'lyrics' && words.number === 9 && words.index === 1, JSON.stringify(words));
    await press('ArrowLeft');
    await sleep(600);
    check('y en la portada, «Anterior» se queda en ella', (await onAir()).item.index === 1);
    await click(`[...${hbar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
    await sleep(600);
    const wordsInOrder = (await onAir()).order.find((i) => i.kind === 'lyrics');
    check('se añade al orden del culto como letra sin música, con sus diapositivas', Boolean(wordsInOrder) && wordsInOrder.title === hymnTitle(9) && wordsInOrder.subtitle === 'N.º 9 · Letra sin música' && wordsInOrder.steps === 4, JSON.stringify(wordsInOrder || null));
    await click(`${ws}.querySelector('.hymn-views [data-view=grid]')`);
  }

  console.log('\n1. Interfaz · Textos');
  {
    const ws = `document.querySelector('.ws[data-module=textos]')`;
    const tbar = `${ws}.querySelector('.text-bar')`;
    const area = `${ws}.querySelector('.text-area')`;
    const textsNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).texts.list)`).then(JSON.parse);
    const air = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).projection.item)`).then(JSON.parse);
    const type = (js, value) => run(`const e = ${js}; e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input'));`);
    await goTo('textos');
    await sleep(500);
    check('Textos empieza vacío, dice para qué sirve y se escribe al lado', await run(`return document.title === 'Manna · Textos' && ${ws}.querySelector('.text-list .empty').textContent.includes('Aún no hay textos') && Boolean(${area}) && ${tbar}.hidden`));
    await type(area, 'Bienvenidos al culto\n\nLos esperamos en el salón al terminar');
    await sleep(300);
    check('al escribir dice en cuántas partes se pasa, y «Preparado» muestra la primera', await run(`return ${ws}.querySelector('.text-info').textContent.startsWith('2 partes') && !${tbar}.hidden && document.querySelector('.prep-monitor .stage-message')?.textContent === 'Bienvenidos al culto'`));
    await click(`[...${ws}.querySelectorAll('.text-foot .btn')].find(b => b.textContent.includes('Guardar'))`);
    await sleep(600);
    let list = await textsNow();
    check('«Guardar» lo deja en la lista, elegido', list.length === 1 && list[0].text === 'Bienvenidos al culto\n\nLos esperamos en el salón al terminar' && await run(`return ${ws}.querySelectorAll('.text-card').length === 1 && ${ws}.querySelector('.text-card').classList.contains('selected')`));
    await click(`${tbar}.querySelector('.btn.primary')`);
    await sleep(800);
    let item = await air();
    check('«Proyectar» pone su primera parte', item?.kind === 'text' && item.part === 1 && item.text === 'Bienvenidos al culto', JSON.stringify(item));
    await click(`document.querySelector('.tb-main .btn.next')`);
    await sleep(700);
    item = await air();
    check('y «Siguiente», la segunda', item?.part === 2 && item.text === 'Los esperamos en el salón al terminar', JSON.stringify(item));
    await click(`[...${ws}.querySelectorAll('.ws-head .btn')].find(b => b.textContent.includes('Nuevo texto'))`);
    await sleep(300);
    await click(`${ws}.querySelector('.text-styles [data-style=quote]')`);
    await sleep(200);
    await type(area, 'Una frase inventada para la prueba');
    await type(`${ws}.querySelector('.text-author input')`, 'Autor de prueba');
    await click(`[...${tbar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Añadir'))`);
    await sleep(700);
    list = await textsNow();
    const inOrder = JSON.parse(await run(`return JSON.stringify((await (await fetch('/api/state')).json()).order.items.filter(i => i.kind === 'text'))`));
    check('una cita lleva su autor; «Añadir al orden» la guarda y la añade', list.length === 2 && list[0].style === 'quote' && list[0].author === 'Autor de prueba' && inOrder.length === 1 && inOrder[0].subtitle === 'Cita · Autor de prueba', JSON.stringify(inOrder));
    await click(`${tbar}.querySelector('.btn.primary')`);
    await sleep(900);
    check('en la proyección, la cita va entre comillas y con su autor debajo', await run(`const i = document.querySelector('.scene-bg .stage-inner'); return i?.querySelector('.stage-message')?.textContent === '«Una frase inventada para la prueba»' && i.querySelector('.stage-ref').textContent === '— Autor de prueba'`),
      await run(`return document.querySelector('.scene-bg .stage-inner')?.textContent`));
    await click(`${ws}.querySelector('.text-card[data-id="${list[1]?.id}"] .text-more')`);
    await sleep(300);
    await menuItem('Eliminar');
    await sleep(300);
    await modalButton('Eliminar');
    await sleep(600);
    check('un texto se elimina desde su menú', (await textsNow()).length === 1 && await run(`return ${ws}.querySelectorAll('.text-card').length === 1`));
  }

  console.log('\n1. Interfaz · Ajustes: espacio en disco y limpiar');
  {
    // Lo que bajó la parte de YouTube ocupa sitio; «Limpiar multimedia temporales» lo borra todo (decisión 36).
    await goTo('ajustes');
    await sleep(1200);
    const diskRow = (id) => `document.querySelector('.disk-row[data-id=${id}] strong')`;
    check('Ajustes dice cuánto ocupa cada cosa subida o descargada, y lo libre del disco', await until(`${diskRow('youtube')} && ${diskRow('youtube')}.textContent !== '0 MB'`, 20)
      && await run(`return document.querySelectorAll('.disk-row').length === 7 && document.querySelector('.disk-row.total') && /Libre en el disco/.test(document.querySelector('.disk-list').nextElementSibling.textContent)`),
      await run(`return [...document.querySelectorAll('.disk-row')].map(r => r.textContent).join(' | ')`));
    await click(`[...document.querySelectorAll('.settings .btn')].find(b => b.textContent.includes('Limpiar multimedia temporales'))`);
    await sleep(400);
    check('antes de borrar, pide confirmarlo y dice qué se borra y qué no', await run(`return ${modal}.textContent.includes('YouTube') && ${modal}.textContent.includes('Contenido') && ${modal}.textContent.includes('No se puede deshacer')`));
    await modalButton('Limpiar');
    check('«Limpiar» borra los videos de YouTube y lo dice', await until(`!${modal} && document.querySelector('#toast').textContent.includes('se liberaron')`, 20)
      && await run(`const s = await (await fetch('/api/state')).json(); return s.media.youtube.length === 0 && ${diskRow('youtube')}.textContent === '0 MB'`), await text('#toast'));
  }
  }

  // ---- Grupo «biblioteca» (2): diapositivas, presentador y páginas web ----
  if (inGroup('biblioteca')) {
  console.log('\n1. Interfaz · Presentaciones (grupo de Medios)');
  {
    const ws = `document.querySelector('.decks[data-panel=diapositivas]')`;
    const dbar = `document.querySelector('.deck-bar')`;
    const decksNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).slides.decks)`).then(JSON.parse);
    const onAir = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item, live: s.live.state, order: s.order.items })`).then(JSON.parse);
    const pickFile = async (file) => { await chooseFiles(MEDIA_FILES, [file]); await sleep(600); };
    const groupsShown = () => run(`return [...document.querySelectorAll('.media-body .media-group')].filter((g) => g.getClientRects().length).map((g) => g.dataset.group).join()`);
    const slide = (n) => `${ws}.querySelector('.slide-pick[data-n="${n}"]')`;
    const deckMenu = async (cardJs, label) => { await click(`${cardJs}.querySelector('.deck-more')`); await sleep(300); await menuItem(label); await sleep(400); };
    const liveBox = LIVE;
    const cats = `document.querySelector('.ws[data-module=medios] .media-cats')`;
    const catChip = (label) => `[...${cats}.querySelectorAll('.chip')].find(c => c.textContent.startsWith(${JSON.stringify(label)}))`;
    // Si se ve (y no solo si existe): el grupo oculto conserva sus tarjetas.
    const seen = (js) => `(${js}?.getClientRects().length > 0)`;
    await openSlides();
    check('las presentaciones son un grupo de Medios (sin botón en el dock): sin ninguna, su grupo y su barra no se ven', await run(`return document.title === 'Manna · Medios' && !document.querySelector('.dock-item[data-id=diapositivas]') && document.querySelector('.media-group[data-group=diapositivas]').hidden && ${dbar}.hidden`));
    const notDeck = path.join(tmp, 'no-es-presentacion.txt');
    fs.writeFileSync(notDeck, 'unas notas');
    await pickFile(notDeck);
    check('un archivo que Manna no sabe usar se rechaza con un aviso, sin abrir ninguna ventana', (await text('#toast')).includes('Manna no sabe usar ese archivo') && await run(`return !${modal}`), await text('#toast'));

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
    check('con una presentación abierta, Medios muestra solo su grupo, con el botón para volver', await groupsShown() === 'diapositivas' && await run(`return ${ws}.dataset.view === 'pages' && !${ws}.querySelector('.deck-back').hidden`), await groupsShown());
    let decks = await decksNow();
    const deck = decks[0] || {};
    check('queda en la biblioteca con sus cuatro diapositivas, grandes y con miniatura', decks.length === 1 && deck.name === 'Informe de tesorería' && deck.pages === 4 && deck.width === 2560 && deck.height === 1440 && deck.thumbs === true && deck.source === 'pdf'
      && await run(`const r = await fetch(${JSON.stringify(`${deck.base}4.jpg`)}); return r.status === 200 && r.headers.get('content-type') === 'image/jpeg'`), JSON.stringify(decks.map((d) => [d.name, d.pages, d.width, d.height, d.thumbs])));
    const deckCard = `${ws}.querySelector('.deck[data-id="${deck.id}"]')`;
    check('se abre sola, con la portada en su tarjeta y una miniatura por diapositiva', await until(`${deckCard}.classList.contains('selected') && ${deckCard}.querySelector('.deck-cover img').naturalWidth === 320 && [...${ws}.querySelectorAll('.slide-thumb img')].every(i => i.naturalWidth === 320)`, 20)
      && await run(`return ${deckCard}.querySelector('small').textContent.startsWith('4 diapositivas · PDF')`));
    await click(slide(2));
    await sleep(500);
    check('al elegir una diapositiva se ve en la vista previa y la barra dice cuál es', await run(`const m = document.querySelector('.prep-monitor'); return ${slide(2)}.classList.contains('selected') && m.querySelector('.img-view img').getAttribute('src') === ${JSON.stringify(`${deck.base}m2.jpg`)} && ${dbar}.querySelector('.sel-ref').textContent === 'Diapositiva 2 de 4' && ${dbar}.querySelector('.hint').textContent === 'Informe de tesorería'`));
    await press('Enter');
    await sleep(600);
    let air = await onAir();
    check('Enter la proyecta, y la rejilla marca cuál está al aire', air.item.kind === 'slides' && air.item.number === 2 && air.item.pages === 4 && await run(`return Boolean(${slide(2)}.querySelector('.badge.live')) && ${deckCard}.classList.contains('live') && document.querySelector('.scene-caption').textContent === 'Informe de tesorería · 2 de 4'`));
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
    await goTo('orden');
    await sleep(500);
    await click(`[...document.querySelectorAll('.ws[data-module=orden] .orow')].find(r => r.textContent.includes('Informe de tesorería'))`);
    const detail = `document.querySelector('.ws[data-module=orden] .odetail')`;
    // Las miniaturas cargan la versión pequeña de cada diapositiva (320 px), no la imagen grande.
    // Se cuentan las imágenes: mientras se ve el esqueleto de carga aún no hay ninguna.
    check('en el orden se ven sus diapositivas en miniatura, rotuladas, con la imagen pequeña de cada una', await until(`${detail}.querySelectorAll('.slide img').length === 4 && [...${detail}.querySelectorAll('.slide img')].every(i => i.naturalWidth === 320 && /\\/m\\d\\.jpg$/.test(i.getAttribute('src')))
      && [...${detail}.querySelectorAll('.slide-cap span')].map(s => s.textContent).join() === 'Diapositiva 1,Diapositiva 2,Diapositiva 3,Diapositiva 4'`, 30)
      && await run(`return ${detail}.querySelector('.odetail-head small').textContent === 'Diapositivas · PDF · 4 diapositivas'`), await run(`return [...${detail}.querySelectorAll('.slide img')].map(i => (i.getAttribute('src') || '').split('/').pop() + ' ' + i.naturalWidth).join(', ')`));
    // Un iPhone triplica los píxeles de cada miniatura: no por eso se pide la imagen grande (decenas de ellas cerraban Safari).
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await sleep(900);
    check('en un celular de pantalla densa (iPhone) las miniaturas del orden siguen con la imagen pequeña', await run(`return devicePixelRatio === 3 && ${detail}.querySelectorAll('.slide img').length === 4 && [...${detail}.querySelectorAll('.slide img')].every(i => i.naturalWidth === 320)`),
      await run(`return devicePixelRatio + ' · ' + [...${detail}.querySelectorAll('.slide img')].map(i => i.clientWidth + '>' + i.naturalWidth).join(', ')`));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await click(`${detail}.querySelectorAll('.slide')[1]`);
    await sleep(600);
    air = await onAir();
    check('desde el orden se proyecta la que se toque, y «Siguiente» sigue por ahí', air.item.number === 2 && air.item.source.orderId === inOrder.id && await (async () => { await press('ArrowRight'); return (await onAir()).item.number === 3; })());

    // Un PowerPoint: lo convierte el PowerPoint del equipo principal (aquí, uno de mentira).
    await openSlides();
    await sleep(400);
    const lesson = path.join(tmp, 'escuela sabatica.pptx');
    fs.writeFileSync(lesson, fakePresentation());
    await pickFile(lesson);
    check('un PowerPoint se sube tal cual: lo convertirá el PowerPoint del equipo', await run(`return ${modal}.querySelector('input').value === 'escuela sabatica' && ${modal}.querySelector('.deck-up-status').textContent.includes('PowerPoint del equipo principal') && !${modal}.querySelector('.btn.primary').disabled`));
    await modalButton('Subir');
    const converting = `${ws}.querySelector('.deck[data-status=converting]')`;
    check('la conversión corre de fondo, con su avance en la tarjeta y en el panel', await until(`!${modal} && ${converting}?.querySelector('.deck-status .bar') && [...document.querySelectorAll('.queue .scene-jobs .job strong')].some(s => s.textContent === 'Convirtiendo «escuela sabatica»')`, 15) && (await text('#toast')).includes('PowerPoint la está convirtiendo')
      && await until(`/Diapositiva \\d de 3/.test(${converting}?.querySelector('.deck-status small')?.textContent || '')`, 15), await run(`return ${converting}?.querySelector('.deck-status small')?.textContent`));
    check('al terminar quedan sus tres diapositivas', await until(`${ws}.querySelectorAll('.deck[data-status=ready]').length === 2`, 40) && await (async () => { decks = await decksNow(); const made = decks.find((d) => d.source === 'powerpoint'); return made?.pages === 3 && made.ext === 'png' && await run(`return ${ws}.querySelector('.deck[data-id="${made.id}"]').classList.contains('selected') && ${ws}.querySelectorAll('.slide-pick').length === 3 && [...${ws}.querySelectorAll('.slide-thumb img')].every(i => i.getAttribute('src').endsWith('.png'))`); })());
    const made = decks.find((d) => d.source === 'powerpoint') || {};

    // PowerPoint en vivo: lo pasa el propio PowerPoint (aquí, el de mentira, que apunta lo que recibe y tiene una
    // animación en la diapositiva 2); Manna pone la foto de cada diapositiva.
    const madeCard = `${ws}.querySelector('.deck[data-id="${made.id}"]')`;
    const pptSaid = () => { try { return fs.readFileSync(path.join(tmp, 'powerpoint', 'pase.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((o) => [o.order, o.value].filter(Boolean).join(' ')); } catch { return []; } };
    check('en Windows con PowerPoint, un PowerPoint nuevo se pasa en vivo, y la tarjeta lo dice', made.live === true && await run(`return ${madeCard}.querySelector('small').textContent.includes('PowerPoint en vivo')`), await run(`return ${madeCard}?.querySelector('small')?.textContent`));
    await click(slide(1));
    await sleep(400);
    await press('Enter');
    await sleep(800);
    await openControls();
    const pptChip = (t) => `document.querySelector('.tb-extra .tool-chip[data-tool=${t}]')`;
    check('con PowerPoint en vivo, la barra ofrece «Señalar» (el punto va encima del pase) y «Mover»', await run(`return !${pptChip('point')}.hidden && !${pptChip('move')}.hidden`));
    check('al proyectarla, PowerPoint empieza por esa diapositiva, y los mandos dicen que la pasa él', pptSaid().filter((o) => o !== 'punto').at(-1) === 'ir 1' && (await onAir()).item.powerpoint === true
      && await run(`const c = ${liveBox}; return !c.querySelector('.slide-ppt').hidden && c.querySelector('.slide-ppt').textContent.includes('PowerPoint') && !c.querySelector('.live-part').hidden`), pptSaid().join(', '));
    // «Mover» con la rueda sobre la proyección: PowerPoint se aparta mientras está acercada; «Vista completa» lo trae.
    await tapEl(pptChip('move'));
    await run(`document.querySelector('.scene-bg').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))`);
    await sleep(600);
    check('al acercarla con «Mover», PowerPoint se aparta y se ve la imagen de Manna acercada', pptSaid().at(-1) === 'parar' && (await onAir()).live.zoom > 1, pptSaid().slice(-3).join(', '));
    await tapEl(pptChip('move'));
    await click(`[...${liveBox}.querySelectorAll('button')].find(b => b.textContent.includes('Vista completa'))`);
    await sleep(600);
    check('«Vista completa» la devuelve a PowerPoint, en la misma diapositiva', pptSaid().at(-1) === 'ir 1' && (await onAir()).live.zoom === 1, pptSaid().slice(-3).join(', '));
    await press('ArrowRight');
    await sleep(500);
    const passed = (await onAir()).item.number;
    await press('ArrowRight');
    await sleep(500);
    check('«Siguiente» lo da PowerPoint: pasa la diapositiva y, si tiene, sus animaciones', passed === 2 && (await onAir()).item.number === 2 && pptSaid().filter((o) => o === 'siguiente').length === 2, `${passed} → ${(await onAir()).item.number}: ${pptSaid().join(', ')}`);
    await deckMenu(madeCard, 'Pasar como imágenes');
    check('«Pasar como imágenes» la cierra en PowerPoint y los mandos dejan de decir que la pasa él', await until(`${LIVE}.querySelector('.slide-ppt').hidden`, 10) && pptSaid().at(-1) === 'cerrar' && (await decksNow()).find((d) => d.id === made.id)?.live === false
      && await run(`return !${madeCard}.querySelector('small').textContent.includes('en vivo')`), pptSaid().join(', '));
    await run(`return await ${post('projection.show', { kind: 'slides', data: { id: deck.id }, step: 2 })}`);
    await sleep(500);

    // Una presentación también se mueve a una categoría (fase 22): desde su menú y arrastrándola. Hay dos: la otra
    // tiene que quedarse donde estaba.
    await click(`${ws}.querySelector('.deck-back')`);
    await sleep(300);
    check('al volver a la lista, las presentaciones son el último de los grupos de Medios', JSON.stringify(await groupsNow()) === JSON.stringify(['Imágenes 1', 'Videos 1', 'Audios 1', 'Presentaciones 2']) && await groupsShown() === 'imagenes,videos,audios,diapositivas', JSON.stringify(await groupsNow()));
    await deckMenu(deckCard, 'Mover a una categoría');
    await menuItem('Nueva categoría');
    await sleep(300);
    await run(`${modal}.querySelector('input').value = 'Escuela sabática';`);
    await modalButton('Crear');
    await sleep(800);
    const moved = (await mediaCats())[0];
    check('«Nueva categoría…» del menú de una presentación la crea y la lleva a ella: sale de Principal y la otra se queda', moved?.name === 'Escuela sabática' && moved.items.join() === deck.id
      && await run(`return !${seen(deckCard)} && ${seen(madeCard)} && ${catChip('Escuela sabática')}.textContent === 'Escuela sabática1' && ${catChip('Principal')}.textContent === 'Principal4'`), JSON.stringify(moved) + ' ' + await run(`return JSON.stringify({ informe: ${seen(deckCard)}, ppt: ${seen(madeCard)}, chips: ${cats}.textContent })`));
    await click(catChip('Escuela sabática'));
    await sleep(400);
    check('al elegir la categoría solo se ve esa presentación', JSON.stringify(await groupsNow()) === JSON.stringify(['Presentaciones 1']) && await run(`return ${seen(deckCard)} && !${seen(madeCard)}`));
    await dragCard(deckCard, catChip('Principal'));
    await sleep(300);
    check('arrastrada con el ratón hasta «Principal», la presentación vuelve y sale de la categoría', (await mediaCats())[0]?.items.length === 0 && (await text('#toast')).includes('volvió a Principal')
      && await run(`return !${seen(deckCard)} && ${catChip('Principal')}.textContent === 'Principal5' && document.querySelector('.ws[data-module=medios] .media-body > :first-child').textContent.includes('aún no tiene nada')`), await text('#toast'));
    await click(catChip('Principal'));
    await sleep(400);
    check('y en Principal vuelve a estar, junto a la otra', await run(`return ${seen(deckCard)} && ${seen(madeCard)}`));

    await deckMenu(deckCard, 'Cambiar el nombre');
    await run(`${modal}.querySelector('input').value = 'Informe del trimestre';`);
    await modalButton('Guardar');
    await sleep(600);
    check('una presentación se renombra, también lo que está al aire', await run(`return !${modal} && ${deckCard}.querySelector('strong').textContent === 'Informe del trimestre' && document.querySelector('.scene-caption').textContent === 'Informe del trimestre · 3 de 4'`), await text('.scene-caption'));
    await deckMenu(`${ws}.querySelector('.deck[data-id="${made.id}"]')`, 'Eliminar');
    await modalButton('Eliminar');
    await sleep(700);
    check('y se elimina con todas sus imágenes', (await decksNow()).length === 1 && await run(`return (await fetch(${JSON.stringify(`${made.base}1.png`)})).status === 404`));

    // La categoría elegida se recuerda en este dispositivo: al recargar la página sigue elegida.
    await click(catChip('Escuela sabática'));
    await sleep(300);
    await chrome.send('Page.navigate', { url: `${local}/control?r=${Date.now()}#medios` });
    await sleep(2500);
    check('la categoría elegida se recuerda en este dispositivo: al recargar la página sigue elegida', await run(`return document.querySelector('.ws[data-module=medios] .media-cats .chip.on')?.textContent.startsWith('Escuela sabática')`), await run(`return document.querySelector('.ws[data-module=medios] .media-cats .chip.on')?.textContent + ' · guardada: ' + localStorage.getItem('manna.medios.categoria')`));
    await click(catChip('Principal'));
    await sleep(300);

    // En el celular: primero las presentaciones; al tocar una, sus diapositivas.
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await chrome.send('Page.navigate', { url: `${local}/control?m=${Date.now()}#medios` });
    await sleep(2500);
    const shownPane = () => run(`const vis = (s) => { const e = ${ws}.querySelector(s); return Boolean(e) && e.getClientRects().length > 0; }; return JSON.stringify({ list: vis('.deck-list'), pages: vis('.deck-pages'), back: vis('.deck-back'), groups: [...document.querySelectorAll('.media-body .media-group')].filter((g) => g.getClientRects().length).map((g) => g.dataset.group).join() })`).then(JSON.parse);
    let pane = await shownPane();
    check('en el celular se ve el cajón de Medios con todos sus grupos y la lista de presentaciones', pane.list && !pane.pages && !pane.back && pane.groups === 'imagenes,videos,audios,diapositivas', JSON.stringify(pane));
    await click(`${ws}.querySelector('.deck-pick')`);
    await sleep(400);
    pane = await shownPane();
    check('al tocar una se ven solo sus diapositivas, con el botón para volver', !pane.list && pane.pages && pane.back && pane.groups === 'diapositivas' && await run(`return ${ws}.querySelectorAll('.slide-pick').length === 4 && ${dbar}.querySelector('.sel-ref').textContent === 'Diapositiva 3 de 4'`), JSON.stringify(pane));
    await click(`${ws}.querySelector('.deck-back')`);
    await sleep(300);
    pane = await shownPane();
    check('«Presentaciones» vuelve a la lista, con los demás grupos', pane.list && !pane.pages && pane.groups === 'imagenes,videos,audios,diapositivas', JSON.stringify(pane));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    await chrome.send('Page.navigate', { url: `${local}/control?d=${Date.now()}#medios` });
    await sleep(2500);
  }

  console.log('\n1. Interfaz · Presentador');
  {
    const pr = `document.querySelector('.ws[data-module=presentador]')`;
    const snap = () => run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ item: s.projection.item && { kind: s.projection.item.kind, number: s.projection.item.number, orderId: s.projection.item.source?.orderId }, mode: s.projection.mode, pointer: s.pointer, view: s.live.state })`).then(JSON.parse);
    const num = async () => (await snap()).item?.number;
    // Un dedo (pointerId) sobre el monitor grande, en fracciones de su ancho y su alto.
    const finger = (kind, id, fx, fy) => run(`const m = ${pr}.querySelector('.pr-live'); const r = m.getBoundingClientRect(); m.dispatchEvent(new PointerEvent(${JSON.stringify(kind)}, { pointerId: ${id}, bubbles: true, clientX: r.left + r.width * ${fx}, clientY: r.top + r.height * ${fy} }))`);
    const button = (label) => `[...${pr}.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})`;
    const sees = (js) => run(`const e = ${js}; return Boolean(e) && !e.hidden && e.getClientRects().length > 0`);
    // Con otra cosa al aire (un versículo del orden), la pantalla dice que no es de la presentación.
    const orderId = (kind) => run(`return (await (await fetch('/api/state')).json()).order.items.find(i => i.kind === ${JSON.stringify(kind)}).id`);
    const verse = await orderId('verses');
    await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(verse)));
    await chrome.send('Page.navigate', { url: `${local}/presentador` });
    await sleep(2500);
    check('/presentador trae solo su módulo, titulado «Presentador», y no muestra el escenario', await run(`return document.title === 'Manna · Presentador' && document.body.classList.contains('full') && [...document.querySelectorAll('.ws')].map(e => e.dataset.module).join() === 'presentador' && document.querySelectorAll('.dockbar, .scene-bg, .scene-status, .queue, .transport-bar, .prep').length === 0`),
      await run(`return document.title + ' · ' + [...document.querySelectorAll('.ws')].map(e => e.dataset.module).join()`));
    check('con la presentación en el orden del culto, se abre en «Del orden» y la ofrece', await run(`return ${pr}.dataset.view === 'choose' && ${pr}.querySelector('.pr-tabs .chip.on').textContent === 'Del orden' && ${pr}.querySelectorAll('.pr-list .deck').length === 1 && ${pr}.querySelector('.pr-list .deck strong').textContent.includes('Informe')`));
    await click(`${pr}.querySelector('.pr-list .deck-pick')`);
    await sleep(500);
    check('al tocarla se abre la vista de presentar, con su grande, su siguiente y la rejilla', await run(`return ${pr}.dataset.view === 'present' && ${pr}.querySelectorAll('.slide-pick').length === 4 && ${pr}.querySelector('.pr-title').textContent.includes('Informe')`));
    check('con otra cosa al aire lo dice, y el botón propone empezar', await run(`const o = ${pr}.querySelector('.pr-onair'); return !o.hidden && o.textContent.startsWith('En pantalla:') && ${pr}.querySelector('.btn.primary.grow').textContent === 'Empezar' && ${pr}.querySelector('.btn[aria-label=Anterior]').disabled`));
    await click(`${pr}.querySelector('.btn.primary.grow')`);
    await sleep(600);
    let now = await snap();
    check('«Empezar» proyecta la primera, desde el orden del culto, y la rejilla la marca', now.item?.kind === 'slides' && now.item.number === 1 && now.item.orderId === await orderId('slides')
      && await run(`return ${pr}.querySelector('.slide-pick[data-n="1"]').classList.contains('live') && ${pr}.querySelector('.pr-onair').hidden && ${pr}.querySelector('.btn.primary.grow').textContent === 'Siguiente'`), JSON.stringify(now.item));
    await click(`${pr}.querySelector('.btn.primary.grow')`);
    await sleep(500);
    check('«Siguiente» pasa a la 2, se ve en la grande y el recuadro «Siguiente» muestra la 3', (await num()) === 2 && await until(`${pr}.querySelector('.pr-live .img-view img')?.getAttribute('src')?.endsWith('/2.jpg')`, 10)
      && await run(`return ${pr}.querySelector('.slide-pick[data-n="2"]').classList.contains('live') && !${pr}.querySelector('.slide-pick[data-n="1"]').classList.contains('live') && /3 de 4/.test(${pr}.querySelector('.pr-around > div:last-child .dock-label').textContent)`));
    check('a la izquierda de la siguiente, del mismo tamaño, se ve la anterior (la 1)', await run(`const prev = ${pr}.querySelector('.pr-prev'); const next = ${pr}.querySelector('.pr-next'); const a = prev.getBoundingClientRect(); const b = next.getBoundingClientRect(); return /1 de 4/.test(${pr}.querySelector('.pr-around > div:first-child .dock-label').textContent) && !prev.disabled && /m?1\\.(jpg|png)$/.test(prev.querySelector('img').getAttribute('src')) && a.right <= b.left && Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2`));
    await click(`${pr}.querySelector('.slide-pick[data-n="4"]')`);
    await sleep(500);
    check('tocar una miniatura la proyecta; en la última no hay más: «Siguiente» queda desactivado y se ve el fin', (await num()) === 4 && await run(`const e = ${pr}.querySelector('.pr-end'); return ${pr}.querySelector('.btn.primary.grow').disabled && !e.hidden && e.textContent === 'Fin de la presentación' && ${pr}.querySelector('.pr-next').disabled`));
    await click(`${pr}.querySelector('.slide-pick[data-n="2"]')`);
    await sleep(500);

    // El dedo señala: cada toque pone el punto rojo en la proyección, y al soltar se quita.
    await finger('pointerdown', 1, 0.8, 0.2);
    await sleep(500);
    now = await snap();
    check('un dedo sobre la grande señala en la proyección, en las mismas fracciones', now.pointer.x != null && Math.abs(now.pointer.x - 0.8) < 0.03 && Math.abs(now.pointer.y - 0.2) < 0.03, JSON.stringify(now.pointer));
    check('y el punto rojo se ve en la propia grande', await sees(`${pr}.querySelector('.pr-live .stage-pointer')`));
    await finger('pointerup', 1, 0.8, 0.2);
    await sleep(500);
    check('al soltar, el punto se quita', (await snap()).pointer.x === null && !await sees(`${pr}.querySelector('.pr-live .stage-pointer')`));

    // Mover: dos dedos que se separan acercan; uno que arrastra desplaza el encuadre.
    await click(`${pr}.querySelector('[data-tool=move]')`);
    await finger('pointerdown', 1, 0.4, 0.5);
    await finger('pointerdown', 2, 0.6, 0.5);
    await finger('pointermove', 2, 0.8, 0.5);
    await sleep(600);
    await finger('pointerup', 1, 0.4, 0.5);
    await finger('pointerup', 2, 0.8, 0.5);
    now = await snap();
    check('dos dedos que se separan al doble dejan el zoom en 2', now.view.zoom === 2, JSON.stringify(now.view));
    await finger('pointerdown', 3, 0.5, 0.5);
    await finger('pointermove', 3, 0.3, 0.5);
    await sleep(600);
    await finger('pointerup', 3, 0.3, 0.5);
    now = await snap();
    check('un dedo que se desplaza a la izquierda un 20 % del monitor deja el encuadre en x 0,6', Math.abs(now.view.x - 0.6) < 0.03 && Math.abs(now.view.y - 0.5) < 0.03, JSON.stringify(now.view));
    const resetBtn = `${pr}.querySelector('.pr-tools [aria-label="Restablecer el zoom"]')`;
    await click(resetBtn);
    await sleep(500);
    check('«Restablecer» (junto a «Mover») devuelve el zoom a 1 y se apaga', (await snap()).view.zoom === 1 && await run(`return ${resetBtn}.disabled`));
    check('y ya no está el recuadro de zoom de los mandos: se acerca y se mueve sobre la diapositiva', await run(`const f = ${pr}.querySelector('.slide-framing'); return !f || f.getClientRects().length === 0`));
    // Con el ratón, arrastrar sobre la diapositiva no la arrastra como una imagen (pasaba en la 1.14).
    await run(`window.__drags = 0; document.addEventListener('dragstart', () => { window.__drags += 1; }, true);`);
    const big = JSON.parse(await run(`const r = ${pr}.querySelector('.pr-live').getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 })`));
    await dragMouse(big.x, big.y, big.x + 80, big.y + 40);
    check('con el ratón, arrastrar sobre la diapositiva no la arrastra como una imagen', await run(`return window.__drags === 0`));
    await run(`return await ${post('projection.control', { zoom: 2, x: 0.6, y: 0.5 })}`);
    await sleep(500);
    check('con la imagen acercada, «Restablecer» se puede pulsar', await run(`return !${resetBtn}.disabled`));
    await click(resetBtn);
    await sleep(500);
    const whole = (await snap()).view;
    check('«Restablecer» deja la imagen entera y se apaga', whole.zoom === 1 && Math.abs(whole.x - 0.5) < 0.001 && await run(`return ${resetBtn}.disabled`), JSON.stringify(whole));

    // En el celular: la grande y la fila Anterior / Siguiente / Negro, sin desplazarse.
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await chrome.send('Page.navigate', { url: `${local}/presentador?m=${Date.now()}` });
    await sleep(2500);
    const inView = (selector) => run(`const e = ${pr}.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth`);
    check('en 375 px se ven sin desplazar la grande y Anterior / Siguiente / Negro, y la página no se ensancha', await inView('.pr-live') && await inView('.btn[aria-label=Anterior]') && await inView('.btn.primary.grow') && await inView(`.transport .btn:last-child`)
      && await run(`return ${pr}.dataset.view === 'present' && document.documentElement.scrollWidth <= innerWidth`), await run(`const r = ${pr}.querySelector('.transport').getBoundingClientRect(); return Math.round(r.bottom) + ' de ' + innerHeight`));
    // En el celular se pasa tocando la grande, como en «Historias»; con «Señalar» encendido, el toque señala.
    await click(`${pr}.querySelector('.slide-pick[data-n="2"]')`);
    await sleep(600);
    const tapAt = async (id, fx) => { await finger('pointerdown', id, fx, 0.5); await finger('pointerup', id, fx, 0.5); await sleep(600); return num(); };
    const passed = [await num(), await tapAt(21, 0.8), await tapAt(22, 0.2)];
    check('en el celular, tocar la grande a la derecha avanza y a la izquierda vuelve', passed.join() === '2,3,2', passed.join(' → '));
    await click(`${pr}.querySelector('[data-tool=point]')`);
    await finger('pointerdown', 23, 0.8, 0.5);
    await sleep(500);
    const pointed = (await snap()).pointer;
    await finger('pointerup', 23, 0.8, 0.5);
    await sleep(500);
    check('con «Señalar» encendido, el toque señala en la proyección y no pasa', pointed.x != null && (await num()) === 2, JSON.stringify(pointed));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
    await chrome.send('Page.navigate', { url: `${local}/control?p=${Date.now()}#medios` });
    await sleep(2500);
    // Lo que señala el Presentador también se ve en el fondo del control.
    await run(`return await ${post('projection.pointer', { x: 0.4, y: 0.4 })}`);
    await sleep(500);
    check('el punto rojo del Presentador se ve en la proyección de fondo del control', await run(`const p = document.querySelector('.scene-bg .stage-pointer'); return Boolean(p) && !p.hidden && p.getClientRects().length > 0`));
    await run(`return await ${post('projection.pointer', { x: null, y: null })}`);
  }

  console.log('\n1. Interfaz · Páginas web');
  {
    // Un sitio de mentira en este equipo, con una página que se deja mostrar dentro de otra y otra que no
    // (X-Frame-Options): nada sale a internet.
    const site = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...(req.url.startsWith('/no-se-deja') && { 'X-Frame-Options': 'DENY' }) });
      res.end('<!doctype html><title>Sitio de prueba</title><body>Sitio de prueba</body>');
    });
    await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
    const open = `http://127.0.0.1:${site.address().port}/se-deja`;
    const closed = `http://127.0.0.1:${site.address().port}/no-se-deja`;
    try {
      const ws = `document.querySelector('.ws[data-module=paginas]')`;
      const entry = (name) => `[...${ws}.querySelectorAll('.web-item')].find(i => i.querySelector('strong').textContent === ${JSON.stringify(name)})`;
      const pagesNow = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).web.pages)`).then(JSON.parse);
      const pickPage = async (name) => { await click(`${entry(name)}.querySelector('.web-pick')`); await sleep(300); };
      const projectPage = async (name) => { await pickPage(name); await click(`${ws}.querySelector('.abar .btn.primary')`); await sleep(600); };
      const pageMenu = async (name, label) => { await click(`${entry(name)}.querySelector('.web-more')`); await sleep(300); await menuItem(label); await sleep(400); };
      // La otra pantalla de proyección, dentro de la prueba; recoge lo que le dice el marco de la página.
      const far = `document.querySelector('#pantalla').contentDocument`;
      const heard = () => run(`return JSON.stringify(document.querySelector('#pantalla').contentWindow.__msgs)`).then(JSON.parse);
      const echoes = async (n) => { await until(`document.querySelector('#pantalla').contentWindow.__msgs.filter(m => m.eco).length >= ${n}`, 15); return (await heard()).filter((m) => m.eco).map((m) => `${m.eco}${m.key === 'ArrowRight' ? '→' : '←'}`).join(' '); };
      const dockKey = (label) => click(`[...${LIVE}.querySelectorAll('.web-keys .btn')].find(b => b.textContent.trim() === ${JSON.stringify(label)})`);

      await goTo('paginas');
      await sleep(500);
      check('Páginas web, sin páginas, invita a agregar una y no muestra la barra', await run(`return document.title === 'Manna · Páginas web' && ${ws}.querySelector('.empty').textContent.includes('Aún no hay páginas') && ${ws}.querySelector('.abar').hidden`));

      // Una dirección mal escrita: el error se dice y la ventana sigue abierta para corregirla.
      await click(`${ws}.querySelector('.ws-head .btn')`);
      await sleep(300);
      const fill = (address, name = '') => run(`const m = ${modal}; m.querySelector('input[type=url]').value = ${JSON.stringify(address)}; m.querySelector('input:not([type=url])').value = ${JSON.stringify(name)};`);
      expectError('Escribe la dirección de la página');
      await fill('esto no es una dirección');
      await modalButton('Agregar');
      await sleep(600);
      check('una dirección mal escrita muestra el error y deja la ventana abierta', (await text('#toast')).includes('Escribe la dirección de la página') && await run(`return Boolean(${modal}) && !${ws}.querySelector('.web-item')`));

      // Una que se deja mostrar: se verá en todas las pantallas.
      await fill(open, 'Presentación del culto');
      await modalButton('Agregar');
      check('una dirección que se deja mostrar se agrega y dice que se verá en todas las pantallas', await until(`${entry('Presentación del culto')}`, 15) && (await text('#toast')).includes('se verá en todas las pantallas') && await run(`return !${modal}`)
        && await run(`return ${entry('Presentación del culto')}.querySelector('small').textContent.trim() === '127.0.0.1' && ${ws}.querySelector('.abar').hidden === false`), await text('#toast'));
      check('el servidor la guardó como mostrable', (await pagesNow()).some((p) => p.name === 'Presentación del culto' && p.source === 'url' && p.framable === true && p.url === open));

      // Una que no: el proyector la abre en su propia ventana, y la lista lo dice.
      await click(`${ws}.querySelector('.ws-head .btn')`);
      await sleep(300);
      await fill(closed, 'Concurso bíblico');
      await modalButton('Agregar');
      check('una dirección que no se deja mostrar avisa de que irá en su propia ventana, y su subtítulo también', await until(`${entry('Concurso bíblico')}`, 15) && (await text('#toast')).includes('su propia ventana')
        && await run(`return ${entry('Concurso bíblico')}.querySelector('small').textContent.includes('en su propia ventana')`), await text('#toast'));
      check('el servidor la guardó como no mostrable', (await pagesNow()).some((p) => p.name === 'Concurso bíblico' && p.framable === false));

      // Un archivo HTML inventado: cuenta las teclas que recibe y, además, intenta dar una orden a Manna
      // desde dentro del marco (una orden de verdad, para que la comprobación no pase en vacío).
      const game = path.join(tmp, 'eco_de-teclas.html');
      fs.writeFileSync(game, `<!doctype html><title>Eco</title><body>Eco<script>
let n = 0;
addEventListener('keydown', (e) => { n += 1; parent.postMessage({ eco: n, key: e.key }, '*'); });
fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ type: 'order.addSection', payload: { title: 'Intruso' } }) })
  .then((r) => parent.postMessage({ orden: r.status }, '*'), () => parent.postMessage({ orden: 'error' }, '*'));
</script></body>`);
      await chooseFiles('.ws[data-module=paginas] input[type=file]', [game]);
      check('«Subir un archivo HTML» lo agrega, con el nombre del archivo, y queda elegido', await until(`${entry('eco de teclas')}`, 15) && (await text('#toast')).includes('«eco de teclas» agregada') && await run(`return ${entry('eco de teclas')}.classList.contains('selected') && ${entry('eco de teclas')}.querySelector('small').textContent.trim() === 'Archivo HTML'`));
      const fileId = (await pagesNow()).find((p) => p.name === 'eco de teclas')?.id;
      check('se sirve encerrado (sandbox) y con el puente de las flechas', await run(`const r = await fetch('/paginas/${fileId}'); const t = await r.text(); return r.headers.get('content-security-policy') === 'sandbox allow-scripts' && t.includes("d.manna!=='tecla'")`));

      // La otra pantalla de proyección escucha lo que diga el marco.
      await run(`const f = document.createElement('iframe'); f.id = 'pantalla'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:640px;height:360px;z-index:99;border:0'; document.body.append(f);`);
      await until(`${far}?.readyState === 'complete'`, 20);
      await run(`const w = document.querySelector('#pantalla').contentWindow; w.__msgs = []; w.addEventListener('message', (e) => w.__msgs.push(e.data));`);
      await projectPage('eco de teclas');
      check('proyectarlo pone en la otra pantalla un marco encerrado: solo con scripts, sin origen propio', await until(`${far}.querySelector('iframe.web-frame')`, 20)
        && await run(`const f = ${far}.querySelector('iframe.web-frame'); return f.getAttribute('sandbox') === 'allow-scripts' && f.getAttribute('src') === '/paginas/${fileId}' && ${far}.querySelector('.web-card').hidden`));
      check('«Anterior» y «Siguiente» aparecen en los mandos al aire', await until(`${LIVE}.querySelector('.web-keys') && !${LIVE}.querySelector('.web-keys').hidden`, 15));
      await until(`document.querySelector('#pantalla').contentWindow.__msgs.some(m => 'orden' in m)`, 15);
      const order = (await heard()).find((m) => 'orden' in m)?.orden;
      check('la orden enviada desde dentro del marco no se cumple (sin permiso o sin respuesta) y no cambia nada', (order === 'error' || order === 401 || order === 403) && !(await live()).order.includes('Intruso'), String(order));
      await dockKey('Siguiente');
      await sleep(400);
      await dockKey('Siguiente');
      await sleep(400);
      await dockKey('Anterior');
      await sleep(400);
      const keys = await echoes(3);
      check('«Siguiente» dos veces y «Anterior» una: el marco recibe las tres teclas, en orden', keys === '1→ 2→ 3←' && await run(`return (await (await fetch('/api/state')).json()).live.state.count === 3`), keys);
      await run(`const w = document.querySelector('#pantalla').contentWindow; w.__msgs = []; const f = w.document.querySelector('.web-frame'); f.src = f.src;`);
      const again = await echoes(3);
      check('si el marco se recarga, vuelve a recibir todas las teclas desde el principio', again === '1→ 2→ 3←', again);

      // Una dirección que se deja mostrar: un marco con esa dirección y sin flechas.
      await projectPage('Presentación del culto');
      check('una dirección que se deja mostrar se ve en un marco de la otra pantalla, sin tarjeta y sin flechas', await until(`${far}.querySelector('iframe.web-frame')?.getAttribute('src') === ${JSON.stringify(open)}`, 15)
        && await run(`return ${far}.querySelector('.web-card').hidden && ${LIVE}.querySelector('.web-keys').hidden`));

      // La que no se deja: tarjeta, sin marco.
      await projectPage('Concurso bíblico');
      check('la que no se deja mostrar se ve como una tarjeta que dice que va en su propia ventana, sin marco', await until(`${far}.querySelector('.web-card') && !${far}.querySelector('.web-card').hidden`, 15)
        && await run(`const c = ${far}.querySelector('.web-card'); return c.getClientRects().length > 0 && c.textContent.includes('Se ve en su propia ventana en el proyector') && c.textContent.includes('Concurso bíblico') && !${far}.querySelector('iframe')`), await run(`return ${far}.querySelector('.web-card')?.textContent`));
      await run(`document.querySelector('#pantalla').remove()`);

      // Al orden del culto: en la miniatura, siempre una tarjeta.
      await pickPage('Presentación del culto');
      await click(`[...${ws}.querySelectorAll('.abar .btn')].find(b => b.textContent.includes('Añadir'))`);
      await sleep(600);
      check('«Añadir al orden» la pone en el orden del culto', (await text('#toast')).includes('añadida al orden del culto') && (await live()).order.includes('Presentación del culto'));
      await goTo('orden');
      await sleep(500);
      await click(`[...document.querySelectorAll('.ws[data-module=orden] .orow')].find(r => r.textContent.includes('Presentación del culto'))`);
      const detail = `document.querySelector('.ws[data-module=orden] .odetail')`;
      check('en el orden, su miniatura es la tarjeta y no carga ningún marco, aunque la página se deje mostrar', await until(`${detail}.querySelector('.slide .web-card')`, 15)
        && await run(`const c = ${detail}.querySelector('.slide .web-card'); return !c.hidden && c.textContent.includes('Presentación del culto') && !${detail}.querySelector('iframe')`));

      // ---- El Presentador con páginas web ----
      // Ya hay tres: el archivo «eco de teclas», «Presentación del culto» (se deja mostrar, y está en el orden del culto) y
      // «Concurso bíblico» (en su propia ventana, al aire ahora).
      console.log('\n1. Interfaz · Presentador · páginas web');
      {
        const pr = `document.querySelector('.ws[data-module=presentador]')`;
        const ids = Object.fromEntries((await pagesNow()).map((p) => [p.name, p.id]));
        const snap = () => run(`const s = await (await fetch('/api/state')).json(); const i = s.projection.item; return JSON.stringify({ item: i && { kind: i.kind, id: i.id, orderId: i.source?.orderId }, pointer: s.pointer, count: s.live.state?.count || 0, orderWeb: s.order.items.filter((o) => o.kind === 'web').map((o) => o.id) })`).then(JSON.parse);
        const rows = () => run(`return JSON.stringify([...${pr}.querySelectorAll('.pr-list .deck')].map((d) => ({ name: d.querySelector('strong').textContent, small: d.querySelector('small').textContent, globe: Boolean(d.querySelector('.deck-cover use[href$="#globe"]')) })))`).then(JSON.parse);
        const seen = (selector) => run(`const e = ${pr}.querySelector(${JSON.stringify(selector)}); return Boolean(e) && e.getClientRects().length > 0`);
        const label = (text) => `[...${pr}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
        const big = `${pr}.querySelector('.btn.primary.grow')`;
        const prev = `${pr}.querySelector('.btn[aria-label=Anterior]')`;
        const pick = (name) => click(`[...${pr}.querySelectorAll('.pr-list .deck')].find((d) => d.querySelector('strong').textContent === ${JSON.stringify(name)}).querySelector('.deck-pick')`);
        // Un dedo sobre la grande, en fracciones del marco de la página (no del monitor).
        const onFrame = (kind, fx, fy) => run(`const m = ${pr}.querySelector('.pr-live'); const r = m.querySelector('iframe.web-frame').getBoundingClientRect(); m.dispatchEvent(new PointerEvent(${JSON.stringify(kind)}, { pointerId: 1, bubbles: true, clientX: r.left + r.width * ${fx}, clientY: r.top + r.height * ${fy} }))`);
        // Dónde dibuja el punto rojo la pantalla de proyección, en fracciones de su marco; null si no se ve.
        const farDot = () => run(`const d = ${far}; const p = d.querySelector('.stage-pointer'); const f = d.querySelector('iframe.web-frame'); if (!p || p.hidden || !f) return 'null'; const a = p.getBoundingClientRect(); const r = f.getBoundingClientRect(); return JSON.stringify({ x: (a.left + a.width / 2 - r.left) / r.width, y: (a.top + a.height / 2 - r.top) / r.height })`).then(JSON.parse);
        const near = (got, x, y) => Boolean(got) && Math.abs(got.x - x) <= 0.02 && Math.abs(got.y - y) <= 0.02;

        // Con una página al aire al entrar, se sigue sola (la de su propia ventana lleva Anterior y Siguiente).
        await chrome.send('Page.navigate', { url: `${local}/presentador?w=${Date.now()}` });
        await sleep(2500);
        check('con una página web al aire, al entrar el Presentador la sigue sola, con «Siguiente» y «Anterior»', await run(`return ${pr}.dataset.view === 'present' && ${pr}.querySelector('.pr-title').textContent === 'Concurso bíblico' && ${big}.textContent.trim() === 'Siguiente' && !${big}.disabled && !${prev}.disabled`));
        await run(`const f = document.createElement('iframe'); f.id = 'pantalla'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:640px;height:360px;z-index:99;border:0'; document.body.append(f);`);
        await until(`${far}?.readyState === 'complete'`, 20);
        const listen = () => run(`const w = document.querySelector('#pantalla').contentWindow; w.__msgs = []; if (!w.__oye) { w.__oye = true; w.addEventListener('message', (e) => w.__msgs.push(e.data)); }`);
        await listen();

        // Las páginas en las listas.
        await click(label('Presentaciones'));
        await sleep(300);
        let list = await rows();
        check('«Del orden» ofrece la presentación y, con icono de globo y «Página web · …», la página del orden', await run(`return ${pr}.dataset.view === 'choose' && ${pr}.querySelector('.pr-tabs .chip.on').textContent === 'Del orden'`)
          && list.filter((r) => r.globe).length === 1 && list.some((r) => !r.globe && r.name.includes('Informe'))
          && list.find((r) => r.globe).name === 'Presentación del culto' && list.find((r) => r.globe).small === 'Página web · 127.0.0.1', JSON.stringify(list));
        await click(`${pr}.querySelector('.pr-tabs [data-tab=biblioteca]')`);
        await sleep(300);
        list = await rows();
        check('«Biblioteca» da las presentaciones y, detrás, las tres páginas web', list.length > 3 && list.filter((r) => r.globe).length === 3 && list.slice(-3).every((r) => r.globe) && list.slice(0, -3).every((r) => !r.globe)
          && list.slice(-3).every((r) => r.small.startsWith('Página web · ')), JSON.stringify(list));

        // Una página elegida del orden: sin «Mover», sin siguiente ni rejilla; «Proyectar» la pone y lo hace desde su elemento del orden.
        await click(`${pr}.querySelector('.pr-tabs [data-tab=orden]')`);
        await pick('Presentación del culto');
        await sleep(400);
        check('elegir una página abre la vista de presentar sin «Mover», sin siguiente ni rejilla, avisa de lo que hay al aire y el botón dice «Proyectar»',
          await run(`return ${pr}.dataset.view === 'present' && ${pr}.querySelector('.pr-title').textContent === 'Presentación del culto' && ${big}.textContent.trim() === 'Proyectar' && ${prev}.disabled && ${pr}.querySelector('.pr-onair').textContent.startsWith('En pantalla:')`)
          && await seen('[data-tool=point]') && !await seen('[data-tool=move]') && !await seen('.pr-next') && !await seen('.pr-around .dock-label') && !await seen('.pr-grid') && !await seen('.slide-pick')
          && await seen('.pr-onair'));
        await click(big);
        await sleep(700);
        let now = await snap();
        check('«Proyectar» pone la página al aire, desde su elemento del orden', now.item?.kind === 'web' && now.item.id === ids['Presentación del culto'] && now.item.orderId === now.orderWeb[0] && Boolean(now.orderWeb[0]), JSON.stringify(now));

        // Una dirección que se deja mostrar: sin flechas. Las del teclado no mandan nada.
        check('con una dirección que se deja mostrar al aire, «Anterior» y «Siguiente» quedan desactivados y el aviso se quita', await run(`return ${big}.textContent.trim() === 'Siguiente' && ${big}.disabled && ${prev}.disabled && ${pr}.querySelector('.pr-onair').hidden`));
        await press('ArrowRight');
        await press('ArrowLeft');
        check('y las flechas del teclado no mandan nada', (await snap()).count === 0 && await run(`const s = await (await fetch('/api/state')).json(); return !s.live.state`));

        // Señalar: el punto cae en el mismo sitio del marco, en la grande y en la pantalla de proyección.
        await until(`${far}.querySelector('iframe.web-frame')?.getAttribute('src') && ${far}.querySelector('iframe.web-frame').getBoundingClientRect().width > 0`, 20);
        await onFrame('pointerdown', 0.3, 0.7);
        await sleep(500);
        now = await snap();
        let dot = await farDot();
        check('un toque sobre la grande señala en las fracciones del marco, y el punto rojo cae en el mismo sitio de la pantalla de proyección', near(now.pointer, 0.3, 0.7) && near(dot, 0.3, 0.7) && await seen('.pr-live .stage-pointer'), JSON.stringify({ pointer: now.pointer, dot }));
        await onFrame('pointermove', 0.6, 0.4);
        await sleep(500);
        now = await snap();
        dot = await farDot();
        check('al arrastrar, el punto sigue al dedo', near(now.pointer, 0.6, 0.4) && near(dot, 0.6, 0.4), JSON.stringify({ pointer: now.pointer, dot }));
        await onFrame('pointerup', 0.6, 0.4);
        await sleep(500);
        check('al soltar, el punto desaparece de las dos pantallas', (await snap()).pointer.x === null && await farDot() === null && !await seen('.pr-live .stage-pointer'));

        // Un archivo propio, elegido de la biblioteca: «Proyectar» lo pone (sin elemento del orden) y las flechas le llegan al marco.
        await click(label('Presentaciones'));
        await click(`${pr}.querySelector('.pr-tabs [data-tab=biblioteca]')`);
        await pick('eco de teclas');
        await sleep(400);
        check('un archivo HTML elegido de la biblioteca también dice «Proyectar»', await run(`return ${pr}.dataset.view === 'present' && ${big}.textContent.trim() === 'Proyectar'`));
        await listen();
        await click(big);
        await sleep(700);
        now = await snap();
        check('«Proyectar» lo pone al aire, sin elemento del orden', now.item?.kind === 'web' && now.item.id === ids['eco de teclas'] && !now.item.orderId, JSON.stringify(now.item));
        await until(`document.querySelector('#pantalla').contentWindow.__msgs.some((m) => 'orden' in m)`, 20);
        check('con el archivo al aire, «Siguiente» y «Anterior» están activos', await run(`return ${big}.textContent.trim() === 'Siguiente' && !${big}.disabled && !${prev}.disabled`));
        await click(big);
        await sleep(400);
        await click(big);
        await sleep(400);
        await click(prev);
        await sleep(400);
        await press('ArrowRight');
        const keys = await echoes(4);
        check('«Siguiente» dos veces, «Anterior» y la flecha derecha del teclado: el marco de la pantalla de proyección recibe las cuatro, en orden', keys === '1→ 2→ 3← 4→' && (await snap()).count === 4, keys);

        // Volver a una presentación: reaparece todo lo suyo.
        await click(label('Presentaciones'));
        await pick((await rows()).find((r) => !r.globe && r.name.includes('Informe')).name);
        await sleep(400);
        check('al elegir una presentación reaparecen «Mover», el siguiente y la rejilla, y el botón vuelve a «Empezar»', await run(`return ${pr}.dataset.view === 'present' && ${pr}.querySelector('.pr-title').textContent.includes('Informe') && ${big}.textContent.trim() === 'Empezar' && ${pr}.querySelector('.pr-hint').textContent.includes('diapositiva') && ${pr}.querySelectorAll('.slide-pick').length === 4`)
          && await seen('[data-tool=move]') && await seen('.pr-next') && await seen('.pr-around .dock-label') && await seen('.pr-grid') && await seen('.slide-pick'));

        // En el celular, con la página al aire (la sigue sola al entrar).
        await chrome.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
        await chrome.send('Page.navigate', { url: `${local}/presentador?p=${Date.now()}` });
        await sleep(2500);
        check('en 375 px, con una página, la grande y sus botones se ven sin desbordar', await run(`const w = 375; /* el ancho pedido, no innerWidth */ const fits = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= w && r.top >= 0 && r.bottom <= innerHeight; }; const t = [...${pr}.querySelectorAll('.pr-main .transport .btn')];
          return ${pr}.dataset.view === 'present' && ${pr}.querySelector('.pr-title').textContent === 'eco de teclas' && t.length === 3 && t.every(fits) && fits(${pr}.querySelector('.pr-live')) && fits(${pr}.querySelector('.pr-tools')) && document.documentElement.scrollWidth <= w`),
        await run(`return document.documentElement.scrollWidth + ' de ' + innerWidth`));
        await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
        // Lo que sigue elimina «eco de teclas»: que no esté al aire.
        await run(`await ${post('projection.show', { kind: 'web', data: { id: ids['Concurso bíblico'] } })}`);
        await chrome.send('Page.navigate', { url: `${local}/control?q=${Date.now()}#paginas` });
        await sleep(2500);
      }

      // Nombre y eliminación.
      await goTo('paginas');
      await sleep(400);
      // Con un nombre largo, que en el celular tiene que cortarse y no ensanchar la página.
      const longName = 'Presentación de la escuela sabática del domingo con un nombre muy largo';
      await pageMenu('Presentación del culto', 'Cambiar el nombre');
      await run(`${modal}.querySelector('input').value = ${JSON.stringify(longName)};`);
      await modalButton('Guardar');
      await sleep(600);
      check('una página se renombra desde su menú «…»', await run(`return !${modal} && Boolean(${entry(longName)}) && !${entry('Presentación del culto')}`) && (await pagesNow()).some((p) => p.name === longName));
      await pageMenu('eco de teclas', 'Eliminar');
      check('«Eliminar» pide confirmación y dice qué se quita', await run(`return ${modal}.textContent.includes('«eco de teclas» se quitará de la biblioteca')`));
      await modalButton('Eliminar');
      await sleep(700);
      check('al confirmar se elimina de la lista y se borra su archivo', await run(`return !${modal} && !${entry('eco de teclas')} && ${ws}.querySelectorAll('.web-item').length === 2 && (await fetch('/paginas/${fileId}')).status === 404`) && (await pagesNow()).length === 2);

      // En el celular.
      await chrome.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await chrome.send('Page.navigate', { url: `${local}/control?w=${Date.now()}#paginas` });
      await sleep(2500);
      await pickPage(longName);
      check('en 375 px, con un nombre largo, la lista y la barra se ven sin desbordar', await run(`const w = 375; /* el ancho pedido, no innerWidth: una página que desborda ensancha el de Chrome */ const fits = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= w; }; const bar = ${ws}.querySelector('.abar');
        return document.documentElement.scrollWidth <= w && ${ws}.querySelectorAll('.web-item').length === 2 && [...${ws}.querySelectorAll('.web-item')].every(fits) && fits(bar) && bar.getBoundingClientRect().bottom <= innerHeight && [...bar.querySelectorAll('button')].every(fits)`),
      await run(`return document.documentElement.scrollWidth + ' de ' + innerWidth`));
      await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
      await chrome.send('Page.navigate', { url: `${local}/control?g=${Date.now()}#paginas` });
      await sleep(2500);
    } finally {
      site.closeAllConnections();
      site.close();
    }
  }

  }

  // ---- Grupo «control» (2): televisores, ajustes, mandos en vivo y alabanza ----
  if (inGroup('control')) {
  console.log('\n1. Interfaz · Televisores');
  // El módulo está en pausa: no sale en la barra, pero sigue ahí y se entra por su dirección.
  check('Televisores, en pausa, no aparece en la barra de módulos', await run(`return !document.querySelector('.dock-item[data-id=televisores]')`));
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
  await goTo('orden');
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
  await goTo('ajustes');
  await sleep(500);
  await run(`const s = document.querySelector('.settings input[type=range]'); s.value = 60; s.dispatchEvent(new Event('input'));`);
  await sleep(500);
  check('los estilos de proyección se aplican', (await live()).size === 60);
  // El tamaño de los subtítulos (los de un video, YouTube o un himno), en Ajustes (S23).
  await run(`const s = [...document.querySelectorAll('.settings .field')].find(f => f.textContent.includes('Tamaño de los subtítulos')).querySelector('input[type=range]'); s.value = 150; s.dispatchEvent(new Event('input'));`);
  await sleep(500);
  check('«Tamaño de los subtítulos» se guarda y agranda los de la proyección', await run(`const s = await (await fetch('/api/state')).json(); return s.projection.styles.subtitleSize === 150 && document.querySelector('.scene-screen').style.getPropertyValue('--cue') === '1.5'`));
  check('Ajustes lista los programas del equipo principal', await run(`return document.querySelectorAll('.tools .tool').length === 6 && Boolean(document.querySelector('.tools .tool[data-id=cloudflared]')) && Boolean(document.querySelector('.tools .tool[data-id=node]'))`));
  await tapEl(`[...document.querySelectorAll('.set-nav .btn')].find(b => b.textContent === 'Programas')`);
  await sleep(800);
  check('la fila de secciones de Ajustes tiene una por sección y lleva a la elegida', await run(`const s = [...document.querySelectorAll('.settings .set')].find(x => x.querySelector('h2').textContent === 'Programas del equipo principal'); const c = document.querySelector('.settings').getBoundingClientRect(); const r = s.getBoundingClientRect(); return document.querySelectorAll('.set-nav .btn').length === document.querySelectorAll('.settings .set').length && Math.abs(r.top - c.top) < 30`));

  if (CAN_TUNNEL) {
    console.log('\n1. Interfaz · Ajustes: conexión por internet');
    // Un túnel de mentira: la dirección y el «Registered tunnel connection» los escribe el guion de cloudflared-falso.
    // La comprobación desde internet entra por MANNA_TUNEL_PRUEBA (el propio servidor): nada sale a internet.
    const net = `[...document.querySelectorAll('.settings .set')].find((s) => s.querySelector('h2').textContent === 'Conexión por internet')`;
    const netState = () => run(`return JSON.stringify((await (await fetch('/api/state')).json()).internet)`).then(JSON.parse);
    const netButtons = () => run(`return ${net}.querySelectorAll('.set-body .row .btn').length`);
    const netBtn = (label) => `[...${net}.querySelectorAll('.set-body .row .btn')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
    const netText = () => run(`return ${net}.querySelector('.set-body > p').textContent`);
    const ownKey = `eyJ${'a1B2'.repeat(15)}`;
    const quickUrl = 'https://manna-de-prueba.trycloudflare.com';
    check('empieza apagada, con sus dos botones', await netText() === 'Apagada.' && await netButtons() === 2 && await run(`return ${netBtn('Encender')}.disabled === false && Boolean(${netBtn('Usar un dominio propio')}) && ${net}.querySelector('.net-address').hidden`));
    await click(netBtn('Encender'));
    check('«Encender» la pasa a encendida y comprobada, con la dirección del túnel y su botón «Copiar»', await until(`${net}.querySelector('.set-body > p').textContent.startsWith('Encendida y comprobada') && ${net}.querySelector('.net-address a').textContent === ${JSON.stringify(quickUrl)}`)
      && await run(`const a = ${net}.querySelector('.net-address'); return !a.hidden && a.querySelector('a').href === ${JSON.stringify(`${quickUrl}/`)} && [...a.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join() === 'Copiar' && ${netBtn('Apagar')} !== undefined`), await netText());
    check('el servidor la da por encendida y la recuerda', (await netState()).status === 'on' && (await netState()).on === true && fs.existsSync(path.join(tmp, 'data', 'tunel.json')));
    // El dominio propio: la clave y la dirección que se le dio en Cloudflare.
    await click(netBtn('Usar un dominio propio'));
    await sleep(300);
    check('«Usar un dominio propio» abre una ventana con la clave y la dirección, sin «Quitar»', await run(`const m = document.querySelector('.modal'); return Boolean(m) && m.querySelector('input[type=password]').getAttribute('aria-label') === 'Clave del túnel' && m.querySelectorAll('.net-own input').length === 2 && ![...m.querySelectorAll('.btn')].some((b) => b.textContent.includes('Quitar'))`));
    await run(`const m = document.querySelector('.modal'); const [k, a] = m.querySelectorAll('.net-own input'); k.value = ${JSON.stringify(ownKey)}; a.value = 'manna.ejemplo.org';`);
    await modalButton('Guardar');
    check('«Guardar» muestra la dirección propia y el botón pasa a «Cambiar el dominio propio»', await until(`${net}.querySelector('.set-body > p').textContent.startsWith('Encendida') && ${net}.querySelector('.net-address a').textContent === 'https://manna.ejemplo.org'`)
      && await run(`return !document.querySelector('.modal') && Boolean(${netBtn('Cambiar el dominio propio')}) && !${netBtn('Usar un dominio propio')}`), await netText());
    const keyAsked = fs.readFileSync(tunnelAsked, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1);
    check('cloudflared recibió la clave por el entorno, no en los argumentos', keyAsked.token === true && keyAsked.args.join(' ') === 'tunnel --no-autoupdate run');
    check('la clave no aparece en el estado ni en la página', await run(`const raw = await (await fetch('/api/state')).text(); return !raw.includes(${JSON.stringify(ownKey)}) && !document.documentElement.outerHTML.includes(${JSON.stringify(ownKey)})`) && (await netState()).own === true);
    // Una clave que Cloudflare no acepta: lo dice con palabras claras.
    await click(netBtn('Cambiar el dominio propio'));
    await sleep(300);
    check('al cambiarlo, la ventana ofrece «Quitar el dominio propio»', await run(`return [...document.querySelectorAll('.modal .btn')].some((b) => b.textContent.trim() === 'Quitar el dominio propio')`));
    await run(`const m = document.querySelector('.modal'); const [k, a] = m.querySelectorAll('.net-own input'); k.value = ${JSON.stringify(`malo${'z'.repeat(50)}`)}; a.value = 'manna.ejemplo.org';`);
    await modalButton('Guardar');
    check('una clave no válida se ve como error', await until(`${net}.querySelector('.set-body > p').classList.contains('warn') && ${net}.querySelector('.set-body > p').textContent.includes('La clave del túnel no es válida')`) && await run(`return ${net}.querySelector('.net-address').hidden`), await netText());
    // Vuelta al túnel rápido.
    await click(netBtn('Cambiar el dominio propio'));
    await sleep(300);
    await modalButton('Quitar el dominio propio');
    check('«Quitar el dominio propio» vuelve al túnel rápido', await until(`${net}.querySelector('.set-body > p').textContent.startsWith('Encendida') && ${net}.querySelector('.net-address a').textContent === ${JSON.stringify(quickUrl)}`)
      && await run(`return Boolean(${netBtn('Usar un dominio propio')}) && !${netBtn('Cambiar el dominio propio')}`) && (await netState()).own === false, await netText());
    // Desde internet (lo que llega por un túnel lleva estas cabeceras) no se cambia.
    const outside = await run(`return await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Prueba': '1', 'Cf-Connecting-Ip': '203.0.113.9', 'X-Forwarded-For': '203.0.113.9' }, body: JSON.stringify({ type: 'internet.set', payload: { on: false } }) }).then((r) => r.status)`);
    check('una orden que llega desde internet no la apaga', outside !== 200 && (await netState()).on === true, `HTTP ${outside}`);
    await click(netBtn('Apagar'));
    check('«Apagar» la deja apagada', await until(`${net}.querySelector('.set-body > p').textContent === 'Apagada.' && ${net}.querySelector('.net-address').hidden && ${netBtn('Encender')}`) && (await netState()).status === 'off' && (await netState()).on === false);
    // También desde el menú de la función (arriba a la derecha), sin ir a Ajustes.
    const netItem = `[...document.querySelectorAll('.menu button')].find((b) => b.textContent.includes('Conexión por internet'))`;
    const netIs = (status) => until(`(await (await fetch('/api/state')).json()).internet.status === ${JSON.stringify(status)}`);
    await click(`document.querySelector('.role-chip')`);
    await sleep(300);
    check('el menú de la función ofrece la conexión por internet y dice que está apagada', await run(`return ${netItem}?.querySelector('small')?.textContent.startsWith('Apagada')`));
    await click(netItem);
    check('desde el menú se enciende', await netIs('on'));
    await click(`document.querySelector('.role-chip')`);
    await sleep(300);
    check('el menú dice que está encendida, y desde ahí se apaga', await run(`return ${netItem}.querySelector('small').textContent.startsWith('Encendida')`) && (await click(netItem), await netIs('off')));
  }

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
    && await run(`const i = new Image(); i.src = ${JSON.stringify(firstBackground)}; await i.decode(); return i.naturalWidth === 2560 && document.querySelector('.scene-bg > .stage .stage-bg').style.background.includes(${JSON.stringify(firstBackground)})`));
  await click(`${sw}.querySelector('[aria-label="Fondo Negro"]')`);
  await sleep(500);
  bg = await styles();
  check('al elegir un color la imagen sigue guardada', bg.type === 'solid' && bg.saved.length === 1 && await run(`return ${sw}.querySelectorAll('.swatch-image').length === 1 && !${sw}.querySelector('.swatch-image.on') && ${sw}.querySelector('[aria-label="Fondo Negro"]').classList.contains('on') && [...document.querySelectorAll('.settings .btn')].find(b => b.textContent.includes('Eliminar esta imagen')).hidden`));
  await chooseFiles('.settings input[type=file]', [smallBackground]);
  check('se pueden guardar varias', await until(`${sw}.querySelectorAll('.swatch-image').length === 2`) && (await styles()).saved.length === 2);
  await click(`${sw}.querySelector('.swatch-image')`);
  await sleep(500);
  check('una imagen guardada se vuelve a poner con un toque', (await styles()).image === firstBackground && await run(`return ${sw}.querySelector('.swatch-image').classList.contains('on')`));
  // De paso, con un versículo al aire: la Biblia se abre por primera vez en esta página.
  await run(`await ${post('projection.show', { kind: 'verses', data: { versionId: VERSION, ref: { book: 43, chapter: 3, verseStart: 16, verseEnd: 16 } } })}`);
  await chrome.send('Page.navigate', { url: `${local}/control?fondos=${Date.now()}#ajustes` });
  await sleep(2500);
  check('las imágenes de fondo siguen ahí al volver a abrir el control', await run(`return ${sw}.querySelectorAll('.swatch-image').length === 2 && ${sw}.querySelector('.swatch-image').classList.contains('on')`));
  // Pasó el 2026-10-17: con algo de la Biblia al aire, abrirla fallaba a medio dibujar; ese trozo quedaba encima del módulo abierto, y otro más en cada intento.
  for (const id of ['biblia', 'ajustes', 'biblia']) { await goTo(id); await sleep(500); }
  check('con un versículo al aire, la Biblia se abre bien la primera vez y no se repite al volver a ella', await run(`const ws = document.querySelectorAll('.work .ws[data-module=biblia]'); return ws.length === 1 && !ws[0].hidden && document.querySelector('.ws[data-module=ajustes]').hidden && ws[0].querySelectorAll('.verse').length > 0`));
  await goTo('ajustes');
  await sleep(300);
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
  const dockControls = LIVE;
  const pressControl = async (label) => { await click(`[...${dockControls}.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(label)}))`); await sleep(500); };
  check('la imagen de prueba sale al aire y el panel muestra sus mandos', (await live()).kind === 'testcard' && (await text('.scene-caption')) === 'Imagen de prueba' && await run(`return !${dockControls}.hidden && ${dockControls}.querySelectorAll('button').length === 5`));
  check('en el escritorio los mandos van siempre a la vista en la barra de abajo, sin capa ni botón «Mandos»', await run(`const b = document.querySelector('.tb-extra'); return !b.hidden && b.getClientRects().length > 0 && b.querySelectorAll('.live-controls button').length === 5 && document.querySelector('.controls-layer').hidden && !document.querySelector('.transport-bar [aria-haspopup=dialog]')`));
  await pressControl('Colores');
  check('un mando cambia lo que se ve', (await live()).pattern === 'barras' && await run(`return document.querySelector('.scene-bg .tc').dataset.pattern === 'barras'`));
  // Una segunda pantalla (la de proyección) dentro de un marco: debe ir a la par con el panel.
  await run(`const f = document.createElement('iframe'); f.id = 'otra'; f.src = '/proyeccion'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:320px;height:180px;z-index:99;border:0'; document.body.append(f);`);
  await sleep(2500);
  await pressControl('Cronómetro');
  await sleep(2200);
  const pair = JSON.parse(await run(`const other = document.querySelector('#otra').contentDocument; return JSON.stringify({ here: document.querySelector('.scene-bg .tc-time').textContent, there: other.querySelector('.tc-time')?.textContent, pattern: other.querySelector('.tc')?.dataset.pattern, at: Date.now() })`));
  const { clock } = await live();
  const expected = clock.position + (pair.at - clock.at) / 1000;
  check('la otra pantalla recibe los mandos', pair.pattern === 'barras');
  check('el reloj va a la par en las dos pantallas', Math.abs(seconds(pair.here) - seconds(pair.there)) <= 0.2, `${pair.here} y ${pair.there}`);
  check('y coincide con el del servidor', clock.playing && Math.abs(seconds(pair.here) - expected) <= 0.4, `${pair.here} frente a ${expected.toFixed(1)} s`);
  await pressControl('Pausar');
  const paused = await text('.scene-bg .tc-time');
  await sleep(700);
  check('en pausa el reloj se detiene', (await live()).clock.playing === false && (await text('.scene-bg .tc-time')) === paused);
  await run(`document.querySelector('#otra').remove()`);
  const card = await run(`const r = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Prueba':'1'},body:JSON.stringify({type:'order.add',payload:{kind:'testcard',data:{}}})}); return (await r.json()).result.id`);
  await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(card)));
  await goTo('orden');
  await sleep(900);
  check('los mandos aparecen también en el detalle del elemento al aire', await run(`const c = document.querySelector('.odetail .live-controls'); return Boolean(c) && !c.hidden && c.querySelectorAll('button').length === 5 && document.querySelector('.orow.live').textContent.includes('Imagen de prueba')`));
  await goTo('ajustes');
  await sleep(400);
  // «Dispositivos» ya no está en el dock: se abre desde el menú de la función, arriba a la derecha.
  check('«Dispositivos» ya no está en el dock', await run(`return !document.querySelector('.dock-item[data-id=dispositivos]')`));
  await click(`document.querySelector('.role-chip')`);
  await sleep(250);
  await menuItem('Dispositivos');
  await sleep(700);
  check('"Dispositivos" muestra un solo QR y el PIN, de 4 números', await run(`const i = document.querySelector('.modal input'); const pin = i.value; i.value = '12a345'; i.dispatchEvent(new Event('input')); const typed = i.value; i.value = pin; return /^\\d{4}$/.test(pin) && document.querySelectorAll('.modal .qr').length === 1 && i.maxLength === 4 && typed === '1234'`));
  await run(`document.querySelector('.modal input').value = '2468';`);
  await modalButton('Cambiar');
  await sleep(600);
  check('el PIN se cambia desde el equipo principal', (await text('#toast')).startsWith('PIN cambiado') && await run(`return (await (await fetch('/api/system/pin')).json()).pin === '2468'`));
  await click(`document.querySelector('.modal-header .icon-btn')`);
  check('sin errores de JavaScript', !chrome.events.some((e) => e.method === 'Runtime.exceptionThrown'));
  await chrome.send('Page.navigate', { url: `${local}/orden#orden` });
  await sleep(2200);
  check('"Control del orden" no ofrece editar ni «Buscar en todo»', await run(`return !document.querySelector('.finder-chip') && !document.querySelector('.ws-head .search') && !document.querySelector('.orow .grip') && !document.querySelector('.orow .icon-btn[aria-label=Opciones]')`));
  check('el servidor rechaza una edición desde esa función', (await run(`return await ${post('order.clear')}`)) === 403);
  check('esa función gobierna lo que está al aire, pero no instala programas', await run(`return !${LIVE}.hidden`) && (await run(`return await ${post('projection.control', { pattern: 'blanco' })}`)) === 200 && (await live()).pattern === 'blanco' && (await run(`return await ${post('tools.install', { id: 'yt-dlp' })}`)) === 403);
  check('tampoco puede encender ni cambiar la conexión por internet', (await run(`return await ${post('internet.set', { on: true })}`)) === 403 && (await run(`return await ${post('internet.own', { token: '' })}`)) === 403);
  await click(`[...document.querySelectorAll('.orow')].find(r => r.textContent.includes('Salmos 23')).querySelector('.icon-btn')`);
  await sleep(600);
  check('pero sí puede proyectar', (await live()).ref === 'Salmos 23:1');

  console.log('\n1. Interfaz · Servicio de alabanza');
  await chrome.send('Page.navigate', { url: `${local}/alabanza` });
  await sleep(2200);
  const praise = `document.querySelector('.transport-bar .tb-volume')`;
  const praiseInView = () => run(`const r = ${praise}.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight`);
  check('"Servicio de alabanza" trae Himnario, Medios, Orden y Biblia, sin Ajustes', await run(`return [...document.querySelectorAll('.dock-item')].map(b => b.dataset.id).join() === 'himnario,medios,orden,biblia'`));
  check('fuera del control, la barra de arriba no lleva el botón del proyector, solo su estado', await run(`return !document.querySelector('.scene-status > .btn') && Boolean(document.querySelector('.scene-status .live-pill'))`));
  check('lleva el volumen de Manna a la vista aunque no suene nada', (await live()).kind === 'verses' && await praiseInView());
  await run(`const s = ${praise}.querySelector('input[type=range]'); s.value = 35; s.dispatchEvent(new Event('input'));`);
  await sleep(700);
  check('ese mando es el volumen general', await run(`return (await (await fetch('/api/state')).json()).live.volume === 0.35`));
  check('puede preparar el orden, pero no tocar los ajustes ni instalar programas', (await run(`return await ${post('order.addSection', { title: 'Alabanza' })}`)) === 200
    && (await run(`return await ${post('projection.styles', { fontSize: 50 })}`)) === 403 && (await run(`return await ${post('tools.install', { id: 'yt-dlp' })}`)) === 403);
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  const storyVolume = () => run(`const e = document.querySelector('.story-volume.big'); const r = e.getBoundingClientRect(); return Boolean(e.querySelector('input[type=range]')) && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight`);
  check('en el celular el volumen, grande, sigue a la vista bajo la proyección, sin abrir nada', await storyVolume() && await run(`return !document.querySelector('.scene-bg > .stage') && Boolean(document.querySelector('.story-frame > .stage')) && !document.body.classList.contains('drawer-open')`));
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await run(`await ${post('projection.volume', { volume: 1 })}`);
  }

  if (!QUICK && inGroup('control')) {
    // El grupo «control» no pasa por Medios: sube un video corto para escucharlo después desde otro dispositivo.
    if (HAS_FFMPEG) {
      const clip = sample('saludo corto.mp4', ['-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=262:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest']);
      const login = await fetch(`http://127.0.0.1:${PORT}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
      const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
      await fetch(`http://127.0.0.1:${PORT}/api/media/clips?name=${encodeURIComponent('Saludo corto')}&ext=.mp4&duration=3`, { method: 'POST', headers: { cookie }, body: fs.readFileSync(clip) });
    }
    // ================= 2. Paso a la dirección con nombre =================
    console.log('\n2. Paso automático a la dirección con nombre');
    await chrome.send('Page.navigate', { url: `${byIp}/` });
    await sleep(4000);
    check('entra por la IP y termina en el nombre', (await chrome.evaluate('location.origin')) === byName, await chrome.evaluate('location.origin'));

    // Por la dirección de la red, este Chrome es «otro dispositivo»: el Inicio pide el PIN con su teclado.
    console.log('\n2. Inicio y PIN desde otro dispositivo');
    const roleCard = (name) => `[...document.querySelectorAll('.role')].find(b => b.querySelector('strong').textContent === ${JSON.stringify(name)})`;
    check('el Inicio enseña cada función en una tarjeta con su icono, y las de control dicen «Pide PIN»', await run(`const cards = [...document.querySelectorAll('.role')]; return cards.length === 5 && cards.every(c => c.querySelector('.role-icon svg')) && ${roleCard('Control del orden')}.querySelector('.tag').textContent === 'Pide PIN' && ${roleCard('Pantalla de proyección')}.querySelector('.tag').textContent === 'Sin PIN'`));
    const pinKey = (label) => click(`[...document.querySelectorAll('.pin-keys button')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)})`);
    await click(roleCard('Control del orden'));
    await sleep(300);
    await chrome.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(300);
    check('el teclado del PIN se cierra con Esc', await run(`return !document.querySelector('.pin-pad')`));
    await click(roleCard('Control del orden'));
    await sleep(300);
    for (const k of ['1', '2', 'Borrar']) await pinKey(k);
    check('el teclado tiene cuatro puntos, marca cada cifra y borra la última', await run(`return document.querySelectorAll('.pin-dots span').length === 4 && document.querySelectorAll('.pin-dots span.on').length === 1`));
    await pinKey('Borrar');
    const realPin = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'sesiones.json'), 'utf8')).pin;
    const wrongPin = realPin === '1111' ? '2222' : '1111';
    for (const k of wrongPin) await pinKey(k);
    await sleep(600);
    check('al teclear la cuarta cifra entra solo: un PIN equivocado lo dice, pone los puntos en rojo y vacía el teclado', await run(`const p = document.querySelector('.pin-pad'); return p.classList.contains('wrong') && p.querySelector('.pin-error').textContent === 'PIN incorrecto.' && !document.querySelector('.pin-dots span.on')`));
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await sleep(300);
    check('en 375 px el teclado cabe entero, con teclas grandes', await run(`const m = document.querySelector('.modal').getBoundingClientRect(); return m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight && [...document.querySelectorAll('.pin-keys button')].every(b => b.offsetHeight >= 44 && b.offsetWidth >= 44)`));
    for (const k of realPin) await pinKey(k);
    await sleep(1500);
    check('con el PIN bueno entra en la función elegida', (await chrome.evaluate('location.pathname')) === '/orden');

    // Desde otro dispositivo (Control completo, en el celular): escuchar antes de añadir, solo en este dispositivo.
    // En el equipo principal estos botones no salen.
    console.log('\n2. Escuchar en otro dispositivo');
    await run(`return (await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control', pin: ${JSON.stringify(realPin)} }) })).status`);
    await chrome.send('Page.navigate', { url: `${byName}/control?e=${Date.now()}` });
    await sleep(2500);
    await run(`return await ${post('projection.show', { kind: 'song', data: { number: 9, track: 'vocal' } })}`);
    await sleep(1500);
    // «Escuchar aquí» se quitó (2026-10-16: en un celular de verdad se oía a saltos). La proyección de fondo de otro
    // dispositivo muestra la imagen de lo que suena, sin reproducirlo.
    check('en otro dispositivo no hay «Escuchar aquí», y la proyección de fondo no reproduce el himno al aire', await run(`const a = document.querySelector('.scene-screen video'); return !document.querySelector('.listen-btn') && (!a || a.paused || a.muted)`));
    await goTo('himnario');
    await sleep(1200);
    await click(`document.querySelector('.ws[data-module=himnario] .hymn[data-n="3"]')`);
    await sleep(400);
    await tapEl(`document.querySelector('.hymn-listen')`);
    await sleep(1200);
    const pv = () => run(`const b = document.querySelector('.preview-bar'); const a = b.querySelector('audio'); return JSON.stringify({ shown: !b.hidden && b.getClientRects().length > 0, title: b.querySelector('strong').textContent, src: a.getAttribute('src'), paused: a.paused })`).then(JSON.parse);
    let heardBefore = await pv();
    check('en el Himnario, «Escuchar» lo oye solo aquí, en una barra arriba, sin proyectarlo', heardBefore.shown && heardBefore.title.startsWith('3 · ') && /\/himnos\/003/.test(heardBefore.src || '') && heardBefore.paused === false
      && (await run(`return (await (await fetch('/api/state')).json()).projection.item.number`)) === 9, JSON.stringify(heardBefore));
    await tapEl(`document.querySelector('.preview-bar .pv-close')`);
    await sleep(300);
    check('su × la cierra y deja de sonar', !(await pv()).shown && (await pv()).src === null);
    // En Medios, un video ya convertido se puede escuchar aquí.
    await goTo('medios');
    await sleep(800);
    if (HAS_FFMPEG) {
    const clipUrl = await run(`const v = (await (await fetch('/api/state')).json()).media.videos.find((c) => c.url); if (!v) return ''; document.querySelector(\`.media-list[data-panel=videos] .media-card[data-id="\${v.id}"] .media-pick\`).click(); return v.url`);
    await sleep(400);
    await tapEl(`document.querySelector('.media-bar[data-panel=videos] .media-listen')`);
    await sleep(1000);
    heardBefore = await pv();
    check('en Medios, «Escuchar» oye aquí el video elegido', Boolean(clipUrl) && heardBefore.shown && heardBefore.src === clipUrl, JSON.stringify({ clipUrl, heardBefore }));
    }
    // En el orden del culto, un himno se puede escuchar desde su elemento.
    await run(`return await ${post('order.add', { kind: 'song', data: { number: 5, track: 'vocal' } })}`);
    await goTo('orden');
    await sleep(1000);
    await click(`[...document.querySelectorAll('.olist .orow')].find((r) => r.textContent.includes(${JSON.stringify(hymnTitle(5))}))`);
    await sleep(800);
    await tapEl(`document.querySelector('.odetail [aria-label="Escuchar en este dispositivo"]')`);
    await sleep(1200);
    heardBefore = await pv();
    check('en el Orden, el elemento de un himno se puede escuchar aquí antes de pasarlo', heardBefore.shown && /\/himnos\/005/.test(heardBefore.src || ''), JSON.stringify(heardBefore));
    await run(`document.querySelector('.drawer-backdrop').click()`);
    await sleep(300);
    check('al cerrar el cajón, la escucha se detiene', !(await pv()).shown);
    // Se sale del control (aceptando el «¿Salir del sitio?») para que lo siguiente empiece sin ventanas abiertas.
    chrome.acceptDialogs = true;
    await chrome.send('Page.navigate', { url: `${byName}/` });
    await sleep(1500);
    await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });

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

  }

  if (!QUICK && inGroup('red')) {
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
    check('recupera lo que estaba en pantalla', /Salmos 23:1/.test(await text('.scene-caption')));
    check('acepta órdenes sin volver a pedir el PIN', (await run(`return await ${post('projection.mode', { mode: 'black' })}`)) === 200);
  }

  // ---- Grupo «biblioteca»: el cierre ----
  if (inGroup('biblioteca')) {
  // ================= 5. Lo que cierra la sesión =================
  // Un Manna que "arrancó con el código de antes" (huella fingida): debe notarlo y decirlo.
  await stopServer(server);
  // De paso, sin ffmpeg: para ver cómo se comporta Medios en un equipo que no lo tiene.
  server = startServer(null, { MANNA_HUELLA: 'de-antes', MANNA_REVISAR_CODIGO_MS: '300', MANNA_FALTA: 'ffmpeg,yt-dlp,powerpoint,cloudflared' });
  await sleep(3000);
  await chrome.send('Page.navigate', { url: `${local}/control?fin=${Date.now()}#orden` });
  await sleep(2500);

  // ---- Órdenes guardados (fase 23): el servidor acaba de arrancar de nuevo (sin apagarse), así que el orden sin nombre empieza vacío ----
  console.log('\n5. Órdenes guardados');
  {
    const sw = `document.querySelector('.ws[data-module=orden] .order-switch')`;
    const queueName = `document.querySelector('.queue-head .queue-name')`;
    const other = `document.querySelector('#otro').contentDocument`;
    const orderNow = () => run(`const o = (await (await fetch('/api/state')).json()).order; return JSON.stringify({ name: o.name, active: o.active, draft: o.draft, items: o.items.length, saved: o.saved.map((s) => s.name + ':' + s.count) })`).then(JSON.parse);
    const topModal = `[...document.querySelectorAll('.modal')].at(-1)`;
    const rowOf = (name) => `[...document.querySelectorAll('.order-saved')].find((r) => r.querySelector('strong').textContent === ${JSON.stringify(name)})`;
    const rowBtn = (name, label) => click(`[...${rowOf(name)}.querySelectorAll('.btn')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`);
    const inTop = (label) => click(`[...${topModal}.querySelectorAll('.btn')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`);
    const rowMenu = async (name, label) => { await click(`${rowOf(name)}.querySelector('.icon-btn')`); await sleep(300); await menuItem(label); await sleep(400); };
    const typeName = (value) => run(`${topModal}.querySelector('input').value = ${JSON.stringify(value)};`);
    const addCards = async (n) => { for (let i = 0; i < n; i += 1) await run(`return await ${post('order.add', { kind: 'testcard', data: {} })}`); await sleep(400); };
    // El nombre que propone «Guardar con un nombre»: «Sábado 18/10/26 19:30».
    const two = (n) => String(n).padStart(2, '0');
    const stamp = (d) => `${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()]} ${two(d.getDate())}/${two(d.getMonth() + 1)}/${two(d.getFullYear() % 100)} ${two(d.getHours())}:${two(d.getMinutes())}`;
    // Otra pestaña de control (otro dispositivo): su cola tiene que cambiar con la del primero.
    await run(`const f = document.createElement('iframe'); f.id = 'otro'; f.src = '/control#orden'; f.style.cssText = 'position:fixed;left:0;bottom:0;width:1100px;height:600px;z-index:99;border:0;visibility:hidden;pointer-events:none'; document.body.append(f);`);
    await until(`document.querySelector('#otro').contentDocument.querySelector('.queue-head')`, 30);
    await sleep(500);
    const names = (expected) => run(`return ${queueName}.textContent === ${JSON.stringify(expected)} && ${other}.querySelector('.queue-head .queue-name').textContent === ${JSON.stringify(expected)} && ${sw}.textContent.trim() === ${JSON.stringify(expected || 'Sin nombre')}`);
    const hidden = () => run(`return ${queueName}.getClientRects().length === 0 && getComputedStyle(${other}.querySelector('.queue-head .queue-name')).display === 'none'`);
    let now = await orderNow();
    check('al empezar, el orden sin nombre está en uso: la cabecera lo dice y la cola no muestra ningún nombre, en las dos pestañas', now.active === null && now.saved.length === 0 && await run(`return ${sw}.tagName === 'BUTTON'`) && await names('') && await hidden(), JSON.stringify(now));
    await addCards(2);
    await run(`return await ${post('order.addSection', { title: 'Mensaje' })}`);
    await sleep(300);
    await click(sw);
    await sleep(500);
    check('el botón de la cabecera abre «Órdenes guardados»: el sin nombre, en uso, con los elementos que tiene y «Guardar con un nombre»', await run(`const r = ${rowOf('Sin nombre')}; return ${topModal}.querySelector('h2').textContent === 'Órdenes guardados' && document.querySelectorAll('.order-saved').length === 1 && r.dataset.id === '' && r.classList.contains('on') && r.querySelector('.badge').textContent === 'En uso' && r.querySelector('small').textContent === '2 elementos · se vacía al cerrar Manna' && [...r.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join() === 'Guardar con un nombre' && !r.querySelector('.icon-btn')`));
    const askedAt = [stamp(new Date())];
    await rowBtn('Sin nombre', 'Guardar con un nombre');
    await sleep(400);
    askedAt.push(stamp(new Date()));
    const proposal = await run(`return ${topModal}.querySelector('input').value`);
    check('propone un nombre con el día, la fecha y la hora («Sábado 18/10/26 19:30»)', /^(Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado) \d\d\/\d\d\/\d\d \d\d:\d\d$/.test(proposal) && askedAt.includes(proposal), `${proposal} · ${askedAt.join(' / ')}`);
    await modalButton('Guardar');
    await sleep(700);
    now = await orderNow();
    check('«Guardar» deja el orden con ese nombre, sigue en uso y lo ven las dos pestañas (cabecera y cola)', now.name === proposal && Boolean(now.active) && now.draft === 0 && now.items === 3 && now.saved.join() === `${proposal}:2` && await names(proposal), JSON.stringify(now));
    check('en la lista, el guardado queda en uso (con ⋯) y el sin nombre vuelve a estar vacío y con «Usar»', await run(`const a = ${rowOf(proposal)}; const d = ${rowOf('Sin nombre')}; return a.classList.contains('on') && a.querySelector('.badge').textContent === 'En uso' && Boolean(a.querySelector('.icon-btn')) && ![...a.querySelectorAll('.btn')].some((b) => b.textContent.trim() === 'Usar') && !d.classList.contains('on') && [...d.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join() === 'Usar' && d.querySelector('small').textContent.startsWith('0 elementos')`));
    const first = proposal;

    // Nuevo orden, con el guardado en uso: no se pierde nada.
    await modalButton('Nuevo orden');
    await sleep(400);
    check('«Nuevo orden» con un guardado en uso dice que queda guardado y no habla de vaciar nada', await run(`const t = ${topModal}.querySelector('p').textContent; return ${topModal}.querySelector('h2').textContent === 'Nuevo orden' && t.includes('«${first}» queda guardado') && !t.includes('se vaciará') && [...${topModal}.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join() === 'Cancelar,Empezar uno nuevo'`));
    await inTop('Empezar uno nuevo');
    await sleep(600);
    now = await orderNow();
    check('«Empezar uno nuevo» pone en uso el sin nombre, vacío, y el guardado sigue ahí; la cola de la otra pestaña también se vacía', now.active === null && now.items === 0 && now.saved.join() === `${first}:2` && await names('') && await hidden(), JSON.stringify(now));

    // Nuevo orden, con elementos en el sin nombre: «Guardarlo antes».
    await addCards(2);
    await modalButton('Nuevo orden');
    await sleep(400);
    check('«Nuevo orden» con elementos sin guardar avisa de que se vaciarán y ofrece «Guardarlo antes»', await run(`const t = ${topModal}.querySelector('p').textContent; return t.includes('tiene 2 elementos y se vaciará') && [...${topModal}.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join() === 'Cancelar,Guardarlo antes,Vaciarlo y empezar'`));
    await inTop('Guardarlo antes');
    await sleep(400);
    await typeName('Culto de la tarde');
    await modalButton('Guardar');
    await sleep(800);
    now = await orderNow();
    check('«Guardarlo antes» lo guarda con el nombre que se escriba y empieza uno nuevo, vacío', now.active === null && now.items === 0 && now.draft === 0 && now.saved.join() === `${first}:2,Culto de la tarde:2` && await names(''), JSON.stringify(now));
    await addCards(1);
    await modalButton('Nuevo orden');
    await sleep(400);
    await inTop('Vaciarlo y empezar');
    await sleep(600);
    now = await orderNow();
    check('«Vaciarlo y empezar» deja el sin nombre vacío sin tocar los guardados', now.active === null && now.items === 0 && now.draft === 0 && now.saved.length === 2, JSON.stringify(now));
    await modalButton('Nuevo orden');
    await sleep(400);
    check('y con el sin nombre ya vacío, «Nuevo orden» solo lo dice, sin pedir nada', (await text('#toast')).includes('Ya estás en un orden nuevo') && await run(`return document.querySelectorAll('.modal').length === 1`), await text('#toast'));

    // Usar otro orden: pide confirmación, y la cola de las dos pestañas cambia y muestra su nombre.
    await rowBtn(first, 'Usar');
    await sleep(400);
    check('«Usar» pide confirmación y dice qué cambia para todos', await run(`const t = ${topModal}.querySelector('p').textContent; return ${topModal}.querySelector('h2').textContent === 'Cambiar de orden' && t.includes('«${first}»') && t.includes('Todos los dispositivos')`));
    await inTop('Cancelar');
    await sleep(300);
    check('«Cancelar» no cambia nada', (await orderNow()).active === null && await run(`return document.querySelectorAll('.modal').length === 1`));
    await rowBtn(first, 'Usar');
    await sleep(400);
    await inTop('Usar este orden');
    await sleep(700);
    now = await orderNow();
    check('«Usar este orden» lo pone en la cola de las dos pestañas, con su nombre y sus elementos', now.name === first && now.items === 3 && await names(first) && await run(`return !(${queueName}.getClientRects().length === 0) && ${rowOf(first)}.classList.contains('on')`), JSON.stringify(now));
    await rowBtn('Sin nombre', 'Usar');
    await sleep(400);
    check('«Usar» el sin nombre lo dice así', await run(`return ${topModal}.querySelector('p').textContent.includes('el orden sin nombre')`));
    await inTop('Usar este orden');
    await sleep(700);
    now = await orderNow();
    check('y la cola vuelve al sin nombre: sin nombre y vacía, en las dos pestañas', now.active === null && now.items === 0 && await names('') && await hidden(), JSON.stringify(now));

    // Cambiar el nombre y duplicar.
    await rowMenu('Culto de la tarde', 'Cambiar el nombre');
    check('«Cambiar el nombre» propone el nombre de ahora', await run(`return ${topModal}.querySelector('h2').textContent === 'Cambiar el nombre' && ${topModal}.querySelector('input').value === 'Culto de la tarde'`));
    await typeName('Culto vespertino');
    await modalButton('Guardar');
    await sleep(700);
    now = await orderNow();
    check('el nombre cambia en la lista y en el servidor', now.saved.join() === `${first}:2,Culto vespertino:2` && await run(`return Boolean(${rowOf('Culto vespertino')}) && !${rowOf('Culto de la tarde')}`), JSON.stringify(now));
    await rowMenu(first, 'Duplicar');
    check('«Duplicar» propone «nombre (copia)»', await run(`return ${topModal}.querySelector('h2').textContent === 'Duplicar el orden' && ${topModal}.querySelector('input').value === ${JSON.stringify(`${first} (copia)`)}`));
    await modalButton('Guardar');
    await sleep(700);
    now = await orderNow();
    check('la copia queda guardada con sus elementos y no se pone en uso', now.saved.join() === `${first}:2,Culto vespertino:2,${first} (copia):2` && now.active === null && await run(`return Boolean(${rowOf(`${first} (copia)`)}) && !${rowOf(`${first} (copia)`)}.classList.contains('on')`), JSON.stringify(now));

    // Eliminar el que está en uso: la cola pasa al sin nombre.
    await rowBtn(`${first} (copia)`, 'Usar');
    await sleep(400);
    await inTop('Usar este orden');
    await sleep(700);
    await rowMenu(`${first} (copia)`, 'Eliminar');
    check('«Eliminar» pide confirmación y, si está en uso, avisa de que la cola pasa al sin nombre', await run(`const t = ${topModal}.querySelector('p').textContent; return ${topModal}.querySelector('h2').textContent === 'Eliminar el orden' && t.includes('Como está en uso') && t.includes('orden sin nombre')`));
    await inTop('Eliminar');
    await sleep(700);
    now = await orderNow();
    check('al eliminar el que estaba en uso, la cola pasa al sin nombre (en las dos pestañas) y los demás siguen guardados', now.active === null && now.items === 0 && now.saved.join() === `${first}:2,Culto vespertino:2` && await names('') && await hidden() && await run(`return !${rowOf(`${first} (copia)`)} && ${rowOf('Sin nombre')}.classList.contains('on')`), JSON.stringify(now));
    await click(`document.querySelector('.modal-header .icon-btn')`);
    await sleep(300);
    await run(`document.querySelector('#otro').remove()`);

    // Sin permiso de editar («Control del orden») solo se ve el nombre del orden en uso.
    const vesperId = await run(`return (await (await fetch('/api/state')).json()).order.saved.find((o) => o.name === 'Culto vespertino').id`);
    await run(`return await ${post('order.use', { id: vesperId })}`);
    await chrome.send('Page.navigate', { url: `${local}/orden?x=${Date.now()}#orden` });
    await sleep(2500);
    check('en «Control del orden» no hay botón ni ventana: solo se ve el nombre del orden en uso', await run(`const e = document.querySelector('.order-switch'); e.click(); return e.tagName === 'SPAN' && e.textContent.trim() === 'Culto vespertino' && !document.querySelector('button.order-switch') && !document.querySelector('.modal')`));
    await chrome.send('Page.navigate', { url: `${local}/control?fin2=${Date.now()}#orden` });
    await sleep(2500);
  }
  console.log('\n5. Orden del culto: secciones, quitar y vaciar');
  const ord = `document.querySelector('.ws[data-module=orden]')`;
  const orderRows = () => run(`return ${ord}.querySelectorAll('.orow').length`);
  await run(`return await ${post('order.use', {})}`);
  await run(`return await ${post('order.clear', {})}`);
  for (let i = 0; i < 2; i += 1) await run(`return await ${post('order.add', { kind: 'testcard', data: {} })}`);
  await sleep(500);
  await click(`[...${ord}.querySelectorAll('.ws-head .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(300);
  check('"Añadir" ofrece Medios en una sola entrada: ya no hay Video, Imagen o audio ni Diapositivas por separado', await run(`const t = [...document.querySelectorAll('.menu button')].map((b) => b.textContent); return t.length >= 5 && t.some((x) => x.startsWith('Medios')) && !t.some((x) => /^(Video|Imagen|Diapositivas)/.test(x))`));
  await menuItem('Medios');
  await sleep(500);
  check('y de ahí se llega a la biblioteca de Medios', (await chrome.evaluate('document.title')) === 'Manna · Medios');
  await goTo('orden');
  await sleep(400);
  await click(`[...${ord}.querySelectorAll('.ws-head .btn')].find(b => b.textContent.includes('Añadir'))`);
  await sleep(300);
  await menuItem('Página web');
  await sleep(500);
  check('y a las páginas web', (await chrome.evaluate('document.title')) === 'Manna · Páginas web');
  await goTo('orden');
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
    await goTo('medios');
    await sleep(400);
    const vids = `document.querySelector('.ws[data-module=medios] .media-list[data-panel=videos]')`;
    const notice = `document.querySelector('.ws-notice')`;
    check('Medios avisa de que sin ffmpeg no podrá convertir (y sin yt-dlp, descargar de YouTube)', await run(`return !${notice}.hidden && /Faltan? ffmpeg/.test(${notice}.textContent) && ${notice}.textContent.includes('convertir') && ${notice}.textContent.includes('YouTube')`), await text('.ws-notice'));
    const before = await run(`return ${vids}.querySelectorAll('.media-card').length`);
    const dummy = path.join(tmp, 'grabacion antigua.avi');
    fs.writeFileSync(dummy, Buffer.alloc(4000, 3));
    await chooseFiles(MEDIA_FILES, [path.join(tmp, 'video_de-bienvenida.mp4'), dummy]);
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
  await goTo('himnario');
  check('sin ffmpeg el himnario avisa de que no habrá pista, y los himnos se proyectan cantados', await until(`document.querySelectorAll('.ws[data-module=himnario] .hymn').length === 13`, 20) && await (async () => {
    await click(`document.querySelector('.ws[data-module=himnario] .hymn[data-n="2"]')`);
    await sleep(400);
    return run(`const n = document.querySelector('.ws-notice'); const c = document.querySelector('.hymn-sound [data-track=instrumental]'); return !n.hidden && n.textContent.includes('Falta ffmpeg') && n.textContent.includes('pista instrumental') && c.disabled && c.title.includes('ffmpeg') && document.querySelector('.hymn-sound [data-track=vocal]').classList.contains('on')`);
  })());

  console.log('\n5. Diapositivas en un equipo sin PowerPoint');
  await openSlides();
  const withoutPpt = path.join(tmp, 'sermon del sabado.pptx');
  fs.writeFileSync(withoutPpt, fakePresentation());
  await chooseFiles(MEDIA_FILES, [withoutPpt]);
  await sleep(600);
  check('sin PowerPoint, al elegir uno se explica cómo guardarlo como PDF, sin subir nada, y Medios no avisa por PowerPoint (los PDF sí funcionan)', await run(`return ${modal}.querySelector('h2').textContent === 'Hace falta el PDF de la presentación' && ${modal}.textContent.includes('Exportar') && !${modal}.querySelector('input') && !document.querySelector('.ws-notice').textContent.includes('PowerPoint')`));
  await modalButton('Entendido');
  check('y lo que ya estaba en la biblioteca sigue ahí tras reabrir Manna', await run(`return document.querySelectorAll('.decks[data-panel=diapositivas] .deck[data-status=ready]').length === 1`));

  console.log('\n5. Actualización con Manna abierto, reinicio y apagado');
  const bar = `document.querySelector('.update-bar')`;
  check('si el programa se actualizó con Manna abierto, todas las pantallas de control lo avisan', await until(`!${bar}.hidden`) && await run(`return ${bar}.textContent.includes('Manna se actualizó mientras estaba abierto') && (await (await fetch('/api/state')).json()).system.stale === true`));
  await chrome.evaluate('window.__marca = true');
  await click(`[...${bar}.querySelectorAll('.btn')].find(b => b.textContent.includes('Reiniciar ahora'))`);
  await sleep(300);
  await modalButton('Reiniciar ahora');
  // Manna se cierra y vuelve a abrirse solo; la página nota que el servidor es otro y se carga de nuevo.
  const back = await until(`window.__marca !== true && document.body.classList.contains('app') && !document.body.classList.contains('offline')`, 60);
  const after = back ? JSON.parse(await run(`const s = (await (await fetch('/api/state')).json()).system; return JSON.stringify({ stale: s.stale, build: s.build })`)) : {};
  check('"Reiniciar ahora" lo vuelve a abrir con el código nuevo, y la página se recarga sola', back && after.stale === false && after.build !== 'de-antes' && await run(`return ${bar}.hidden`), JSON.stringify(after));
  await goTo('ajustes');
  await sleep(500);
  check('Ajustes ofrece reiniciar y apagar', await run(`const b = [...document.querySelectorAll('.settings .btn')].map(x => x.textContent); return b.includes('Reiniciar Manna') && b.includes('Apagar Manna')`));
  await click(`[...document.querySelectorAll('.settings .btn')].find(b => b.textContent === 'Apagar Manna')`);
  await sleep(300);
  await modalButton('Apagar Manna');
  await sleep(1500);
  const gone = await fetch(`http://127.0.0.1:${PORT}/api/ping`, { signal: AbortSignal.timeout(800) }).then(() => false, () => true);
  check('"Apagar Manna" lo apaga y lo dice', gone && await run(`return document.querySelector('.goodbye h1')?.textContent === 'Manna está apagado'`));

  }

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
  check('la lista de lo que no se puede pulsar aquí está al día', stale.length === 0, stale.join(', '));
  // Lo que este grupo no usó: el guion que lanzó los grupos se queda con lo que no usó ninguno.
  fs.writeFileSync(process.env.MANNA_PRUEBA_VIGILANCIA, JSON.stringify({ idle, quiet }));
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
