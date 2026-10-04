import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextIndex, findMarks, fold, prepareQuery, stem } from '../server/core/search.js';

test('fold quita tildes, mayúsculas y signos', () => {
  assert.equal(fold('¡Señor, ven!  ¿Hasta cuándo?'), 'senor ven hasta cuando');
  assert.equal(fold('  Él dijo: «Yo soy».'), 'el dijo yo soy');
  assert.equal(fold('1 Corintios 13:4-7'), '1 corintios 13 4 7');
  assert.equal(fold('...'), '');
});

test('stem junta las formas regulares de una misma palabra', () => {
  const same = (...words) => assert.equal(new Set(words.map((w) => stem(fold(w)))).size, 1, words.join(', '));
  same('salvar', 'salvó', 'salvación', 'salvador', 'salvos', 'salvará');
  same('perdón', 'perdonar', 'perdonó', 'perdonados');
  same('creer', 'cree', 'creyó', 'creyeron', 'creyentes', 'creído');
  same('santo', 'santos', 'santa', 'santidad');
  same('verdad', 'verdades', 'verdadero', 'verdaderamente');
  same('mujer', 'mujeres');
  same('judío', 'judíos', 'judía');
  same('hermano', 'hermanos', 'hermana');
  same('reino', 'reinar', 'reinó', 'reina');
});

test('stem conoce los verbos irregulares y las palabras cortas más usados', () => {
  const same = (...words) => assert.equal(new Set(words.map((w) => stem(fold(w)))).size, 1, words.join(', '));
  same('amar', 'amó', 'amor', 'amado', 'amaos');
  same('orar', 'oraba', 'oración', 'oraciones', 'orad'); // "oró" sin tilde es "oro": se deja fuera a propósito
  same('decir', 'dijo', 'dice', 'dicho', 'dirá');
  same('hacer', 'hizo', 'hecho', 'haré');
  same('venir', 'viene', 'vendrá', 'vinieron');
  same('morir', 'murió', 'muerte', 'muertos');
  same('poder', 'puede', 'pudo', 'podrá');
  same('siervo', 'servir', 'sirve');
  same('luz', 'luces');
  same('bendecir', 'bendijo', 'bendito', 'bendición');
});

test('stem no junta palabras que se parecen pero no son la misma', () => {
  const differ = (a, b) => assert.notEqual(stem(fold(a)), stem(fold(b)), `${a} / ${b}`);
  differ('Dios', 'dio');
  differ('amén', 'amar');
  differ('vino', 'venir');
  differ('hacia', 'hacer');
  differ('hermano', 'hermoso');
  differ('creación', 'creer');
  differ('caridad', 'cara');
  differ('perdón', 'perder');
  differ('oro', 'orar');
});

const texts = [
  /* 0 */ 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.',
  /* 1 */ 'El amor es sufrido, es benigno; el amor no tiene envidia.',
  /* 2 */ 'Dios es amor; y el que permanece en amor, permanece en Dios.',
  /* 3 */ 'Amados, amémonos unos a otros; porque el amor es de Dios.',
  /* 4 */ 'Jehová es mi pastor; nada me faltará.',
  /* 5 */ 'El Señor es mi pastor, nada me falta.',
  /* 6 */ 'Y dio Dios al hombre toda planta.',
  /* 7 */ 'La caridad es sufrida, es benigna.',
  /* 8 */ 'Al mundo amó Dios de una manera tal.',
];
const index = createTextIndex(texts);
const find = (text) => index.find(prepareQuery(text));

test('nivel 1: la frase exacta, sin importar tildes, mayúsculas ni signos', () => {
  assert.deepEqual([...find('amó dios al mundo').exact], [0]);
  assert.deepEqual([...find('AMO DIOS AL MUNDO').exact], [0]);
  assert.deepEqual([...find('benigno el amor').exact], [1]);
  assert.deepEqual([...find('es mi pastor').exact], [4, 5]);
});

test('nivel 1: la última palabra puede estar a medio escribir, y las completas van primero', () => {
  assert.deepEqual([...find('de tal mane').exact], [0]);
  // "dio" como palabra completa (6) antes que como principio de "Dios" (0, 2, 3, 8).
  assert.deepEqual([...find('dio').exact], [6, 0, 2, 3, 8]);
  // Una palabra intermedia a medias no cuenta.
  assert.deepEqual([...find('de ta manera').exact], []);
});

test('nivel 2: todas las palabras en cualquier orden, sin repetir lo del nivel 1', () => {
  const found = find('amó dios al mundo');
  assert.deepEqual([...found.exact], [0]);
  assert.deepEqual([...found.words], [8]);
  // Las palabras comunes ("el", "es", "de") no se exigen.
  assert.deepEqual([...find('el amor de dios').words], [2, 3]);
});

test('nivel 3: otras formas de la palabra y sinónimos, sin repetir los niveles anteriores', () => {
  const amor = find('amor');
  assert.deepEqual([...amor.exact], [1, 2, 3]);
  // "amó" (0, 8) y "Amados" ya está en 3; "caridad" (7) es sinónimo.
  assert.deepEqual([...amor.similar], [0, 7, 8]);
  const pastor = find('Señor pastor');
  assert.deepEqual([...pastor.words], [5]);
  assert.deepEqual([...pastor.similar], [4]); // Jehová
});

test('una búsqueda de menos de dos letras no devuelve nada', () => {
  assert.deepEqual(find('a'), { exact: [], words: [], similar: [] });
  assert.deepEqual(find('  '), { exact: [], words: [], similar: [] });
  assert.equal(prepareQuery('¿?').empty, true);
});

test('findMarks señala en el texto original lo que coincidió', () => {
  const marked = (text, query, level) => findMarks(text, prepareQuery(query), level).map(([a, b]) => text.slice(a, b));
  assert.deepEqual(marked(texts[0], 'amo dios al mundo', 'exact'), ['amó Dios al mundo']);
  assert.deepEqual(marked(texts[1], 'benigno el amor', 'exact'), ['benigno; el amor']);
  assert.deepEqual(marked(texts[0], 'de tal mane', 'exact'), ['de tal mane']);
  assert.deepEqual(marked(texts[2], 'amor', 'exact'), ['amor', 'amor']);
  assert.deepEqual(marked(texts[8], 'amó dios al mundo', 'words'), ['mundo', 'amó', 'Dios']);
  assert.deepEqual(marked(texts[3], 'amor', 'similar'), ['Amados', 'amor']);
  assert.deepEqual(marked(texts[4], 'señor pastor', 'similar'), ['Jehová', 'pastor']);
  // Una tilde escrita como carácter aparte queda dentro de la marca.
  assert.deepEqual(marked('Jehová es bueno', 'jehova', 'exact'), ['Jehová']);
});
