import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// La copia de vista previa (fase 43, decisión 69): para que un celular vea el video en movimiento, sin sonido, sin cargar el
// wifi de la iglesia (con la copia ligera serían unos 6 Mbps por celular). ffmpeg la hace de fondo, de lo que está en el
// orden en uso y de lo que se proyecta: unos 360p y menos de 1 Mbps. Cada una se reconoce por su archivo original (ruta,
// tamaño y fecha): si el original cambia, es otra. Mientras no está, se ve la imagen.
// Un tipo de contenido dice de qué archivo se hace con `previewFile(data)`, y la da en lo que resuelve con `urlFor(archivo)`.
const FOLDER = 'vista-previa';
const OLD_MS = 30 * 86_400_000; // las que nadie pide en un mes se borran al abrir Manna: se pueden volver a hacer
const WAIT_MS = 2000; // se agrupan los cambios: al montar un orden llegan muchos seguidos

export function createPreviews(app, converter) {
  const { store } = app;
  const dir = path.join(app.uploadsDir, FOLDER);
  const failed = new Set(); // no se reintentan hasta volver a abrir Manna
  const asked = new Set();

  try {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (Date.now() - fs.statSync(file).mtimeMs > OLD_MS) fs.rmSync(file, { force: true });
    }
  } catch { /* aún no hay ninguna */ }

  const keyOf = (file) => {
    const { size, mtimeMs } = fs.statSync(file);
    return crypto.createHash('sha1').update(`${file}|${size}|${mtimeMs}`).digest('hex').slice(0, 20);
  };
  const outputOf = (key) => path.join(dir, `${key}.mp4`);

  function urlFor(file) {
    try {
      const key = file && keyOf(file);
      return key && fs.existsSync(outputOf(key)) ? `/media/${FOLDER}/${key}.mp4` : null;
    } catch {
      return null; // el original ya no está
    }
  }

  function make(file, name) {
    let key;
    try { key = keyOf(file); } catch { return; }
    if (asked.has(key) || failed.has(key) || fs.existsSync(outputOf(key))) {
      // Sigue haciendo falta: que no se borre por vieja.
      try { const now = new Date(); fs.utimesSync(outputOf(key), now, now); } catch { /* aún no existe */ }
      return;
    }
    asked.add(key);
    fs.mkdirSync(dir, { recursive: true });
    converter.enqueue({
      id: `previa-${key}`, name, input: file, output: outputOf(key), kind: 'video', plan: { video: 'preview' }, quiet: true,
      onDone({ ok, cancelled }) {
        asked.delete(key);
        if (ok) app.services.projection?.refresh();
        else if (!cancelled) failed.add(key);
      },
    });
  }

  // Lo que hace falta ahora: lo que está al aire y lo del orden en uso, de lo primero a lo último.
  function review() {
    if (!app.tools.has('ffmpeg')) return;
    const air = store.get('projection')?.item?.source;
    const items = [...(air ? [air] : []), ...(store.get('order')?.items || [])];
    for (const { kind, data, title } of items) {
      const def = app.kinds.get(kind);
      if (!def?.previewFile) continue;
      try {
        const file = def.previewFile(data);
        if (file) make(file, title || def.label);
      } catch { /* ya no está */ }
    }
  }
  let timer = null;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(review, WAIT_MS);
    timer.unref();
  };
  store.on('change', (ns) => { if (ns === 'order' || ns === 'projection' || ns === 'tools') later(); });
  store.on('listening', later);
  app.onClose(() => clearTimeout(timer));

  return { urlFor };
}
