// Control de un Chrome real sin ventana, por el protocolo DevTools, sin dependencias.
// Lo usan los scripts de desarrollo (pruebas en Chrome, generación de iconos).
// Necesita Node 22 o superior, por el WebSocket integrado.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { findBrowser } from '../../server/core/tools.js';

export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Lo que un guion lanza (el Chrome, los servidores de prueba) se cierra con él, también si lo
// cortan a medias. Sin esto quedaba un Chrome sin ventana abierto, y como el puerto de control era
// fijo, la prueba siguiente se enganchaba a ese Chrome viejo, con sus páginas aún conectadas.
const children = new Set();
let guarded = false;
export function killOnExit(child) {
  children.add(child);
  child.once('exit', () => children.delete(child));
  if (guarded) return child;
  guarded = true;
  process.on('exit', () => { for (const one of children) one.kill(); });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));
  return child;
}

// Tiempo máximo de un guion de pruebas (regla del dueño, 2026-10-18: una auditoría se quedó más de una hora en un
// bucle y nadie lo miró). Si se pasa, se corta con un error que dice dónde estaba (where()), y killOnExit cierra lo
// que lanzó, en vez de quedarse esperando sin que nadie lo note.
export function deadline(minutes, name, where = () => '') {
  setTimeout(() => {
    const at = where();
    console.error(`\n✖ ${name} pasó de ${minutes} min sin terminar: se corta.${at ? ` Iba por: ${at}` : ''}`);
    process.exit(3);
  }, minutes * 60_000).unref();
}

// Un puerto que nadie usa ahora mismo.
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

// Devuelve { send, evaluate, events, close, acceptDialogs, lastError }.
//   send(method, params)  orden del protocolo DevTools
//   evaluate(expresión)   ejecuta JavaScript en la página y devuelve el valor (undefined si lanza un error,
//                         con el motivo en lastError)
//   events                eventos recibidos (por ejemplo, cuadros de diálogo)
//   acceptDialogs         si es true, acepta solo el aviso "¿Salir del sitio?"; sin ello,
//                         una navegación se queda esperando a que alguien responda
// args: más opciones para este Chrome (p. ej., la pestaña que elige solo al compartir una).
export async function startChrome({ args = [] } = {}) {
  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-chrome-'));
  // --mute-audio: lo que las pruebas reproducen no suena en este equipo (los reproductores de la
  // página se comportan igual: solo se calla la salida del navegador).
  const child = killOnExit(spawn(findBrowser(), ['--headless=new', '--mute-audio', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--window-size=1280,800', ...args, 'about:blank'], { stdio: 'ignore' }));
  // Si el guion sale de golpe (su tiempo máximo, Ctrl+C, un error), el perfil se borra igual: quedaban de 15 a 70 MB por
  // Chrome en la carpeta temporal, 4,9 GB en un día de pruebas (auditoría integral, N2-6-4). Va después de killOnExit,
  // que cierra antes ese Chrome.
  process.once('exit', () => { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* lo limpia el sistema */ } });

  let target;
  for (let i = 0; i < 50 && !target; i += 1) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* aún arrancando */ }
  }
  if (!target) throw new Error('Chrome no arrancó.');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  const events = [];
  const chrome = { events, acceptDialogs: false };
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id) return pending.get(msg.id)?.(msg);
    events.push(msg);
    if (msg.method === 'Page.javascriptDialogOpening' && chrome.acceptDialogs) send('Page.handleJavaScriptDialog', { accept: true });
  };
  // Una orden que Chrome no contesta en 60 s hace fallar el guion en vez de dejarlo esperando: el 2026-10-15
  // una ventana «¿Salir del sitio?» sin aceptar dejó la prueba colgada casi dos horas.
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    const mine = id;
    const timer = setTimeout(() => {
      pending.delete(mine);
      reject(new Error(`Chrome no contestó a ${method} en 60 s (¿hay una ventana de aviso abierta en la página?)`));
    }, 60_000);
    pending.set(mine, (msg) => { clearTimeout(timer); pending.delete(mine); resolve(msg); });
    ws.send(JSON.stringify({ id: mine, method, params }));
  });
  // Si lo evaluado lanza un error, da undefined y deja el motivo en chrome.lastError. Antes daba el error como
  // valor ({}), que es verdadero, y así pasaban las comprobaciones rotas (auditoría integral, T1-02).
  const evaluate = async (expression) => {
    chrome.lastError = '';
    const reply = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result;
    if (!reply?.exceptionDetails) return reply?.result?.value;
    chrome.lastError = (reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'error en la página').split('\n')[0];
    return undefined;
  };
  await send('Page.enable');

  const close = () => {
    ws.close();
    child.kill();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 }), 800);
  };
  return Object.assign(chrome, { send, evaluate, close });
}
