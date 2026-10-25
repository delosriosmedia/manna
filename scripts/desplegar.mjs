// Arma el paquete de la nube (fase 36, parte 6): solo lo que necesita el hosting (package.json, server/ y web/ del último commit; las
// biblias y el himnario vienen de R2), en un .zip con la versión y la hora en el nombre: el hosting gasta cada archivo
// subido al compilarlo, y para repetir hace falta otro nombre. Con «probar», además lo abre como el hosting (con
// require() de server/inicio.cjs, en modo nube, con su puerto y contra un R2 de mentira) y comprueba que abre el puerto
// a tiempo, que se puede entrar y que el himnario llega de R2. Lo sube el asistente con el conector de Hostinger (ver
// .claude/rules/nube.md).
//
// Uso:  node scripts/desplegar.mjs           arma el paquete en data/despliegue/
//       node scripts/desplegar.mjs probar    y lo prueba (unos 30 s; necesita ffmpeg para el himnario de mentira)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deadline, killOnExit, sleep } from './lib/chrome.mjs';
import { seedHymnal } from './lib/himnario-falso.mjs';
import { startFakeR2 } from './lib/r2-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = ['package.json', 'server', 'web'];
// El hosting espera que la aplicación abra su puerto en sus primeros 3 s (prueba del hosting, 2026-10-25).
const PORT_WITHIN_MS = 3000;

const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
const out = path.join(ROOT, 'data', 'despliegue');
const zip = path.join(out, `manna-${version}-${stamp}.zip`);
fs.mkdirSync(out, { recursive: true });
fs.rmSync(zip, { force: true });
// Lo que está en el último commit, no lo que haya a medio hacer en la carpeta: se despliega lo publicado.
const made = spawnSync('git', ['archive', '--format=zip', '-o', zip, 'HEAD', ...PARTS], { cwd: ROOT, encoding: 'utf8' });
if (made.status !== 0) {
  console.error(`No se pudo armar el paquete: ${made.stderr || made.error?.message}`);
  process.exit(1);
}
console.log(`Paquete: ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1048576).toFixed(1)} MB)`);
if (!process.argv.includes('probar')) process.exit(0);

// ---- Probarlo como lo abre el hosting ----
deadline(2, 'La prueba del paquete', () => 'arrancando el paquete');
let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` (${detail})` : ''}`);
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-paquete-'));
const app = path.join(tmp, 'app');
fs.mkdirSync(app);
spawnSync('unzip', ['-q', zip, '-d', app]);
check('el paquete lleva solo lo que necesita la nube', fs.readdirSync(app).sort().join() === [...PARTS].sort().join(), fs.readdirSync(app).join(', '));

// Un R2 de mentira con la Reina-Valera 1909 y un himnario inventado.
const r2dir = path.join(tmp, 'r2');
fs.mkdirSync(path.join(r2dir, 'Biblias'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'Contenido', 'Biblias', 'Reina Valera 1909.xmm'), path.join(r2dir, 'Biblias', 'Reina Valera 1909.xmm'));
seedHymnal(path.join(r2dir, 'Himnario'), { count: 3, seconds: 2 });
const r2 = await startFakeR2(r2dir);
const port = await new Promise((resolve) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const base = `http://127.0.0.1:${port}`;
const log = [];
const t0 = Date.now();
// Como LiteSpeed: require() de la entrada, con las variables del sitio.
const child = killOnExit(spawn(process.execPath, ['-e', "require('./server/inicio.cjs')"], {
  cwd: app, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, MANNA_NUBE: '1', MANNA_DATA: path.join(tmp, 'datos'), PORT: String(port), MANNA_CLAVE_ALTA: 'clave-del-paquete', MANNA_NO_OPEN: '1', ...r2.env },
}));
child.stdout.on('data', (d) => log.push(String(d)));
child.stderr.on('data', (d) => log.push(String(d)));
try {
  let opened = null;
  for (let i = 0; i < 100 && opened === null; i += 1) {
    if (await fetch(`${base}/api/ping`).then((r) => r.ok, () => false)) opened = Date.now() - t0;
    else await sleep(100);
  }
  check(`abre el puerto en menos de ${PORT_WITHIN_MS / 1000} s`, opened !== null && opened < PORT_WITHIN_MS, opened === null ? 'no abrió' : `${opened} ms`);
  const info = await (await fetch(`${base}/api/session`)).json();
  check('en modo nube, con solo sus dos funciones y la clave de alta pendiente', info.roles.map((r) => r.id).join() === 'preparacion,administrar' && info.alta === true && info.isLocal === false);
  check('sirve la interfaz', (await fetch(`${base}/preparacion`)).status === 200 && (await fetch(`${base}/core/app.css`)).status === 200);
  const post = (url, body, cookie = '') => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  const alta = await post('/api/session/alta', { clave: 'clave-del-paquete', name: 'Prueba', pin: '1234', password: 'contraseña de prueba' });
  check('la clave de alta crea el administrador', alta.status === 200);
  const user = (await alta.json()).user?.id;
  const cookie = (await post('/api/session', { role: 'preparacion', user, pin: '1234' }, alta.headers.get('set-cookie')?.split(';')[0])).headers.get('set-cookie')?.split(';')[0] || '';
  let list = [];
  for (let i = 0; i < 60 && list.length < 3; i += 1) {
    list = (await (await fetch(`${base}/api/hymns`, { headers: { cookie } })).json()).hymns || [];
    if (list.length < 3) await sleep(250);
  }
  check('el himnario llega de R2', list.length === 3, `${list.length} himnos`);
  const video = list[0] && await fetch(base + list[0].url, { redirect: 'manual', headers: { cookie } });
  check('y cada himno, con un enlace de R2 que caduca', video?.status === 302 && video.headers.get('location').startsWith(r2.endpoint) && video.headers.get('location').includes('X-Amz-Signature='));
  const state = await (await fetch(`${base}/api/state`, { headers: { cookie } })).json();
  check('y la Reina-Valera 1909', (state.bible?.versions || []).some((v) => v.id === 'reina-valera-1909'));
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.on('exit', resolve)));
  await r2.stop();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}
if (failed) console.log(`\nLo que dijo Manna:\n${log.join('').trim().split('\n').slice(-20).join('\n')}`);
console.log(failed ? `\n${failed} comprobación(es) fallaron.` : '\nEl paquete funciona como lo abrirá el hosting.');
process.exit(failed ? 1 : 0);
