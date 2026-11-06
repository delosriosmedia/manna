import test from 'node:test';
import assert from 'node:assert/strict';
import { findBook } from '../server/modules/bible/canon.js';
import { parseReference, formatReference } from '../server/modules/bible/reference.js';
import { parseBible, cleanVerse } from '../server/modules/bible/parsers.js';
import { describeVersion } from '../server/modules/bible/versions.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BibleLibrary } from '../server/modules/bible/library.js';

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

// La cita rápida es lo más usado durante el sermón. Lo que hoy se lee bien queda fijado aquí, con la RV1909 del
// repositorio. Lo que falla está como pendiente («todo»), para la fase 52.4 (auditoría integral, fase 51.4).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quick = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-cita-rapida-'));
  fs.copyFileSync(path.join(ROOT, 'Contenido', 'Biblias', 'Reina Valera 1909.xmm'), path.join(dir, 'Reina Valera 1909.xmm'));
  const library = new BibleLibrary(dir);
  library.scan();
  test.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }));
  return (query) => {
    const found = library.search(library.list()[0].id, query, { limit: 1 });
    return found?.type === 'ref' ? found.reference : null;
  };
})();

test('la cita rápida: las formas de escribir una cita que se leen bien', () => {
  const READ = {
    'Juan 3:16': 'Juan 3:16', 'juan 3 16': 'Juan 3:16', 'Jn 3:16': 'Juan 3:16', 'Jn3:16': 'Juan 3:16', 'Jn 3.16': 'Juan 3:16',
    'Juan 3,16': 'Juan 3:16', 'JUAN 3:16': 'Juan 3:16', 'Juan 3:16-18': 'Juan 3:16-18', 'Juan 3:16 - 18': 'Juan 3:16-18', 'Juan 3:16–18': 'Juan 3:16-18',
    'Juan 3': 'Juan 3', 'Génesis 1:1': 'Génesis 1:1', 'genesis 1 1': 'Génesis 1:1', 'Gn 1': 'Génesis 1', 'Gén 1:1-3': 'Génesis 1:1-3',
    'exodo 20:3': 'Éxodo 20:3', 'Salmo 23': 'Salmos 23', 'Sal 119:105': 'Salmos 119:105', '1 co 13 4': '1 Corintios 13:4',
    '1Co 13:4-7': '1 Corintios 13:4-7', 'I Corintios 13': '1 Corintios 13', 'I Co 13:4': '1 Corintios 13:4', 'II Timoteo 3:16': '2 Timoteo 3:16',
    '2 Ti 3:16': '2 Timoteo 3:16', '1 Jn 4:8': '1 Juan 4:8', 'Judas 1:24': 'Judas 1:24', 'Abdías 1:15': 'Abdías 1:15',
    'Cantar de los cantares 2:4': 'Cantares 2:4', 'Hch 2:38': 'Hechos 2:38', 'Ap 21:4': 'Apocalipsis 21:4', 'Mateo 5,3-12': 'Mateo 5:3-12',
    'Ro 8:28': 'Romanos 8:28', 'Malaquías 4:2': 'Malaquías 4:2', 'Joel 3:1': 'Joel 3:1', 'Pr 3:5-6': 'Proverbios 3:5-6',
  };
  assert.deepEqual(Object.fromEntries(Object.keys(READ).map((q) => [q, quick(q)])), READ);
  assert.equal(quick('Sal 151'), null, 'un capítulo que no existe no se lee como cita');
});

test('la cita rápida: libros de un solo capítulo sin el «1:» («Judas 24»)', { todo: 'fase 52.4: hoy busca el capítulo 24 y no da nada' }, () => {
  assert.deepEqual(['Judas 24', 'Filemón 4', 'Abdías 15', '2 Juan 6', '3 Juan 14'].map(quick), ['Judas 1:24', 'Filemón 1:4', 'Abdías 1:15', '2 Juan 1:6', '3 Juan 1:14']);
});
test('la cita rápida: ordinales («1ra», «Primera de»)', { todo: 'fase 52.4: hoy no da nada' }, () => {
  assert.deepEqual(['1ra Corintios 13', '1a Corintios 13', 'Primera de Corintios 13', 'Segunda Timoteo 3:16'].map(quick), ['1 Corintios 13', '1 Corintios 13', '1 Corintios 13', '2 Timoteo 3:16']);
});
test('la cita rápida: un versículo que no existe no se ofrece como cita', { todo: 'fase 52.4: hoy se ofrece y al proyectarlo da error' }, () => {
  assert.equal(quick('Juan 3:99'), null);
});
