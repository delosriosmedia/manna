import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addFont, deckFonts, fontDirs, fontNames, fontsFor, installedFonts, installFont, officeFolder, userFontDir } from '../server/modules/slides/fuentes.js';
import { hasMotion, readZip } from '../server/modules/slides/pptx.js';
import { makeFont, serveFonts } from '../scripts/lib/letra.mjs';
import { makePptx } from '../scripts/lib/pptx.mjs';

// Las letras de una presentación, para DeckCraft con animaciones (que no ve las del equipo). Las presentaciones y las
// letras se fabrican aquí mismo: ninguna de una iglesia ni del equipo.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-letras-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const deck = path.join(tmp, 'letras.pptx');
fs.writeFileSync(deck, makePptx([{ text: 'Uno', font: 'Letra de Prueba' }, { text: 'Dos', font: 'Letra Que Falta' }, { text: 'Tres', font: 'Letra de Dentro' }, { text: 'Cuatro', font: 'Letra Comprimida' }],
  { embedded: [{ name: 'Letra de Dentro' }, { name: 'Letra Comprimida', compressed: true }] }));

test('del .pptx se leen solo las partes pedidas, descomprimidas', () => {
  const parts = readZip(deck, (name) => name.startsWith('ppt/slides/slide'));
  assert.deepEqual([...parts.keys()].sort(), ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide3.xml', 'ppt/slides/slide4.xml']);
  assert.match(parts.get('ppt/slides/slide1.xml').toString('utf8'), /typeface="Letra de Prueba"/);
  const notZip = path.join(tmp, 'nada.pptx');
  fs.writeFileSync(notZip, 'esto no es un zip');
  assert.throws(() => readZip(notZip, () => true), /zip/);
});

test('las letras que usa: las del tema y las de cada diapositiva; aparte, las que trae dentro sin comprimir', () => {
  assert.deepEqual(deckFonts(deck), { used: ['Arial', 'Letra Comprimida', 'Letra Que Falta', 'Letra de Dentro', 'Letra de Prueba'], embedded: ['Letra de Dentro'] });
});

test('si algo se mueve en una presentación: una transición sí; nada, o un archivo que no se lee, no', () => {
  const moving = path.join(tmp, 'se-mueve.pptx');
  fs.writeFileSync(moving, makePptx([{ text: 'Uno' }, { text: 'Dos', transition: true }]));
  assert.equal(hasMotion(moving), true);
  assert.equal(hasMotion(deck), false);
  assert.equal(hasMotion(path.join(tmp, 'no-existe.pptx')), false);
});

test('el nombre de familia de un archivo de letra, de su tabla «name»', () => {
  const file = path.join(tmp, 'una.ttf');
  fs.writeFileSync(file, makeFont('Letra de Prueba'));
  assert.deepEqual(fontNames(file), ['letra de prueba']);
  fs.writeFileSync(path.join(tmp, 'rota.ttf'), 'no es una letra');
  assert.deepEqual(fontNames(path.join(tmp, 'rota.ttf')), []);
});

test('se mandan las instaladas que usa, y faltan las que no están ni vienen dentro', () => {
  const dir = path.join(tmp, 'instaladas');
  fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'prueba.ttf'), makeFont('Letra de Prueba'));
  fs.writeFileSync(path.join(dir, 'sub', 'arial.ttf'), makeFont('Arial'));
  fs.writeFileSync(path.join(dir, 'otra.ttf'), makeFont('Letra Que No Usa'));
  const index = installedFonts([dir]);
  const { files, missing } = fontsFor(deck, index);
  assert.deepEqual(files.map((f) => path.basename(f)).sort(), ['arial.ttf', 'prueba.ttf']);
  assert.deepEqual(missing, ['Letra Comprimida', 'Letra Que Falta'], 'la comprimida falta: las miniaturas no la leen');
  // Instalar una letra cambia la carpeta, y el índice se rehace.
  fs.writeFileSync(path.join(dir, 'falta.ttf'), makeFont('Letra Que Falta'));
  fs.writeFileSync(path.join(dir, 'comprimida.ttf'), makeFont('Letra Comprimida'));
  fs.utimesSync(dir, new Date(), new Date(Date.now() + 5000));
  assert.deepEqual(fontsFor(deck, installedFonts([dir])).missing, []);
});

// Lo de Nueva Vida (2026-11-14): Helvetica, «system-ui» y «ui-sans-serif» salían como letras que había que instalar a mano.
test('no faltan las que tienen una gemela de las mismas medidas ni los nombres de página web; la gemela se manda', () => {
  const web = path.join(tmp, 'de-la-web.pptx');
  fs.writeFileSync(web, makePptx([{ text: 'Uno', font: 'Helvetica' }, { text: 'Dos', font: 'system-ui' }, { text: 'Tres', font: 'ui-sans-serif' }, { text: 'Cuatro', font: 'Helvetica Neue' }]));
  const dir = path.join(tmp, 'con-arial');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'arial.ttf'), makeFont('Arial'));
  const { files, missing, replaced } = fontsFor(web, installedFonts([dir]));
  assert.deepEqual(missing, ['Helvetica Neue'], 'Helvetica Neue no tiene gemela de las mismas medidas: esa sí falta');
  assert.deepEqual(replaced, [{ name: 'Helvetica', as: 'Arial' }]);
  assert.deepEqual(files.map((f) => path.basename(f)), ['arial.ttf'], 'con Arial dibuja DeckCraft la Helvetica');
});

test('una letra subida: solo si es una letra, a la carpeta de letras de quien usa el equipo, con su nombre', () => {
  const dir = path.join(tmp, 'subidas');
  const up = path.join(tmp, 'subida');
  fs.writeFileSync(up, makeFont('Letra Comercial'));
  assert.deepEqual(addFont(up, dir), ['letra comercial']);
  const asks = path.join(tmp, 'comercial.pptx');
  fs.writeFileSync(asks, makePptx([{ text: 'Uno', font: 'Letra Comercial' }]));
  assert.deepEqual(fontsFor(asks, installedFonts([dir])).missing, [], 'ya no falta');
  fs.writeFileSync(up, 'esto no es una letra');
  assert.deepEqual(addFont(up, dir), []);
  assert.equal(fs.readdirSync(dir).length, 1, 'lo que no es una letra no se guarda');
});

test('las carpetas de letras de cada sistema, también las que baja Office', () => {
  const win = fontDirs('win32', { WINDIR: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local' }, 'C:\\Users\\Ana');
  assert.ok(win.some((d) => d.endsWith(path.join('Microsoft', 'FontCache', '4', 'CloudFonts'))) && win.some((d) => d.endsWith(path.join('Microsoft', 'Windows', 'Fonts'))));
  assert.ok(fontDirs('darwin', {}, '/Users/ana').includes(path.join('/Users/ana', 'Library/Fonts')));
  assert.deepEqual(fontDirs('darwin', { MANNA_LETRAS: '/tmp/letras' }), ['/tmp/letras']);
});

test('la carpeta de una letra de Office en Mac: solo la que está justo ahí, aunque el .pptx diga otra cosa', () => {
  const cloud = path.join(tmp, 'UBF8T346G9.Office', 'CloudFonts');
  fs.mkdirSync(path.join(cloud, 'Jumble'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'UBF8T346G9.Office', 'Otra'), { recursive: true });
  fs.writeFileSync(path.join(cloud, 'archivo'), '');
  const dirs = ['/Library/Fonts', cloud];
  assert.equal(officeFolder('Jumble', dirs), path.join(cloud, 'Jumble'));
  for (const name of ['No Esta', 'archivo', '..', '.', '../Otra', 'Jumble/x']) assert.equal(officeFolder(name, dirs), null, name);
  assert.equal(officeFolder('Jumble', ['/Library/Fonts']), null);
});

test('una que falta se baja de Google Fonts, Fontsource o Font Squirrel (de mentira), comprobada, a la carpeta de letras de quien usa el equipo', async () => {
  const repos = await serveFonts(['Letra Que Falta'], { fontsource: ['Chunk Five'], squirrel: ['Ostrich Sans'] });
  process.env.MANNA_LETRAS_URL = repos.url;
  try {
    const dir = path.join(tmp, 'del-usuario');
    const saved = await installFont('Letra Que Falta', dir);
    assert.deepEqual(saved.map((f) => path.basename(f)), ['LetraQueFalta-Regular.ttf']);
    assert.deepEqual(fontNames(saved[0]), ['letra que falta']);
    assert.deepEqual((await installFont('ChunkFive', dir)).map((f) => path.basename(f)), ['ChunkFive-400.ttf'], 'de Fontsource, aunque el nombre vaya junto');
    assert.deepEqual((await installFont('Ostrich Sans', dir)).map((f) => path.basename(f)), ['Ostrich Sans-Regular.otf'], 'de Font Squirrel, sin la otra familia del paquete ni la licencia');
    assert.deepEqual(await installFont('Jumble', dir), [], 'la que no está en ninguno no se instala');
    // Instalada con otro nombre junto («ChunkFive»), deja de faltar igual.
    const deckChunk = path.join(tmp, 'chunk.pptx');
    fs.writeFileSync(deckChunk, makePptx([{ text: 'Uno', font: 'Chunk Five' }]));
    assert.deepEqual(fontsFor(deckChunk, installedFonts([dir])).missing, [], 'y Arial, que no está aquí, se ve con su gemela');
  } finally {
    repos.close();
  }
  process.env.MANNA_LETRAS_URL = 'http://127.0.0.1:9';
  try {
    await assert.rejects(installFont('Letra Que Falta', path.join(tmp, 'sin-red')), /internet/);
  } finally {
    delete process.env.MANNA_LETRAS_URL;
  }
});

test('la carpeta de letras de quien usa el equipo, sin pedir permisos de administrador', () => {
  assert.equal(userFontDir('win32', { LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local' }, 'C:\\Users\\Ana'), path.join('C:\\Users\\Ana\\AppData\\Local', 'Microsoft', 'Windows', 'Fonts'));
  assert.equal(userFontDir('darwin', {}, '/Users/ana'), path.join('/Users/ana', 'Library', 'Fonts'));
  assert.equal(userFontDir('darwin', { MANNA_LETRAS: '/tmp/letras' }), '/tmp/letras');
});
