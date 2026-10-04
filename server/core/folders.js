import fs from 'node:fs';
import path from 'node:path';

// Carpetas de contenido (Biblias/, Himnario/, Medios/): el usuario copia archivos y aparecen solos.

// Avisa cuando cambia el contenido de una carpeta, una sola vez por tanda de cambios
// (copiar un archivo grande dispara muchos avisos seguidos). Devuelve la función que deja de vigilar.
export function watchFolder(dir, onChange, { delay = 1000 } = {}) {
  let timer = null;
  let watcher = null;
  try {
    watcher = fs.watch(dir, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, delay);
    });
    watcher.on('error', () => {});
  } catch { /* este sistema no permite vigilar la carpeta: queda recargar a mano */ }
  return () => {
    clearTimeout(timer);
    watcher?.close();
  };
}

// Archivos de una carpeta con alguna de las extensiones dadas (['.mp4', '.m4v']), por orden
// de nombre. No entra en subcarpetas ni lista archivos ocultos o a medio copiar.
export function listFiles(dir, extensions) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  const wanted = new Set(extensions.map((e) => e.toLowerCase()));
  return names
    .filter((name) => !name.startsWith('.') && wanted.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .map((name) => {
      const file = path.join(dir, name);
      let stat = null;
      try { stat = fs.statSync(file); } catch { /* desapareció mientras se listaba */ }
      return stat?.isFile() ? { name, file, size: stat.size, modified: stat.mtimeMs } : null;
    })
    .filter(Boolean);
}
