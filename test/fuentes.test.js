import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deckFonts, fontDirs, fontNames, fontsFor, installedFonts, installFont, readZip, userFontDir } from '../server/modules/slides/fuentes.js';
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

test('las carpetas de letras de cada sistema, también las que baja Office', () => {
  const win = fontDirs('win32', { WINDIR: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local' }, 'C:\\Users\\Ana');
  assert.ok(win.some((d) => d.endsWith(path.join('Microsoft', 'FontCache', '4', 'CloudFonts'))) && win.some((d) => d.endsWith(path.join('Microsoft', 'Windows', 'Fonts'))));
  assert.ok(fontDirs('darwin', {}, '/Users/ana').includes(path.join('/Users/ana', 'Library/Fonts')));
  assert.deepEqual(fontDirs('darwin', { MANNA_LETRAS: '/tmp/letras' }), ['/tmp/letras']);
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
    assert.deepEqual(fontsFor(deckChunk, installedFonts([dir])).missing, ['Arial']);
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
