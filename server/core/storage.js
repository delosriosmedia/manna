import fs from 'node:fs';
import path from 'node:path';

// Archivos JSON pequeños en data/. Cada módulo pide el suyo con storage('nombre', valoresPorDefecto).
export function createStorage(dataDir) {
  const all = [];

  function storage(name, defaults = {}) {
    const file = path.join(dataDir, `${name}.json`);
    let data = { ...defaults };
    try {
      data = { ...defaults, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch { /* primera ejecución o archivo dañado: se usan los valores por defecto */ }

    let timer = null;
    let dirty = false;
    const flush = () => {
      clearTimeout(timer);
      timer = null;
      if (!dirty) return;
      const tmp = `${file}.tmp`;
      // Esto corre desde un temporizador: si el disco no deja escribir (lleno, o en Windows otro
      // programa tiene el archivo abierto), Manna no se cae. Sigue con lo que tiene en memoria y lo
      // vuelve a intentar en el siguiente cambio y al cerrar.
      try {
        fs.writeFileSync(tmp, JSON.stringify(entry.data, null, 2));
        fs.renameSync(tmp, file);
        dirty = false;
      } catch (err) {
        console.error(`No se pudo guardar ${name}.json:`, err.message);
      }
    };
    const entry = {
      data,
      save() {
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(flush, 200);
      },
      flush,
    };
    all.push(entry);
    return entry;
  }

  storage.flushAll = () => all.forEach((s) => s.flush());
  return storage;
}
