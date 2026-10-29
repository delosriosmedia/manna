// Trae a web/vendor/ las letras del «texto fijo» (Textos, 2026-10-29), además de Sora, que ya está: cuatro que se
// leen bien en pequeño y de lejos. Todas con la SIL Open Font License, de su paquete oficial en npm (Fontsource, que
// publica las de Google Fonts), comprobado contra la huella que publica el propio registro; si no coincide, no se
// copia nada. Del paquete se guardan solo las letras latinas (el español entero cabe en ellas) y su licencia.
//
// Uso:  node scripts/actualizar-fuentes.mjs     (necesita internet; solo al cambiar de versión)
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FONTS = [
  // La más legible: la hizo el Braille Institute para personas con baja visión.
  { name: 'atkinson', pkg: '@fontsource/atkinson-hyperlegible', version: '5.3.0', files: ['atkinson-hyperlegible-latin-400-normal.woff2', 'atkinson-hyperlegible-latin-700-normal.woff2'] },
  // Redondeada y amable, pensada para leer con facilidad.
  { name: 'lexend', pkg: '@fontsource-variable/lexend', version: '5.3.0', files: ['lexend-latin-wght-normal.woff2'] },
  // Con remates, para ocasiones formales; hecha para leerse en pantalla.
  { name: 'merriweather', pkg: '@fontsource-variable/merriweather', version: '5.3.0', files: ['merriweather-latin-wght-normal.woff2'] },
];
const vendor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'vendor');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-fuentes-'));

try {
  for (const font of FONTS) {
    const meta = await (await fetch(`https://registry.npmjs.org/${font.pkg}/${font.version}`)).json();
    const { tarball, integrity } = meta.dist || {};
    if (!tarball || !/^sha512-/.test(integrity || '')) throw new Error(`El registro no publica ${font.pkg} ${font.version} con su huella.`);
    if (new URL(tarball).hostname !== 'registry.npmjs.org') throw new Error('El paquete no está en el registro oficial.');
    const bytes = Buffer.from(await (await fetch(tarball)).arrayBuffer());
    if (`sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}` !== integrity) throw new Error(`La huella de ${font.pkg} no coincide con la publicada: no se copia nada.`);
    const work = path.join(tmp, font.name);
    fs.mkdirSync(work);
    fs.writeFileSync(path.join(work, 'paquete.tgz'), bytes);
    if (spawnSync('tar', ['-xzf', 'paquete.tgz'], { cwd: work }).status !== 0) throw new Error('No se pudo abrir el paquete (hace falta "tar").');
    const out = path.join(vendor, font.name);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    for (const file of font.files) fs.copyFileSync(path.join(work, 'package', 'files', file), path.join(out, file));
    fs.copyFileSync(path.join(work, 'package', 'LICENSE'), path.join(out, 'OFL.txt'));
    console.log(`${font.pkg} ${font.version} → web/vendor/${font.name}/`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
