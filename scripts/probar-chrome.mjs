// Pruebas en un Chrome real (sin ventana) de lo que no se puede comprobar con las pruebas
// automáticas ni con un navegador integrado que bloquee nombres ".local" o cuadros de diálogo:
//
//   1. Al entrar por la dirección numérica, la página pasa sola a la dirección con nombre.
//   2. El navegador pide confirmación al salir de la pestaña de control.
//   3. Con un dispositivo conectado por el nombre, el equipo principal "cambia de IP" y el
//      dispositivo reconecta solo, sin recargar y sin volver a pedir el PIN.
//
// Uso:  node scripts/probar-chrome.mjs        (tarda unos 2 minutos)
// Necesita Node 22 o superior (WebSocket integrado) y Chrome o Edge. No toca los datos reales:
// usa el puerto 8123, el nombre "manna-prueba.local" y una carpeta de datos temporal.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanInterfaces } from '../server/modules/system/network.js';
import { sleep, startChrome } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const NAME = 'manna-prueba';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-chrome-'));

const ip = (await lanInterfaces())[0]?.address;
if (!ip) {
  console.error('Este equipo no está conectado a ninguna red: no se puede probar.');
  process.exit(1);
}
const byIp = `http://${ip}:${PORT}`;
const byName = `http://${NAME}.local:${PORT}`;

// ---- Servidor de prueba ----
function startServer(host) {
  const env = { ...process.env, MANNA_NAME: NAME, MANNA_NO_OPEN: '1', MANNA_DATA: path.join(tmp, 'data'), PORT: String(PORT) };
  if (host) env.MANNA_HOST = host;
  return spawn(process.execPath, ['server/index.js'], { cwd: ROOT, stdio: 'ignore', env });
}
const stopServer = (child) => new Promise((resolve) => {
  child.on('exit', resolve);
  child.kill();
});

const action = (type, payload) => `fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({ type, payload })})}).then(r=>r.status)`;
const dialogShown = (chrome) => chrome.events.some((e) => e.method === 'Page.javascriptDialogOpening');

let failed = 0;
function check(label, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` (${detail})` : ''}`);
}

let server = startServer();
await sleep(3000);
let chrome = await startChrome();
try {
  console.log('\n1. Paso automático a la dirección con nombre');
  await chrome.send('Page.navigate', { url: `${byIp}/` });
  await sleep(4000);
  check('entra por la IP y termina en el nombre', (await chrome.evaluate('location.origin')) === byName, await chrome.evaluate('location.origin'));

  console.log('\n2. Confirmación al salir del control');
  await chrome.send('Page.navigate', { url: `http://localhost:${PORT}/control` });
  await sleep(2500);
  for (const type of ['mousePressed', 'mouseReleased']) await chrome.send('Input.dispatchMouseEvent', { type, x: 600, y: 300, button: 'left', clickCount: 1 });
  await sleep(300);
  chrome.events.length = 0;
  chrome.send('Page.navigate', { url: 'about:blank' });
  await sleep(1000);
  check('pide confirmación al salir tras haber hecho un clic', dialogShown(chrome));
  await chrome.send('Page.handleJavaScriptDialog', { accept: false });
  await sleep(500);
  chrome.events.length = 0;
  await chrome.evaluate('document.querySelector("a.brand").click()');
  await sleep(1200);
  check('"cambiar de función" no pide confirmación', !dialogShown(chrome) && (await chrome.evaluate('location.pathname')) === '/');

  console.log('\n3. Cambio de IP del equipo principal (IP vieja: 127.0.0.1, IP nueva: la de la red)');
  await stopServer(server);
  server = startServer('127.0.0.1');
  // Chrome nuevo: el anterior recordaría durante un minuto la dirección del paso 1.
  chrome.close();
  chrome = await startChrome();
  await sleep(3000);
  await chrome.send('Page.navigate', { url: `${byName}/control` });
  await sleep(3000);
  await chrome.evaluate('window.__marca = true');
  const shown = await chrome.evaluate(action('projection.show', { versionId: 'reina-valera-1909', ref: { book: 19, chapter: 23, verseStart: 1, verseEnd: 1 } }));
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
  check('recupera lo que estaba en pantalla', /Salmos 23:1/.test(await chrome.evaluate('document.querySelector("#live-label").textContent')));
  check('acepta órdenes sin volver a pedir el PIN', (await chrome.evaluate(action('projection.mode', { mode: 'black' }))) === 200);
} finally {
  chrome.close();
  await stopServer(server);
  await sleep(800);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}

console.log(failed ? `\n${failed} comprobación(es) fallaron.` : '\nTodo correcto.');
process.exit(failed ? 1 : 0);
