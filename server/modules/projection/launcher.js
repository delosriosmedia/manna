import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function candidates() {
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((r) => [
      path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
}

// Navegador tipo Chrome instalado en el equipo servidor, o null.
export function findBrowser() {
  return candidates().find((p) => fs.existsSync(p)) || null;
}

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
