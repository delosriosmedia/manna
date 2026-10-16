import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Descarga un programa a la carpeta de herramientas de Manna y comprueba que llegó entero.
// Solo se usa cuando el dueño pulsa "Instalar por mí" en la revisión del equipo, y solo con
// las direcciones oficiales fijadas en tools.js: nunca con una dirección que venga de fuera.
//
// spec: {
//   url       de dónde se descarga
//   file      nombre con el que se guarda (descarga directa de un ejecutable)
//   extract   ['ffmpeg.exe', …]: la descarga es un .zip y se sacan de él esos archivos
//   sums      dirección de una lista "<sha256>  <nombre>" publicada junto a la descarga
//   release   true: sums es una versión de GitHub (su API) y las huellas van en su texto como "<nombre>: <sha256>"
//   inner     true: la huella publicada es la del programa de dentro del archivo, no la del archivo
//   sha256    dirección de un archivo que contiene solo el sha256
//   pick      sin url: el nombre lleva la versión (Node.js), así que se elige en la lista sums el que cuadra con esta
//             expresión, y se descarga de la misma carpeta que la lista
// }
// Devuelve las rutas de los archivos instalados.

const OFFLINE = 'No se pudo descargar. Comprueba que el equipo principal tiene internet y vuelve a intentarlo.';

async function get(url, signal) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', signal });
  } catch {
    throw new Error(OFFLINE);
  }
  if (!res.ok) throw new Error(`La descarga no está disponible en este momento (respuesta ${res.status}). Inténtalo más tarde o instálalo a mano.`);
  return res;
}

// La huella publicada por quien distribuye el programa, o null si no publica ninguna.
async function expectedHash(spec, signal) {
  const source = spec.sums || spec.sha256;
  if (!source) return null;
  const raw = await (await get(source, signal)).text();
  let text = raw;
  if (spec.release) try { text = String(JSON.parse(raw).body || ''); } catch { text = ''; }
  const name = path.posix.basename(new URL(spec.url).pathname);
  const line = spec.release
    ? text.split(/\r?\n/).find((l) => l.trim().startsWith(`${name}:`))
    : spec.sums
      ? text.split(/\r?\n/).find((l) => l.trim().split(/\s+/).at(-1)?.replace(/^\*/, '') === name)
      : text;
  const hash = /\b[a-f0-9]{64}\b/i.exec(line || '')?.[0];
  if (!hash) throw new Error('No se pudo comprobar la descarga: falta su huella de verificación. Instálalo a mano.');
  return hash.toLowerCase();
}

// El nombre del archivo que cuadra con spec.pick en la lista de huellas (el más nuevo de esa línea de versiones).
export async function pickName(spec, signal) {
  const list = await (await get(spec.sums, signal)).text();
  const name = new RegExp(`(?:^|\\s)(${spec.pick})\\s*$`, 'm').exec(list)?.[1];
  if (!name) throw new Error('No se encontró la descarga en la lista oficial. Instálalo a mano siguiendo los pasos.');
  return name;
}

function unzip(archive, dir) {
  return new Promise((resolve, reject) => {
    // tar viene con Windows 10 y 11 y con macOS, y sabe abrir archivos .zip.
    execFile('tar', ['-xf', archive, '-C', dir], { windowsHide: true }, (err) => {
      if (err) reject(new Error('No se pudo abrir el archivo descargado. Instálalo a mano siguiendo los pasos.'));
      else resolve();
    });
  });
}

function findInside(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const inside = findInside(full, name);
      if (inside) return inside;
    } else if (entry.name.toLowerCase() === name.toLowerCase()) return full;
  }
  return null;
}

// Lo que se dice si el programa nuevo no arranca. El que había no se toca.
export const NOT_RUNNABLE = 'se descargó, pero este equipo no lo dejó abrir (a veces el antivirus lo revisa la primera vez). El que había sigue igual. Vuelve a intentarlo en un minuto; si se repite, en Ajustes pulsa «Revisar el equipo» y sigue «Prefiero instalarlo a mano».';

// check(archivo) → true si el programa recién bajado arranca: se prueba antes de reemplazar al que había,
// para que una actualización que falla no deje sin programa.
export async function installTool(spec, { dir, onProgress = () => {}, signal, check = null } = {}) {
  if (spec.pick) spec = { ...spec, url: new URL(await pickName(spec, signal), spec.sums).href };
  fs.mkdirSync(dir, { recursive: true });
  const work = fs.mkdtempSync(path.join(dir, '.descarga-'));
  try {
    const download = path.join(work, 'descarga');
    const res = await get(spec.url, signal);
    const total = Number(res.headers.get('content-length')) || null;
    const hash = crypto.createHash('sha256');
    let received = 0;
    try {
      await pipeline(Readable.fromWeb(res.body), async function* count(source) {
        for await (const chunk of source) {
          received += chunk.length;
          hash.update(chunk);
          if (total) onProgress(received / total);
          yield chunk;
        }
      }, fs.createWriteStream(download));
    } catch {
      throw new Error(OFFLINE);
    }

    const expected = await expectedHash(spec, signal);
    if (expected && !spec.inner && expected !== hash.digest('hex')) {
      throw new Error('La descarga llegó incompleta o dañada. Vuelve a intentarlo.');
    }

    const installed = [];
    if (spec.extract) {
      const opened = path.join(work, 'abierto');
      fs.mkdirSync(opened);
      await unzip(download, opened);
      for (const name of spec.extract) {
        const found = findInside(opened, name);
        if (!found) throw new Error(`El archivo descargado no contiene ${name}. Instálalo a mano siguiendo los pasos.`);
        if (expected && spec.inner && crypto.createHash('sha256').update(fs.readFileSync(found)).digest('hex') !== expected) {
          throw new Error('La descarga llegó incompleta o dañada. Vuelve a intentarlo.');
        }
        installed.push([found, path.join(dir, name)]);
      }
    } else {
      // Con su nombre (en Windows, sin «.exe» no se ejecuta).
      const candidate = path.join(work, spec.file);
      fs.renameSync(download, candidate);
      installed.push([candidate, path.join(dir, spec.file)]);
    }
    for (const [file] of installed) fs.chmodSync(file, 0o755);
    if (check && !(await check(installed[0][0]))) throw new Error(NOT_RUNNABLE);
    for (const [file, target] of installed) {
      fs.copyFileSync(file, target);
      fs.chmodSync(target, 0o755);
    }
    return installed.map(([, target]) => target);
  } finally {
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  }
}
