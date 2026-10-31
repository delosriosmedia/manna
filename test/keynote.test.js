import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { makeKey } from '../scripts/lib/keynote.mjs';
import { makePng } from '../scripts/lib/png.mjs';
import { snappy } from '../server/modules/slides/iwa.js';
import { fontOf, keynoteToPptx, translateKeynote } from '../server/modules/slides/keynote.js';
import { hasMotion, readZip, writeZip } from '../server/modules/slides/pptx.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-keynote-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const PNG = makePng(4, 4);
let count = 0;

// Traduce y da cada parte del .pptx.
function translate(slides, options) {
  count += 1;
  const file = path.join(tmp, `prueba-${count}.key`);
  fs.writeFileSync(file, makeKey(slides, options));
  const { pptx, soft } = keynoteToPptx(file);
  const out = path.join(tmp, `prueba-${count}.pptx`);
  fs.writeFileSync(out, pptx);
  const parts = readZip(out, () => true);
  return { out, soft, parts, slide: (n) => parts.get(`ppt/slides/slide${n}.xml`).toString('utf8'), xml: (name) => parts.get(name).toString('utf8') };
}
const emu = (pt) => pt * 12700;

test('el nombre PostScript de una letra se vuelve familia, negrita y cursiva', () => {
  const cases = {
    'Rockwell-Regular': ['Rockwell', false, false], 'Rockwell-Bold': ['Rockwell', true, false], 'Rockwell-BoldItalic': ['Rockwell', true, true],
    HelveticaNeue: ['Helvetica Neue', false, false], 'HelveticaNeue-Light': ['Helvetica Neue Light', false, false],
    'MulishRoman-Bold': ['Mulish', true, false], 'BookmanOldStyle-Bold': ['Bookman Old Style', true, false],
    ArialMT: ['Arial', false, false], 'Arial-BoldItalicMT': ['Arial', true, true], 'TimesNewRomanPS-BoldMT': ['Times New Roman', true, false],
    'Montserrat-SemiBoldItalic': ['Montserrat SemiBold', false, true], 'Nunito Sans': ['Nunito Sans', false, false],
  };
  for (const [name, [family, bold, italic]] of Object.entries(cases)) assert.deepEqual(fontOf(name), { family, bold, italic }, name);
  assert.equal(fontOf('.SFNS-Regular'), null, 'la letra del sistema de Apple no se nombra');
  assert.equal(fontOf(undefined), null);
});

test('Snappy: literales, copias que se pisan a sí mismas y datos rotos', () => {
  assert.equal(snappy(Buffer.from([6, 1 << 2, 0x61, 0x62, 0b01 | (0 << 2), 2])).toString(), 'ababab', 'una copia de cuatro desde dos atrás');
  assert.throws(() => snappy(Buffer.from([2, 0b01 | (0 << 2), 9])), /Snappy/, 'una copia de lo que aún no existe');
  assert.throws(() => snappy(Buffer.from([1, 4 << 2, 0x61, 0x62, 0x63])), /Snappy/, 'más datos de los que dijo');
});

test('una presentación de Keynote se vuelve un PowerPoint con lo mismo en el mismo sitio', () => {
  const { slide, xml, parts, soft, out } = translate([
    { background: '102030', items: [
      { type: 'text', x: 100, y: 50, w: 400, h: 200, text: 'Dios & tú <siempre>', font: 'Rockwell-Bold', size: 40, color: 'FF0000', align: 2, anchor: 1, fill: '00FF00', radius: 10, angle: 90 },
      { type: 'image', x: 10, y: 20, w: 100, h: 50, png: PNG, mask: { x: 25, y: 0, w: 50, h: 50 } },
      { type: 'group', x: 300, y: 300, w: 200, h: 100, items: [{ type: 'text', x: 5, y: 6, w: 150, h: 30, text: 'En el grupo' }] },
    ] },
    { hidden: true, items: [{ type: 'text', x: 0, y: 0, w: 100, h: 30, text: 'Oculta' }] },
    { items: [{ type: 'text', x: 0, y: 0, w: 100, h: 30, text: 'Tercera' }] },
  ]);
  assert.deepEqual(soft, []);
  assert.match(xml('ppt/presentation.xml'), new RegExp(`<p:sldSz cx="${emu(960)}" cy="${emu(540)}"/>`));
  assert.equal([...parts.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length, 3);

  const first = slide(1);
  assert.match(first, /<p:bgPr><a:solidFill><a:srgbClr val="102030">/, 'el fondo');
  assert.match(first, /<a:t>Dios &amp; tú &lt;siempre&gt;<\/a:t>/, 'el texto, sin romper el XML');
  assert.match(first, /sz="4000" b="1" i="0"/, 'tamaño y negrita');
  assert.match(first, /<a:solidFill><a:srgbClr val="FF0000"><\/a:srgbClr><\/a:solidFill><a:latin typeface="Rockwell"\/>/, 'color y letra');
  assert.match(first, /algn="ctr"/);
  assert.match(first, /anchor="ctr"/);
  assert.match(first, new RegExp(`<a:xfrm rot="${270 * 60000}"><a:off x="${emu(100)}" y="${emu(50)}"/><a:ext cx="${emu(400)}" cy="${emu(200)}"/>`), 'Keynote gira al revés que PowerPoint');
  assert.match(first, /prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 5000"\/>/, 'las esquinas: 10 de 200');
  assert.match(first, /<a:srgbClr val="00FF00">/, 'el relleno de la forma');
  assert.match(first, /<a:srcRect l="25000" t="0" r="25000" b="0"\/>/, 'la máscara recorta la imagen');
  assert.match(first, new RegExp(`<a:off x="${emu(35)}" y="${emu(20)}"/><a:ext cx="${emu(50)}" cy="${emu(50)}"/>`), 'y lo que se ve es esa ventana');
  assert.match(first, new RegExp(`<p:grpSpPr><a:xfrm><a:off x="${emu(300)}" y="${emu(300)}"/><a:ext cx="${emu(200)}" cy="${emu(100)}"/><a:chOff x="0" y="0"/><a:chExt cx="${emu(200)}" cy="${emu(100)}"/></a:xfrm>`), 'el grupo');
  assert.match(first, /<a:t>En el grupo<\/a:t>/);
  const [media] = [...parts.keys()].filter((n) => n.startsWith('ppt/media/'));
  assert.ok(parts.get(media).equals(PNG), 'la imagen va tal cual');
  assert.match(xml('ppt/slides/_rels/slide1.xml.rels'), new RegExp(`Target="../media/${path.basename(media)}"`));
  assert.match(xml('[Content_Types].xml'), /<Default Extension="png" ContentType="image\/png"\/>/);

  assert.match(slide(2), /<p:sld [^>]* show="0">/, 'la oculta sigue oculta');
  assert.doesNotMatch(slide(3), /show="0"/);
  assert.equal(hasMotion(out), false, 'como imágenes: de Keynote no se traen animaciones');
});

test('lo que hace Keynote al dibujar: encoger, el alto sin calcular, los párrafos sin estilo y el interlineado', () => {
  const big = 'palabra '.repeat(60);
  const { slide } = translate([{ items: [
    { type: 'text', x: 0, y: 0, w: 200, h: 100, text: big, size: 40, shrink: true },
    { type: 'text', x: 0, y: 200, w: 200, h: 100, text: big, size: 40 },
  ] }, { items: [
    { type: 'text', x: 50, y: 300, w: 200, h: 0, text: 'Al centro', size: 20, anchor: 1 },
    { type: 'text', x: 50, y: 400, w: 200, h: 0, text: 'Arriba', size: 20 },
  ] }, { items: [
    { type: 'text', x: 0, y: 0, w: 900, h: 400, text: 'Grande\nSin estilo', size: 50, spacing: 0.8, styleless: 7 },
  ] }]);
  const sizes = [...slide(1).matchAll(/<a:rPr lang="es-CO" sz="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(sizes[0] < 2000, `lo que debe caber se encoge (${sizes[0]})`);
  assert.equal(sizes.at(-1), 4000, 'lo que no pide encoger, no');

  const boxes = [...slide(2).matchAll(/<a:off x="\d+" y="(\d+)"\/><a:ext cx="\d+" cy="(\d+)"\/>/g)].map((m) => [Number(m[1]), Number(m[2])]).slice(1); // la primera es la del lienzo
  assert.equal(boxes[0][0] + boxes[0][1] / 2, emu(300), 'sin alto y al centro: su «y» es la mitad de la caja');
  assert.equal(boxes[1][0], emu(400), 'sin alto y arriba: su «y» es el borde de arriba');
  assert.ok(boxes.every(([, h]) => h > 0), 'la caja tiene alto');

  const third = slide(3);
  assert.deepEqual([...third.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]), ['Grande', 'Sin estilo'], 'cada párrafo, el suyo');
  assert.equal([...third.matchAll(/<a:r><a:rPr lang="es-CO" sz="5000"/g)].length, 2, 'el que no trae estilo sigue con el de antes');
  assert.match(third, /<a:lnSpc><a:spcPct val="80000"\/>/);
  assert.match(third, new RegExp(`tIns="${Math.round((4 + 0.2 * 50 * 1.2) * 12700)}"`), 'con interlineado menor que 1, la primera línea no sube');
});

test('de la plantilla salen sus objetos y su fondo, no sus lugares ni su imagen de muestra', () => {
  const { slide, parts } = translate([{
    template: {
      background: 'ABCDEF',
      items: [{ type: 'text', x: 1, y: 1, w: 100, h: 30, text: 'De la plantilla' }, { type: 'text', x: 1, y: 40, w: 100, h: 30, text: 'Título de muestra', placeholder: 2 }],
      sample: { type: 'image', x: 0, y: 0, w: 100, h: 100, png: PNG },
    },
    items: [{ type: 'text', x: 5, y: 5, w: 100, h: 30, text: 'Mío' }],
  }]);
  const xml = slide(1);
  assert.match(xml, /<p:bgPr><a:solidFill><a:srgbClr val="ABCDEF">/, 'su fondo, si la diapositiva no pone otro');
  assert.ok(xml.indexOf('De la plantilla') < xml.indexOf('Mío'), 'sus objetos, debajo');
  assert.doesNotMatch(xml, /Título de muestra/);
  assert.equal([...parts.keys()].some((n) => n.startsWith('ppt/media/')), false, 'la imagen de muestra no sale');
});

test('el número de diapositiva y lo que sale de la miniatura', () => {
  const { slide, soft, parts } = translate([
    { items: [{ type: 'text', x: 0, y: 0, w: 50, h: 30, text: '￼', placeholder: 1, field: true }] },
    { hidden: true },
    { number: true, thumbnail: PNG, items: [
      { type: 'text', x: 0, y: 0, w: 50, h: 30, text: '￼', placeholder: 1, field: true },
      { type: 'group', x: 96, y: 54, w: 480, h: 270, items: [{ type: 'chart', x: 96, y: 54, w: 192, h: 108 }] },
      { type: 'text', x: 0, y: 100, w: 300, h: 30, text: 'Encima' },
    ] },
  ]);
  assert.doesNotMatch(slide(1), /<a:t>/, 'sin marcarlo, el número no sale');
  const third = slide(3);
  assert.match(third, /<a:t>2<\/a:t>/, 'su número es el que se ve: la oculta no cuenta');
  assert.deepEqual(soft, [2], 'y se avisa de cuál se verá con menos nitidez');
  assert.match(third, /<a:srcRect l="20000" t="20000" r="60000" b="60000"\/>/, 'el recorte, en coordenadas de la diapositiva, aunque vaya en un grupo');
  assert.ok(third.lastIndexOf('<p:pic>') > third.indexOf('Encima'), 'y va encima de todo: la miniatura ya trae lo de arriba');
  assert.ok([...parts.keys()].some((n) => n.startsWith('ppt/media/')));
});

test('lo que no se puede leer se dice, en otro hilo y sin dejar nada', async () => {
  const notKeynote = path.join(tmp, 'otra-cosa.key');
  fs.writeFileSync(notKeynote, writeZip([['index.apxl', 'de una versión muy antigua']]));
  assert.throws(() => keynoteToPptx(notKeynote), /muy antigua/);
  const broken = path.join(tmp, 'rota.key');
  fs.writeFileSync(broken, writeZip([['Index/Document.iwa', Buffer.from([9, 9, 9, 9, 9])]]));
  assert.throws(() => keynoteToPptx(broken));

  const out = path.join(tmp, 'hilo.pptx');
  await assert.rejects(translateKeynote(broken, out));
  assert.equal(fs.existsSync(out), false);

  const good = path.join(tmp, 'buena.key');
  fs.writeFileSync(good, makeKey([{ items: [{ type: 'text', x: 0, y: 0, w: 100, h: 30, text: 'Hola' }] }]));
  assert.deepEqual(await translateKeynote(good, out), { soft: [] });
  assert.match(readZip(out, (n) => n === 'ppt/slides/slide1.xml').get('ppt/slides/slide1.xml').toString(), /<a:t>Hola<\/a:t>/);
});
