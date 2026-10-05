import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Un himnario de mentira para las pruebas, la auditoría y la demostración: videos hechos en el
// momento con ffmpeg (con dos pistas de sonido, como los de verdad: un tono para "cantado" y otro
// para "pista") y letras inventadas aquí mismo. Nada de esto sale de ningún himnario real.
//
//   seedHymnal(carpeta, { count, seconds })  -> { dir, count, hasVideo, facts }
//
// Deja carpeta/videos y carpeta/letras como las pone una iglesia, con los casos que Manna tiene
// que saber llevar:
//   - el himno 4 tiene en el archivo de letras otro título que su video (esa letra no se usa)
//   - el himno 5 trae una sola pista de sonido (no tiene "pista" instrumental)
//   - el himno 6 no tiene letra
//   - el himno 7 no tiene video (falta), pero sí letra
//   - los tres primeros van escritos de una forma y el resto de otra, como en un archivo exportado
// Sin ffmpeg los videos quedan vacíos: sirven para ver la lista, pero no se reproducen.

const TITLES = ['Canto de la mañana clara', 'Luz que no se apaga', 'Camino del valle', 'Voces del monte', 'Río de alegría serena',
  'Bajo el mismo cielo', 'Manos que siembran', 'La casa de puertas abiertas', 'Puente de paz', 'Sendero de luz', 'Aurora de un día nuevo',
  'Canción del sembrador', '¡Despierta, pueblo!', 'Gratitud al amanecer', 'El pozo del camino', 'Donde nace el río'];
const CATEGORIES = ['Cantos de la mañana', 'Cantos del camino', 'Cantos de gratitud y esperanza para todos los días'];
// Frases que solo están en un sitio, para que las pruebas las busquen.
export const HYMN_FACTS = {
  phrase: { text: 'brilla la lámpara encendida', number: 2, label: 'Estrofa 2' },
  chorus: { text: 'cantan los montes y responden', number: 9, label: 'Coro' },
  mismatched: 4, single: 5, withoutLyrics: 6, withoutVideo: 7,
};

const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡!¿?,]/g, '');
export const hymnTitle = (n) => (n <= TITLES.length ? TITLES[n - 1] : `${TITLES[(n - 1) % TITLES.length]} (${Math.ceil(n / TITLES.length)})`);
const fileName = (n) => `${String(n).padStart(3, '0')} ${plain(hymnTitle(n))}.mp4`;

function lyricsOf(n) {
  const stanza = (s) => [`Primer renglón inventado del canto ${n}, parte ${s},`, `segundo renglón que solo sirve de prueba;`, `tercero, para que haya dónde buscar,`, `y cuarto, con el que termina la parte ${s}.`];
  const parts = [['Estrofa 1', stanza(1)], ['Coro', [`Este es el coro inventado del canto ${n},`, 'que se repite después de cada estrofa.']], ['Estrofa 2', stanza(2)]];
  if (n === HYMN_FACTS.phrase.number) parts[2][1][1] = `${HYMN_FACTS.phrase.text} en la ventana;`;
  if (n === HYMN_FACTS.chorus.number) parts[1][1][0] = `${HYMN_FACTS.chorus.text} los valles,`;
  return parts;
}

export function seedHymnal(dir, { count = 12, seconds = 3 } = {}) {
  const videos = path.join(dir, 'videos');
  const lyrics = path.join(dir, 'letras');
  for (const folder of [videos, lyrics]) fs.mkdirSync(folder, { recursive: true });

  // Un video con dos pistas de sonido y otro con una sola; los demás son copias.
  const make = (name, tones) => {
    const file = path.join(dir, name);
    const made = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=320x180:rate=15:duration=${seconds}`,
      ...tones.flatMap((hz) => ['-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${seconds}`]), '-map', '0:v', ...tones.flatMap((_, i) => ['-map', `${i + 1}:a`]),
      '-filter:a', 'volume=0.05', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-metadata:s:a:0', 'language=spa', ...(tones.length > 1 ? ['-metadata:s:a:1', 'language=eng'] : []), '-shortest', file]);
    return made.status === 0 ? file : null;
  };
  const two = make('base-dos-pistas.mp4', [330, 494]);
  const one = two && make('base-una-pista.mp4', [330]);
  for (let n = 1; n <= count; n += 1) {
    if (n === HYMN_FACTS.withoutVideo) continue;
    const target = path.join(videos, fileName(n));
    if (two) fs.copyFileSync(n === HYMN_FACTS.single ? one : two, target);
    else fs.writeFileSync(target, '');
  }
  for (const base of [two, one]) if (base) fs.rmSync(base, { force: true });

  // Las letras. Los tres primeros, a renglón seguido con barras al final (como salen de Word);
  // los demás, con las marcas "escapadas" y un renglón por párrafo.
  const lines = ['Himnario de prueba', '', CATEGORIES[0], ''];
  const written = (n) => (n === HYMN_FACTS.mismatched ? 'Un título que no es el de su video' : hymnTitle(n));
  for (let n = 1; n <= count; n += 1) {
    if (n === HYMN_FACTS.withoutLyrics) continue;
    if (n <= 3) {
      lines.push(`${n}\\. ${written(n)}`, '');
      for (const [label, text] of lyricsOf(n)) lines.push(`**${label}**\\`, ...text.map((line, i) => (i < text.length - 1 ? `${line}\\` : line)), '');
      continue;
    }
    if ((n - 4) % 5 === 0) lines.push('\\# Himnario de prueba', '', `\\## ${CATEGORIES[Math.min(CATEGORIES.length - 1, 1 + Math.floor((n - 4) / 5))]}`, '');
    lines.push('\\-\\--', '', `\\### ${n}. ${written(n)}`, '');
    for (const [label, text] of lyricsOf(n)) lines.push(`\\*\\*${label}\\*\\*`, '', ...text.flatMap((line) => [line, '']));
  }
  fs.writeFileSync(path.join(lyrics, 'Letras de prueba.md'), lines.join('\r\n'));
  return { dir, count, hasVideo: Boolean(two), facts: HYMN_FACTS };
}
