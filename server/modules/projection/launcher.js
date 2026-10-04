import { spawn } from 'node:child_process';
import { findBrowser } from '../../core/tools.js';

// Abre una ventana a pantalla completa (modo kiosco) sobre la pantalla indicada.
// Usa un perfil propio para no mezclarse con el Chrome del usuario.
export function openKiosk({ url, screen, profileDir, onExit }) {
  const browser = findBrowser();
  if (!browser) return null;
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
    url,
  ], { stdio: 'ignore' });
  child.on('exit', () => onExit?.());
  child.on('error', () => onExit?.());
  return child;
}
