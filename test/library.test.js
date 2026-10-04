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
  assert.deepEqual([hit.reference, hit.book, hit.chapter, hit.verse, res.version.id], ['Génesis 1:1', 1, 1, 1, 'prueba']);
  assert.deepEqual(hit.marks.map(([a, b]) => hit.text.slice(a, b)), ['creó Dios']);
  assert.equal(library.search('prueba', 'zzz').total, 0);
});

// ---- En qué versión se busca ----
// Los textos de estas versiones de prueba son inventados.

const many = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-test-versiones-'));
const bible = (verses) => `<bible><b n="Juan"><c n="3">${verses.map(([n, text]) => `<v n="${n}">${text}</v>`).join('')}</c></b></bible>`;
fs.writeFileSync(path.join(many, 'Moderna.xmm'), bible([
  [16, 'Dios quiere tanto a la gente que entregó a su Hijo.'],
  [17, 'El Hijo no vino a condenar, sino a dar vida.'],
]));
const versions = new BibleLibrary(many);
versions.scan();
test.after(() => fs.rmSync(many, { recursive: true, force: true }));

test('sin la Reina-Valera 1960, el texto se busca en la versión elegida', () => {
  assert.equal(versions.searchVersion(), null);
  assert.equal(versions.searchVersion('moderna'), 'moderna');
  const res = versions.search('moderna', 'quiere tanto');
  assert.deepEqual([res.version.id, res.total, res.levels[0].results[0].reference], ['moderna', 1, 'Juan 3:16']);
});

test('con la Reina-Valera 1960 instalada, se busca en ella aunque esté elegida otra', () => {
  fs.writeFileSync(path.join(many, 'Reina Valera 1960.xmm'), bible([
    [16, 'El amor de Dios alcanza a todo el mundo.'],
    [17, 'Dios envió a su Hijo para dar vida.'],
    [18, 'El que cree no es condenado.'],
  ]));
  versions.scan();
  assert.equal(versions.searchVersion(), 'reina-valera-1960');
  assert.equal(versions.searchVersion('moderna'), 'reina-valera-1960');

  const res = versions.search('moderna', 'amor de dios');
  assert.deepEqual(res.version, { id: 'reina-valera-1960', name: 'Reina-Valera 1960', abbr: 'RVR1960' });
  const [hit] = res.levels[0].results;
  assert.deepEqual([hit.reference, hit.book, hit.chapter, hit.verse], ['Juan 3:16', 43, 3, 16]);
  assert.deepEqual(hit.marks.map(([a, b]) => hit.text.slice(a, b)), ['amor de Dios']);
  // Una frase que solo está en la versión elegida no se encuentra: no se busca en ella.
  assert.equal(versions.search('moderna', 'quiere tanto').total, 0);
  // Las citas siguen resolviéndose en la versión elegida.
  assert.equal(versions.search('moderna', 'jn 3 17').reference, 'Juan 3:17');
});

test('los resultados van por niveles y limit recorta cada uno sin cambiar el total', () => {
  const res = versions.search('moderna', 'dios hijo');
  assert.deepEqual(res.levels.map((l) => [l.id, l.results.map((r) => r.verse)]), [['words', [17]]]);
  const cut = versions.search('moderna', 'el', { limit: 1 });
  assert.deepEqual([cut.levels[0].results.length, cut.levels[0].total], [1, 2]);
});

test('la búsqueda se puede limitar al Antiguo o al Nuevo Testamento', () => {
  const dirBoth = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-test-testamentos-'));
  fs.writeFileSync(path.join(dirBoth, 'Dos.xmm'), `<bible>
    <b n="Génesis"><c n="1"><v n="1">En el principio fue creada la luz.</v></c></b>
    <b n="Malaquías"><c n="4"><v n="6">La luz volverá al final.</v></c></b>
    <b n="Mateo"><c n="5"><v n="14">Ustedes son la luz del mundo.</v></c></b>
  </bible>`);
  const both = new BibleLibrary(dirBoth);
  both.scan();
  try {
    const refs = (scope) => both.search('dos', 'luz', { scope }).levels.flatMap((l) => l.results.map((r) => r.reference));
    assert.deepEqual(refs('all'), ['Génesis 1:1', 'Malaquías 4:6', 'Mateo 5:14']);
    assert.deepEqual(refs('ot'), ['Génesis 1:1', 'Malaquías 4:6']);
    assert.deepEqual(refs('nt'), ['Mateo 5:14']);
    // Un valor desconocido busca en toda la Biblia, y la respuesta dice dónde se buscó.
    assert.deepEqual(refs('otra-cosa'), refs('all'));
    assert.deepEqual([both.search('dos', 'luz', { scope: 'nt' }).scope, both.search('dos', 'luz', { scope: 'x' }).scope, both.search('dos', 'luz', { scope: 'nt' }).total], ['nt', 'all', 1]);
  } finally {
    fs.rmSync(dirBoth, { recursive: true, force: true });
  }
});
