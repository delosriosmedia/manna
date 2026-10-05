// Pruebas de extremo a extremo en un Chrome real (sin ventana). Cubren lo que no alcanzan
// las pruebas automáticas ni un navegador integrado:
//
//   0. La revisión del equipo: avisa de los programas que faltan y de qué módulos afecta, instala
//      uno mostrando el avance y no bloquea la app; dentro, el módulo afectado también avisa.
//      La descarga sale de un servidor de mentira en este mismo equipo.
//   1. La interfaz: Biblia (búsqueda por niveles), comparador de versiones, orden del culto (con
//      nombres propios), medios (subir imágenes, ajuste, encuadre al aire en dos pantallas),
//      televisores (con uno de mentira), mandos en vivo que van a la par en dos
//      pantallas, ajustes y la función "Control del orden". También que Manna atiende por https.
//   2. Al entrar por la dirección numérica, la página pasa sola a la dirección con nombre.
//   3. El navegador pide confirmación al salir de la pestaña de control.
//   4. Con un dispositivo conectado por el nombre, el equipo principal "cambia de IP" y el
//      dispositivo reconecta solo, sin recargar y sin volver a pedir el PIN.
//
// Uso:  node scripts/probar-chrome.mjs          (unos 3 minutos)
//       node scripts/probar-chrome.mjs rapido   (pasos 0 y 1, menos de un minuto)
// Necesita Node 22 o superior (WebSocket integrado) y Chrome o Edge. No toca los datos reales:
// usa los puertos 8123 y 8125, el nombre "manna-prueba.local" y carpetas temporales de datos y de
// biblias (la Reina-Valera 1909 del repositorio y una versión de prueba de dos versículos).
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanInterfaces } from '../server/modules/system/network.js';
import { sleep, startChrome } from './lib/chrome.mjs';
import { startFakeTv } from './lib/tv-falso.mjs';
import { examplePoster } from './lib/png.mjs';

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

// ---- Servidor de prueba ----
// Los televisores de la prueba son uno de mentira en este equipo: nada sale a la red.
const fakeTv = await startFakeTv();
function startServer(host, extra = {}) {
  const env = { ...process.env, MANNA_NAME: NAME, MANNA_NO_OPEN: '1', MANNA_DATA: path.join(tmp, 'data'), MANNA_BIBLIAS: bibles, PORT: String(PORT), MANNA_TV_PRUEBA: JSON.stringify(fakeTv.endpoints), ...extra };
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
// Un Manna aparte al que "le faltan" yt-dlp y el navegador, y un sitio de descargas de mentira que
// entrega despacio un programa mínimo, para ver el avance. En Windows no se ejecuta: el programa
// de mentira es de consola Unix.
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
  const until = async (js, tries = 40) => { for (let i = 0; i < tries; i += 1) { if (await run(`return Boolean(${js})`)) return true; await sleep(400); } return false; };
  check('sin imágenes, invita a subirlas', await run(`return ${med}.querySelector('.empty').textContent.includes('Aún no hay imágenes') && ${med}.querySelector('.media-bar').hidden`));
  // Dos imágenes hechas aquí mismo: una apaisada más grande de lo que se guarda y un cartel vertical.
  const wide = path.join(tmp, 'anuncios_de-octubre.png');
  const tall = path.join(tmp, 'cartel vertical.png');
  fs.writeFileSync(wide, examplePoster(3000, 1000));
  fs.writeFileSync(tall, examplePoster(600, 900, [[15, 118, 110], [202, 138, 4]]));
  const doc = await chrome.send('DOM.getDocument', {});
  const input = await chrome.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.ws[data-module=medios] input[type=file]' });
  await chrome.send('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [wide, tall] });
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
  // En el celular los módulos no caben todos en la barra: los cuatro primeros y "Más".
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  check('en el celular, la barra muestra cuatro módulos y "Más"', await run(`return [...document.querySelectorAll('.tabbar button')].map(b => b.textContent).join('|') === 'Orden|Biblia|Comparador|Medios|Más' && document.querySelector('.tabbar button.on').textContent === 'Medios'`));
  await click(`document.querySelector('.tabbar .tab-more')`);
  await sleep(300);
  const moreItems = await run(`return [...document.querySelectorAll('.menu button')].map(b => b.textContent).join('|')`);
  await click(`[...document.querySelectorAll('.menu button')].find(b => b.textContent === 'Ajustes')`);
  await sleep(500);
  check('"Más" abre los demás módulos y queda marcada cuando se está en uno de ellos', moreItems === 'Televisores|Ajustes' && (await chrome.evaluate('document.title')) === 'Manna · Ajustes' && await run(`return document.querySelector('.tabbar .tab-more').classList.contains('on') && !document.querySelector('.tabbar button[data-id].on')`), moreItems);
  await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(400);

  console.log('\n1. Interfaz · Televisores');
  await click(`document.querySelector('.rail-item[data-id=televisores]')`);
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
  await addTv('8.8.8.8');
  check('solo admite direcciones de la red local', (await toastText()).includes('dirección del televisor') && await run(`return Boolean(${modal})`));
  await addTv('192.168.1.50');
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
  await click(`${modal}.querySelector('.modal-header .icon-btn')`);
  check('Manna atiende también por https en el mismo puerto', await run(`const s = await (await fetch('/api/state')).json(); return s.system.secure === true`) && await new Promise((resolve) => {
    import('node:https').then(({ default: https }) => https.get({ host: '127.0.0.1', port: PORT, path: '/api/ping', rejectUnauthorized: false, agent: false }, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false)));
  }));
  await click(`${tvCard}.querySelector('.icon-btn')`);
  await sleep(300);
  await click(`[...document.querySelectorAll('.menu button')].find(b => b.textContent.includes('Quitar'))`);
  await sleep(500);
  check('el televisor se puede quitar de la lista', await run(`return !${tvs}.querySelector('.tv') && Boolean(${tvs}.querySelector('.empty'))`));

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
  const card = await run(`const r = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'order.add',payload:{kind:'testcard',data:{}}})}); return (await r.json()).result.id`);
  await run(`await ${post('order.show', { id: 'ID' })}`.replace('"ID"', JSON.stringify(card)));
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
  await fakeTv.stop();
  await sleep(800);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}

console.log(failed ? `\n${failed} comprobación(es) fallaron.` : '\nTodo correcto.');
process.exit(failed ? 1 : 0);
