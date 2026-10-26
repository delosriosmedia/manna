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
  const have = (key) => fs.existsSync(target(key) || '');

  const running = new Map(); // archivo → promesa
  function fetchKey(key) {
    if (running.has(key)) return running.get(key);
    const work = (async () => {
      const dest = target(key);
      if (!dest) throw new Error('Ese archivo no es del himnario ni de las biblias.');
      if (fs.existsSync(dest)) return dest;
      const part = `${dest}.parte`;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const from = fs.existsSync(part) ? fs.statSync(part).size : 0;
      const res = await fetch(await link(key), { headers: from ? { range: `bytes=${from}-` } : {}, signal: AbortSignal.timeout(30 * 60_000) });
      if (!res.ok) throw new Error(`R2 respondió ${res.status}.`);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part, { flags: res.status === 206 ? 'a' : 'w' }));
      const size = files?.find((f) => f.key === key)?.size;
      if (size != null && fs.statSync(part).size !== size) {
        fs.rmSync(part, { force: true });
        throw new Error('El archivo llegó incompleto.');
      }
      fs.renameSync(part, dest);
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
      const all = mode() === 'completo';
      const soon = upcoming();
      const wanted = files.filter(({ key }) => target(key) && !have(key) && (ALWAYS.test(key) || all || soon.has(numberOf(key))));
      let done = 0;
      let failed = 0;
      for (const { key } of wanted) {
        onProgress({ done, total: wanted.length, failed });
        try { await fetchKey(key); } catch { failed += 1; }
        done += 1;
      }
      onProgress(wanted.length ? { done, total: wanted.length, failed } : null);
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
