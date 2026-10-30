// La página de bienvenida y los manuales de manna-iglesia.es (decisión 67): arma data/sitio/ y su .zip para el hosting.
//   node scripts/sitio.mjs             vuelve a tomar las capturas (con la auditoría, datos inventados) y arma el sitio
//   node scripts/sitio.mjs sin-capturas  arma el sitio con las capturas de la última vez (para cambios de texto)
// Las capturas no se guardan en el repositorio: se toman de la versión de ahora, así los manuales no se quedan viejos.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'sitio');
const SHOTS = path.join(OUT, 'capturas');
const PHONE = '390x844';
const LAPTOP = '1280x720';
// Archivo de la captura, tamaño y pantalla de la auditoría (scripts/auditar-responsive.mjs, SCREENS).
const CAPTURES = [
  ['portada', LAPTOP, 'Portada de la nube'],
  ['portada-celular', PHONE, 'Portada de la nube'],
  ['inicio-celular', PHONE, 'Inicio'],
  ['preparar-orden', LAPTOP, 'Preparar el culto: orden'],
  ['preparar-biblia', LAPTOP, 'Preparar el culto: Biblia'],
  ['preparar-himnario', LAPTOP, 'Preparar el culto: himnario'],
  ['preparar-medios', LAPTOP, 'Preparar el culto: medios'],
  ['administrar-usuarios', LAPTOP, 'Administrar la iglesia'],
  ['administrar-equipo', LAPTOP, 'Administrar la iglesia: equipo'],
  ['super-iglesias', LAPTOP, 'Superadministrador: iglesias'],
  ['super-espacio', LAPTOP, 'Superadministrador: espacio'],
  ['super-copias', LAPTOP, 'Superadministrador: copias'],
  ['revision', LAPTOP, 'Revisión del equipo'],
  ['control', LAPTOP, 'Al aire con un himno'],
  ['historias-celular', PHONE, 'Al aire con un himno'],
  ['presentador', LAPTOP, 'Orador: presentando'],
  ['buscar', LAPTOP, 'Buscar en todo'],
  ['ajustes-usuarios', LAPTOP, 'Ajustes: usuarios'],
];

function capture() {
  const words = [...new Set(CAPTURES.map(([, size, screen]) => [size, screen]).flat())];
  console.log(`Tomando ${CAPTURES.length} capturas con la auditoría (unos 3 min)…`);
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'auditar-responsive.mjs'), 'capturas', ...words], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, MANNA_CAPTURAS_ESCALA: '2' }, maxBuffer: 64 * 1024 * 1024,
  });
  const dir = /Capturas en: (.+)/.exec(run.stdout)?.[1]?.trim();
  if (!dir || !fs.existsSync(dir)) throw new Error(`La auditoría no dejó capturas:\n${run.stdout.slice(-2000)}\n${run.stderr.slice(-2000)}`);
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [file, size, screen] of CAPTURES) {
    const png = path.join(dir, `${size} ${screen.replace(/[:"]/g, '')}.png`);
    if (!fs.existsSync(png)) throw new Error(`Falta la captura «${screen}» en ${size}.`);
    // A la mitad de lo tomado (se tomó al doble): nítido en pantallas densas y liviano.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', `scale=${size === PHONE ? 600 : 1400}:-2`, '-q:v', '4', path.join(SHOTS, `${file}.jpg`)]);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

if (!process.argv.includes('sin-capturas')) capture();
else if (!fs.existsSync(SHOTS)) throw new Error('No hay capturas de antes: corre `node scripts/sitio.mjs` sin «sin-capturas».');

// Las páginas, las letras y el logo de Manna (el sitio no carga nada de fuera).
for (const name of fs.readdirSync(OUT)) if (name !== 'capturas') fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'sitio'), OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'letras'), { recursive: true });
for (const font of ['sora/Sora-latin.woff2', 'sora/Sora-latin-ext.woff2', 'geist/GeistMono-Variable.woff2']) {
  fs.copyFileSync(path.join(ROOT, 'web', 'vendor', font), path.join(OUT, 'letras', path.basename(font)));
}
for (const file of ['marca.svg', 'logo.svg', 'icono-180.png']) fs.copyFileSync(path.join(ROOT, 'web', file), path.join(OUT, file));

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const zip = path.join(ROOT, 'data', 'despliegue', `sitio-${stamp}.zip`);
fs.mkdirSync(path.dirname(zip), { recursive: true });
execFileSync('zip', ['-qr', zip, '.', '-x', '.*'], { cwd: OUT });
console.log(`Sitio en ${path.relative(ROOT, OUT)}/ y su paquete en ${path.relative(ROOT, zip)} (${Math.round(fs.statSync(zip).size / 1024)} KB).`);
