import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/core/app.js';
import system from '../server/modules/system/index.js';
import projection from '../server/modules/projection/index.js';
import order from '../server/modules/order/index.js';
import hymns from '../server/modules/hymns/index.js';
import { buildCatalog, createHymnSearch, fromFileName, ranges } from '../server/modules/hymns/catalog.js';
import { parseLyrics } from '../server/modules/hymns/lyrics.js';
import { HYMN_FACTS, hymnTitle, seedHymnal } from '../scripts/lib/himnario-falso.mjs';

// El himnario de estas pruebas es inventado (scripts/lib/himnario-falso.mjs): ni los títulos ni las
// letras son de ningún himnario real.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-himnario-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const needs = HAS_FFMPEG ? {} : { skip: 'este equipo no tiene ffmpeg para fabricar los videos de prueba' };

test('parseLyrics entiende un archivo escrito con almohadillas', () => {
  const parsed = parseLyrics(`# Cantos de prueba

## Primera parte

### 1. Canto uno

**Estrofa 1**
Renglón uno del canto uno,
renglón dos del canto uno.

**Coro**
Coro del canto uno.

---

### 2. Canto dos

### Estrofa única
Solo un renglón, y otro
para terminar.

## Segunda parte

### 10. Canto diez
**Estrofa 1**
Sin línea en blanco antes.
`);
  assert.equal(parsed.book, 'Cantos de prueba');
  assert.deepEqual(parsed.categories, [{ name: 'Primera parte', numbers: [1, 2] }, { name: 'Segunda parte', numbers: [10] }]);
  assert.deepEqual(parsed.hymns.map((h) => [h.number, h.title, h.parts.map((p) => `${p.label}:${p.lines.length}`).join()]),
    [[1, 'Canto uno', 'Estrofa 1:2,Coro:1'], [2, 'Canto dos', 'Estrofa única:2'], [10, 'Canto diez', 'Estrofa 1:1']]);
  assert.deepEqual(parsed.hymns[0].parts[0].lines, ['Renglón uno del canto uno,', 'renglón dos del canto uno.']);
  assert.deepEqual(parsed.warnings, []);
});

test('parseLyrics entiende un archivo exportado de Word: marcas con barra, renglones sueltos y dos formas mezcladas', () => {
  // Lo primero viene a renglón seguido, con una barra al final de cada uno; lo demás, con las
  // marcas "escapadas", una regla entre himnos y cada renglón en su párrafo.
  const exported = ['Cantos de prueba (edición inventada)', '', 'Primera parte', '', '1\\. Canto uno', '', '**Estrofa 1**\\', 'Renglón uno,\\', 'renglón dos;\\', 'renglón tres.', '',
    '**Coro**\\', 'Coro \\"entre comillas\\",\\', 'segundo del coro.', '', '2\\. ¡Canto dos!', '', '**Estrofa única**\\', '3 veces lo diré,\\', 'y una más.', '',
    '\\# Cantos de prueba (edición inventada)', '', '\\## Primera parte', '', '\\-\\--', '', '\\### 3. Canto tres', '', '\\*\\*Estrofa 1\\*\\*', '', 'Un renglón por párrafo,', '', 'y otro más.', '',
    '\\*\\*Coro (final)\\*\\*', '', 'Coro del tres.', '', '\\-\\--', '', '\\# Cantos de prueba (edición inventada)', '', '\\## Segunda parte', '', '\\-\\--', '', '\\### 4. Canto cuatro', '', '\\*\\*Estrofa 1\\*\\*', '', '4. no es un himno: es letra,', '', 'y sigue.'].join('\r\n');
  const parsed = parseLyrics(exported);
  assert.equal(parsed.book, 'Cantos de prueba (edición inventada)');
  assert.deepEqual(parsed.categories, [{ name: 'Primera parte', numbers: [1, 2, 3] }, { name: 'Segunda parte', numbers: [4] }], 'el mismo nombre de categoría en dos trozos es una sola');
  assert.deepEqual(parsed.hymns.map((h) => [h.number, h.title]), [[1, 'Canto uno'], [2, '¡Canto dos!'], [3, 'Canto tres'], [4, 'Canto cuatro']]);
  assert.deepEqual(parsed.hymns[0].parts, [{ label: 'Estrofa 1', lines: ['Renglón uno,', 'renglón dos;', 'renglón tres.'] }, { label: 'Coro', lines: ['Coro "entre comillas",', 'segundo del coro.'] }]);
  assert.deepEqual(parsed.hymns[1].parts[0].lines, ['3 veces lo diré,', 'y una más.'], 'un renglón que empieza por una cifra sigue siendo letra');
  assert.deepEqual(parsed.hymns[2].parts.map((p) => [p.label, p.lines.length]), [['Estrofa 1', 2], ['Coro (final)', 1]]);
  assert.deepEqual(parsed.hymns[3].parts[0].lines, ['4. no es un himno: es letra,', 'y sigue.']);
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parseLyrics('').hymns, []);
});

test('fromFileName y ranges', () => {
  assert.deepEqual(fromFileName('001 Canto de la mañana.mp4'), { number: 1, title: 'Canto de la mañana' });
  assert.deepEqual(fromFileName('25_Otro_canto.m4v'), { number: 25, title: 'Otro canto' });
  assert.deepEqual(fromFileName('613.mp4'), { number: 613, title: 'Himno 613' });
  assert.equal(fromFileName('Bienvenida.mp4'), null);
  assert.equal(fromFileName('000 Nada.mp4'), null);
  assert.equal(ranges([5, 12, 14, 13, 30, 5]), '5, 12-14, 30');
  assert.equal(ranges([]), '');
});

const files = (...names) => names.map((name, i) => ({ name, size: 100 + i, modified: 1000 + i }));

test('buildCatalog: los videos mandan, y una letra con otro título que su video no se usa', () => {
  const lyrics = parseLyrics(`## Parte uno
### 1. Canto de la mañana
**Estrofa 1**
Letra del uno.
### 2. Un título que no corresponde
**Estrofa 1**
Letra que no es del dos.
## Parte dos
### 4. ¡Canto, cuarto!
**Estrofa 1**
Letra del cuatro.
### 9. Sin video
**Estrofa 1**
Letra del nueve.
`);
  const catalog = buildCatalog(files('001 Canto de la manana.mp4', '002 El segundo canto.mp4', '004 Canto cuarto.mp4', '004 Canto cuarto (otra copia).mp4', '006 Sin letra.mp4', 'Bienvenida.mp4'), lyrics);
  assert.deepEqual(catalog.hymns.map((h) => [h.number, h.title, Boolean(h.parts), h.category]), [
    [1, 'Canto de la mañana', true, 0],   // el título de la letra, que lleva la tilde
    [2, 'El segundo canto', false, 0],    // el del video: la letra de ese número es de otro canto
    [4, '¡Canto, cuarto!', true, 1],
    [6, 'Sin letra', false, null],
  ]);
  assert.deepEqual(catalog.categories, ['Parte uno', 'Parte dos']);
  assert.deepEqual(catalog.report, { total: 4, withLyrics: 2, missing: [3, 5], repeated: [4], unnumbered: ['Bienvenida.mp4'], mismatched: [2], withoutLyrics: [2, 6], withoutVideo: [9] });
  assert.deepEqual(buildCatalog([]).hymns, []);
  assert.equal(buildCatalog(files('001 Solo.mp4')).report.withLyrics, 0);
});

test('la búsqueda del himnario: por número, por título y por letra, con el renglón donde está', () => {
  const lyrics = parseLyrics(`### 1. Canto de la mañana
**Estrofa 1**
Despierta el día sobre el valle,
la niebla sube despacio.
**Coro**
Cantamos juntos al amanecer.
### 2. El valle del río
**Estrofa 1**
Bajan las aguas claras.
### 12. Otro canto
**Estrofa 1**
Nada que ver con lo anterior.
`);
  const search = createHymnSearch(buildCatalog(files('001 Canto de la manana.mp4', '002 El valle del rio.mp4', '012 Otro canto.mp4'), lyrics).hymns);
  assert.deepEqual(search('1').results.map((r) => r.number), [1, 12], 'primero el número exacto; después los que empiezan así');
  assert.deepEqual(search('7'), { type: 'number', total: 0, results: [] });
  const byTitle = search('valle');
  assert.equal(byTitle.type, 'text');
  // En el mismo nivel, antes el himno que lo lleva en el título que el que lo lleva en la letra.
  assert.deepEqual(byTitle.levels[0].results.map((r) => [r.number, r.label]), [[2, null], [1, 'Estrofa 1']]);
  assert.deepEqual(byTitle.levels[0].results[1].text, 'Despierta el día sobre el valle,', 'se muestra el renglón, no la estrofa entera');
  const [mark] = byTitle.levels[0].results[1].marks;
  assert.equal(byTitle.levels[0].results[1].text.slice(...mark), 'valle');
  const title = byTitle.levels[0].results[0];
  assert.equal(title.title.slice(...title.marks[0]), 'valle');
  // Una frase que salta de un renglón al siguiente se encuentra, y se muestran los dos.
  const across = search('sobre el valle la niebla').levels[0].results[0];
  assert.deepEqual([across.number, across.text], [1, 'Despierta el día sobre el valle, / la niebla sube despacio.']);
  assert.equal(search('manana').levels[0].results[0].number, 1, 'sin tildes');
  assert.equal(search('cantar al amanecer').levels.at(-1).id, 'similar', 'otras formas de la palabra, al final');
  assert.equal(search('zzz').total, 0);
  assert.deepEqual(search('a'), { type: 'text', levels: [], total: 0 });
});

// ---- Contra el servidor de verdad ----
async function start(name, { env = {}, count = 12 } = {}) {
  const hymnsDir = path.join(tmp, `${name}-himnario`);
  if (!fs.existsSync(hymnsDir)) seedHymnal(hymnsDir, { count, seconds: 3 });
  Object.assign(process.env, env);
  const dataDir = path.join(tmp, name);
  const app = createApp({ rootDir: ROOT, dataDir, biblesDir: path.join(tmp, 'biblias'), hymnsDir });
  for (const setup of [system, projection, order, hymns]) await setup(app);
  await app.tools.scan();
  for (const key of Object.keys(env)) delete process.env[key];
  app.services.hymns.reload();
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (role) => (await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })).headers.get('set-cookie').split(';')[0];
  let cookie = await login('control');
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...options.headers, cookie } });
  const api = {
    app, dataDir, hymnsDir, request,
    as: async (role) => { cookie = role ? await login(role) : ''; },
    get: async (url) => { const res = await request(url); return { ...(await res.json()), http: res.status }; },
    send: async (type, payload = {}) => { const res = await request('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) }); return { ...(await res.json()), http: res.status }; },
    state: async () => (await request('/api/state')).json(),
    // Espera a que Manna haya mirado todos los videos (cuánto duran y cuántas pistas traen).
    async probed(ms = 20_000) {
      for (let waited = 0; waited < ms; waited += 100) {
        const { hymns: list } = await api.get('/api/hymns');
        if (list.length && list.every((h) => h.instrumental != null)) return list;
        await sleep(100);
      }
      return null;
    },
    async stop() {
      await app.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
  return api;
}

test('el himnario se arma con lo que hay en la carpeta y dice lo que conviene revisar', async () => {
  const s = await start('lista', { env: { MANNA_FALTA: 'ffmpeg' } });
  try {
    const book = await s.get('/api/hymns');
    assert.equal(book.http, 200);
    assert.deepEqual((await s.state()).hymns, { ready: true, version: book.version, count: 11, issues: 4 });
    assert.deepEqual(book.hymns.map((h) => h.number), [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);
    assert.deepEqual(book.hymns.slice(0, 2).map((h) => [h.title, h.category, h.lyrics, h.duration, h.instrumental]), [[hymnTitle(1), 0, true, null, null], [hymnTitle(2), 0, true, null, null]], 'sin ffmpeg no se sabe cuánto duran');
    assert.equal(book.hymns.find((h) => h.number === 13)?.title, undefined);
    assert.equal(book.hymns.find((h) => h.number === 4).lyrics, false, 'la letra con otro título no se usa');
    assert.deepEqual(book.hymns.filter((h) => h.category === 1).map((h) => h.number), [4, 5, 6, 8], 'el 6 no viene en las letras, pero está entre dos de la misma categoría');
    assert.equal(book.hymns.find((h) => h.number === 4).title, hymnTitle(4), 'y se queda el título del video');
    assert.deepEqual(book.categories, ['Cantos de la mañana', 'Cantos del camino', 'Cantos de gratitud y esperanza para todos los días']);
    assert.deepEqual([book.report.total, book.report.withLyrics, book.report.missing, book.report.mismatched, book.report.withoutLyrics, book.report.withoutVideo], [11, 9, [7], [4], [4, 6], [7]]);
    assert.equal(book.report.notes.length, 4);
    assert.match(book.report.notes.join(' '), /Faltan los videos de un himno: 7\..*otro título que su video.*: 4\..*No hay letra para un himno: 6\..*sin video.*: 7\./);

    // La letra, para leerla; y la búsqueda.
    const two = await s.get('/api/hymns/2');
    assert.deepEqual([two.title, two.parts.map((p) => p.label).join(), two.parts[2].lines[1]], [hymnTitle(2), 'Estrofa 1,Coro,Estrofa 2', `${HYMN_FACTS.phrase.text} en la ventana;`]);
    assert.deepEqual((await s.get('/api/hymns/4')).parts, []);
    assert.equal((await s.get('/api/hymns/7')).http, 404);
    const found = await s.get(`/api/hymns/search?q=${encodeURIComponent('lampara encendida')}`);
    assert.deepEqual(found.levels[0].results.map((r) => [r.number, r.label, r.text]), [[2, 'Estrofa 2', `${HYMN_FACTS.phrase.text} en la ventana;`]]);
    assert.deepEqual((await s.get('/api/hymns/search?q=9')).results.map((r) => r.number), [9]);
    assert.equal((await s.get(`/api/hymns/search?q=${encodeURIComponent('titulo que no es el de su video')}`)).total, 0, 'lo que no se usa tampoco se encuentra');

    // Sin sesión, la letra no se entrega.
    await s.as(null);
    assert.equal((await s.get('/api/hymns')).http, 401);
    assert.equal((await s.get('/api/hymns/2')).http, 401);
    assert.equal((await s.get('/api/hymns/search?q=canto')).http, 401);
    await s.as('orden');
    assert.equal((await s.get('/api/hymns/2')).http, 200, 'quien opera el orden sí puede leerla');
    await s.as('control');

    // Al orden y al aire, cantado. Sin ffmpeg no hay pista.
    const item = (await s.send('order.add', { kind: 'song', data: { number: 2 } })).result;
    assert.deepEqual([item.kind, item.title, item.subtitle, item.steps, item.data], ['song', hymnTitle(2), 'N.º 2 · Cantado', 1, { number: 2, track: 'vocal' }]);
    const shown = await s.send('projection.show', { kind: 'song', data: { number: 2, track: 'vocal' } });
    assert.deepEqual([shown.result.number, shown.result.track, shown.result.instrumental, shown.result.url], [2, 'vocal', null, `/himnos/${encodeURIComponent('002 Luz que no se apaga.mp4')}`]);
    assert.equal((await s.state()).live.state.clock.playing, true);
    const refused = await s.send('projection.show', { kind: 'song', data: { number: 2, track: 'instrumental' } });
    assert.equal(refused.http, 409);
    assert.match(refused.error, /hace falta ffmpeg/);
    assert.equal((await s.send('projection.control', { track: 'instrumental' })).http, 409);
    assert.equal((await s.request('/api/hymns/2/pista.mp4')).status, 409);
    assert.equal((await s.send('projection.show', { kind: 'song', data: { number: 7 } })).http, 404);
    // En un equipo sin ffmpeg, la primera pantalla que lo reproduce dice cuánto dura.
    await s.send('projection.control', { duration: 181.4 });
    assert.equal((await s.state()).live.state.clock.duration, 181.4);

    // Al copiar otro video a la carpeta, aparece solo.
    fs.writeFileSync(path.join(s.hymnsDir, 'videos', '007 Manos que siembran.mp4'), '');
    s.app.services.hymns.reload();
    const again = await s.get('/api/hymns');
    assert.equal(again.hymns.find((h) => h.number === 7).lyrics, true);
    assert.deepEqual([again.report.missing, again.report.withoutVideo, again.report.notes.length], [[], [], 2]);
    assert.ok(again.version > book.version);
  } finally {
    await s.stop();
  }
});

test('con ffmpeg: cuánto dura cada himno, y la pista instrumental preparada al pedirla', needs, async () => {
  const s = await start('pista');
  try {
    const list = await s.probed();
    assert.ok(list, 'Manna mira todos los videos');
    const two = list.find((h) => h.number === 2);
    const single = list.find((h) => h.number === HYMN_FACTS.single);
    assert.deepEqual([Math.round(two.duration), two.instrumental, single.instrumental], [3, true, false]);
    // Lo anotado se guarda (con un momento de retraso): al volver a abrir no hay que mirarlos otra vez.
    const notes = path.join(s.dataDir, 'himnario.json');
    for (let waited = 0; waited < 3000 && !fs.existsSync(notes); waited += 50) await sleep(50);
    assert.equal(Object.keys(JSON.parse(fs.readFileSync(notes, 'utf8')).files).length, 11);

    const shown = await s.send('projection.show', { kind: 'song', data: { number: 2, track: 'instrumental' } });
    assert.deepEqual([shown.http, shown.result.track, Math.round(shown.result.duration)], [200, 'instrumental', 3]);
    assert.match(shown.result.instrumental, /^\/api\/hymns\/2\/pista\.mp4\?v=\d+$/);
    assert.equal((await s.state()).live.state.track, 'instrumental');
    // El archivo de la pista: el mismo video, con una sola pista de sonido (la segunda).
    const res = await s.request(shown.result.instrumental, { headers: { Range: 'bytes=0-99' } });
    assert.deepEqual([res.status, res.headers.get('content-type'), (await res.arrayBuffer()).byteLength], [206, 'video/mp4', 100]);
    const made = fs.readdirSync(path.join(s.dataDir, 'tmp', 'himnos'));
    assert.equal(made.length, 1);
    const streams = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', path.join(s.dataDir, 'tmp', 'himnos', made[0])]).stdout).streams;
    assert.deepEqual(streams.map((st) => [st.codec_type, st.tags?.language]), [['video', 'und'], ['audio', 'eng']]);

    // Al aire se cambia de sonido sin perder el punto.
    await s.send('projection.control', { position: 1.5, playing: false });
    await s.send('projection.control', { track: 'vocal' });
    let live = (await s.state()).live.state;
    assert.deepEqual([live.track, live.clock.position, live.clock.playing], ['vocal', 1.5, false]);
    assert.equal((await s.send('projection.control', { track: 'coro' })).http, 400);
    // «Negro» lo pausa, como a cualquier cosa que suena.
    await s.send('projection.control', { playing: true });
    await s.send('projection.mode', { mode: 'black' });
    live = (await s.state()).live.state;
    assert.equal(live.clock.playing, false);

    // Un himno con una sola pista de sonido no tiene "pista".
    const one = await s.send('projection.show', { kind: 'song', data: { number: HYMN_FACTS.single, track: 'instrumental' } });
    assert.equal(one.http, 409);
    assert.match(one.error, /no trae pista instrumental/);
    const sung = await s.send('projection.show', { kind: 'song', data: { number: HYMN_FACTS.single } });
    assert.deepEqual([sung.http, sung.result.instrumental], [200, null]);
    assert.equal((await s.send('projection.control', { track: 'instrumental' })).http, 409);
    assert.equal((await s.request(`/api/hymns/${HYMN_FACTS.single}/pista.mp4`)).status, 409);

    const item = (await s.send('order.add', { kind: 'song', data: { number: 9, track: 'instrumental' } })).result;
    assert.equal(item.subtitle, 'N.º 9 · Pista');
    assert.equal((await s.send('order.show', { id: item.id })).result.track, 'instrumental');
  } finally {
    await s.stop();
  }
});
