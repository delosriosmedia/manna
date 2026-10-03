import path from 'node:path';
import { normalize } from './canon.js';

// Nombres legibles para versiones conocidas. Si un archivo no coincide, se usa su propio nombre.
const KNOWN = [
  [/\bnvi\b|version internacional/, 'Nueva Versión Internacional', 'NVI'],
  [/\bntv\b|traduccion viviente/, 'Nueva Traducción Viviente', 'NTV'],
  [/\brvr ?1960\b|valera 1960/, 'Reina-Valera 1960', 'RVR1960'],
  [/\brv ?1909\b|valera 1909/, 'Reina-Valera 1909', 'RV1909'],
  [/\brvc\b|valera contemporanea/, 'Reina Valera Contemporánea', 'RVC'],
  [/\bdhh\b|dios habla hoy/, 'Dios Habla Hoy', 'DHH'],
  [/\bpdt\b|palabra de dios para todos/, 'Palabra de Dios para Todos', 'PDT'],
  [/\btla\b|lenguaje actual/, 'Traducción en Lenguaje Actual', 'TLA'],
  [/\blbla\b|biblia de las americas/, 'La Biblia de las Américas', 'LBLA'],
  [/\bnblh\b|biblia de los hispanos/, 'Nueva Biblia de los Hispanos', 'NBLH'],
  [/\bnbj\b|biblia de jerusalen/, 'Nueva Biblia de Jerusalén', 'NBJ'],
  [/king james 2000/, 'King James 2000', 'KJ2000'],
];

// fileName: "SpanishNVIBible.xml"; head: primeros caracteres del archivo (para leer translation="...").
export function describeVersion(fileName, head = '') {
  const base = path.basename(fileName, path.extname(fileName));
  const translation = /<bible\b[^>]*\btranslation="([^"]*)"/.exec(head)?.[1] || '';
  // "SpanishNVIBible" -> "NVI"
  const code = /^Spanish(.+?)Bible$/i.exec(base)?.[1] || '';
  const haystack = normalize(`${code} ${base} ${translation}`).replace(/[^a-z0-9]+/g, ' ');
  const known = KNOWN.find(([rx]) => rx.test(haystack));
  const id = normalize(base).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (known) return { id, name: known[1], abbr: known[2] };
  return { id, name: translation.replace(/^Spanish\s+/i, '') || base, abbr: '' };
}
