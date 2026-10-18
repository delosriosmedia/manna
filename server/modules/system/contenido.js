import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';

// La carpeta de contenido de la iglesia (fase 29): elegirla con la ventana del sistema, guardarla, prepararla y
// abrirla, en el equipo principal. Cambiarla no reinicia Manna: app.setContent avisa a cada módulo.

// Dónde se guarda la elegida: instalado, en carpetas.json (la lee también el instalador); en una copia sin instalar,
// en data/ajustes.json. server/app.js la lee al arrancar.
const placesFile = (app) => (path.basename(app.rootDir) === 'programa' ? path.join(app.rootDir, '..', 'carpetas.json') : null);
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; } };

export function contentState(app) {
  const places = placesFile(app);
  const chosen = places ? readJson(places)?.elegida === true : Boolean(app.settings.data.contenido);
  return { dir: app.contentDir, chosen, exists: Boolean(app.contentDir) && fs.existsSync(app.contentDir) };
}

function remember(app, dir) {
  const places = placesFile(app);
  if (places) {
    const data = readJson(places) || {};
    fs.writeFileSync(places, JSON.stringify({ ...data, contenido: dir, elegida: true }, null, 2));
  } else {
    app.settings.data.contenido = dir;
    app.settings.save();
  }
}

// ¿Parece una carpeta de contenido? Tiene alguna de sus tres carpetas.
export const looksLikeContent = (dir) => ['Biblias', 'Himnario', 'Medios'].some((name) => fs.existsSync(path.join(dir, name)));

// Le añade lo que le falte: sus carpetas, las instrucciones (LEEME.txt) y la Reina-Valera 1909, que trae el programa.
// Nunca reemplaza, mueve ni borra nada.
export function prepareContent(dir, programContent) {
  for (const sub of ['Biblias', 'Himnario/videos', 'Himnario/letras', 'Himnario/diapositivas', 'Medios']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  // Lo que el programa trae de Contenido/ (lo único de esa carpeta que se publica en GitHub).
  for (const rel of ['LEEME.txt', 'Biblias/LEEME.txt', 'Biblias/Reina Valera 1909.xmm', 'Himnario/LEEME.txt', 'Himnario/videos/LEEME.txt', 'Himnario/letras/LEEME.txt', 'Medios/LEEME.txt']) {
    try { fs.copyFileSync(path.join(programContent, rel), path.join(dir, rel), fs.constants.COPYFILE_EXCL); } catch { /* ya estaba, o el programa no lo trae */ }
  }
}

// La ventana del sistema para elegir una carpeta. Devuelve la ruta, o null si se cerró sin elegir.
// MANNA_CARPETA_PRUEBA (solo para pruebas): la ruta que «elige» la persona, sin abrir ninguna ventana.
const MAC_PICK = `on run argv
  activate
  try
    return POSIX path of (choose folder with prompt "Elige la carpeta de contenido de tu iglesia (con Biblias, Himnario y Medios)" default location (POSIX file (item 1 of argv)))
  on error number -128
    return ""
  end try
end run`;
const WIN_PICK = `
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Elige la carpeta de contenido de tu iglesia (con Biblias, Himnario y Medios)'
$dialog.ShowNewFolderButton = $true
if ($env:MANNA_CARPETA_ACTUAL -and (Test-Path -LiteralPath $env:MANNA_CARPETA_ACTUAL)) { $dialog.SelectedPath = $env:MANNA_CARPETA_ACTUAL }
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }
$owner.Dispose()
`;

export function pickPlan(current, platform = process.platform) {
  if (platform === 'darwin') return { file: 'osascript', args: ['-e', MAC_PICK, current], env: {} };
  if (platform === 'win32') return { file: 'powershell.exe', args: ['-STA', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WIN_PICK, 'utf16le').toString('base64')], env: { MANNA_CARPETA_ACTUAL: current } };
  return null;
}

export function pickFolder(current) {
  if (process.env.MANNA_CARPETA_PRUEBA) return Promise.resolve(process.env.MANNA_CARPETA_PRUEBA);
  const plan = pickPlan(current || '');
  if (!plan) return Promise.reject(new HttpError(501, 'En este equipo no se puede abrir la ventana para elegir carpetas.'));
  return new Promise((resolve, reject) => {
    // Sin límite de tiempo corto: la persona puede tardar en encontrar su carpeta.
    execFile(plan.file, plan.args, { env: { ...process.env, ...plan.env }, timeout: 10 * 60_000, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        console.error(`No se pudo abrir la ventana para elegir la carpeta: ${String(stderr || err.message).trim().slice(0, 300)}`);
        return reject(new HttpError(500, 'No se pudo abrir la ventana para elegir la carpeta.'));
      }
      const chosen = stdout.replace(/\r/g, '').trim();
      resolve(chosen ? chosen.replace(/[\\/]+$/, '') || chosen : null);
    });
  });
}

// La abre en el Explorador o el Finder. No en las pruebas (MANNA_NO_OPEN), como el navegador.
export function openFolder(dir) {
  if (process.env.MANNA_NO_OPEN) return;
  const [file, args] = process.platform === 'darwin' ? ['open', [dir]] : process.platform === 'win32' ? ['explorer', [dir]] : ['xdg-open', [dir]];
  spawn(file, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

// Cambia la carpeta de contenido: comprueba que exista, la prepara, la guarda y avisa a los módulos.
export function useContent(app, dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new HttpError(400, 'Esa carpeta no es válida.');
  let stat = null;
  try { stat = fs.statSync(dir); } catch { /* no existe */ }
  if (!stat?.isDirectory()) throw new HttpError(404, 'Esa carpeta no existe.');
  const inside = (parent) => { const rel = path.relative(parent, dir); return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
  if (inside(app.dataDir)) throw new HttpError(400, 'Esa es la carpeta de los datos de Manna, no la del contenido.');
  prepareContent(dir, path.join(app.rootDir, 'Contenido'));
  remember(app, dir);
  app.setContent(dir);
}
