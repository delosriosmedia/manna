// Sube a R2 las versiones de la portada, un archivo por libro, para que el Worker las lea por cita sin abrir el XML entero.
// Quedan en Portada/biblias/: la copia de la nube (mirror) no las toca y solo salen por el Worker, con tope.
//   node scripts/himnos-publicos/subir-biblias.mjs [carpeta de las biblias]
// Las claves salen de ~/.manna-r2, como en scripts/subir-r2.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bucketFromEnv } from '../../server/core/r2.js';
import { ARCHIVOS, porLibro } from './biblias.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const carpeta = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'Contenido', 'Biblias');
const guardado = Object.fromEntries(fs.readFileSync(path.join(os.homedir(), '.manna-r2'), 'utf8').split(/\r?\n/)
  .map((linea) => linea.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const deposito = bucketFromEnv({ ...guardado, ...process.env });
if (!deposito) throw new Error('Faltan las claves de R2 en ~/.manna-r2.');

const cola = Object.entries(ARCHIVOS).flatMap(([version, archivo]) => {
  const libros = porLibro(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
  if (Object.keys(libros).length !== 66) throw new Error(`${version} no trae los 66 libros.`);
  return Object.entries(libros).map(([n, capitulos]) => [`Portada/biblias/${version}/${n}.json`, Buffer.from(JSON.stringify(capitulos))]);
});
const total = cola.length;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let par = cola.shift(); par; par = cola.shift()) await deposito.put(par[0], par[1], 'application/json');
}));
console.log(`Subidos ${total} libros a Portada/biblias/.`);
