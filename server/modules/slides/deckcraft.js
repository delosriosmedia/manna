import fs from 'node:fs';
import path from 'node:path';

// Convertir una presentación de PowerPoint con DeckCraft (fase 33, parte 2): un programa libre, de código abierto, que
// dibuja cada diapositiva sin abrir ninguna ventana ni pedir permisos, igual en Windows y en Mac. Lo instala Manna
// (core/tools.js, versión fija) y se lanza solo con app.tools.spawn. Se le pide:
//   1. `info`, para saber el tamaño de la diapositiva y cuáles están ocultas (DeckCraft las dibuja; PowerPoint no);
//   2. `render --all` dos veces: las diapositivas, de SLIDE_SIDE de lado mayor, y las miniaturas, de THUMB_SIDE.
// Las imágenes salen en PNG («slide-01.png»…). Las ocultas se descartan aquí.

const STEP_LIMIT_MS = 10 * 60 * 1000;

// Lo que dice `deckcraft-cli info` (JSON): { width, height, slides: [{ index, hidden }] }.
export function readInfo(text) {
  let info;
  try { info = JSON.parse(text); } catch { throw new Error('DeckCraft no pudo leer la presentación.'); }
  const [width, height] = Array.isArray(info?.slideSize) ? info.slideSize.map(Number) : [];
  if (!(width > 0 && height > 0) || !Array.isArray(info.slides)) throw new Error('DeckCraft no pudo leer la presentación.');
  return { width, height, slides: info.slides.map((s, i) => ({ index: Number.isInteger(s.index) ? s.index : i, hidden: Boolean(s.hidden) })) };
}

// Píxeles por punto para que el lado mayor mida `side`.
export const scaleFor = (info, side) => side / Math.max(info.width, info.height);

// Las imágenes de una carpeta de `render --all`, por número de diapositiva (1, 2…).
export function rendered(dir) {
  const byNumber = new Map();
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return byNumber; }
  for (const name of names) {
    const found = /^slide-(\d+)\.png$/i.exec(name);
    if (found) byNumber.set(Number(found[1]), path.join(dir, name));
  }
  return byNumber;
}

// Las diapositivas que se ven, en orden: [{ file, thumb }]. Falta una imagen: la conversión no está completa.
export function visiblePages(info, full, thumbs) {
  return info.slides.filter((s) => !s.hidden).map((s) => {
    const file = full.get(s.index + 1);
    if (!file) throw new Error('DeckCraft no dibujó todas las diapositivas.');
    return { file, thumb: thumbs.get(s.index + 1) || null };
  });
}

// Lanza DeckCraft y devuelve { code, out, err }. onLine recibe cada línea que escribe; onChild, el proceso (para cancelar).
function run(app, args, { onLine = () => {}, onChild = () => {} } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = app.tools.spawn('deckcraft', args, { binary: 'deckcraft-cli' }); } catch (err) { resolve({ code: -1, out: '', err: err.message }); return; }
    onChild(child);
    const limit = setTimeout(() => child.kill(), STEP_LIMIT_MS);
    let out = '';
    let err = '';
    let pending = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      lines.forEach(onLine);
    });
    child.stderr.on('data', (chunk) => { err = (err + chunk).slice(-3000); });
    child.on('error', (e) => { clearTimeout(limit); resolve({ code: -1, out, err: e.message }); });
    child.on('close', (code) => { clearTimeout(limit); resolve({ code, out, err }); });
  });
}

// La conversión entera. Devuelve { ok, pages, err } (pages en el orden de las diapositivas que se ven).
// onProgress(hechas, total); onChild(proceso): el que corre ahora, para poder cancelarlo.
export async function convertWithDeckCraft(app, { input, dir, sides, onProgress = () => {}, onChild = () => {} }) {
  const asked = await run(app, ['info', input], { onChild });
  if (asked.code !== 0) return { ok: false, pages: [], err: asked.err || asked.out };
  let info;
  try { info = readInfo(asked.out); } catch (err) { return { ok: false, pages: [], err: err.message }; }
  const total = info.slides.length * 2;
  let done = 0;
  const counted = { onChild, onLine: (line) => { if (line.trim()) onProgress(Math.min(++done, total - 1), total); } };
  const full = path.join(dir, 'diapositivas');
  const small = path.join(dir, 'miniaturas');
  for (const [out, side] of [[full, sides.slide], [small, sides.thumb]]) {
    fs.mkdirSync(out, { recursive: true });
    const drawn = await run(app, ['render', input, '--all', '--scale', scaleFor(info, side).toFixed(4), out], counted);
    if (drawn.code !== 0) return { ok: false, pages: [], err: drawn.err || drawn.out };
  }
  try {
    const pages = visiblePages(info, rendered(full), rendered(small));
    if (!pages.length) return { ok: false, pages: [], err: 'La presentación no tiene diapositivas que se vean (todas están ocultas).' };
    return { ok: true, pages, err: '' };
  } catch (err) {
    return { ok: false, pages: [], err: err.message };
  }
}
