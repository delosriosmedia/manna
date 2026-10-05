import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Huella del código del servidor: cambia en cuanto cambia cualquier archivo de server/ o la versión.
//
// Manna queda abierto durante horas, y la interfaz (los archivos de web/) se lee del disco en cada
// visita. Si el programa se actualiza con Manna abierto, la interfaz nueva habla con un servidor
// viejo que no conoce sus órdenes: todo parece estar, pero falla al usarlo. Con esta huella el
// servidor se da cuenta de que el código cambió bajo sus pies y lo avisa.
export function codeSignature(rootDir) {
  const hash = crypto.createHash('sha1');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) hash.update(`${path.relative(rootDir, full)}\n`).update(fs.readFileSync(full));
    }
  };
  try {
    walk(path.join(rootDir, 'server'));
    hash.update(fs.readFileSync(path.join(rootDir, 'package.json')));
  } catch {
    return null; // a mitad de una copia de archivos: se volverá a mirar
  }
  return hash.digest('hex').slice(0, 12);
}
