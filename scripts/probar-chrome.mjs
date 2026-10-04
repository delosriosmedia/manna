// Pruebas de extremo a extremo en un Chrome real (sin ventana). Cubren lo que no alcanzan
// las pruebas automáticas ni un navegador integrado:
//
//   0. La revisión del equipo: avisa de un programa que falta, lo instala mostrando el avance
//      y deja pasar a la app. La descarga sale de un servidor de mentira en este mismo equipo.
//   1. La interfaz: Biblia, orden del culto (con nombres propios), mandos en vivo que van a la
//      par en dos pantallas, ajustes y la función "Control del orden".
//   2. Al entrar por la dirección numérica, la página pasa sola a la dirección con nombre.
//   3. El navegador pide confirmación al salir de la pestaña de control.
//   4. Con un dispositivo conectado por el nombre, el equipo principal "cambia de IP" y el
//      dispositivo reconecta solo, sin recargar y sin volver a pedir el PIN.
//
// Uso:  node scripts/probar-chrome.mjs          (unos 3 minutos)
//       node scripts/probar-chrome.mjs rapido   (pasos 0 y 1, menos de un minuto)
// Necesita Node 22 o superior (WebSocket integrado) y Chrome o Edge. No toca los datos reales:
// usa los puertos 8123 y 8125, el nombre "manna-prueba.local" y una carpeta de datos temporal.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanInterfaces } from '../server/modules/system/network.js';
import { sleep, startChrome } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const NAME = 'manna-prueba';
const QUICK = process.argv.includes('rapido');
const VERSION = 'reina-valera-1909';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-chrome-'));

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

// ---- Servidor de prueba ----
function startServer(host, extra = {}) {
  const env = { ...process.env, MANNA_NAME: NAME, MANNA_NO_OPEN: '1', MANNA_DATA: path.join(tmp, 'data'), PORT: String(PORT), ...extra };
  if (host) env.MANNA_HOST = host;
  return spawn(process.execPath, ['server/index.js'], { cwd: ROOT, stdio: 'ignore', env });
}
const stopServer = (child) => new Promise((resolve) => {
  child.on('exit', resolve);
  child.kill();
});

let failed = 0;
function check(label, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` (${detail})` : ''}`);
}

let chrome;
const run = (js) => chrome.evaluate(`(async () => { ${js} })()`);
const post = (type, payload = {}) => `fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({ type, payload })})}).then(r=>r.status)`;
const live = async () => JSON.parse(await run(`const s = await (await fetch('/api/state')).json(); return JSON.stringify({ mode: s.projection.mode, ref: s.projection.item?.reference, kind: s.projection.item?.kind, order: s.order.items.map(i => i.title), size: s.projection.styles.fontSize, pattern: s.live.state?.pattern, clock: s.live.state?.clock })`));
// "1:02.5" -> 62.5
const seconds = (text) => String(text).split(':').reduce((total, part) => total * 60 + Number(part), 0);
const CODES = { Enter: 13, ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37, b: 66 };
async function press(key) {
  for (const type of ['keyDown', 'keyUp']) await chrome.send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: CODES[key] });
  await sleep(450);
}
const type = (selector, value) => run(`const i = document.querySelector(${JSON.stringify(selector)}); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));`);
const click = (js) => run(`${js}.click()`);
const text = (selector) => run(`return document.querySelector(${JSON.stringify(selector)})?.textContent`);

// ================= 0. Revisión del equipo =================
// Un Manna aparte al que "le falta" yt-dlp, y un sitio de descargas de mentira que entrega despacio
// un programa mínimo, para ver el avance. En Windows no se ejecuta: el programa de mentira es de consola Unix.
async function reviewSection() {
  console.log('\n0. Revisión del equipo');
  const program = Buffer.from(`#!/bin/sh\necho 2026.01.01\n${'#'.repeat(60_000)}\n`);
  const sums = `${crypto.createHash('sha256').update(program).digest('hex')}  yt-dlp-prueba\n`;
  const downloads = http.createServer(async (req, res) => {
    if (req.url === '/SUMAS') return res.end(sums);
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
    PORT: '8125', MANNA_NAME: 'manna-revision', MANNA_DATA: path.join(tmp, 'revision'), MANNA_FALTA: 'yt-dlp',
    MANNA_DESCARGAS: JSON.stringify({ 'yt-dlp': { url: `${from}/yt-dlp-prueba`, sums: `${from}/SUMAS`, file: 'yt-dlp', size: '60 KB' } }),
  });
  try {
    await sleep(3000);
    await chrome.send('Page.navigate', { url: 'http://localhost:8125/requisitos' });
    await sleep(2000);
    const card = `document.querySelector('.req[data-id="yt-dlp"]')`;
    check('la revisión lista los cuatro programas y marca el que falta', await run(`return document.querySelectorAll('.req').length === 4 && ${card}.classList.contains('missing') && document.querySelectorAll('.req.missing').length >= 1`));
    check('explica para qué sirve y cómo instalarlo a mano', await run(`return ${card}.textContent.includes('YouTube') && Boolean(${card}.querySelector('details code'))`));
    check('deja continuar sin él, avisando', await run(`return document.querySelector('#footer a').textContent === 'Continuar sin instalarlo' && document.querySelector('#lead').textContent.includes('algunas funciones')`));
    await click(`[...${card}.querySelectorAll('button')].find(b => b.textContent.includes('Instalar por mí'))`);
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
    const pending = await run(`return (await (await fetch('/api/state')).json()).tools.pending`);
    if (pending === 0) {
      check('con todo instalado ofrece abrir Manna', await run(`return document.querySelector('#footer a').textContent === 'Abrir Manna' && document.querySelector('#lead').textContent.includes('todo lo necesario')`));
    } else {
      console.log('  · a este equipo le falta además otro programa: no se comprueba el mensaje de "todo listo"');
    }
    await click(`document.querySelector('#footer a')`);
    await sleep(2000);
    check('y de ahí se pasa al control', (await chrome.evaluate('location.pathname')) === '/control' && await run(`return Boolean(document.querySelector('.rail'))`));
    check('sin errores de JavaScript en la revisión', !chrome.events.some((e) => e.method === 'Runtime.exceptionThrown'));
  } finally {
    await stopServer(review);
    downloads.close();
  }
}

let server = startServer();
await sleep(3000);
chrome = await startChrome();
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
  await type('.ws[data-module=biblia] .search input', 'pastor');
  await sleep(900);
  check('la búsqueda por palabra muestra resultados', await run(`return document.querySelectorAll('.search-pop .search-item').length > 5`));
  await click(`document.querySelector('.search-pop .icon-btn')`);
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

  console.log('\n1. Interfaz · Ajustes, dispositivos y permisos');
  await click(`document.querySelector('.rail-item[data-id=ajustes]')`);
  await sleep(500);
  await run(`const s = document.querySelector('.settings input[type=range]'); s.value = 60; s.dispatchEvent(new Event('input'));`);
  await sleep(500);
  check('los estilos de proyección se aplican', (await live()).size === 60);
  check('Ajustes lista los programas del equipo principal', await run(`return document.querySelectorAll('.tools .tool').length === 4`));

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
  const added = await run(`const r = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'order.add',payload:{kind:'testcard',data:{}}})}); return (await r.json()).result.id`);
  await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(added)));
  await click(`document.querySelector('.rail-item[data-id=orden]')`);
  await sleep(900);
  check('los mandos aparecen también en el detalle del elemento al aire', await run(`const c = document.querySelector('.odetail .live-controls'); return Boolean(c) && !c.hidden && c.querySelectorAll('button').length === 5 && document.querySelector('.orow.live').textContent.includes('Imagen de prueba')`));
  await click(`document.querySelector('.rail-item[data-id=ajustes]')`);
  await sleep(400);
  await click(`document.querySelector('.rail-item[data-id=dispositivos]')`);
  await sleep(700);
  check('"Dispositivos" muestra un solo QR y el PIN', await run(`return document.querySelectorAll('.modal .qr').length === 1 && document.querySelector('.modal input').value.length >= 4`));
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
    chrome.events.length = 0;
    chrome.send('Page.navigate', { url: 'about:blank' });
    await sleep(1000);
    check('pide confirmación al salir tras haber hecho un clic', asked());
    await chrome.send('Page.handleJavaScriptDialog', { accept: false });
    await sleep(500);
    chrome.events.length = 0;
    await click(`document.querySelector('a.brand-mark')`);
    await sleep(1200);
    check('"cambiar de función" no pide confirmación', !asked() && (await chrome.evaluate('location.pathname')) === '/');

    // ================= 4. Cambio de IP =================
    console.log('\n4. Cambio de IP del equipo principal (IP vieja: 127.0.0.1, IP nueva: la de la red)');
    await stopServer(server);
    server = startServer('127.0.0.1');
    // Chrome nuevo: el anterior recordaría durante un minuto la dirección del paso 2.
    chrome.close();
    chrome = await startChrome();
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
} finally {
  chrome.close();
  await stopServer(server);
  await sleep(800);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}

console.log(failed ? `\n${failed} comprobación(es) fallaron.` : '\nTodo correcto.');
process.exit(failed ? 1 : 0);
