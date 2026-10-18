import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import bible from '../server/modules/bible/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import { BibleLibrary } from '../server/modules/bible/library.js';
import { createDetector, createReview, citeLabel } from '../server/modules/bible/citas.js';
import { docxText, pdfText } from '../web/core/documentos.js';
import { makeDocx } from '../scripts/lib/docx.mjs';

// Citas de un texto o documento (fase 27). El detector necesita la Biblia entera para saber qué capítulos y
// versículos existen: la Reina-Valera 1909 del repositorio (dominio público), copiada a una carpeta temporal. Los
// textos de prueba son inventados (test/datos/citas): los casos salen de lo que enseñaron once documentos reales de
// la iglesia, escritos con otras palabras.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'test', 'datos', 'citas');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-citas-'));
const bibles = path.join(tmp, 'biblias');
fs.mkdirSync(bibles);
fs.copyFileSync(path.join(ROOT, 'Contenido', 'Biblias', 'Reina Valera 1909.xmm'), path.join(bibles, 'Reina Valera 1909.xmm'));
const library = new BibleLibrary(bibles);
library.scan();
const tools = { structure: (b) => library.shape(b), verses: (b, c) => library.verseTexts(b, c) };
const detect = createDetector(tools);
const review = createReview(tools);
const read = (name) => fs.readFileSync(path.join(DATA, name), 'utf8');
const labels = (found) => found.map((f) => f.refs.map(citeLabel).join(' + ') + (f.confidence === 'revisar' ? ' (revisar)' : ''));
const counts = (r) => [r.found.filter((f) => f.confidence === 'segura').length, r.found.filter((f) => f.confidence === 'revisar').length, r.dropped.length];

test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

test('las formas de escribir una cita, y lo que solo lo parece', () => {
  const cases = JSON.parse(read('casos.json'));
  const wrong = cases.filter((c) => JSON.stringify(labels(detect(c.text).found)) !== JSON.stringify(c.expect))
    .map((c) => `${JSON.stringify(c.text)} → ${JSON.stringify(labels(detect(c.text).found))} (esperado ${JSON.stringify(c.expect)})`);
  assert.deepEqual(wrong, [], `${wrong.length} de ${cases.length} casos no salen como se esperaba`);
});

test('nada de lo que parece una cita y no lo es pasa por cita', () => {
  const r = detect(read('trampas.txt'));
  assert.deepEqual(r.found.map((f) => f.source), [], 'ni seguras ni a revisar');
  assert.ok(r.dropped.length >= 20, 'lo descartado se dice, con su porqué');
});

test('dos bosquejos con muchas formas de citar: todo encontrado y nada equivocado', () => {
  assert.deepEqual(counts(detect(read('bosquejo1.txt'))), [66, 5, 0]);
  // «2Co 13:14» no existe en la 1909 (que numera 2 Corintios 13 con 13 versículos): con la 1960 instalada, sí.
  const notes = detect(read('bosquejo2.txt'));
  assert.deepEqual(counts(notes), [52, 0, 1]);
  assert.match(notes.dropped[0].source, /2Co 13:14/);
});

test('la lista para revisar: una vez cada cita, por capítulos, con sus opciones y la página', () => {
  const salmo = library.verseTexts(19, 19);
  const text = [
    'Lectura: Juan 3:16 y Mateo 5–7.',
    `Oremos con Salmos 19.\n12 ${salmo[11][0]}\n13 ${salmo[12][0]}`,
    'Otra vez Juan 3:16, y la fe en Heb 11:1ss.\f',
    'Página dos: el Salmo 119 entero.',
  ].join('\n');
  const { items, pages } = review(text);
  const by = (start) => items.find((i) => i.choices[0].label.startsWith(start));
  assert.equal(pages, 2);
  assert.equal(by('Juan 3:16').times, 2, 'repetida: una vez, con cuántas');
  assert.deepEqual(by('Mateo 5').choices[0].order.map((r) => [r.chapter, r.verseStart, r.verseEnd]), [[5, 1, 48], [6, 1, 34], [7, 1, 29]], 'un elemento por capítulo');
  const salmo19 = by('Salmos 19');
  assert.deepEqual(salmo19.choices.map((c) => c.label), ['Salmos 19:12-13', 'Salmos 19'], 'el texto copiado debajo propone esos versículos; el capítulo, de otra opción');
  assert.equal(salmo19.confidence, 'revisar');
  const faith = by('Hebreos 11:1');
  assert.deepEqual(faith.choices.map((c) => c.label), ['Hebreos 11:1 y siguientes', 'Hebreos 11:1']);
  assert.deepEqual(faith.choices[0].order[0], { book: 58, chapter: 11, verseStart: 1, verseEnd: 40 }, '«y siguientes»: hasta el final del capítulo');
  const long = by('Salmos 119');
  assert.equal(long.page, 2);
  assert.ok(long.reasons.some((r) => r.includes('176 versículos')), 'un capítulo largo se avisa');
  assert.deepEqual(long.context.match, 'Salmo 119');
});

test('el texto de un Word: un párrafo por línea', async () => {
  const docx = makeDocx(['Texto: Juan 3:16', 'Y Romanos&#160;8:28 &amp; más']);
  const text = await docxText(docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength));
  assert.equal(text, 'Texto: Juan 3:16\nY Romanos\u00a08:28 & más\n');
  assert.deepEqual(labels(detect(text).found), ['Juan 3:16', 'Romanos 8:28']);
});

test('por el servidor: buscar las citas de un texto y añadirlas al orden, con su sección', async () => {
  const app = createApp({ rootDir: ROOT, dataDir: path.join(tmp, 'datos'), biblesDir: bibles });
  for (const setup of [system, bible, projection, order]) await setup(app);
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'control' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const ask = (text) => fetch(`${base}/api/bible/citas`, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8', cookie }, body: text });
    assert.equal((await ask('   ')).status, 400, 'sin texto');
    const { items } = await (await ask('Texto: Juan 3:16-18. Luego Mt 5–7 y Rut 5 años.')).json();
    assert.deepEqual(items.map((i) => i.choices[0].label), ['Juan 3:16-18', 'Mateo 5–7']);
    const send = (type, payload) => fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ type, payload }) });
    const versionId = library.list()[0].id;
    const add = (refs, section) => send('order.addMany', { section, items: refs.map((ref) => ({ kind: 'verses', data: { versionId, ref } })) });
    assert.equal((await add(items.flatMap((i) => i.choices[0].order), { title: 'Sermón de prueba' })).status, 200);
    const titles = () => app.store.get('order').items.map((i) => i.title);
    assert.deepEqual(titles(), ['Sermón de prueba', 'Juan 3:16-18', 'Mateo 5:1-48', 'Mateo 6:1-34', 'Mateo 7:1-29']);
    // Al final de una sección que ya existe (antes de la siguiente), y nada si algo no existe.
    await send('order.addSection', { title: 'Después' });
    const section = app.store.get('order').items[0].id;
    assert.equal((await add([{ book: 19, chapter: 23, verseStart: 1, verseEnd: 6 }], { id: section })).status, 200);
    assert.deepEqual(titles(), ['Sermón de prueba', 'Juan 3:16-18', 'Mateo 5:1-48', 'Mateo 6:1-34', 'Mateo 7:1-29', 'Salmos 23:1-6', 'Después']);
    assert.equal((await add([{ book: 19, chapter: 23, verseStart: 1, verseEnd: 1 }, { book: 99, chapter: 1, verseStart: 1, verseEnd: 1 }])).status, 404);
    assert.equal(titles().length, 7, 'si uno no existe, no se añade ninguno');
  } finally {
    await app.close();
    server.close();
  }
});

// Con los documentos reales de la iglesia (solo en este equipo, fuera de git y nunca en una prueba publicada): que lo
// que el detector saca de ellos no cambie sin querer. La primera vez guarda lo que sale, en su misma carpeta.
const REAL = path.join(ROOT, 'Bosquejos temporales');
test('los documentos reales de la iglesia dan lo mismo que la última vez', { skip: !fs.existsSync(REAL) && 'no está la carpeta local «Bosquejos temporales»' }, async (t) => {
  const all = new BibleLibrary(path.join(ROOT, 'Contenido', 'Biblias'));
  all.scan();
  const real = createDetector({ structure: (b) => all.shape(b), verses: (b, c) => all.verseTexts(b, c) });
  const pdfjs = await import('../web/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT, 'web', 'vendor', 'pdfjs', 'pdf.worker.min.mjs');
  const result = {};
  for (const file of fs.readdirSync(REAL).filter((f) => /\.(docx|pdf)$/i.test(f)).sort()) {
    const bytes = fs.readFileSync(path.join(REAL, file));
    const text = file.toLowerCase().endsWith('.pdf')
      ? await pdfText(await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise)
      : await docxText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    result[file] = labels(real(text).found);
  }
  const snapshot = path.join(REAL, '.citas-esperadas.json');
  if (!fs.existsSync(snapshot)) {
    fs.writeFileSync(snapshot, JSON.stringify(result, null, 1));
    t.diagnostic('primera vez: se guardó lo que sale, para comparar las próximas');
    return;
  }
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  for (const file of Object.keys(result)) {
    if (before[file]) assert.deepEqual(result[file], before[file], `${file}: cambió lo que se encuentra (si es una mejora revisada, borra ${path.basename(snapshot)})`);
  }
});
