import fs from 'node:fs';
import path from 'node:path';

const RETRY_MS = 2000;
// Lee un JSON; null si no existe o no se puede leer.
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

// Archivos JSON pequeños en data/. Cada módulo pide el suyo con storage('nombre', valoresPorDefecto).
export function createStorage(dataDir) {
  const all = [];

  function storage(name, defaults = {}) {
    const file = path.join(dataDir, `${name}.json`);
    const previous = `${file}.anterior`;
    let loaded = readJson(file);
    // Un archivo que existe y no se puede leer (un corte de luz justo al guardar) no se pisa: se aparta con la fecha y se
    // usa la versión anterior, si la hay. Antes se cargaban los valores por defecto y el primer guardado lo borraba: se
    // perdían los órdenes o los usuarios sin aviso (auditoría integral, S1-E).
    if (loaded === null && fs.existsSync(file)) {
      const apart = path.join(dataDir, `${name}.dañado-${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')}.json`);
      try { fs.renameSync(file, apart); } catch { /* se queda donde está; igual no se usa */ }
      loaded = readJson(previous);
      console.error(`${name}.json estaba dañado: quedó aparte como ${path.basename(apart)}${loaded ? ' y se usa la versión anterior' : ''}.`);
    }
    const data = { ...defaults, ...(loaded || {}) };

    let timer = null;
    let dirty = false;
    const flush = () => {
      clearTimeout(timer);
      timer = null;
      if (!dirty) return;
      const tmp = `${file}.tmp`;
      // Esto corre desde un temporizador: si el disco no deja escribir (lleno, o en Windows otro programa tiene el archivo
      // abierto un momento), Manna no se cae: lo vuelve a intentar en 2 s (N1-1-1 de la auditoría), y al cerrar. El temporal
      // se escribe con fsync, para que un corte de luz no deje el archivo vacío, y la versión de antes queda en .anterior.
      try {
        const fd = fs.openSync(tmp, 'w');
        try {
          fs.writeSync(fd, JSON.stringify(entry.data, null, 2));
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        if (fs.existsSync(file)) fs.copyFileSync(file, previous);
        fs.renameSync(tmp, file);
        dirty = false;
      } catch (err) {
        console.error(`No se pudo guardar ${name}.json (se vuelve a intentar):`, err.message);
        timer = setTimeout(flush, RETRY_MS);
        timer.unref?.();
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
