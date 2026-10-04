import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { HttpError } from './router.js';
import { installTool } from './install.js';

// Programas del equipo principal que Manna usa pero no incluye: el navegador de la proyección,
// ffmpeg, yt-dlp y PowerPoint. Este es el único lugar que los busca, los instala y los ejecuta.
//
// Cada uno tiene un nivel:
//   required  sin él Manna no puede trabajar: no se entra a la app hasta que esté
//   feature   lo necesita alguna función: se avisa al abrir, y se puede continuar sin él
//   optional  recomendado: solo se informa
//
// Manna puede descargar ffmpeg y yt-dlp por su cuenta, a data/herramientas/, sin tocar el sistema.

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const PLATFORM = WIN ? 'win32' : MAC ? 'darwin' : 'other';

function browserCandidates() {
  if (MAC) {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  if (WIN) {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((r) => [
      path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
}

// Navegador tipo Chrome instalado en el equipo principal, o null.
export function findBrowser() {
  return browserCandidates().find((p) => fs.existsSync(p)) || null;
}

// Ejecuta un programa y devuelve lo que escribe, o null si falla. Siempre con lista de argumentos.
function output(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 8000, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve(err ? null : `${stdout}${stderr}`);
    });
  });
}

// Dónde se busca un ejecutable: primero en la carpeta de Manna y luego en el equipo.
// Se añaden las carpetas habituales porque, al abrir Manna desde el icono, el sistema no
// siempre entrega el PATH completo (y uno recién instalado no aparece hasta reiniciar).
function searchDirs(toolsDir, withSystem) {
  const dirs = [toolsDir];
  if (withSystem) {
    dirs.push(...(process.env.PATH || '').split(path.delimiter));
    if (WIN) {
      const { LOCALAPPDATA, PROGRAMDATA, PROGRAMFILES } = process.env;
      dirs.push(
        LOCALAPPDATA && path.join(LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'),
        PROGRAMFILES && path.join(PROGRAMFILES, 'ffmpeg', 'bin'),
        'C:\\ffmpeg\\bin',
        PROGRAMDATA && path.join(PROGRAMDATA, 'chocolatey', 'bin'),
        path.join(os.homedir(), 'scoop', 'shims'),
      );
    } else {
      dirs.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', path.join(os.homedir(), '.local', 'bin'));
    }
  }
  return [...new Set(dirs.filter(Boolean))];
}

function findBinary(name, dirs) {
  // En Windows solo .exe: los .cmd y .bat no se pueden ejecutar sin pasar por una consola.
  const fileName = WIN ? `${name}.exe` : name;
  for (const dir of dirs) {
    const file = path.join(dir, fileName);
    try { if (fs.statSync(file).isFile()) return file; } catch { /* no está aquí */ }
  }
  return null;
}

async function findPowerPoint() {
  if (MAC) {
    return ['/Applications', path.join(os.homedir(), 'Applications')]
      .map((dir) => path.join(dir, 'Microsoft PowerPoint.app'))
      .find((app) => fs.existsSync(app)) || null;
  }
  if (!WIN) return null;
  // Windows anota dónde está cada programa instalado; si no, se mira en las carpetas de Office.
  const reg = await output('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\powerpnt.exe', '/ve']);
  const noted = reg && /REG_SZ\s+(.+?)\s*$/m.exec(reg)?.[1];
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean);
  const usual = roots.flatMap((r) => ['root\\Office16', 'Office16', 'Office15'].map((v) => path.join(r, 'Microsoft Office', v, 'POWERPNT.EXE')));
  return [noted, ...usual].filter(Boolean).find((p) => fs.existsSync(p)) || null;
}

// Descargas oficiales para "Instalar por mí". Si un sistema no figura, se instala a mano.
const YT = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
const OFFICIAL = {
  ffmpeg: {
    win32: {
      url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
      sha256: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256',
      extract: ['ffmpeg.exe', 'ffprobe.exe'],
      size: '115 MB',
    },
  },
  'yt-dlp': {
    win32: { url: `${YT}/yt-dlp.exe`, sums: `${YT}/SHA2-256SUMS`, file: 'yt-dlp.exe', size: '18 MB' },
    darwin: { url: `${YT}/yt-dlp_macos`, sums: `${YT}/SHA2-256SUMS`, file: 'yt-dlp', size: '37 MB' },
  },
};

// Solo para pruebas: MANNA_DESCARGAS='{"yt-dlp":{"url":"http://127.0.0.1:9000/x","file":"yt-dlp"}}'
// sustituye una descarga por otra servida en el propio equipo, para probar sin internet.
function downloadsFor(platform) {
  const table = {};
  for (const [id, byPlatform] of Object.entries(OFFICIAL)) if (byPlatform[platform]) table[id] = byPlatform[platform];
  try { Object.assign(table, JSON.parse(process.env.MANNA_DESCARGAS || '{}')); } catch { /* valor no válido: se ignora */ }
  return table;
}

const AFTER_COMMAND = 'Cuando termine, vuelve aquí y pulsa "Volver a comprobar".';
const terminal = {
  win32: 'Abre el menú Inicio, escribe "PowerShell" y ábrelo.',
  darwin: 'Abre la app Terminal (está en Aplicaciones, dentro de Utilidades).',
};

const CATALOG = [
  {
    id: 'navegador',
    name: WIN ? 'Google Chrome o Microsoft Edge' : 'Google Chrome',
    level: 'required',
    purpose: 'Abre la ventana de proyección a pantalla completa en el proyector.',
    link: 'https://www.google.com/chrome/',
    manual: {
      win32: { steps: ['Descarga Chrome con el botón e instálalo normalmente.', 'Vuelve aquí y pulsa "Volver a comprobar".'] },
      darwin: { steps: ['Descarga Chrome con el botón y arrástralo a la carpeta Aplicaciones.', 'Vuelve aquí y pulsa "Volver a comprobar".'] },
      other: { steps: ['Instala Chrome o Chromium con el gestor de programas de tu sistema.'] },
    },
    find: async () => {
      const file = findBrowser();
      return file ? { file, detail: /edge/i.test(file) ? 'Microsoft Edge' : /brave/i.test(file) ? 'Brave' : /chromium/i.test(file) ? 'Chromium' : 'Google Chrome' } : null;
    },
  },
  {
    id: 'ffmpeg',
    name: 'ffmpeg',
    level: 'feature',
    purpose: 'Convierte los videos y audios que el navegador no reproduce, une la imagen y el sonido de YouTube y permite elegir la pista de los himnos.',
    link: 'https://ffmpeg.org/download.html',
    binaries: ['ffmpeg', 'ffprobe'],
    version: { args: ['-version'], pattern: /ffmpeg version (\S+)/ },
    manual: {
      win32: { steps: [terminal.win32, 'Copia esta orden, pégala y pulsa Enter:', AFTER_COMMAND], command: 'winget install --id Gyan.FFmpeg -e' },
      darwin: { steps: [terminal.darwin, 'Copia esta orden, pégala y pulsa Enter (necesita Homebrew, de brew.sh):', AFTER_COMMAND], command: 'brew install ffmpeg' },
      other: { steps: ['Instala el paquete "ffmpeg" con el gestor de programas de tu sistema.'] },
    },
  },
  {
    id: 'yt-dlp',
    name: 'yt-dlp',
    level: 'feature',
    purpose: 'Descarga los videos de YouTube para proyectarlos sin anuncios ni cortes.',
    link: 'https://github.com/yt-dlp/yt-dlp#installation',
    binaries: ['yt-dlp'],
    version: { args: ['--version'], pattern: /^\s*(\S+)/ },
    manual: {
      win32: { steps: [terminal.win32, 'Copia esta orden, pégala y pulsa Enter:', AFTER_COMMAND], command: 'winget install --id yt-dlp.yt-dlp -e' },
      darwin: { steps: [terminal.darwin, 'Copia esta orden, pégala y pulsa Enter (necesita Homebrew, de brew.sh):', AFTER_COMMAND], command: 'brew install yt-dlp' },
      other: { steps: ['Instala el paquete "yt-dlp" con el gestor de programas de tu sistema.'] },
    },
  },
  {
    id: 'powerpoint',
    name: 'Microsoft PowerPoint',
    level: 'optional',
    purpose: 'Convierte las presentaciones de PowerPoint en diapositivas. Sin él, se guardan como PDF desde otro equipo y se añade el PDF.',
    link: 'https://www.microsoft.com/microsoft-365/powerpoint',
    manual: { other: { steps: ['Si la iglesia tiene Microsoft Office, instálalo en este equipo. No es obligatorio.'] } },
    find: async () => {
      const file = await findPowerPoint();
      return file ? { file } : null;
    },
  },
];

export function setupTools(app) {
  const { store } = app;
  const toolsDir = path.join(app.dataDir, 'herramientas');
  // Solo para pruebas: MANNA_FALTA=ffmpeg,navegador hace como si el equipo no los tuviera
  // (lo que Manna instale en su propia carpeta sí cuenta).
  const hidden = new Set((process.env.MANNA_FALTA || '').split(',').map((s) => s.trim()).filter(Boolean));
  const downloads = downloadsFor(PLATFORM);
  const found = new Map();      // id -> { files: { binario: ruta }, version, detail, own }
  const installing = new Set();

  store.register('tools', { list: [], blocked: false, pending: 0, checked: false });

  async function detect(tool) {
    if (tool.find) {
      const hit = hidden.has(tool.id) ? null : await tool.find();
      return hit ? { files: { [tool.id]: hit.file }, version: null, detail: hit.detail || null, own: false } : null;
    }
    const dirs = searchDirs(toolsDir, !hidden.has(tool.id));
    const files = {};
    for (const binary of tool.binaries) {
      files[binary] = findBinary(binary, dirs);
      if (!files[binary]) return null;
    }
    const main = files[tool.binaries[0]];
    // Que el archivo exista no basta: tiene que poder ejecutarse.
    const text = await output(main, tool.version.args);
    if (text == null) return null;
    return { files, version: tool.version.pattern.exec(text)?.[1] || null, detail: null, own: main.startsWith(toolsDir + path.sep) };
  }

  function publish() {
    const list = CATALOG.map((tool) => {
      const hit = found.get(tool.id);
      const download = downloads[tool.id];
      return {
        id: tool.id,
        name: tool.name,
        level: tool.level,
        purpose: tool.purpose,
        link: tool.link,
        found: Boolean(hit),
        version: hit?.version || null,
        detail: hit?.detail || (hit?.own ? 'Instalado por Manna' : null),
        manual: tool.manual[PLATFORM] || tool.manual.other || null,
        installable: Boolean(download),
        downloadSize: download?.size || null,
        installing: installing.has(tool.id),
      };
    });
    store.set('tools', {
      list,
      blocked: list.some((t) => t.level === 'required' && !t.found),
      pending: list.filter((t) => t.level === 'feature' && !t.found).length,
      checked: true,
    });
  }

  async function scan() {
    const results = await Promise.all(CATALOG.map(detect));
    CATALOG.forEach((tool, i) => (results[i] ? found.set(tool.id, results[i]) : found.delete(tool.id)));
    publish();
    return store.get('tools');
  }

  async function install(id) {
    const tool = CATALOG.find((t) => t.id === id);
    const spec = downloads[id];
    if (!tool || !spec) throw new HttpError(400, 'Ese programa no se puede instalar automáticamente en este equipo. Sigue los pasos para instalarlo a mano.');
    if (installing.has(id)) return;
    installing.add(id);
    publish();
    // Un intento anterior que falló deja su aviso: se retira al volver a intentarlo.
    for (const old of app.jobs.list()) if (old.owner === 'tools' && old.ref === id) app.jobs.dismiss(old.id);
    const job = app.jobs.start({ title: `Descargando ${tool.name}`, detail: spec.size || '', owner: 'tools', ref: id });
    try {
      await installTool(spec, { dir: toolsDir, onProgress: (progress) => job.update({ progress }) });
      installing.delete(id);
      await scan();
      if (!found.has(id)) throw new Error(`${tool.name} se descargó, pero este equipo no deja ejecutarlo. Instálalo a mano siguiendo los pasos.`);
      job.done('Instalado');
    } catch (err) {
      installing.delete(id);
      publish();
      job.fail(err.message);
    }
  }

  // Mientras falte algo imprescindible, toda página lleva a la revisión del equipo.
  app.gate(({ path: page }) => (store.get('tools').blocked && page !== '/requisitos' ? '/requisitos' : null));

  app.action('tools.scan', { permission: 'system.admin' }, async () => { await scan(); });

  app.action('tools.install', { permission: 'system.admin' }, ({ id }, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Los programas solo se instalan desde el equipo principal.');
    // No se espera a que termine: el avance se ve en las tareas.
    install(String(id));
  });

  return {
    scan,
    has: (id) => found.has(id),
    // Ruta del ejecutable, o null. binary: cuál, si el programa trae varios (ffmpeg / ffprobe).
    path: (id, binary = id) => found.get(id)?.files[binary] || null,
    // Con qué página debe abrirse Manna en el equipo principal.
    entry() {
      const { blocked, pending } = store.get('tools');
      return blocked || pending ? '/requisitos' : '/control';
    },
    // Lanza un programa externo. Siempre con lista de argumentos: nunca se arma una orden con texto.
    spawn(id, args, { binary = id, ...options } = {}) {
      const file = found.get(id)?.files[binary];
      if (!file) {
        const name = CATALOG.find((t) => t.id === id)?.name || id;
        throw new HttpError(409, `Falta ${name} en el equipo principal. Se instala desde Ajustes, en "Programas del equipo principal".`);
      }
      return spawn(file, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    },
  };
}
