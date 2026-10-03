// Control de un Chrome real sin ventana, por el protocolo DevTools, sin dependencias.
// Lo usan los scripts de desarrollo (pruebas en Chrome, generación de iconos).
// Necesita Node 22 o superior, por el WebSocket integrado.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findBrowser } from '../../server/modules/projection/launcher.js';

export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

let runs = 0;

// Devuelve { send, evaluate, events, close }.
//   send(method, params)  orden del protocolo DevTools
//   evaluate(expresión)   ejecuta JavaScript en la página y devuelve el valor
//   events                eventos recibidos (por ejemplo, cuadros de diálogo)
export async function startChrome({ port = 9333 } = {}) {
  runs += 1;
  const debugPort = port + runs;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-chrome-'));
  const child = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });

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
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id) pending.get(msg.id)?.(msg);
    else events.push(msg);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send('Page.enable');

  const close = () => {
    ws.close();
    child.kill();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 }), 800);
  };
  return { send, evaluate, events, close };
}
