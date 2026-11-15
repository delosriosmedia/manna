import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// El himnario y las biblias de la nube en el equipo de la iglesia (decisión 64). La nube los tiene en R2; el equipo le
// pide la lista (y la guarda: así el himnario sale completo aunque no haya internet) y un enlace por archivo, y baja a
// la carpeta de contenido lo que falte, sin pisar nada:
// - siempre, las biblias y las letras;
// - con el himnario «completo», también los videos y las diapositivas;
// - «desde la nube», los de los himnos de los órdenes que vienen; cualquier otro, al usarlo (`fetch`).
// Cada archivo se baja a «.parte» y, si se corta, sigue donde iba.
const ALWAYS = /^(Biblias|Himnario\/letras)\//;
const numberOf = (key) => Number(/^Himnario\/(?:videos|diapositivas)\/(\d+)\s/.exec(key)?.[1]) || null;
const MARGIN = 2 * 2 ** 30; // lo que se deja libre en el disco, para guardar los datos, convertir y descargar

// Qué bajar de lo que falta (S5-11 de la auditoría integral): lo que toca si cabe en `room`; si no, solo lo de siempre
// y los himnos de los próximos cultos (`full`, para avisarlo); si tampoco cabe eso, nada. El himnario completo son
// varios gigas, y un disco lleno deja a Manna sin poder guardar sus datos.
export function pick(list, { all, soon, room }) {
  const needed = list.filter(({ key }) => ALWAYS.test(key) || soon.has(numberOf(key)));
  const wanted = all ? list : needed;
  const fits = (l) => l.reduce((n, f) => n + (f.size || 0), 0) <= room;
  if (fits(wanted)) return { wanted, full: false };
  return { wanted: fits(needed) ? needed : [], full: true };
}

export function createContent(app, { ask, link, mode, onProgress }) {
  const listFile = path.join(app.dataDir, 'nube-contenido.json');
  let files = null;
  try { files = JSON.parse(fs.readFileSync(listFile, 'utf8')).files; } catch { /* aún no se pidió */ }

  // Dónde va cada archivo de la nube; null si no es del himnario ni de las biblias.
  const target = (key) => {
    const [top, ...rest] = key.split('/');
    if (!rest.length || rest.some((p) => !p || p === '.' || p === '..')) return null;
    if (top === 'Biblias') return path.join(app.biblesDir, ...rest);
    return top === 'Himnario' && app.hymnsDir ? path.join(app.hymnsDir, ...rest) : null;
  };
  // Lo que ya está, también si su nombre lleva las tildes escritas de la otra forma (NFD): en Windows son archivos
  // distintos, y se bajaba otra vez y salía «repetido» en los avisos del himnario (N1-1-2).
  const present = (key) => [target(key), target(key.normalize('NFD'))].find((p) => p && fs.existsSync(p)) || null;
  const have = (key) => Boolean(present(key));
  // Lo libre en el disco del himnario; si el sistema no lo dice (Node.js anterior a la 18.15), no se limita.
  const free = () => {
    try {
      const s = fs.statfsSync(app.hymnsDir || app.dataDir);
      return s.bavail * s.bsize;
    } catch {
      return Infinity;
    }
  };

  const running = new Map(); // archivo → promesa
  function fetchKey(key) {
    if (running.has(key)) return running.get(key);
    const work = (async () => {
      const dest = target(key);
      if (!dest) throw new Error('Ese archivo no es del himnario ni de las biblias.');
      const already = present(key);
      if (already) return already;
      const part = `${dest}.parte`;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const size = files?.find((f) => f.key === key)?.size;
      // Lo que quedó de una bajada cortada (N2-1-4 y N2-1-5 de la auditoría integral). Si ya está entero (se cortó justo
      // antes de darle su nombre), se termina sin pedir nada: R2 diría 416 y quedaba trabado. Si mide más, es de otra
      // versión y se empieza de cero. Si no, se sigue un mega antes: tras un corte de luz, el final escrito puede no
      // haber llegado al disco.
      let from = fs.existsSync(part) ? fs.statSync(part).size : 0;
      if (size != null && from > size) from = 0;
      if (size == null || from < size) {
        from = Math.max(0, from - 2 ** 20);
        if (from) fs.truncateSync(part, from);
        const get = async (start) => fetch(await link(key), { headers: start ? { range: `bytes=${start}-` } : {}, signal: AbortSignal.timeout(30 * 60_000) });
        let res = await get(from);
        if (res.status === 416) res = await get(0);
        if (!res.ok) throw new Error(`R2 respondió ${res.status}.`);
        await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part, { flags: res.status === 206 ? 'a' : 'w' }));
      }
      if (size != null && fs.statSync(part).size !== size) {
        fs.rmSync(part, { force: true });
        throw new Error('El archivo llegó incompleto.');
      }
      // Al disco antes de darle su nombre, y el nombre otra vez si Windows lo retiene un momento (el antivirus).
      const fd = fs.openSync(part, 'r+');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      for (let tries = 1; ; tries += 1) {
        try {
          fs.renameSync(part, dest);
          break;
        } catch (err) {
          if (tries >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
          await new Promise((resolve) => { setTimeout(resolve, 200); });
        }
      }
      return dest;
    })().finally(() => running.delete(key));
    running.set(key, work);
    return work;
  }

  // Los himnos de los órdenes de hoy en adelante (y del que está en uso): se bajan antes del culto.
  function upcoming() {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const active = app.store.get('order')?.active;
    const numbers = new Set();
    for (const o of app.services.order?.sync?.export().records || []) {
      if (o.date < today && o.id !== active) continue;
      for (const item of o.items || []) if (['song', 'lyrics'].includes(item.kind) && Number(item.data?.number)) numbers.add(Number(item.data.number));
    }
    return numbers;
  }

  // Pone al día la lista y baja lo que toca. Una vez a la vez; si se pide otra durante, se hace al terminar.
  let filling = null;
  let again = false;
  function fill() {
    if (filling) { again = true; return filling; }
    filling = (async () => {
      const list = await ask('GET', '/api/nube/contenido', null, 90_000);
      if (JSON.stringify(list.files) !== JSON.stringify(files)) {
        files = list.files;
        fs.writeFileSync(listFile, JSON.stringify({ files }));
        app.services.hymns?.reload();
      }
      const { wanted, full } = pick(files.filter(({ key }) => target(key) && !have(key)), { all: mode() === 'completo', soon: upcoming(), room: free() - MARGIN });
      if (full) console.log('Nube: el disco está casi lleno: no se baja todo el himnario.');
      let done = 0;
      let failed = 0;
      const tell = () => onProgress({ done, total: wanted.length, failed, ...(full && { full }) });
      for (const { key } of wanted) {
        tell();
        try { await fetchKey(key); } catch { failed += 1; }
        done += 1;
      }
      if (wanted.length || full) tell();
      else onProgress(null);
      if (wanted.length) console.log(`Nube: del himnario y las biblias bajaron ${done - failed} de ${wanted.length} archivos${failed ? ` (fallaron ${failed})` : ''}.`);
    })().finally(() => {
      filling = null;
      if (again) { again = false; fill().catch(() => {}); }
    });
    return filling;
  }

  // Lo que el himnario no tiene en la carpeta pero está en la nube: los videos y las diapositivas, con su tamaño.
  const missing = () => (files || []).filter(({ key }) => /^Himnario\/(videos|diapositivas)\//.test(key) && !have(key));
  return { fill, fetch: fetchKey, missing };
}
