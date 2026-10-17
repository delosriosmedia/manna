// Lógica de los textos que se proyectan (fase 18): limpiarlos, partirlos en pantallas y sacarles un título.
// Pura, sin servidor, para probarla en test/textos.test.js.

export const STYLES = ['normal', 'quote'];
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
