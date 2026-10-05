// Trae pdf.js (Mozilla, licencia Apache 2.0) a web/vendor/pdfjs/: lo que hace falta para que el
// navegador convierta las páginas de un PDF en imágenes (módulo Diapositivas).
//
// Uso:  node scripts/actualizar-pdfjs.mjs     (necesita internet; solo al cambiar de versión)
// Para cambiar de versión: pon el número en VERSION y ejecuta esto.
//
// Se descarga el paquete oficial del registro de npm y se comprueba contra la huella que el
// propio registro publica; si no coincide, no se copia nada. Del paquete solo se guarda:
//   pdf.min.mjs, pdf.worker.min.mjs   la biblioteca, en su variante para navegadores no tan nuevos
//   standard_fonts/                   las tipografías de un PDF que no trae las suyas
//   cmaps/                            tablas de caracteres (chino, japonés, coreano)
//   wasm/                             imágenes JPEG 2000 y JBIG2 (PDF escaneados) y perfiles de color
//   iccs/                             perfil de color para imágenes CMYK
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '6.4.299';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'vendor', 'pdfjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-pdfjs-'));

try {
  const meta = await (await fetch(`https://registry.npmjs.org/pdfjs-dist/${VERSION}`)).json();
  const { tarball, integrity } = meta.dist || {};
  if (!tarball || !/^sha512-/.test(integrity || '')) throw new Error(`El registro no publica la versión ${VERSION} con su huella.`);
  if (new URL(tarball).hostname !== 'registry.npmjs.org') throw new Error('El paquete no está en el registro oficial.');
  const bytes = Buffer.from(await (await fetch(tarball)).arrayBuffer());
  const got = `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`;
  if (got !== integrity) throw new Error('La huella del paquete no coincide con la publicada: no se copia nada.');
  const packed = path.join(tmp, 'pdfjs.tgz');
  fs.writeFileSync(packed, bytes);
  if (spawnSync('tar', ['-xzf', packed, '-C', tmp]).status !== 0) throw new Error('No se pudo abrir el paquete (hace falta "tar").');

  const from = path.join(tmp, 'package');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const copy = (relative, to = path.basename(relative)) => fs.copyFileSync(path.join(from, relative), path.join(out, to));
  copy('legacy/build/pdf.min.mjs');
  copy('legacy/build/pdf.worker.min.mjs');
  copy('LICENSE');
  for (const folder of ['standard_fonts', 'cmaps', 'wasm', 'iccs']) {
    fs.mkdirSync(path.join(out, folder));
    // quickjs es para ejecutar el código que algunos PDF llevan dentro: Manna no lo ejecuta.
    for (const name of fs.readdirSync(path.join(from, folder)).filter((n) => !n.startsWith('quickjs'))) copy(`${folder}/${name}`, `${folder}/${name}`);
  }
  fs.writeFileSync(path.join(out, 'VERSION.txt'), `pdf.js ${VERSION} (paquete pdfjs-dist, variante "legacy")\n${tarball}\n${integrity}\n`);
  const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => total + (entry.isDirectory() ? size(path.join(dir, entry.name)) : fs.statSync(path.join(dir, entry.name)).size), 0);
  console.log(`pdf.js ${VERSION} en ${path.relative(process.cwd(), out)} (${(size(out) / 1024 / 1024).toFixed(1)} MB)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
