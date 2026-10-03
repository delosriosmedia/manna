import test from 'node:test';
import assert from 'node:assert/strict';
import { findBook } from '../server/modules/bible/canon.js';
import { parseReference, formatReference } from '../server/modules/bible/reference.js';
import { parseBible, cleanVerse } from '../server/modules/bible/parsers.js';
import { describeVersion } from '../server/modules/bible/versions.js';

test('findBook reconoce nombres, abreviaturas y prefijos sin tildes', () => {
  assert.equal(findBook('Génesis'), 1);
  assert.equal(findBook('genesis'), 1);
  assert.equal(findBook('Gn'), 1);
  assert.equal(findBook('rom'), 45);
  assert.equal(findBook('1 co'), 46);
  assert.equal(findBook('I Juan'), 62);
  assert.equal(findBook('juan'), 43);
  assert.equal(findBook('salmo'), 19);
  assert.equal(findBook('apoc'), 66);
  assert.equal(findBook('xyz'), null);
});

test('parseReference entiende citas, rangos y capítulos completos', () => {
  assert.deepEqual(parseReference('Juan 3:16'), { book: 43, chapter: 3, verseStart: 16, verseEnd: 16 });
  assert.deepEqual(parseReference('jn 3 16-18'), { book: 43, chapter: 3, verseStart: 16, verseEnd: 18 });
  assert.deepEqual(parseReference('1 Corintios 13:4–7'), { book: 46, chapter: 13, verseStart: 4, verseEnd: 7 });
  assert.deepEqual(parseReference('Salmo 23'), { book: 19, chapter: 23, verseStart: null, verseEnd: null });
  assert.equal(parseReference('amor'), null);
  assert.equal(parseReference('de tal manera'), null);
  assert.equal(formatReference({ book: 43, chapter: 3, verseStart: 16, verseEnd: 18 }), 'Juan 3:16-18');
});

test('cleanVerse quita notas, asteriscos y títulos de sección', () => {
  assert.equal(cleanVerse('\n [1] En el comienzo de todo, Dios creó el cielo y la tierra. '), 'En el comienzo de todo, Dios creó el cielo y la tierra.');
  assert.equal(cleanVerse('se le apareció* a José;[4] y dijo'), 'se le apareció a José; y dijo');
  assert.equal(
    cleanVerse('\n\nI. Orígenes del mundo\n1. LA CREACIÓN Y LA CAÍDA\nPrimer[1] relato de la creación*.\nEn el[2] principio creó Dios el cielo y la tierra*. '),
    'En el principio creó Dios el cielo y la tierra.',
  );
  assert.equal(cleanVerse('Tom &amp; Jerry &#243;'), 'Tom & Jerry ó');
});

test('parseBible lee el formato .xmm', () => {
  const { books } = parseBible('<bible><b n="Juan"><c n="3"><v n="16">Porque de tal manera</v><v n="17">--</v><v n="18">\n (TEXT OMITTED) </v></c></b></bible>');
  assert.equal(books.length, 1);
  assert.equal(books[0].n, 43);
  assert.deepEqual(books[0].chapters[0].verses, [{ n: 16, text: 'Porque de tal manera' }]);
});

test('parseBible lee el formato .xml con libros numerados', () => {
  const { books } = parseBible('<bible translation="X"><testament name="New"><book number="43"><chapter number="3"><verse number="16">16 Porque</verse></chapter></book></testament></bible>');
  assert.equal(books[0].name, 'Juan');
  assert.deepEqual(books[0].chapters[0].verses, [{ n: 16, text: 'Porque' }]);
});

test('describeVersion da nombres legibles', () => {
  assert.deepEqual(describeVersion('SpanishNVIBible.xml'), { id: 'spanishnvibible', name: 'Nueva Versión Internacional', abbr: 'NVI' });
  assert.equal(describeVersion('La Biblia de Las Americas.xmm').abbr, 'LBLA');
  assert.equal(describeVersion('Reina Valera 1909.xmm').abbr, 'RV1909');
  assert.deepEqual(describeVersion('Mi Biblia.xmm'), { id: 'mi-biblia', name: 'Mi Biblia', abbr: '' });
});
