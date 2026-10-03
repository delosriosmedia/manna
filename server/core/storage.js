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
    const flush = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(entry.data, null, 2));
      fs.renameSync(tmp, file);
    };
    const entry = {
      data,
      save() {
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
