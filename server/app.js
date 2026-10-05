import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createApp, portCandidates } from './core/app.js';
import { logToFile } from './core/log.js';

import system from './modules/system/index.js';
import bible from './modules/bible/index.js';
import projection from './modules/projection/index.js';
import order from './modules/order/index.js';
import tv from './modules/tv/index.js';
import media from './modules/media/index.js';
import slides from './modules/slides/index.js';

// Para añadir un módulo nuevo: crea su carpeta en server/modules y agrégalo aquí.
const MODULES = [system, bible, projection, order, media, slides, tv];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.MANNA_DATA || path.join(ROOT, 'data');
// Lo que pone cada iglesia (biblias, himnos, letras) vive en una sola carpeta: ver Contenido/LEEME.txt.
const CONTENT = path.join(ROOT, 'Contenido');

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

// ¿Ya hay un Manna abierto con estos mismos datos? Devuelve { port, build }, o null.
// Evita dos copias si se pulsa el icono dos veces: la segunda solo vuelve a mostrar el control.
async function findRunning(app) {
  const ports = portCandidates(Number(process.env.PORT) || app.settings.data.port);
  const found = await Promise.all(ports.map(async (port) => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(700) });
      const ping = await res.json();
      return ping.id === app.settings.data.id ? { port, build: ping.build || null } : null;
    } catch {
      return null;
    }
  }));
  return found.find(Boolean) || null;
}

// Cierra el Manna que está abierto con un código anterior, como lo haría su botón "Apagar"
// (desde este mismo equipo no hace falta PIN). Devuelve true cuando ya no responde.
async function retire(port) {
  const base = `http://127.0.0.1:${port}`;
  const json = { 'Content-Type': 'application/json' };
  try {
    const login = await fetch(`${base}/api/session`, { method: 'POST', headers: json, body: JSON.stringify({ role: 'control' }), signal: AbortSignal.timeout(3000) });
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    await fetch(`${base}/api/action`, { method: 'POST', headers: { ...json, cookie }, body: JSON.stringify({ type: 'system.shutdown' }), signal: AbortSignal.timeout(3000) });
  } catch {
    return false;
  }
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => { setTimeout(resolve, 250); });
    const alive = await fetch(`${base}/api/ping`, { signal: AbortSignal.timeout(500) }).then(() => true, () => false);
    if (!alive) return true;
  }
  return false;
}

async function run() {
  const options = {
    rootDir: ROOT,
    dataDir: DATA,
    biblesDir: process.env.MANNA_BIBLIAS || path.join(CONTENT, 'Biblias'),
    mediaDir: process.env.MANNA_MEDIOS || path.join(CONTENT, 'Medios'),
  };
  let app = createApp(options);

  const running = await findRunning(app);
  // El que está abierto arrancó con otro código (Manna se actualizó mientras tanto): se cierra y
  // se abre el actual. Si no se deja cerrar, se muestra el que hay, como siempre.
  const outdated = Boolean(running) && running.build !== app.build;
  if (outdated) console.log('El Manna que estaba abierto es de antes de la última actualización: se cierra para abrir el actual.');
  if (running && !(outdated && await retire(running.port))) {
    console.log(`Manna ya está abierto. Se muestra el control: ${localUrl(running.port)}/control`);
    openInBrowser(`${localUrl(running.port)}/control`);
    process.exit(0);
  }
  // El anterior guardó sus datos al cerrarse: se leen de nuevo.
  if (outdated) app = createApp(options);

  for (const setup of MODULES) await setup(app);

  // Apagar y reiniciar se dejan listos antes de abrir el puerto: en cuanto Manna responde, sus
  // botones ya tienen que funcionar.
  // Apagado ordenado: cierra la ventana de proyección, despide el nombre de red y guarda lo pendiente.
  let closing = false;
  app.shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('Manna se apaga.');
    await app.close();
    process.exit(0);
  };
  // Reinicio: cierra todo y lanza otra copia, que arranca con el código que haya ahora en disco.
  // No abre otra pestaña: las que hay se reconectan solas y se recargan.
  app.restart = async () => {
    if (closing) return;
    closing = true;
    console.log('Manna se reinicia.');
    await app.close();
    // (La huella fingida de las pruebas no se hereda: la copia nueva calcula la suya.)
    const { MANNA_HUELLA: _fake, ...env } = process.env;
    spawn(process.execPath, process.argv.slice(1), {
      cwd: process.cwd(), env: { ...env, MANNA_REINICIO: '1' }, detached: true, stdio: 'ignore', windowsHide: true,
    }).on('error', () => {}).unref();
    process.exit(0);
  };
  // Revisión del equipo: si falta algún programa, Manna se abre en la página que dice qué no
  // funcionará y ayuda a instalarlo (web/requisitos.html). No bloquea: desde ahí se continúa.
  const { list } = await app.tools.scan();
  const port = await app.listen();
  await app.services.network.refresh();
  const entry = app.tools.entry();

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

  for (const tool of list.filter((t) => !t.found && t.level !== 'optional')) {
    console.log(`  Falta ${tool.name}: ${tool.purpose}`);
  }
  // Tras un reinicio pedido desde el control ya hay pestañas abiertas: se reconectan solas.
  if (!process.env.MANNA_REINICIO) openInBrowser(`${localUrl(port)}${entry}`);

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
