import fs from 'node:fs';
import path from 'node:path';

// DeckCraft web de mentira (fase 33, parte 3): una página que habla el idioma del puente de la copia de Manna
// (apps/deckcraft-web/src/web.rs de delosriosmedia/deckcraft) sin WebGL ni sus 37 MB. Abre lo que le mandan (cuenta
// sus diapositivas por los nombres de dentro del .pptx y las ocultas, como DeckCraft), pasa con las flechas (la diapositiva 2 tiene una animación:
// un paso más), va a la que le piden y dice por dónde va. Apunta lo que recibe en window.__dc.
const PAGE = `<!doctype html><meta charset="utf-8"><title>DeckCraft de mentira</title>
<body style="margin:0;background:#123;color:#fff;font:40px sans-serif;display:grid;place-items:center;height:100vh"><div id="t">DeckCraft</div>
<script>
window.__dc = [];
let slides = 0, slide = null, step = 0, ended = false, hidden = [];
const tell = () => parent.postMessage({ deckcraft: 'state', slide, step, ended, slides, hidden }, location.origin);
// Cada archivo del .zip: su nombre y, descomprimido, si es una diapositiva oculta.
async function read(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const found = [];
  for (let at = 0; at + 30 < bytes.length && view.getUint32(at, true) === 0x04034b50;) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength + view.getUint16(at + 28, true);
    const n = /^ppt\\/slides\\/slide(\\d+)\\.xml$/.exec(name)?.[1];
    if (n) {
      const data = bytes.subarray(start, start + size);
      const xml = view.getUint16(at + 8, true) ? await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text() : new TextDecoder().decode(data);
      found.push({ n: Number(n), hidden: xml.includes('show="0"') });
    }
    at = start + size;
  }
  found.sort((a, b) => a.n - b.n);
  return { slides: found.length, hidden: found.flatMap((s, i) => (s.hidden ? [i] : [])) };
}
const visible = (i, d) => { while (hidden.includes(i)) i += d; return i; };
const paint = () => { document.getElementById('t').textContent = slide == null ? 'DeckCraft' : 'Diapositiva ' + (slide + 1) + (step ? ' · paso ' + step : ''); };
addEventListener('message', async (e) => {
  if (e.origin !== location.origin) return;
  const m = e.data || {};
  window.__dc.push(m.deckcraft === 'open' ? { deckcraft: 'open', size: m.bytes.byteLength, from: m.from } : m);
  if (m.deckcraft === 'open') {
    ({ slides, hidden } = await read(new Uint8Array(m.bytes)));
    slide = visible(Math.min(m.from, slides - 1), 1); step = 0; ended = false;
  } else if (m.deckcraft === 'key' && slide != null && !ended) {
    // La diapositiva 2 (la segunda que se ve) tiene una animación: un paso más.
    const second = visible(visible(0, 1) + 1, 1);
    if (m.key === 'ArrowRight') { if (slide === second && !step) step = 1; else if (visible(slide + 1, 1) < slides) { slide = visible(slide + 1, 1); step = 0; } else ended = true; }
    else if (m.key === 'ArrowLeft') { if (step) step = 0; else if (visible(slide - 1, -1) >= 0) slide = visible(slide - 1, -1); }
  } else if (m.deckcraft === 'goto') { slide = visible(Math.min(m.slide, slides - 1), 1); step = 0; ended = false; }
  else if (m.deckcraft === 'end') slide = null;
  else return;
  paint();
  tell();
});
parent.postMessage({ deckcraft: 'ready', version: 'mentira' }, location.origin);
</script>`;

export function writeFakeDeckCraftWeb(toolsDir) {
  const dir = path.join(toolsDir, 'deckcraft-web');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), PAGE);
  return dir;
}
