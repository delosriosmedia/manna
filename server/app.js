import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createApp } from './core/app.js';
import { checkRequirements } from './preflight.js';

import system from './modules/system/index.js';
import bible from './modules/bible/index.js';
import projection from './modules/projection/index.js';
import playlist from './modules/playlist/index.js';

// Para añadir un módulo nuevo: crea su carpeta en server/modules y agrégalo aquí.
const MODULES = [system, bible, projection, playlist];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function openInBrowser(target) {
  const cmd = process.platform === 'darwin' ? ['open', [target]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', target]]
    : ['xdg-open', [target]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

export async function start() {
  const problems = checkRequirements();
  if (problems.length) {
    console.error('\nFaltan requisitos para ejecutar Manna:\n');
    for (const p of problems) console.error(`  - ${p.message}\n    ${p.link}\n`);
    openInBrowser(path.join(ROOT, 'instalar.html'));
    process.exit(1);
  }

  const app = createApp({
    rootDir: ROOT,
    dataDir: process.env.MANNA_DATA || path.join(ROOT, 'data'),
    biblesDir: process.env.MANNA_BIBLIAS || path.join(ROOT, 'Biblias'),
  });
  for (const setup of MODULES) await setup(app);
  const port = await app.listen();

  const local = `http://localhost:${port}`;
  const system_ = app.store.get('system');
  console.log('\n==========================================================');
  console.log('  Manna - Church projection app');
  console.log('==========================================================');
  console.log(`  En este equipo:        ${local}/control`);
  for (const url of system_.addresses) console.log(`  Desde otro dispositivo: ${url}`);
  console.log(`  PIN de control:        ${app.sessions.pin}`);
  console.log('==========================================================');
  console.log('  Deja esta ventana abierta. Ciérrala para apagar Manna.\n');

  if (!process.env.MANNA_NO_OPEN) openInBrowser(`${local}/control`);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
}
