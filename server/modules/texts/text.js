// Lógica de los textos que se proyectan (fase 18): limpiarlos, partirlos en pantallas y sacarles un título.
// Pura, sin servidor, para probarla en test/textos.test.js.

export const STYLES = ['normal', 'quote', 'fixed'];

// El texto fijo (2026-10-29): va en una capa, como el reloj, con su aspecto. Cuatro letras que se leen bien en pequeño
// y de lejos, tres tamaños, los nueve sitios del reloj, sin recuadro, en una franja de lado a lado o en una píldora, y
// quieto o pasando como una franja de noticias. El color no se elige: se ajusta solo a lo que haya detrás.
export const LOOK = { font: 'sora', size: 'm', place: 'bc', box: 'pill', motion: 'still', speed: 'normal' };
export const LOOKS = {
  font: ['sora', 'atkinson', 'lexend', 'merriweather'],
  size: ['s', 'm', 'l'],
  place: ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'],
  box: ['none', 'stripe', 'pill'],
  motion: ['still', 'scroll'],
  speed: ['slow', 'normal', 'fast'],
};
// Lo que se elige, solo con valores conocidos (lo demás, el de siempre).
export const cleanLook = (look) => Object.fromEntries(Object.entries(LOOK).map(([key, base]) => [key, LOOKS[key].includes(look?.[key]) ? look[key] : base]));
export const MAX_TEXT = 4000;
export const MAX_AUTHOR = 80;

// Sin espacios de más al final de cada línea ni más de una línea en blanco seguida.
export function cleanText(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// Una línea en blanco pasa a otra pantalla (cada parte es un paso, como un versículo).
export function splitParts(text) {
  return cleanText(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

// Cómo se ve en la lista y en el orden del culto: el principio de su primera línea.
export function titleOf(text, max = 60) {
  const first = cleanText(text).split('\n')[0] || '';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
