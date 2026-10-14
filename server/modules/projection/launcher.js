import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findBrowser } from '../../core/tools.js';
import { openWebSocket } from '../../core/ws.js';

const KEY_CODES = { ArrowLeft: 37, ArrowRight: 39 };

// Abre una ventana a pantalla completa (modo kiosco) sobre la pantalla indicada.
// Usa un perfil propio para no mezclarse con el Chrome del usuario.
// debug: acepta teclas (sendKeys) por el protocolo de depuración de Chrome, que solo escucha en
// 127.0.0.1 y solo mientras la ventana existe. El puerto lo elige Chrome y lo apunta en su perfil.
export function openKiosk({ url, screen, profileDir, onExit, debug = false }) {
  const browser = findBrowser();
  if (!browser) return null;
  if (debug) fs.rmSync(path.join(profileDir, 'DevToolsActivePort'), { force: true });
  const child = spawn(browser, [
    `--user-data-dir=${profileDir}`,
    `--window-position=${Math.round(screen.x)},${Math.round(screen.y)}`,
    `--window-size=${Math.round(screen.width)},${Math.round(screen.height)}`,
    '--kiosk',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-session-crashed-bubble',
    '--disable-infobars',
    '--noerrdialogs',
    '--disable-translate',
    '--autoplay-policy=no-user-gesture-required',
    ...(debug ? ['--remote-debugging-port=0'] : []),
    url,
  ], { stdio: 'ignore' });
  child.on('exit', () => onExit?.());
  child.on('error', () => onExit?.());
  return child;
}

// Pulsa teclas (solo las flechas) en la página de una ventana abierta con debug, como si se pulsaran
// en su teclado. Devuelve false si la ventana aún no está lista o ya no existe.
export async function sendKeys(profileDir, keys) {
  try {
    const port = Number(fs.readFileSync(path.join(profileDir, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })).json();
    // La página, no las propias de Chrome (chrome://…) que pueda abrir por su cuenta.
    const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('chrome'));
    if (!page) return false;
    const ws = await openWebSocket(page.webSocketDebuggerUrl, { timeout: 3000 });
    let id = 0;
    for (const key of keys.filter((k) => KEY_CODES[k])) {
      for (const type of ['keyDown', 'keyUp']) {
        id += 1;
        ws.send(JSON.stringify({ id, method: 'Input.dispatchKeyEvent', params: { type, key, code: key, windowsVirtualKeyCode: KEY_CODES[key], nativeVirtualKeyCode: KEY_CODES[key] } }));
      }
    }
    // Se cierra cuando Chrome ha respondido a la última (o al cabo de 2 s).
    await new Promise((resolve) => {
      ws.on('message', (text) => { if (JSON.parse(text).id === id) resolve(); });
      ws.on('close', resolve);
      setTimeout(resolve, 2000);
    });
    ws.close();
    return true;
  } catch {
    return false;
  }
}
