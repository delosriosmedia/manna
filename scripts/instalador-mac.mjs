// Arma Instalar-Manna-Mac.pkg (fase 30) con lo que trae macOS (pkgbuild y productbuild), sin nada de terceros: un
// paquete sin archivos cuyo guion (instalacion/mac/postinstall) instala Manna con «Instalar Manna en Mac.command», y
// las páginas de instalacion/mac/recursos. Lo usa la compilación de GitHub (.github/workflows/instaladores.yml); en un
// Mac sirve igual:
//   node scripts/instalador-mac.mjs [salida.pkg]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || 'Instalar-Manna-Mac.pkg');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-pkg-'));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });
try {
  const scripts = path.join(tmp, 'guiones');
  fs.mkdirSync(scripts);
  // Escritos de nuevo, no copiados: una copia conserva los atributos de macOS, que irían en el .pkg como «._».
  fs.writeFileSync(path.join(scripts, 'postinstall'), fs.readFileSync(path.join(ROOT, 'instalacion', 'mac', 'postinstall')), { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'instalar.command'), fs.readFileSync(path.join(ROOT, 'Instalar Manna en Mac.command')), { mode: 0o755 });
  run('pkgbuild', ['--quiet', '--nopayload', '--scripts', scripts, '--identifier', 'app.manna.instalador', '--version', version, path.join(tmp, 'manna.pkg')]);

  const resources = path.join(tmp, 'recursos');
  fs.cpSync(path.join(ROOT, 'instalacion', 'mac', 'recursos'), resources, { recursive: true });
  // El logo de Manna abajo a la izquierda de la ventana del instalador, del mismo icono de la app.
  run('sips', ['-s', 'format', 'png', '--resampleWidth', '160', path.join(ROOT, 'instalacion', 'icono', 'manna.icns'), '--out', path.join(resources, 'fondo.png')]);
  const distribution = path.join(tmp, 'distribution.xml');
  fs.writeFileSync(distribution, fs.readFileSync(path.join(ROOT, 'instalacion', 'mac', 'distribution.xml'), 'utf8').replace('VERSION', version));
  run('productbuild', ['--quiet', '--distribution', distribution, '--resources', resources, '--package-path', tmp, out]);
  console.log(`✔ ${path.relative(process.cwd(), out)} (Manna ${version}, ${Math.round(fs.statSync(out).size / 1024)} KB)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
