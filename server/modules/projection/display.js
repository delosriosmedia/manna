import { execFile } from 'node:child_process';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 8000, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

// macOS: NSScreen da el origen abajo-izquierda; se convierte a arriba-izquierda, que es lo que usa Chrome.
const MAC_SCRIPT = `
ObjC.import('AppKit');
var screens = $.NSScreen.screens, out = [];
var mainH = screens.objectAtIndex(0).frame.size.height;
for (var i = 0; i < screens.count; i++) {
  var f = screens.objectAtIndex(i).frame;
  out.push({ x: f.origin.x, y: mainH - (f.origin.y + f.size.height), width: f.size.width, height: f.size.height, primary: i === 0 });
}
JSON.stringify(out);`;

const WIN_SCRIPT = 'Add-Type -AssemblyName System.Windows.Forms; '
  + '[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { '
  + '"$($_.Bounds.X),$($_.Bounds.Y),$($_.Bounds.Width),$($_.Bounds.Height),$($_.Primary)" }';

async function macScreens() {
  return JSON.parse(await run('osascript', ['-l', 'JavaScript', '-e', MAC_SCRIPT]));
}

async function winScreens() {
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPT]);
  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    const [x, y, width, height, primary] = line.trim().split(',');
    return { x: Number(x), y: Number(y), width: Number(width), height: Number(height), primary: primary === 'True' };
  });
}

async function linuxScreens() {
  const out = await run('xrandr', ['--query']);
  return [...out.matchAll(/ connected( primary)? (\d+)x(\d+)\+(\d+)\+(\d+)/g)].map((m) => ({
    x: Number(m[4]), y: Number(m[5]), width: Number(m[2]), height: Number(m[3]), primary: Boolean(m[1]),
  }));
}

// Lista las pantallas conectadas al equipo servidor. { supported: false } si no se pudo consultar.
export async function listScreens() {
  try {
    const screens = process.platform === 'darwin' ? await macScreens()
      : process.platform === 'win32' ? await winScreens()
      : await linuxScreens();
    return { supported: true, screens };
  } catch {
    return { supported: false, screens: [] };
  }
}

// La pantalla de proyección es siempre una que NO sea la principal.
export function secondScreen(screens) {
  return screens.find((s) => !s.primary) || null;
}
