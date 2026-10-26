import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { arrange, pairingFrom } from '../instalacion/ordenar.mjs';

// Cómo ordenan los instaladores la carpeta de Manna (instalacion/ordenar.mjs), en carpetas temporales:
// una instalación nueva, la de la carpeta oculta, la antigua (la carpeta entera del proyecto), la carpeta
// sincronizada con la nube, volver a instalar y cerrar el Manna que esté abierto. Nada sale del temporal.
const WINDOWS = 'Instalar Manna en Windows.bat';
const MAC = 'Instalar Manna en Mac.command';
const write = (file, text = 'x') => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const list = (dir) => fs.readdirSync(dir).sort();
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function setup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-instalar-'));
  const origen = path.join(tmp, 'bajado', 'manna-main');
  for (const file of ['server/index.js', 'web/app.js', 'README.md', WINDOWS, MAC, 'Contenido/LEEME.txt', 'Contenido/Biblias/rv1909.xmm']) write(path.join(origen, file), `nuevo ${file}`);
  return { tmp, origen, oculta: path.join(tmp, 'oculta'), documentos: path.join(tmp, 'Documentos') };
}
const expected = process.platform === 'win32' ? ['Contenido', MAC, 'Programa'] : ['Contenido', MAC, WINDOWS, 'Programa'];

test('una instalación nueva: la carpeta Manna con los instaladores, Contenido y Programa, y nada más', async () => {
  const t = setup();
  try {
    const res = await arrange({ ...t, nube: false });
    const raiz = path.join(t.documentos, 'Manna');
    assert.deepEqual([res.raiz, res.programa], [raiz, path.join(raiz, 'Programa', 'programa')]);
    assert.deepEqual(list(raiz), expected);
    assert.equal(fs.readFileSync(path.join(raiz, 'Programa', 'programa', 'server', 'index.js'), 'utf8'), 'nuevo server/index.js');
    assert.deepEqual(json(path.join(raiz, 'Programa', 'carpetas.json')), { datos: path.join(raiz, 'Programa', 'datos'), contenido: path.join(raiz, 'Contenido'), raiz });
    assert.ok(fs.existsSync(path.join(raiz, 'Contenido', 'Biblias', 'rv1909.xmm')), 'el contenido recibe lo que trae Manna');
    if (process.platform !== 'win32') assert.ok(fs.statSync(path.join(raiz, MAC)).mode & 0o100, 'el instalador de Mac se puede abrir');

    // Volver a instalar no cambia nada de sitio ni crea «antiguo».
    write(path.join(raiz, 'Programa', 'datos', 'orden.json'), 'mi orden');
    const again = await arrange({ ...t, nube: false });
    assert.equal(again.antiguo, null);
    assert.deepEqual(list(raiz), expected);
    assert.equal(fs.readFileSync(path.join(raiz, 'Programa', 'datos', 'orden.json'), 'utf8'), 'mi orden');
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('el instalador bajado de la nube de una iglesia deja a Manna lo necesario para emparejarse (decisión 64)', async () => {
  const t = setup();
  try {
    assert.equal(pairingFrom('Instalar-Manna-Windows.exe'), null, 'el de GitHub no empareja');
    const res = await arrange({ ...t, nube: false, instalador: path.join(t.tmp, 'Descargas', 'Instalar-Manna-pruebas.manna-iglesia.es-1a2b3c4d5e6f (1).exe') });
    assert.equal(res.emparejar, 'pruebas.manna-iglesia.es');
    assert.deepEqual(json(path.join(t.documentos, 'Manna', 'Programa', 'datos', 'emparejar.json')), { url: 'https://pruebas.manna-iglesia.es', code: '1a2b3c4d5e6f' });
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('desde la carpeta oculta: los datos se mueven a Programa y el contenido de la iglesia no se toca', async () => {
  const t = setup();
  try {
    const contenido = path.join(t.documentos, 'Manna', 'Contenido');
    write(path.join(t.oculta, 'programa', 'server', 'index.js'), 'viejo');
    write(path.join(t.oculta, 'datos', 'orden.json'), 'mi orden');
    write(path.join(contenido, 'LEEME.txt'), 'el de la iglesia');
    write(path.join(contenido, 'Himnario', 'videos', '001 Himno.mp4'), 'video');
    write(path.join(t.oculta, 'carpetas.json'), JSON.stringify({ datos: path.join(t.oculta, 'datos'), contenido }));
    const res = await arrange({ ...t, lanzador: path.join(t.oculta, 'programa'), nube: false });
    const raiz = path.join(t.documentos, 'Manna');
    assert.deepEqual(list(raiz), expected);
    assert.equal(fs.readFileSync(path.join(raiz, 'Programa', 'datos', 'orden.json'), 'utf8'), 'mi orden', 'los datos, movidos');
    assert.equal(fs.readFileSync(path.join(contenido, 'LEEME.txt'), 'utf8'), 'el de la iglesia', 'lo que ya había no se pisa');
    assert.ok(fs.existsSync(path.join(contenido, 'Himnario', 'videos', '001 Himno.mp4')));
    assert.deepEqual(list(t.oculta), ['donde.json'], 'en la carpeta oculta solo queda dónde está ahora');
    assert.equal(res.programa, path.join(raiz, 'Programa', 'programa'));
    // Aunque se borre el icono, la próxima vez lo encuentra.
    const again = await arrange({ ...t, nube: false });
    assert.equal(again.programa, res.programa);
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('a la antigua (la carpeta entera del proyecto): se ordena donde está; lo viejo va a antiguo y lo ajeno se queda', async () => {
  const t = setup();
  try {
    const x = path.join(t.tmp, 'Mis cosas', 'Manna-main');
    for (const file of ['server/index.js', 'web/app.js', 'README.md', WINDOWS, MAC]) write(path.join(x, file), `viejo ${file}`);
    write(path.join(x, 'data', 'ajustes.json'), JSON.stringify({ id: 'no-esta-abierto' }));
    write(path.join(x, 'Contenido', 'Biblias', 'NVI.xmm'), 'biblia');
    write(path.join(x, 'mis notas.txt'), 'mío');
    // Como el Windows del dueño: el instalador anterior ya llevó el programa a la carpeta oculta, y los datos siguieron aquí.
    write(path.join(t.oculta, 'programa', 'server', 'index.js'), 'viejo');
    write(path.join(t.oculta, 'carpetas.json'), JSON.stringify({ datos: path.join(x, 'data'), contenido: path.join(x, 'Contenido') }));
    const res = await arrange({ ...t, lanzador: path.join(t.oculta, 'programa'), nube: false });
    assert.deepEqual(list(x), [...expected, 'mis notas.txt'].sort());
    assert.equal(json(path.join(x, 'Programa', 'datos', 'ajustes.json')).id, 'no-esta-abierto');
    assert.ok(fs.existsSync(path.join(x, 'Contenido', 'Biblias', 'NVI.xmm')));
    assert.ok(res.antiguo?.startsWith(path.join(x, 'Programa', 'antiguo')));
    assert.deepEqual(list(res.antiguo), process.platform === 'win32' ? [WINDOWS, 'README.md', 'server', 'web'] : ['README.md', 'server', 'web']);
    assert.equal(fs.readFileSync(path.join(x, MAC), 'utf8'), `nuevo ${MAC}`, 'el instalador, al día');
    assert.deepEqual(json(path.join(x, 'Programa', 'carpetas.json')).contenido, path.join(x, 'Contenido'));
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('una copia que se actualizaba a mano, con el instalador abierto desde ella: se ordena ahí aunque no haya icono', async () => {
  const t = setup();
  try {
    const x = path.join(t.tmp, 'Escritorio', 'Manna');
    for (const file of ['server/index.js', 'web/app.js', 'README.md', WINDOWS, MAC]) write(path.join(x, file), `viejo ${file}`);
    write(path.join(x, 'data', 'tunel.json'), '{"on":true}');
    write(path.join(x, 'Contenido', 'Himnario', 'letras', 'letras.md'), 'letras');
    const res = await arrange({ ...t, aqui: x, nube: false });
    assert.deepEqual(list(x), expected);
    assert.equal(fs.readFileSync(path.join(x, 'Programa', 'datos', 'tunel.json'), 'utf8'), '{"on":true}');
    assert.ok(fs.existsSync(path.join(x, 'Contenido', 'Himnario', 'letras', 'letras.md')));
    assert.ok(!fs.existsSync(path.join(t.documentos, 'Manna')), 'no se crea otra carpeta en Documentos');
    // Desde la carpeta ya ordenada, y desde Descargas con la pista de la carpeta oculta, sigue siendo la misma.
    assert.equal((await arrange({ ...t, aqui: x, nube: false })).programa, res.programa);
    assert.equal((await arrange({ ...t, aqui: path.join(x, 'Programa', 'programa'), nube: false })).programa, res.programa);
    assert.equal((await arrange({ ...t, aqui: path.join(t.tmp, 'Descargas'), nube: false })).programa, res.programa);
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

// El Windows del dueño (2026-10-17): pegaba lo de GitHub en Documentos/Manna, junto a su Contenido, y Manna usaba
// los datos de la carpeta oculta (con la clave del túnel). Una copia abierta aparte había dejado un data/ suelto.
function ownerCase(t) {
  const x = path.join(t.documentos, 'Manna');
  for (const file of ['server/index.js', 'web/app.js', 'README.md', WINDOWS, MAC]) write(path.join(x, file), `viejo ${file}`);
  write(path.join(x, 'data', 'ajustes.json'), JSON.stringify({ id: 'copia-suelta' }));
  write(path.join(x, 'Contenido', 'Biblias', 'NVI.xmm'), 'biblia');
  write(path.join(t.oculta, 'programa', 'server', 'index.js'), 'viejo');
  write(path.join(t.oculta, 'datos', 'ajustes.json'), JSON.stringify({ id: 'la-de-siempre' }));
  write(path.join(t.oculta, 'datos', 'tunel.json'), JSON.stringify({ on: true, token: 'eyJclave', address: 'https://manna.ejemplo.org' }));
  write(path.join(t.oculta, 'carpetas.json'), JSON.stringify({ datos: path.join(t.oculta, 'datos'), contenido: path.join(x, 'Contenido') }));
  return x;
}

test('abierto junto a un Contenido que ya usa una instalación, se quedan sus datos (con la conexión por internet)', async () => {
  const t = setup();
  try {
    const x = ownerCase(t);
    const res = await arrange({ ...t, aqui: x, nube: false });
    assert.equal(json(path.join(x, 'Programa', 'datos', 'ajustes.json')).id, 'la-de-siempre');
    assert.equal(res.dominio, 'https://manna.ejemplo.org', 'la conexión por internet sigue con su dominio');
    assert.deepEqual(list(x), expected, 'el data suelto no se queda en la carpeta');
    assert.equal(json(path.join(res.antiguo, 'data', 'ajustes.json')).id, 'copia-suelta', 'y no se borra: va a antiguo');
    assert.ok(!fs.existsSync(path.join(t.oculta, 'carpetas.json')));
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('si una versión anterior eligió mal los datos, al volver a abrirlo vuelven los de siempre', async () => {
  const t = setup();
  try {
    const x = ownerCase(t);
    // Lo que dejó la 1.25.1: la carpeta ordenada con los datos sueltos, y la oculta todavía con los de siempre.
    fs.mkdirSync(path.join(x, 'Programa'));
    fs.renameSync(path.join(x, 'data'), path.join(x, 'Programa', 'datos'));
    write(path.join(x, 'Programa', 'carpetas.json'), JSON.stringify({ datos: path.join(x, 'Programa', 'datos'), contenido: path.join(x, 'Contenido') }));
    const res = await arrange({ ...t, aqui: x, nube: false });
    assert.equal(json(path.join(x, 'Programa', 'datos', 'ajustes.json')).id, 'la-de-siempre');
    assert.equal(res.dominio, 'https://manna.ejemplo.org');
    assert.equal(json(path.join(res.antiguo, 'datos', 'ajustes.json')).id, 'copia-suelta', 'los de la versión anterior, guardados');
    assert.ok(res.avisos.some((a) => a.includes('Se recuperaron')));
    assert.ok(!fs.existsSync(path.join(t.oculta, 'carpetas.json')));
    // Y la próxima vez ya no cambia nada.
    const again = await arrange({ ...t, aqui: x, nube: false });
    assert.equal(json(path.join(x, 'Programa', 'datos', 'ajustes.json')).id, 'la-de-siempre');
    assert.equal(again.antiguo, null);
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('una copia de desarrollo (con .git) no se reordena, ni abriendo el instalador desde ella ni si la app apunta a ella', async () => {
  const t = setup();
  try {
    const dev = path.join(t.tmp, 'proyecto');
    for (const file of ['.git/HEAD', 'server/index.js', 'data/ajustes.json', 'Contenido/LEEME.txt']) write(path.join(dev, file));
    await arrange({ ...t, aqui: dev, nube: false });
    assert.deepEqual(list(dev), ['.git', 'Contenido', 'data', 'server']);
    // Como el Mac del dueño (2026-10-17): la app Manna apuntaba a la carpeta del proyecto.
    await assert.rejects(arrange({ ...t, aqui: dev, lanzador: dev, nube: false }), /con git/);
    assert.deepEqual(list(dev), ['.git', 'Contenido', 'data', 'server']);
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('con la carpeta de contenido elegida en otro sitio (Ajustes, fase 29), al actualizar todo sigue donde estaba', async () => {
  const t = setup();
  try {
    await arrange({ ...t, nube: false });
    const raiz = path.join(t.documentos, 'Manna');
    const otra = path.join(t.tmp, 'Disco', 'Iglesia');
    write(path.join(otra, 'Himnario', 'videos', '001 Himno.mp4'), 'mío');
    const places = path.join(raiz, 'Programa', 'carpetas.json');
    fs.writeFileSync(places, JSON.stringify({ ...json(places), contenido: otra, elegida: true }));
    const res = await arrange({ ...t, nube: false });
    assert.deepEqual([res.raiz, res.programa, res.contenido], [raiz, path.join(raiz, 'Programa', 'programa'), otra]);
    assert.deepEqual(json(places), { datos: path.join(raiz, 'Programa', 'datos'), contenido: otra, raiz, elegida: true }, 'se recuerda que se eligió');
    assert.deepEqual(list(path.join(t.tmp, 'Disco')), ['Iglesia'], 'junto a la elegida no se pone nada');
    assert.equal(fs.readFileSync(path.join(otra, 'Himnario', 'videos', '001 Himno.mp4'), 'utf8'), 'mío');
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('si la carpeta se sincroniza con la nube, Programa se queda en la carpeta oculta', async () => {
  const t = setup();
  try {
    const res = await arrange({ ...t, nube: true });
    const raiz = path.join(t.documentos, 'Manna');
    assert.deepEqual(list(raiz), expected.filter((n) => n !== 'Programa'));
    assert.equal(res.programa, path.join(t.oculta, 'programa'));
    assert.deepEqual(json(path.join(t.oculta, 'carpetas.json')).contenido, path.join(raiz, 'Contenido'));
  } finally {
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('el Manna abierto con esos datos se apaga antes de moverlos; otro Manna del equipo, no', async () => {
  const t = setup();
  const asked = [];
  const fake = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.url === '/api/ping') return res.end(JSON.stringify({ id: fake.id }));
      if (req.url === '/api/session') return res.writeHead(200, { 'Set-Cookie': 'manna=1' }).end('{}');
      asked.push([req.headers.cookie, JSON.parse(body).type]);
      res.end('{}');
      fake.close();
      fake.closeAllConnections();
      return undefined;
    });
  });
  await new Promise((resolve) => { fake.listen(0, '127.0.0.1', resolve); });
  try {
    fake.id = 'otro-manna';
    write(path.join(t.oculta, 'datos', 'ajustes.json'), JSON.stringify({ id: 'este', port: fake.address().port }));
    write(path.join(t.oculta, 'carpetas.json'), JSON.stringify({ datos: path.join(t.oculta, 'datos'), contenido: path.join(t.documentos, 'Manna', 'Contenido') }));
    await arrange({ ...t, nube: true });
    assert.deepEqual(asked, [], 'otro Manna (otro id) no se apaga');
    fake.id = 'este';
    await arrange({ ...t, nube: true });
    assert.deepEqual(asked, [['manna=1', 'system.shutdown']]);
  } finally {
    fake.close();
    fs.rmSync(t.tmp, { recursive: true, force: true });
  }
});

// El instalador de Mac entero, como lo abre una persona o el .pkg, en carpetas temporales: con el Manna de esta copia
// (en un .zip) y un Node.js de mentira de dos líneas que llama al del equipo (liviano; su huella sí se comprueba).
test('el instalador de Mac entero: baja Node.js, lo comprueba, ordena la carpeta y crea la app; al actualizar, reutiliza su Node.js', { skip: process.platform !== 'darwin' && 'solo en Mac' }, async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-instalador-'));
  try {
    const name = 'node-v24.0.0-darwin-' + (process.arch === 'arm64' ? 'arm64' : 'x64');
    write(path.join(t, 'nodo', name, 'bin', 'node'), `#!/bin/bash\nexec ${JSON.stringify(process.execPath)} "$@"\n`);
    fs.chmodSync(path.join(t, 'nodo', name, 'bin', 'node'), 0o755);
    execFileSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: path.join(t, 'nodo') });
    const sha = execFileSync('shasum', ['-a', '256', `${name}.tar.gz`], { cwd: path.join(t, 'nodo'), encoding: 'utf8' }).split(' ')[0];
    fs.writeFileSync(path.join(t, 'nodo', 'SHASUMS256.txt'), `${'0'.repeat(64)}  node-v24.0.0-linux-x64.tar.gz\n${sha}  ${name}.tar.gz\n`);
    const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => f && fs.existsSync(path.join(ROOT, f)));
    for (const f of files) { fs.mkdirSync(path.dirname(path.join(t, 'zip', 'manna-main', f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(t, 'zip', 'manna-main', f)); }
    execFileSync('zip', ['-qr', 'manna.zip', 'manna-main'], { cwd: path.join(t, 'zip') });
    const env = { ...process.env, HOME: t, MANNA_DESCARGA: `file://${t}/zip/manna.zip`, MANNA_NODE_DESCARGA: `file://${t}/nodo`, MANNA_BASE: path.join(t, 'oculta'), MANNA_DOCUMENTOS: path.join(t, 'Documentos'), MANNA_DESTINO: path.join(t, 'Apps') };
    const first = spawnSync('bash', [path.join(ROOT, MAC)], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const raiz = path.join(t, 'Documentos', 'Manna');
    assert.deepEqual(list(path.join(raiz, 'Programa')), ['carpetas.json', 'datos', 'node', 'programa']);
    const app = fs.readFileSync(path.join(t, 'Apps', 'Manna.app', 'Contents', 'MacOS', 'Manna'), 'utf8');
    assert.match(app, /PROYECTO\/\.\.\/node\/bin\/node/, 'la app abre Manna con su Node.js');
    // Actualizar desde la copia del programa (lo que abre Manna): sin bajar Node.js otra vez (no hay de dónde).
    const second = spawnSync('bash', [path.join(raiz, 'Programa', 'programa', MAC)], { env: { ...env, MANNA_NODE_DESCARGA: `file://${t}/no-existe` }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /Ya está el de Manna/);
    // Una descarga de Node.js con otra huella no se usa.
    fs.writeFileSync(path.join(t, 'nodo', 'SHASUMS256.txt'), `${'1'.repeat(64)}  ${name}.tar.gz\n`);
    // Como lo ejecuta el .pkg (MANNA_PKG): el motivo queda en un archivo, para la ventana que lo dice.
    const reason = path.join(t, 'motivo');
    const bad = spawnSync('bash', [path.join(ROOT, MAC)], { env: { ...env, MANNA_PKG: '1', MANNA_PKG_ERROR: reason, MANNA_DOCUMENTOS: path.join(t, 'Otros'), MANNA_BASE: path.join(t, 'oculta2'), MANNA_DESTINO: path.join(t, 'Apps2') }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(bad.status, 1);
    assert.match(fs.readFileSync(reason, 'utf8'), /huella no coincide/);
    assert.doesNotMatch(bad.stdout, /\u001b\[/, 'sin colores fuera de la Terminal');
  } finally {
    fs.rmSync(t, { recursive: true, force: true });
  }
});
