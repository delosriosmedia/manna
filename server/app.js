import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createApp, portCandidates } from './core/app.js';
import { logToFile } from './core/log.js';
import { checkRequirements } from './preflight.js';

import system from './modules/system/index.js';
import bible from './modules/bible/index.js';
import projection from './modules/projection/index.js';
import playlist from './modules/playlist/index.js';

// Para añadir un módulo nuevo: crea su carpeta en server/modules y agrégalo aquí.
const MODULES = [system, bible, projection, playlist];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.MANNA_DATA || path.join(ROOT, 'data');

// Así arranca el icono "Manna": sin ventana, con los mensajes guardados en data/manna.log.
const BACKGROUND = process.argv.includes('--segundo-plano');

function openInBrowser(target) {
  if (process.env.MANNA_NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? ['open', [target]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', target]]
    : ['xdg-open', [target]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
}

const localUrl = (port) => `http://localhost${port === 80 ? '' : `:${port}`}`;

// ¿Ya hay un Manna abierto con estos mismos datos? Devuelve su puerto, o null.
// Evita dos copias si se pulsa el icono dos veces: la segunda solo vuelve a mostrar el control.
async function findRunning(app) {
  const ports = portCandidates(Number(process.env.PORT) || app.settings.data.port);
  const found = await Promise.all(ports.map(async (port) => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(700) });
      return (await res.json()).id === app.settings.data.id ? port : null;
    } catch {
      return null;
    }
  }));
  return found.find(Boolean) || null;
}

async function run() {
  const problems = checkRequirements();
  if (problems.length) {
    console.error('\nFaltan requisitos para ejecutar Manna:\n');
    for (const p of problems) console.error(`  - ${p.message}\n    ${p.link}\n`);
    openInBrowser(path.join(ROOT, 'instalacion', 'requisitos.html'));
    process.exit(1);
  }

  const app = createApp({
    rootDir: ROOT,
    dataDir: DATA,
    biblesDir: process.env.MANNA_BIBLIAS || path.join(ROOT, 'Biblias'),
  });

  const running = await findRunning(app);
  if (running) {
    console.log(`Manna ya está abierto. Se muestra el control: ${localUrl(running)}/control`);
    openInBrowser(`${localUrl(running)}/control`);
    process.exit(0);
  }

  for (const setup of MODULES) await setup(app);
  const port = await app.listen();
  await app.services.network.refresh();

  const { addresses: [main, ...others], nameUrl } = app.store.get('system');
  console.log('\n==========================================================');
  console.log('  Manna - Church projection app');
  console.log('==========================================================');
  console.log(`  En este equipo:        ${localUrl(port)}/control`);
  if (nameUrl) console.log(`  Desde otro dispositivo: ${nameUrl}`);
  console.log(`  ${nameUrl ? 'o con la dirección:   ' : 'Desde otro dispositivo:'} ${main || '(este equipo no está conectado a ninguna red)'}`);
  for (const url of others) console.log(`    otra dirección:      ${url}`);
  if (BACKGROUND) {
    console.log('==========================================================\n');
  } else {
    // El PIN no se escribe en el archivo de registro; se ve en el botón "Dispositivos".
    console.log(`  PIN de control:        ${app.sessions.pin}`);
    console.log('==========================================================');
    console.log('  Deja esta ventana abierta. Ciérrala para apagar Manna.\n');
  }

  openInBrowser(`${localUrl(port)}/control`);

  // Apagado ordenado: cierra la ventana de proyección, despide el nombre de red y guarda lo pendiente.
  let closing = false;
  app.shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('Manna se apaga.');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', app.shutdown);
  process.on('SIGTERM', app.shutdown);
  process.on('SIGHUP', app.shutdown);
}

// Sin ventana no hay dónde leer un error de arranque: se muestra en una página.
function showStartupError(err) {
  const page = path.join(DATA, 'error.html');
  const text = String(err?.message || err).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(page, `<!DOCTYPE html><html lang="es"><meta charset="UTF-8"><title>Manna no pudo abrirse</title>
<body style="margin:0;background:#0b1120;color:#e5e9f2;font:17px/1.6 -apple-system,'Segoe UI',sans-serif">
<main style="max-width:640px;margin:0 auto;padding:60px 20px">
<h1>Manna no pudo abrirse</h1>
<p>Vuelve a intentarlo con el icono Manna. Si sigue sin abrir, envía este mensaje a quien instaló el programa:</p>
<pre style="white-space:pre-wrap;background:#111a2e;border:1px solid #263352;border-radius:8px;padding:14px">${text}</pre>
<p style="color:#93a0b8">Hay más detalle en el archivo <code>manna.log</code> de la carpeta <code>data</code>.</p>
</main></body></html>`);
  openInBrowser(page);
}

export async function start() {
  if (BACKGROUND) logToFile(path.join(DATA, 'manna.log'));
  try {
    await run();
  } catch (err) {
    console.error('\nNo se pudo iniciar Manna:', err?.stack || err);
    if (BACKGROUND) showStartupError(err);
    process.exit(1);
  }
}
