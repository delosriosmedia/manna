// Lo que se puede medir de las reglas de móviles (DESIGN.md, 12 ter), en la página abierta. Devuelve la lista de lo que
// no cumple. Lo usa scripts/auditar-responsive.mjs en las pantallas con `movil: true`. Las pantallas marcan:
//   data-vista    la vista de lo que está al aire (se ve tal cual: no se mide)
//   data-peligro  Negro y Solo fondo (12 px libres a todo y 20 a Anterior y Siguiente)
//   data-paso     Anterior y Siguiente
export const MOBILE_RULES = `(() => {
  const fails = [];
  const W = innerWidth;
  const H = innerHeight;
  const seen = (e) => {
    const r = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W;
  };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.className || e.tagName).trim().replace(/\\s+/g, ' ').slice(0, 30);
  const inView = (e) => Boolean(e.closest('[data-vista]'));
  const taps = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')].filter((e) => seen(e) && !inView(e) && !e.disabled);
  const mine = (e, x, y) => {
    const t = document.elementFromPoint(x, y);
    return Boolean(t) && (t === e || e.contains(t) || (t.tagName === 'LABEL' && t.contains(e)));
  };

  // Regla 11: 35 px de toque. A 17 px del centro sigue siendo suyo: cuenta lo que amplía la zona sin verse. Lo que tapa
  // otra capa no se mide. Lo que pisa a otro falla aquí también.
  for (const e of taps) {
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (!mine(e, x, y)) continue;
    const short = [[x - 17, y], [x + 17, y], [x, y - 17], [x, y + 17]].some(([px, py]) => px >= 0 && py >= 0 && px < W && py < H && !mine(e, px, py));
    if (short) fails.push('Zona de toque de menos de 35 px, o pisada: ' + name(e));
  }

  // Regla 4: lo peligroso, lejos.
  const gap = (a, b) => {
    const r = a.getBoundingClientRect();
    const s = b.getBoundingClientRect();
    return Math.max(0, Math.max(r.left, s.left) - Math.min(r.right, s.right), Math.max(r.top, s.top) - Math.min(r.bottom, s.bottom));
  };
  for (const e of taps.filter((t) => t.matches('[data-peligro]'))) {
    for (const o of taps) {
      if (o === e || o.matches('[data-peligro]') || e.contains(o) || o.contains(e)) continue;
      const need = o.matches('[data-paso]') ? 20 : 12;
      if (gap(e, o) < need - 0.5) fails.push(name(e) + ' a menos de ' + need + ' px de ' + name(o));
    }
  }

  // Regla 8: nada baja de 10 px, y contraste de 4,5:1. El fondo se compone capa a capa hacia atrás.
  const parse = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const backOf = (e) => {
    const layers = [];
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    return layers.reduceRight((under, c) => [0, 1, 2].map((i) => c[i] * c[3] + under[i] * (1 - c[3])), [0, 0, 0]);
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const small = new Set();
  const dim = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!t.textContent.trim() || !e || !seen(e) || inView(e)) continue;
    const c = getComputedStyle(e);
    if (parseFloat(c.fontSize) < 10) small.add(name(e));
    const ink = parse(c.color);
    const back = backOf(e);
    const fore = [0, 1, 2].map((i) => ink[i] * ink[3] + back[i] * (1 - ink[3]));
    const a = lum(fore);
    const b = lum(back);
    if ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 4.5 - 0.01) dim.add(name(e));
  }
  for (const n of small) fails.push('Letra de menos de 10 px: ' + n);
  for (const n of dim) fails.push('Contraste de menos de 4,5:1: ' + n);

  // Regla 9: lo que no sea una tira hecha para deslizarse no se sale por los lados.
  if (document.documentElement.scrollWidth > W + 1) fails.push('La página se desplaza de lado');
  for (const e of document.body.querySelectorAll('*')) {
    if (!seen(e) || inView(e) || e.closest('.modal-backdrop')) continue;
    const r = e.getBoundingClientRect();
    let strip = false;
    for (let n = e.parentElement; n; n = n.parentElement) if (/auto|scroll|hidden/.test(getComputedStyle(n).overflowX)) strip = true;
    if (!strip && (r.right > W + 1 || r.left < -1)) { fails.push('Se sale por el lado: ' + name(e)); break; }
  }

  // Reglas 6 y 7, sobre una rejilla de puntos: sin rojo si nada sale al proyector; lo claro, no más del 10 %.
  const stage = document.querySelector('[data-vista] .stage, [data-vista].stage');
  const dark = stage && stage.dataset.mode !== 'live';
  let bright = 0;
  let points = 0;
  let red = '';
  for (let y = 5; y < H; y += 20) {
    for (let x = 5; x < W; x += 20) {
      const e = document.elementFromPoint(x, y);
      if (!e || inView(e)) continue;
      points += 1;
      const back = backOf(e);
      if (lum(back) > 0.4) bright += 1;
      const isRed = (c) => c[3] > 0.2 && c[0] > 170 && c[1] < 90 && c[2] < 90;
      if (dark && !red && (isRed(parse(getComputedStyle(e).color)) || isRed(parse(getComputedStyle(e).backgroundColor)) || isRed(parse(getComputedStyle(e).borderTopColor)))) red = name(e);
    }
  }
  if (points && bright / points > 0.1) fails.push('Lo claro ocupa el ' + Math.round((bright / points) * 100) + ' % de la pantalla');
  if (red) fails.push('Rojo sin nada al aire: ' + red);
  return fails;
})()`;
