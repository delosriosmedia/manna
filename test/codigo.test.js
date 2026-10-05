import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindingsOf, checkContract, checkModules, declaredIn, exportsOf, importsOf, sourceFiles, strip } from '../scripts/lib/codigo.mjs';
import { codeSignature } from '../server/core/build.js';
import { splitTabs } from '../web/core/tabs.js';
import { whenLabel } from '../web/core/time.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-codigo-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));
const write = (name, text) => {
  const file = path.join(tmp, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};

// ---- El proyecto entero ----
// Estas tres pruebas son la red: fallan en cuanto alguien escribe uno de los descuidos que un
// navegador solo delata al pulsar justo ese botón.

const web = sourceFiles(path.join(ROOT, 'web'));
const server = sourceFiles(path.join(ROOT, 'server'));
const rest = [...sourceFiles(path.join(ROOT, 'scripts')), ...sourceFiles(path.join(ROOT, 'test'))];

test('ningún archivo importa algo que no existe ni tapa con un nombre propio algo que importó', () => {
  assert.ok(web.length > 30 && server.length > 30, 'se están revisando los archivos');
  const problems = [
    ...checkModules(web, { root: ROOT, webRoot: path.join(ROOT, 'web') }),
    ...checkModules(server, { root: ROOT }),
    ...checkModules(rest, { root: ROOT }),
  ];
  assert.deepEqual(problems, []);
});

test('la interfaz solo pide al servidor órdenes y direcciones que el servidor tiene', () => {
  const { problems, actions, routes } = checkContract(web, server, { root: ROOT });
  assert.ok(actions.size > 30 && routes.length > 10, 'se encontraron las órdenes y direcciones del servidor');
  assert.deepEqual(problems, []);
});

// ---- El revisor, con los casos que debe cazar ----

test('caza el fallo que rompió la subida del fondo: un nombre propio que tapa lo importado', () => {
  write('caso/api.js', 'export function upload() {}\nexport const state = {};\nexport default function api() {}\n');
  const bad = write('caso/panel.js', `import api, { state, upload } from './api.js';
export function panel() {
  const upload = document.createElement('input'); // como en la 1.1
  upload.onchange = () => upload('/api/x', upload.files[0]);
}
`);
  assert.deepEqual(checkModules([bad], { root: tmp }), ['caso/panel.js:3 declara "upload", que tapa lo importado de "./api.js". Ponle otro nombre.']);

  const cases = {
    'un parámetro': 'export const f = (state) => state;',
    'un parámetro de función': 'export function f(a, upload) { return a + upload; }',
    'un parámetro suelto de flecha': 'export const f = [1].map(state => state);',
    'un parámetro desarmado': 'export const f = ({ list: state }) => state;',
    'una variable desarmada': 'const { a, upload } = window; export const f = a + upload;',
    'una variable de lista': 'const [a, state] = []; export const f = a + state;',
    'una función propia': 'function upload() {} export const f = upload;',
    'un método abreviado': 'export const o = { run(state) { return state; } };',
    'un error capturado': 'try { api(); } catch (state) { console.log(state); }',
    'un recorrido': 'for (const { upload } of []) console.log(upload);',
  };
  for (const [label, body] of Object.entries(cases)) {
    const file = write(`caso/${label.replace(/ /g, '-')}.js`, `import api, { state, upload } from './api.js';\n${body}\n`);
    assert.equal(checkModules([file], { root: tmp }).length, 1, label);
  }
});

test('no acusa a lo que solo se parece', () => {
  write('bien/api.js', 'export function upload() {}\nexport const state = {};\n');
  const fine = write('bien/panel.js', `import { state, upload } from './api.js';
// const upload = 1; en un comentario no cuenta
const text = 'const upload = 2; (state) => 3';
const tpl = \`function upload() {} \${state.x}\`;
const rx = /const upload = /;
export const o = { upload: 1, state: text, other: { upload } };
export function send(file, { headers, onProgress } = {}) { return upload('/api/x', file, { headers, onProgress, tpl, rx }); }
export const names = Object.keys(state).map((key) => key.upload);
`);
  assert.deepEqual(checkModules([fine], { root: tmp }), []);
});

test('caza un import de algo que el otro archivo no ofrece, o de un archivo que no existe', () => {
  write('falta/api.js', 'export const a = 1;\nexport { b as c };\nconst b = 2;\n');
  const file = write('falta/usa.js', "import { a, b, c } from './api.js';\nimport x from './api.js';\nimport './no-esta.js';\nexport const y = a + b + c + x;\n");
  assert.deepEqual(checkModules([file], { root: tmp }), [
    'falta/usa.js:1 importa "b" de "./api.js", que no lo ofrece.',
    'falta/usa.js:2 importa "default" de "./api.js", que no lo ofrece.',
    'falta/usa.js:3 importa "./no-esta.js", que no existe.',
  ]);
  // La web importa con rutas desde su raíz.
  write('web/core/api.js', 'export const a = 1;\n');
  const page = write('web/roles/control.js', "import { a, falta } from '/core/api.js';\nexport const z = a + falta;\n");
  assert.deepEqual(checkModules([page], { root: tmp, webRoot: path.join(tmp, 'web') }), ['web/roles/control.js:1 importa "falta" de "/core/api.js", que no lo ofrece.']);
});

test('caza una orden o una dirección que el servidor no tiene', () => {
  const srv = write('pacto/servidor.js', "app.action('order.add', {}, () => {});\napp.route('GET', '/api/tv/:id/address', () => {});\napp.route('POST', '/api/media/images', () => {});\n");
  const ui = write('pacto/pantalla.js', "action('order.add', {});\naction('order.borrar', {});\napi(`/api/tv/${id}/address`);\nupload('/api/media/images?name=x', f);\napi('/api/media/fotos');\n");
  assert.deepEqual(checkContract([ui], [srv], { root: tmp }).problems, [
    'pacto/pantalla.js:2 envía la orden "order.borrar", que el servidor no tiene.',
    'pacto/pantalla.js:5 pide "/api/media/fotos", que el servidor no atiende.',
  ]);
});

test('las piezas del revisor: quitar textos y comentarios, leer imports, exports y nombres', () => {
  const code = strip("const a = 'x // no'; // sí\nconst b = `t ${a + 'y'} u`; /* fuera */ const r = /['\"]/g;\n");
  assert.equal(code.includes('no'), false);
  assert.equal(code.includes('sí'), false);
  assert.equal(code.includes('fuera'), false);
  assert.match(code, /\$\{a \+ ' '\}/, 'el código dentro de ${} se conserva');
  assert.equal(code.split('\n').length, 3, 'las líneas no se mueven');
  assert.deepEqual(importsOf("import a, { b, c as d } from './x.js';\nimport * as ns from '../y.js';\nimport './z.js';\n").map((i) => [i.from, i.names.map((n) => `${n.imported}>${n.local}`).join(), i.line]), [
    ['./x.js', 'b>b,c>d,default>a', 1], ['../y.js', '*>ns', 2], ['./z.js', '', 3],
  ]);
  assert.deepEqual([...exportsOf('export const a = 1; export async function b() {} export class C {} export { d, e as f }; export default 3;').names].sort(), ['C', 'a', 'b', 'd', 'default', 'f']);
  assert.deepEqual(bindingsOf('a, { b, c: d } = {}, [e], ...rest'), ['a', 'b', 'd', 'e', 'rest']);
  assert.deepEqual([...new Set(declaredIn('const a = 1; let { b, c: d } = x; function f(g) {} const h = (i, j) => i; class K {}').map((d) => d.name))].sort(), ['K', 'a', 'b', 'd', 'f', 'g', 'h', 'i', 'j']);
});

// ---- Huella del código: saber que Manna se actualizó estando abierto ----

test('la huella del código cambia cuando cambia un archivo del servidor o la versión, y solo entonces', () => {
  const root = path.join(tmp, 'huella');
  fs.mkdirSync(path.join(root, 'server', 'core'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'server', 'index.js'), 'console.log(1);');
  fs.writeFileSync(path.join(root, 'server', 'core', 'a.js'), 'export const a = 1;');
  const first = codeSignature(root);
  assert.match(first, /^[0-9a-f]{12}$/);
  assert.equal(codeSignature(root), first);
  // Lo que no es código del servidor no cuenta: la interfaz se lee del disco en cada visita.
  fs.mkdirSync(path.join(root, 'web'));
  fs.writeFileSync(path.join(root, 'web', 'app.js'), 'x');
  fs.writeFileSync(path.join(root, 'server', 'notas.txt'), 'x');
  assert.equal(codeSignature(root), first);
  fs.writeFileSync(path.join(root, 'server', 'core', 'a.js'), 'export const a = 2;');
  const second = codeSignature(root);
  assert.notEqual(second, first);
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.1"}');
  assert.notEqual(codeSignature(root), second);
  fs.writeFileSync(path.join(root, 'server', 'core', 'nuevo.js'), '');
  assert.notEqual(codeSignature(root), second);
  assert.equal(codeSignature(path.join(tmp, 'no-existe')), null);
});

// ---- Piezas pequeñas de la interfaz que no necesitan navegador ----

test('en el celular caben cinco pestañas; con más, las cuatro primeras y "Más"', () => {
  const modules = ['orden', 'biblia', 'comparador', 'medios', 'himnario', 'ajustes'];
  assert.deepEqual(splitTabs(modules.slice(0, 5)), { tabs: modules.slice(0, 5), overflow: [] });
  assert.deepEqual(splitTabs(modules), { tabs: ['orden', 'biblia', 'comparador', 'medios'], overflow: ['himnario', 'ajustes'] });
  assert.deepEqual(splitTabs(['orden']), { tabs: ['orden'], overflow: [] });
});

test('whenLabel dice cuándo se agregó algo: hoy, ayer o la fecha', () => {
  const now = new Date(2026, 9, 4, 21, 0).getTime();
  assert.match(whenLabel(new Date(2026, 9, 4, 20, 34).getTime(), now), /^hoy, .*34/);
  assert.match(whenLabel(new Date(2026, 9, 4, 0, 5).getTime(), now), /^hoy, /);
  assert.match(whenLabel(new Date(2026, 9, 3, 23, 59).getTime(), now), /^ayer, .*59/);
  assert.match(whenLabel(new Date(2026, 8, 27, 9, 5).getTime(), now), /^27 sept?\.?, .*05/);
  assert.match(whenLabel(new Date(2025, 11, 24, 18, 0).getTime(), now), /^24 dic\.? (de )?2025, /);
});
