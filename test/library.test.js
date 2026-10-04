import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BibleLibrary } from '../server/modules/bible/library.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-test-'));
fs.writeFileSync(path.join(dir, 'Prueba.xmm'), `<bible>
  <b n="Génesis"><c n="1"><v n="1">En el principio creó Dios los cielos y la tierra.</v><v n="2">Y la tierra estaba desordenada y vacía.</v></c>
  <c n="2"><v n="1">Fueron, pues, acabados los cielos.</v></c></b>
  <b n="Éxodo"><c n="1"><v n="1">Estos son los nombres.</v></c></b>
</bible>`);
const library = new BibleLibrary(dir);
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('scan lista las versiones de la carpeta', () => {
  assert.deepEqual(library.scan(), [{ id: 'prueba', name: 'Prueba', abbr: '' }]);
});

test('passage resuelve rangos y los ajusta a lo que existe', () => {
  const p = library.passage('prueba', { book: 1, chapter: 1, verseStart: 1, verseEnd: 9 });
  assert.equal(p.reference, 'Génesis 1:1-2');
  assert.equal(p.verses.length, 2);
  assert.equal(library.passage('prueba', { book: 1, chapter: 9, verseStart: 1 }), null);
});

test('step cruza capítulos y libros', () => {
  const at = (chapter, v, book = 1) => ({ book, chapter, verseStart: v, verseEnd: v });
  assert.deepEqual(library.step('prueba', at(1, 1), 1), at(1, 2));
  assert.deepEqual(library.step('prueba', at(1, 2), 1), at(2, 1));
  assert.deepEqual(library.step('prueba', at(2, 1), 1), at(1, 1, 2));
  assert.deepEqual(library.step('prueba', at(2, 1), -1), at(1, 2));
  assert.equal(library.step('prueba', at(1, 1), -1), null);
  assert.equal(library.step('prueba', at(1, 1, 2), 1), null);
});

test('search reconoce una cita y dice cómo se llama', () => {
  assert.deepEqual(library.search('prueba', 'gn 1:2'), { type: 'ref', ref: { book: 1, chapter: 1, verseStart: 2, verseEnd: 2 }, reference: 'Génesis 1:2' });
  assert.equal(library.search('prueba', 'genesis 2').reference, 'Génesis 2');
  assert.equal(library.search('no-existe', 'gn 1'), null);
});

test('search busca texto sin depender de tildes y marca lo encontrado', () => {
  const res = library.search('prueba', 'creo dios');
  assert.equal(res.type, 'text');
  assert.equal(res.total, 1);
  assert.deepEqual(res.levels.map((l) => [l.id, l.label, l.total]), [['exact', 'Frase exacta', 1]]);
  const [hit] = res.levels[0].results;
  assert.deepEqual([hit.reference, hit.book, hit.chapter, hit.verse, hit.versionId], ['Génesis 1:1', 1, 1, 1, 'prueba']);
  assert.deepEqual(hit.marks.map(([a, b]) => hit.text.slice(a, b)), ['creó Dios']);
  assert.equal(library.search('prueba', 'zzz').total, 0);
});

// ---- Varias versiones ----

const many = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-test-versiones-'));
const bible = (verses) => `<bible><b n="Juan"><c n="3">${verses.map(([n, text]) => `<v n="${n}">${text}</v>`).join('')}</c></b></bible>`;
fs.writeFileSync(path.join(many, 'Antigua.xmm'), bible([
  [16, 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.'],
  [17, 'Porque no envió Dios a su Hijo al mundo para condenar al mundo.'],
  [35, 'El Padre ama al Hijo, y todas las cosas dio en su mano.'],
]));
fs.writeFileSync(path.join(many, 'Moderna.xmm'), bible([
  [16, 'Porque tanto amó Dios al mundo, que dio a su Hijo unigénito.'],
  [17, 'Dios no envió a su Hijo al mundo para condenar al mundo.'],
  [35, 'El Padre ama al Hijo, y ha entregado todo en sus manos.'],
]));
const versions = new BibleLibrary(many);
versions.scan();
test.after(() => fs.rmSync(many, { recursive: true, force: true }));

test('sin índice todavía, se busca solo en la versión elegida', () => {
  assert.deepEqual(versions.pendingIndex(), ['antigua', 'moderna']);
  const res = versions.search('antigua', 'tanto amó Dios');
  assert.deepEqual([res.searched, res.versions], [1, 2]);
  // La frase es de la otra versión, y a esta le falta una de sus palabras: no hay nada.
  assert.deepEqual([res.levels, res.total], [[], 0]);
  assert.deepEqual(versions.pendingIndex(), ['moderna']);
});

test('con índice, la frase exacta se encuentra en cualquier versión y dice en cuál', () => {
  assert.equal(versions.index('moderna'), true);
  assert.equal(versions.index('no-existe'), false);
  assert.deepEqual(versions.pendingIndex(), []);
  const res = versions.search('antigua', 'tanto amó Dios');
  assert.equal(res.searched, 2);
  const [hit] = res.levels[0].results;
  assert.deepEqual([res.levels[0].id, hit.reference, hit.versionId, hit.version], ['exact', 'Juan 3:16', 'moderna', 'Moderna']);
  assert.deepEqual(hit.marks.map(([a, b]) => hit.text.slice(a, b)), ['tanto amó Dios']);
});

test('un versículo sale una sola vez: primero en la versión elegida, y avisa de las demás', () => {
  const res = versions.search('moderna', 'hijo al mundo');
  const exact = res.levels.find((l) => l.id === 'exact');
  // Juan 3:17 lo dice igual en las dos: sale con el texto de la elegida y anota la otra.
  assert.deepEqual(exact.results.map((r) => [r.reference, r.versionId, r.others]), [['Juan 3:17', 'moderna', ['Antigua']]]);
  // Juan 3:16 solo coincide por palabras, y en las dos versiones: tampoco se repite.
  const words = res.levels.find((l) => l.id === 'words');
  assert.deepEqual(words.results.map((r) => [r.reference, r.versionId, r.others]), [['Juan 3:16', 'moderna', ['Antigua']]]);
  assert.equal(res.total, 2);
});

test('lo que ya salió en un nivel no vuelve a salir en el siguiente, aunque sea en otra versión', () => {
  // "dio" es palabra completa en la versión moderna de 3:16 y en la antigua de 3:35.
  const res = versions.search('antigua', 'dio');
  const exact = res.levels.find((l) => l.id === 'exact');
  // Primero lo de la versión elegida; dentro de ella, la palabra completa antes que "Dios".
  assert.deepEqual(exact.results.map((r) => `${r.verse} ${r.versionId}`), ['35 antigua', '16 antigua', '17 antigua']);
  assert.equal(res.levels.some((l) => l.id !== 'exact' && l.results.some((r) => r.verse === 16)), false);
});

test('limit recorta los resultados de cada nivel pero no el total', () => {
  const res = versions.search('antigua', 'dio', { limit: 1 });
  const exact = res.levels.find((l) => l.id === 'exact');
  assert.deepEqual([exact.results.length, exact.total], [1, 3]);
});
