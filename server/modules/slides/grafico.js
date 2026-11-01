// Un gráfico de Keynote como formas sencillas, nítido a cualquier tamaño (S63). Lógica pura: dice qué dibujar, en puntos dentro
// del marco del gráfico. El marco de Keynote es la zona de dibujo: los nombres de abajo y la leyenda quedan fuera de él.
// Lo demás (dispersión, burbujas, radar, mixtos, en 3D) sigue saliendo de la miniatura.

const KINDS = {
  1: { kind: 'column' }, 2: { kind: 'bar' }, 3: { kind: 'line' }, 4: { kind: 'area' }, 5: { kind: 'pie' },
  6: { kind: 'column', stacked: true }, 7: { kind: 'bar', stacked: true }, 8: { kind: 'area', stacked: true }, 25: { kind: 'pie', donut: true },
};
export const chartKind = (type) => KINDS[type] ?? null;

const number = (v) => String(Math.round(v * 100) / 100);
const present = (v) => Number.isFinite(v);

// El eje: cuatro divisiones de números redondos, desde cero (o por debajo, si hay negativos).
export function niceScale(low, high) {
  const span = Math.max(high, 0) - Math.min(low, 0) || 1;
  const mag = 10 ** Math.floor(Math.log10(span / 4));
  const step = [1, 2, 2.5, 5, 10].find((n) => n * mag >= span / 4) * mag;
  return { min: Math.floor(Math.min(low, 0) / step) * step, max: Math.ceil(Math.max(high, 0) / step) * step, step };
}

function pie({ series, dataset = 0, start = 0, inner = 0.5, donut, w, h }) {
  const r = Math.min(w, h) / 2;
  const at = (radius, deg) => [w / 2 + radius * Math.sin(deg * Math.PI / 180), h / 2 - radius * Math.cos(deg * Math.PI / 180)];
  // Con líneas cortas: el arco de un .pptx no lo dibujan igual todos los programas.
  const arc = (radius, from, to) => {
    const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 2));
    return Array.from({ length: steps + 1 }, (_, i) => at(radius, from + (to - from) * i / steps));
  };
  const wedges = series.map((s, index) => ({ s, index, value: s.values[dataset] })).filter((x) => x.value > 0);
  const total = wedges.reduce((sum, x) => sum + x.value, 0);
  const marks = [];
  let angle = start;
  for (const { s, index, value } of wedges) {
    const to = angle + value / total * 360;
    marks.push({ mark: 'shape', series: index, points: donut ? [...arc(r, angle, to), ...arc(r * inner, to, angle)] : [[w / 2, h / 2], ...arc(r, angle, to)] });
    if (s.labels) {
      const [x, y] = at(r * (donut ? (1 + inner) / 2 : (s.explosion ?? 75) / 100), (angle + to) / 2);
      marks.push({ mark: 'label', series: index, x, y, text: s.percent ? `${Math.round(value / total * 100)}%` : number(value) });
    }
    angle = to;
  }
  return marks;
}

function axes({ kind, stacked, series, categories, w, h, gapBar = 0.08, gapSet = 0.6, sizes = {}, grid = true, names = true }) {
  const count = Math.max(categories.length, ...series.map((s) => s.values.length));
  const sums = (j, upto = series.length) => series.slice(0, upto).reduce((sum, s) => sum + (s.values[j] ?? 0), 0);
  const all = series.flatMap((s, i) => s.values.map((v, j) => (stacked ? sums(j, i + 1) : v)).filter(present));
  const { min, max, step } = niceScale(Math.min(...all), Math.max(...all));
  const flat = kind === 'bar'; // las barras crecen hacia la derecha; lo demás, hacia arriba
  const along = flat ? w : h;
  const place = (v) => (v - min) / (max - min) * along;
  const band = (flat ? h : w) / count;
  const marks = [];
  if (grid) {
    for (let v = min; v <= max + step / 2; v += step) {
      const p = place(v);
      marks.push({ mark: 'rule', points: flat ? [[p, 0], [p, h]] : [[0, h - p], [w, h - p]] });
    }
  }
  const valueAt = (x, y, text, s, index) => s.labels && marks.push({ mark: 'label', series: index, x, y, text });
  const room = sizes.value ?? 12;
  if (kind === 'column' || kind === 'bar') {
    const bars = stacked ? 1 : series.length;
    const thick = band / (bars + (bars - 1) * gapBar + gapSet);
    series.forEach((s, index) => s.values.forEach((v, j) => {
      if (!present(v)) return;
      const from = place(stacked ? sums(j, index) : 0);
      const to = place(stacked ? sums(j, index + 1) : v);
      const side = band * j + thick * gapSet / 2 + (stacked ? 0 : index * thick * (1 + gapBar));
      const [a, b] = [side, side + thick];
      marks.push({ mark: 'shape', series: index, points: flat ? [[from, a], [to, a], [to, b], [from, b]] : [[a, h - from], [b, h - from], [b, h - to], [a, h - to]] });
      if (flat) valueAt(to + room * 1.2, (a + b) / 2, number(v), s, index);
      else valueAt((a + b) / 2, h - to - room * 0.8, number(v), s, index);
    }));
  } else {
    const xOf = (j) => (kind === 'area' && count > 1 ? w * j / (count - 1) : band * (j + 0.5));
    // Las áreas, de la última a la primera: la primera serie queda delante, como en Keynote.
    if (kind === 'area') {
      [...series.keys()].reverse().forEach((index) => {
        const top = series[index].values.map((v, j) => [xOf(j), h - place(stacked ? sums(j, index + 1) : v ?? 0)]);
        const bottom = series[index].values.map((v, j) => [xOf(j), h - place(stacked ? sums(j, index) : 0)]).reverse();
        marks.push({ mark: 'shape', series: index, points: [...top, ...bottom] });
      });
    }
    series.forEach((s, index) => {
      const points = s.values.map((v, j) => (present(v) ? [xOf(j), h - place(stacked ? sums(j, index + 1) : v)] : null));
      if (kind === 'line') {
        // Un dato vacío corta la línea.
        let run = [];
        for (const p of [...points, null]) {
          if (p) { run.push(p); continue; }
          if (run.length > 1) marks.push({ mark: 'line', series: index, points: run });
          run = [];
        }
        if (s.symbol) points.filter(Boolean).forEach(([x, y]) => marks.push({ mark: 'dot', series: index, x, y }));
      }
      points.forEach((p, j) => p && valueAt(p[0], p[1] - room * 0.9, number(s.values[j]), s, index));
    });
  }
  if (names) {
    categories.forEach((name, j) => {
      const size = sizes.category ?? 12;
      const middle = kind === 'area' && count > 1 ? w * j / (count - 1) : band * (j + 0.5);
      marks.push(flat ? { mark: 'label', role: 'category', x: -size / 2, y: middle, text: name, align: 'end' } : { mark: 'label', role: 'category', x: middle, y: h + size * 1.1, text: name });
    });
  }
  return marks;
}

// La leyenda, en su sitio (Keynote lo guarda desde el centro del gráfico); el título, encima.
function extras({ legend, title, series, w, h, sizes = {} }) {
  const marks = [];
  if (title) marks.push({ mark: 'label', role: 'title', x: w / 2, y: -(sizes.title ?? 18), text: title });
  if (legend) {
    const size = sizes.legend ?? 12;
    const wide = (name) => size * 1.5 + name.length * size * 0.55 + size;
    const used = series.reduce((sum, s) => sum + wide(s.name ?? ''), 0);
    let x = w / 2 + legend.x + (legend.w - used) / 2;
    const y = h / 2 + legend.y + legend.h / 2;
    series.forEach((s, index) => {
      marks.push({ mark: 'swatch', series: index, x, y, size });
      marks.push({ mark: 'label', role: 'legend', x: x + size * 1.5, y, text: s.name ?? '', align: 'start' });
      x += wide(s.name ?? '');
    });
  }
  return marks;
}

export function layoutChart(spec) {
  return [...(spec.kind === 'pie' ? pie(spec) : axes(spec)), ...extras(spec)];
}

// La tabla de un gráfico, en series: por columnas o por filas, según lo guarde (el dato vacío, null).
export function seriesOf({ rows, rowNames, colNames, byRow }) {
  if (byRow) return { categories: colNames, series: rows.map((values, i) => ({ name: rowNames[i], values })) };
  return { categories: rowNames, series: colNames.map((name, c) => ({ name, values: rows.map((r) => r[c] ?? null) })) };
}
