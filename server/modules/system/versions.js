import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HttpError } from '../../core/router.js';

// Versiones nuevas de Manna (pedido del dueño, 2026-10-17): cada 20 minutos el equipo principal pregunta a GitHub qué
// versión tiene la rama que descarga el instalador. Sin internet, o sin nada nuevo, no dice nada; con una nueva, la
// publica en `system.update` y la interfaz la avisa, con un botón que abre el instalador de siempre (que cierra Manna,
// lo pone al día sin tocar el contenido ni los datos y lo vuelve a abrir).
const SOURCE = 'https://raw.githubusercontent.com/delosriosmedia/manna/main/package.json';
const EVERY_MS = 20 * 60_000;
const FIRST_MS = 60_000; // la primera, un minuto después de abrirse: no estorba el arranque
const INSTALLERS = { win32: 'Instalar Manna en Windows.bat', darwin: 'Instalar Manna en Mac.command' };

// ¿La versión a es más nueva que la b? ('1.30.0' frente a '1.29.1')
export function newer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

export function watchVersions(app, version) {
  const { store } = app;
  // Pruebas: MANNA_VERSIONES_URL (de dónde se lee) y MANNA_VERSIONES_MS (cada cuánto, también la primera vez).
  const source = process.env.MANNA_VERSIONES_URL || SOURCE;
  const every = Number(process.env.MANNA_VERSIONES_MS) || 0;
  // La copia con git de quien programa Manna se pone al día con git: ahí no se pregunta.
  const dev = !process.env.MANNA_VERSIONES_URL && fs.existsSync(path.join(app.rootDir, '.git'));

  async function check() {
    if (app.blocked) return;
    try {
      const res = await fetch(source, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Manna' } });
      if (!res.ok) return;
      const latest = String((await res.json())?.version || '');
      if (/^\d+\.\d+\.\d+$/.test(latest) && newer(latest, version) && store.get('system').update?.version !== latest) {
        console.log(`Hay una versión nueva de Manna: ${latest} (esta es la ${version}).`);
        store.set('system', { update: { version: latest } });
      }
    } catch {
      // Sin internet, o GitHub no contesta: no se dice nada y se vuelve a mirar en el próximo turno.
    }
  }
  if (!dev) {
    store.on('listening', () => {
      setTimeout(check, every || FIRST_MS).unref();
      setInterval(check, every || EVERY_MS).unref();
    });
  }

  // «Actualizar ahora»: abre el instalador como lo haría un doble clic. Solo desde el equipo principal, que es donde
  // está y donde se actualiza. Pruebas: MANNA_ACTUALIZADOR_PRUEBA, un guion de node que hace de instalador.
  app.action('system.update', { permission: 'system.admin' }, (_payload, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Manna solo se actualiza desde el equipo principal.');
    const fake = process.env.MANNA_ACTUALIZADOR_PRUEBA;
    const file = fake || path.join(app.rootDir, INSTALLERS[process.platform] || '');
    if (!fake && (dev || !INSTALLERS[process.platform] || !fs.existsSync(file))) {
      throw new HttpError(409, 'No se encontró el instalador de Manna en este equipo. Descárgalo de GitHub y ábrelo.');
    }
    const [cmd, args] = fake ? [process.execPath, [file]]
      // Windows: como un doble clic (el Explorador lo abre en su ventana). Mac: en el Terminal.
      : process.platform === 'win32' ? ['explorer.exe', [file]] : ['open', ['-a', 'Terminal', file]];
    if (!fake && process.platform === 'darwin') fs.chmodSync(file, 0o755); // por si el .zip no guardó el permiso
    spawn(cmd, args, { cwd: path.dirname(file), detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  });
}
