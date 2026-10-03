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

test('search distingue citas de palabras y no depende de tildes', () => {
  assert.deepEqual(library.search('prueba', 'gn 1:2'), { type: 'ref', ref: { book: 1, chapter: 1, verseStart: 2, verseEnd: 2 } });
  const res = library.search('prueba', 'creo dios');
  assert.equal(res.type, 'text');
  assert.equal(res.total, 1);
  assert.equal(res.results[0].reference, 'Génesis 1:1');
});
