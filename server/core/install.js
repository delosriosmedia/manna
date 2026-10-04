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
//   sha256    dirección de un archivo que contiene solo el sha256
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
  const text = await (await get(source, signal)).text();
  const name = path.posix.basename(new URL(spec.url).pathname);
  const line = spec.sums
    ? text.split(/\r?\n/).find((l) => l.trim().split(/\s+/).at(-1)?.replace(/^\*/, '') === name)
    : text;
  const hash = /\b[a-f0-9]{64}\b/i.exec(line || '')?.[0];
  if (!hash) throw new Error('No se pudo comprobar la descarga: falta su huella de verificación. Instálalo a mano.');
  return hash.toLowerCase();
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

export async function installTool(spec, { dir, onProgress = () => {}, signal } = {}) {
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
    if (expected && expected !== hash.digest('hex')) {
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
        const target = path.join(dir, name);
        fs.copyFileSync(found, target);
        installed.push(target);
      }
    } else {
      const target = path.join(dir, spec.file);
      fs.copyFileSync(download, target);
      installed.push(target);
    }
    for (const file of installed) fs.chmodSync(file, 0o755);
    return installed;
  } finally {
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  }
}
