import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

const MAX_BYTES = 1024 * 1024;

// Cuando Manna se abre desde su icono no hay ventana donde leer los mensajes:
// se guardan en un archivo, con fecha. Al pasar de 1 MB se empieza uno nuevo.
export function logToFile(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.anterior`);
  } catch { /* aún no existe */ }

  const write = (args) => {
    try { fs.appendFileSync(file, `${new Date().toISOString()} ${util.format(...args)}\n`); } catch { /* disco lleno o sin permiso: no detener Manna por el registro */ }
  };
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      write(args);
      original(...args);
    };
  }
  process.on('uncaughtException', (err) => {
    write(['ERROR NO CONTROLADO:', err?.stack || err]);
    process.exit(1);
  });
}
