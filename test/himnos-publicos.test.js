import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { TOPE_VERSOS } from '../scripts/himnos-publicos/worker.js';

const REFERER = { referer: 'https://manna-iglesia.es/' };
// Un depósito de mentira: guarda un video y una biblia, y dice qué clave le pidieron.
function deposito() {
  const pedidas = [];
  return {
    pedidas,
    async get(clave, { range }) {
      pedidas.push(clave);
      if (clave !== 'Himnario/videos/001 Cantad alegres al Señor.mp4') return null;
      const hay = range.get('range');
      return { size: 1000, httpEtag: '"x"', body: 'video', range: hay ? { offset: 100, length: 50 } : undefined };
    },
  };
}
const pedir = (ruta, headers = REFERER, env = { CONTENIDO: deposito() }) => worker.fetch(new Request(`https://himnos.manna-iglesia.es/${ruta}`, { headers }), env);
const HIMNO = encodeURIComponent('001 Cantad alegres al Señor.mp4');

test('sirve un himno desde la portada, y por partes para poder adelantarlo', async () => {
  const entero = await pedir(HIMNO);
  assert.equal(entero.status, 200);
  assert.equal(entero.headers.get('content-type'), 'video/mp4');
  const parte = await pedir(HIMNO, { ...REFERER, range: 'bytes=100-149' });
  assert.equal(parte.status, 206);
  assert.equal(parte.headers.get('content-range'), 'bytes 100-149/1000');
  assert.equal(parte.headers.get('content-length'), '50');
});

test('el nombre en otra forma de Unicode llega al mismo himno', async () => {
  assert.equal((await pedir(encodeURIComponent('001 Cantad alegres al Señor.mp4'.normalize('NFD')))).status, 200);
});

test('no sirve nada fuera de los videos del himnario', async () => {
  const env = { CONTENIDO: deposito() };
  for (const ruta of ['Biblias/SpanishRVR1960Bible.xml', encodeURIComponent('Himnario/letras/Letras Himnario.md'), encodeURIComponent('../Biblias/x.mp4'), '']) {
    assert.equal((await pedir(ruta, REFERER, env)).status, 404, ruta);
  }
  assert.deepEqual(env.CONTENIDO.pedidas, []);
});

test('no sirve a otros sitios, atiende a quien no dice de dónde viene y solo responde a GET y HEAD', async () => {
  assert.equal((await pedir(HIMNO, { referer: 'https://otro-sitio.com/' })).status, 403);
  assert.equal((await pedir(HIMNO, { referer: 'https://manna-iglesia.es.otro.com/' })).status, 403);
  assert.equal((await pedir(HIMNO, {})).status, 200);
  assert.equal((await worker.fetch(new Request(`https://himnos.manna-iglesia.es/${HIMNO}`, { method: 'POST', headers: REFERER }), { CONTENIDO: deposito() })).status, 405);
});

test('un himno que no existe responde 404', async () => {
  assert.equal((await pedir(encodeURIComponent('999 No existe.mp4'))).status, 404);
});

// La Biblia: el libro 43, capítulo 3, con diez versículos.
function depositoBiblia() {
  const pedidas = [];
  const capitulo = Array.from({ length: 10 }, (_, i) => [i + 1, `verso ${i + 1}`]);
  return {
    pedidas,
    async get(clave) {
      pedidas.push(clave);
      return clave === 'Portada/biblias/NTV/43.json' ? { json: async () => ({ 3: capitulo }) } : null;
    },
  };
}
const citar = (ruta, headers = REFERER, env = { CONTENIDO: depositoBiblia() }) => worker.fetch(new Request(`https://himnos.manna-iglesia.es/biblia/${ruta}`, { headers }), env);

test('una cita trae solo esos versículos, y el permiso para que los lea la portada', async () => {
  const r = await citar('NTV/43/3/2-3');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { versos: [[2, 'verso 2'], [3, 'verso 3']], truncado: false });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://manna-iglesia.es');
});

test('nunca entrega más del tope por consulta, aunque se pida el capítulo entero', async () => {
  const { versos, truncado } = await (await citar('NTV/43/3/1-10')).json();
  assert.equal(versos.length, TOPE_VERSOS);
  assert.equal(truncado, true);
});

test('la Biblia solo sale hacia la portada: ni desde otro sitio ni sin decir de dónde viene', async () => {
  const env = { CONTENIDO: depositoBiblia() };
  assert.equal((await citar('NTV/43/3/1', { referer: 'https://otro-sitio.com/' }, env)).status, 403);
  assert.equal((await citar('NTV/43/3/1', {}, env)).status, 403);
  assert.deepEqual(env.CONTENIDO.pedidas, []);
});

test('no entrega otras versiones ni los archivos completos', async () => {
  const env = { CONTENIDO: depositoBiblia() };
  for (const ruta of ['NVI/43/3/1', 'NTV/43', 'NTV/43/3', '../Biblias/SpanishNTVBible.xml']) {
    assert.equal((await citar(ruta, REFERER, env)).status, 404, ruta);
  }
  assert.equal((await pedir('Portada/biblias/NTV/43.json', REFERER, env)).status, 404);
  assert.deepEqual(env.CONTENIDO.pedidas, []);
});

test('corta a quien pide demasiado seguido, y no existe lo que no está', async () => {
  const LIMITE = { limit: async () => ({ success: false }) };
  assert.equal((await citar('NTV/43/3/1', REFERER, { CONTENIDO: depositoBiblia(), LIMITE })).status, 429);
  assert.equal((await citar('NTV/43/99/1')).status, 404);
  assert.equal((await citar('PDT/43/3/1')).status, 404);
});
