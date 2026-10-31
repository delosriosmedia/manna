import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HttpError } from './router.js';
import { installTool, NOT_RUNNABLE, pickName } from './install.js';

// Programas del equipo principal que Manna usa pero no incluye: el navegador de la proyección,
// ffmpeg, yt-dlp y PowerPoint. Este es el único lugar que los busca, los instala y los ejecuta.
//
// Ninguno impide abrir Manna (decisión del dueño): si falta alguno, se avisa de qué dejará de
// funcionar y se ayuda a instalarlo. Cada uno tiene un nivel:
//   feature   lo necesita alguna función: Manna se abre en la revisión del equipo mientras falte
//   optional  recomendado: solo se informa
// Qué módulo necesita cada programa lo declara el propio módulo (`needs`, en web/modules/).
//
// Manna puede descargar ffmpeg y yt-dlp por su cuenta, a data/herramientas/, sin tocar el sistema.

const VIGIA = fileURLToPath(new URL('./vigia.js', import.meta.url));
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
function output(file, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
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
// Qué versión es la última (su «tag_name» es lo mismo que dice «yt-dlp --version»): para ponerlo al día solo (freshen).
const YT_LATEST = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
const CF = 'https://github.com/cloudflare/cloudflared/releases/latest/download';
// cloudflared no publica una lista de huellas aparte: van en el texto de cada versión («nombre: huella»).
const CF_SUMS = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
// Node.js de la línea 24 (LTS): el nombre lleva la versión, así que se elige en su lista de huellas (pick).
const NODE = 'https://nodejs.org/dist/latest-v24.x';
// DeckCraft (fase 33): una versión fija, la que se probó con presentaciones reales; se cambia a mano tras probar la nueva.
// En Windows solo viene dentro del .zip portátil, junto a la app: se saca de él el programa de órdenes.
export const DECKCRAFT_VERSION = '0.10.0';
const DC = `https://github.com/storytold/deckcraft/releases/download/v${DECKCRAFT_VERSION}`;
// DeckCraft con animaciones (fase 33, parte 3): la versión web de la copia de Manna (delosriosmedia/deckcraft), con
// el puente por el que Manna la maneja dentro de la ventana del proyector. Una versión fija, compilada en GitHub.
export const DECKCRAFT_WEB = 'manna-web-0.12.0-3';
const DCW = `https://github.com/delosriosmedia/deckcraft/releases/download/${DECKCRAFT_WEB}`;
const DECKCRAFT_WEB_ZIP = { url: `${DCW}/deckcraft-web-manna.zip`, sums: `${DCW}/SHA256SUMS.txt`, folder: 'deckcraft-web', version: DECKCRAFT_WEB, size: '15 MB' };
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
    win32: { url: `${YT}/yt-dlp.exe`, sums: `${YT}/SHA2-256SUMS`, latest: YT_LATEST, file: 'yt-dlp.exe', size: '18 MB' },
    darwin: { url: `${YT}/yt-dlp_macos`, sums: `${YT}/SHA2-256SUMS`, latest: YT_LATEST, file: 'yt-dlp', size: '37 MB' },
  },
  node: {
    win32: { sums: `${NODE}/SHASUMS256.txt`, pick: 'node-v[0-9.]+-win-x64\\.zip', extract: ['node.exe'], size: '36 MB' },
  },
  deckcraft: {
    win32: { url: `${DC}/deckcraft-${DECKCRAFT_VERSION}-windows-${process.arch === 'arm64' ? 'arm64' : 'x64'}-portable.zip`, sums: `${DC}/SHA256SUMS.txt`, extract: ['deckcraft-cli.exe'], size: '77 MB' },
    darwin: { url: `${DC}/deckcraft-cli-${DECKCRAFT_VERSION}-macos-universal.zip`, sums: `${DC}/SHA256SUMS.txt`, extract: ['deckcraft-cli'], size: '69 MB' },
  },
  'deckcraft-web': { win32: DECKCRAFT_WEB_ZIP, darwin: DECKCRAFT_WEB_ZIP },
  cloudflared: {
    win32: { url: `${CF}/cloudflared-windows-amd64.exe`, sums: CF_SUMS, release: true, file: 'cloudflared.exe', size: '65 MB' },
    // En Mac la huella publicada es la del programa, no la del .tgz que lo trae.
    darwin: { url: `${CF}/cloudflared-darwin-${process.arch === 'arm64' ? 'arm64' : 'amd64'}.tgz`, sums: CF_SUMS, release: true, inner: true, extract: ['cloudflared'], size: '20 MB' },
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
    level: 'feature',
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
    // YouTube cambia a menudo y yt-dlp se queda atrás: conviene poder ponerlo al día con un botón.
    update: 'Si las descargas de YouTube empiezan a fallar, actualízalo.',
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
    id: 'node',
    name: 'Node.js para YouTube',
    level: 'feature',
    purpose: 'YouTube pide resolver un acertijo en JavaScript antes de dejar descargar, y yt-dlp lo resuelve con Node.js 22 o más nuevo. Si el que mueve a Manna es más viejo, Manna usa uno propio, solo para eso, y lo pone al día solo.',
    link: 'https://nodejs.org/es/download',
    binaries: ['node'],
    // El del equipo vale si es de la 22 o más nuevo; si no, se instala uno propio en data/herramientas.
    min: 22,
    version: { args: ['--version'], pattern: /^v(\S+)/ },
    manual: {
      other: { steps: ['Descarga Node.js con el botón: elige la versión LTS e instálala normalmente.', 'Cierra Manna y vuelve a abrirlo con su icono.'] },
    },
  },
  {
    id: 'cloudflared',
    name: 'cloudflared',
    level: 'optional',
    purpose: 'Abre la conexión por internet (Ajustes): entrar a Manna desde fuera de la iglesia, siempre con PIN.',
    link: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    binaries: ['cloudflared'],
    version: { args: ['--version'], pattern: /version (\S+)/ },
    manual: {
      win32: { steps: [terminal.win32, 'Copia esta orden, pégala y pulsa Enter:', AFTER_COMMAND], command: 'winget install --id Cloudflare.cloudflared -e' },
      darwin: { steps: [terminal.darwin, 'Copia esta orden, pégala y pulsa Enter (necesita Homebrew, de brew.sh):', AFTER_COMMAND], command: 'brew install cloudflared' },
      other: { steps: ['Instala "cloudflared" siguiendo las instrucciones de Cloudflare.'] },
    },
  },
  {
    id: 'deckcraft',
    name: 'DeckCraft',
    level: 'optional',
    purpose: 'Convierte las presentaciones de PowerPoint y Keynote en diapositivas sin necesitar PowerPoint: un programa libre, de código abierto, que no abre ninguna ventana.',
    link: 'https://github.com/storytold/deckcraft',
    binaries: ['deckcraft-cli'],
    version: { args: ['--version'], pattern: /deckcraft-cli (\S+)/ },
    manual: {
      other: { steps: ['Pulsa «Instalar por mí»: Manna lo descarga de su página oficial y comprueba que llegó entero.'] },
    },
  },
  {
    id: 'deckcraft-web',
    name: 'DeckCraft con animaciones',
    level: 'optional',
    purpose: 'Pasa las presentaciones de PowerPoint en el proyector con sus animaciones y transiciones, dentro de la ventana de Manna (debajo de las capas), en Windows y en Mac. Es la versión web de DeckCraft, en la copia de Manna.',
    link: 'https://github.com/delosriosmedia/deckcraft',
    manual: {
      other: { steps: ['Pulsa «Instalar por mí»: Manna lo descarga de la copia de Manna en GitHub y comprueba que llegó entero.'] },
    },
    // Es una página con su programa, no un ejecutable: está si su página está. Su versión la apunta Manna al instalarla
    // (las de antes de la manna-web-0.12.0-3 no la llevan): con otra, se pone al día sola al abrir Manna (freshen).
    find: async (toolsDir) => {
      const file = path.join(toolsDir, 'deckcraft-web', 'index.html');
      if (!fs.existsSync(file)) return null;
      let version = 'anterior';
      try { version = fs.readFileSync(path.join(toolsDir, 'deckcraft-web', 'version-manna.txt'), 'utf8').trim() || version; } catch { /* de antes */ }
      return { file, version };
    },
  },
  {
    id: 'powerpoint',
    name: 'Microsoft PowerPoint',
    level: 'optional',
    purpose: 'Convierte las presentaciones de PowerPoint cuando no está DeckCraft, y las pasa en vivo (en Windows). Sin ninguno de los dos, se guardan como PDF desde otro equipo y se añade el PDF.',
    link: 'https://www.microsoft.com/microsoft-365/powerpoint',
    manual: { other: { steps: ['Si la iglesia tiene Microsoft Office, instálalo en este equipo. No es obligatorio.'] } },
    find: async () => {
      // Solo para pruebas: un PowerPoint de mentira (un guion que hace de él; ver modules/slides/powerpoint.js).
      if (process.env.MANNA_POWERPOINT_PRUEBA) return { file: process.env.MANNA_POWERPOINT_PRUEBA, detail: 'De prueba' };
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

  store.register('tools', { list: [], pending: 0, checked: false });

  async function detect(tool) {
    if (tool.find) {
      const hit = hidden.has(tool.id) ? null : await tool.find(toolsDir);
      return hit ? { files: { [tool.id]: hit.file }, version: hit.version || null, detail: hit.detail || null, own: false } : null;
    }
    const dirs = searchDirs(toolsDir, !hidden.has(tool.id));
    const files = {};
    for (const binary of tool.binaries) {
      files[binary] = findBinary(binary, dirs);
      if (!files[binary]) return null;
    }
    const main = files[tool.binaries[0]];
    // Que el archivo exista no basta: tiene que poder ejecutarse. Con margen: yt-dlp en Mac se desempaqueta en cada
    // arranque y tarda unos 9 s en decir su versión (con 8 s parecía que faltaba).
    const text = await output(main, tool.version.args, 30_000);
    if (text == null) return null;
    const version = tool.version.pattern.exec(text)?.[1] || null;
    // Uno más viejo que lo que hace falta (Node.js antes de la 22) es como si no estuviera.
    if (tool.min && !(Number(version?.split('.')[0]) >= tool.min)) return null;
    return { files, version, detail: null, own: main.startsWith(toolsDir + path.sep) };
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
        // Se puede poner al día desde Manna (vuelve a descargarlo a su carpeta), y por qué convendría.
        update: download && tool.update ? tool.update : null,
        downloadSize: download?.size || null,
        installing: installing.has(tool.id),
      };
    });
    // pending: cuántos programas no opcionales faltan.
    store.set('tools', { list, pending: list.filter((t) => t.level === 'feature' && !t.found).length, checked: true });
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
    if (!tool || !spec || installing.has(id)) return;
    installing.add(id);
    publish();
    // Un intento anterior que falló deja su aviso: se retira al volver a intentarlo.
    for (const old of app.jobs.list()) if (old.owner === 'tools' && old.ref === id) app.jobs.dismiss(old.id);
    const job = app.jobs.start({ title: `Descargando ${tool.name}`, detail: spec.size || '', owner: 'tools', ref: id });
    try {
      // Un programa recién bajado tarda en arrancar la primera vez en Windows (el antivirus lo revisa): se le da un minuto.
      const check = tool.version && (async (file) => (await output(file, tool.version.args, 60_000)) != null);
      await installTool(spec, { dir: toolsDir, onProgress: (progress) => job.update({ progress }), check });
      installing.delete(id);
      await scan();
      if (!found.has(id)) throw new Error(`${tool.name} ${NOT_RUNNABLE}`);
      job.done('Instalado');
    } catch (err) {
      installing.delete(id);
      publish();
      console.error(`${id}: no se pudo instalar: ${err.message}`);
      job.fail(err.message === NOT_RUNNABLE ? `${tool.name} ${NOT_RUNNABLE}` : err.message);
    }
  }

  // Pone al día un programa que lo pide a menudo (yt-dlp: YouTube cambia y las versiones viejas dejan de bajar): si
  // la última publicada es otra que la instalada, lo vuelve a instalar. Uno de versión fija con `version` (DeckCraft
  // con animaciones), si la instalada es otra que la que pide esta versión de Manna. Solo uno que ya esté; sin internet, o con
  // la misma versión, no hace nada. Nunca en las pruebas (MANNA_FALTA lo oculta). Devuelve si lo cambió.
  async function freshen(id) {
    const spec = downloads[id];
    const hit = found.get(id);
    const have = hit?.version;
    if (!(spec?.latest || spec?.pick || spec?.version) || !have || hidden.has(id) || installing.has(id)) return false;
    // El Node.js del equipo (el que mueve a Manna) no se sustituye: solo se pone al día el propio de Manna.
    if (CATALOG.find((t) => t.id === id)?.min && !hit.own) return false;
    let tag = spec.version;
    if (!tag) try {
      if (spec.pick) tag = /\d+\.\d+\.\d+/.exec(await pickName(spec, AbortSignal.timeout(8000)))?.[0] || '';
      else {
        const res = await fetch(spec.latest, { headers: { 'User-Agent': 'Manna', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) });
        tag = res.ok ? String((await res.json()).tag_name || '') : '';
      }
    } catch { return false; }
    if (!tag || tag === have) return false;
    console.log(`${id}: hay una versión nueva (${have} → ${tag}); se pone al día.`);
    await install(id);
    return found.get(id)?.version !== have;
  }

  app.action('tools.scan', { permission: 'system.admin' }, async () => { await scan(); });

  app.action('tools.install', { permission: 'system.admin' }, ({ id }, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Los programas solo se instalan desde el equipo principal.');
    const key = String(id);
    // Se comprueba aquí y no dentro de install(): un error en lo que no se espera cerraría Manna.
    if (!CATALOG.some((t) => t.id === key) || !downloads[key]) throw new HttpError(400, 'Ese programa no se puede instalar automáticamente en este equipo. Sigue los pasos para instalarlo a mano.');
    // No se espera a que termine: el avance se ve en las tareas.
    install(key);
  });

  return {
    scan,
    freshen,
    has: (id) => found.has(id),
    // Ruta del ejecutable, o null. binary: cuál, si el programa trae varios (ffmpeg / ffprobe).
    path: (id, binary = id) => found.get(id)?.files[binary] || null,
    // Con qué página debe abrirse Manna en el equipo principal: si falta algún programa, con la
    // revisión del equipo, que avisa de lo que no funcionará y deja continuar.
    entry: () => (store.get('tools').pending ? '/requisitos' : '/control'),
    // Lanza un programa externo. Siempre con lista de argumentos: nunca se arma una orden con texto.
    // tied: el programa vive solo mientras viva Manna, aunque Manna se cierre de golpe (core/vigia.js).
    spawn(id, args, { binary = id, tied = false, ...options } = {}) {
      const file = found.get(id)?.files[binary];
      if (!file) {
        const name = CATALOG.find((t) => t.id === id)?.name || id;
        throw new HttpError(409, `Falta ${name} en el equipo principal. Se instala desde Ajustes, en "Programas del equipo principal".`);
      }
      if (!tied) {
        const child = spawn(file, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
        // En Windows un programa puede abrir otros (yt-dlp.exe abre una segunda copia, que es la que descarga):
        // kill() cierra el árbol entero. Si no, al cancelar seguía descargando hasta el final.
        if (WIN) child.kill = () => { if (child.pid) execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {}); };
        return child;
      }
      const child = spawn(process.execPath, [VIGIA, file, ...args], { windowsHide: true, ...options, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdin.on('error', () => {}); // el vigilante ya terminó
      // Se cierra cortándole la entrada: en Windows, matar al vigilante dejaría suelto el programa.
      child.kill = () => child.stdin.end();
      return child;
    },
  };
}
