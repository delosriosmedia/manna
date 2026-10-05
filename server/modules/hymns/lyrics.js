// Lee las letras del himnario de un archivo de texto (.md o .txt) y las deja ordenadas:
//
//   parseLyrics(texto) -> { book, categories: [{ name, numbers }], hymns: [{ number, title, parts: [{ label, lines }] }], warnings }
//
// El archivo lo escribe o lo exporta una persona, así que se acepta escrito de varias formas (pueden
// venir mezcladas en el mismo archivo):
//
//   # Himnario Adventista            el nombre del libro (no se usa para nada más)
//   ## Adoración y alabanza          una categoría: agrupa los himnos que vienen después
//   ### 22. Título del himno         un himno: su número y su título
//   **Estrofa 1**                    una parte del himno (también "### Estrofa 1")
//   una línea de la letra            cada línea, en su renglón; puede haber una línea en blanco entre ellas
//   ---                              separador entre himnos (opcional)
//
// También vale sin almohadillas: "22. Título" solo en su renglón, seguido de una parte ("**Estrofa 1**"),
// y el nombre de la categoría solo en su renglón, justo antes de un himno. Los archivos exportados de
// Word traen las marcas con una barra delante ("\#", "\*\*", "1\.") y una barra al final de cada
// renglón: se quitan.
//
// Las letras tienen derechos de autor: se leen del equipo de cada iglesia y nunca van en el programa.

// Un renglón sin las barras que añade la exportación: "\*\*Coro\*\*\" -> "**Coro**".
const clean = (line) => line.replace(/\\$/, '').replace(/\\([!-/:-@[-`{-~])/g, '$1').replace(/\s+/g, ' ').trim();

const RULE = /^([-*_])(\s*\1){2,}$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const NUMBERED = /^(\d{1,4})\s*[.)\-–:]\s+(\S.*)$/;
const BOLD = /^\*\*\s*([^*]+?)\s*\*\*:?$|^__\s*([^_]+?)\s*__:?$/;
// Nombres de las partes de un himno, para reconocerlas cuando vienen como título ("### Coro").
const PART = /^(estrofa|coro|estribillo|puente|final|introducci[oó]n|pre-?coro|verso|antífona|antifona|interludio|bis)\b/i;

const lyricLine = (text) => text.replace(/\*\*|__/g, '').replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, '$1$2').trim();

export function parseLyrics(source) {
  const lines = String(source ?? '').replace(/^﻿/, '').split(/\r\n?|\n/).map(clean);
  const hymns = [];
  const categories = [];
  const warnings = [];
  let book = null;
  let category = null;  // la categoría en curso
  let hymn = null;      // el himno en curso
  let part = null;      // la parte en curso
  let open = false;     // la parte sigue abierta tras una línea en blanco (letra a un renglón por párrafo)
  let blank = true;     // el renglón anterior estaba en blanco

  const startCategory = (name) => {
    category = categories.find((c) => c.name === name) || null;
    if (!category) {
      category = { name, numbers: [] };
      categories.push(category);
    }
    hymn = null;
    part = null;
  };
  const startHymn = (number, title) => {
    hymn = { number, title: lyricLine(title), parts: [] };
    hymns.push(hymn);
    category?.numbers.push(number);
    part = null;
  };
  const startPart = (label) => {
    part = { label: lyricLine(label), lines: [] };
    hymn.parts.push(part);
  };
  // Dónde está el siguiente renglón con texto, a partir de i (o -1).
  const nextText = (i) => {
    for (let j = i + 1; j < lines.length; j += 1) if (lines[j]) return j;
    return -1;
  };
  const isLabel = (text) => {
    const heading = HEADING.exec(text);
    return heading ? PART.test(heading[2]) && !NUMBERED.test(heading[2]) : BOLD.test(text);
  };
  // ¿Empieza un himno en el renglón i? Con almohadillas y número, siempre. Sin almohadillas, solo
  // si el renglón va solo y lo que sigue es una parte: así un renglón de la letra que empiece por
  // una cifra no se toma por un himno nuevo.
  const hymnAt = (i) => {
    const text = lines[i] || '';
    const heading = HEADING.exec(text);
    const numbered = NUMBERED.exec(heading ? heading[2] : text);
    if (!numbered) return null;
    if (!heading) {
      const after = nextText(i);
      if (lines[i + 1] || after < 0 || !isLabel(lines[after])) return null;
    }
    return { number: Number(numbered[1]), title: numbered[2] };
  };

  lines.forEach((text, i) => {
    if (!text) {
      blank = true;
      // Con la letra unida renglón a renglón, una línea en blanco cierra la parte.
      if (part && !open) part = null;
      return;
    }
    const first = blank;
    blank = false;
    if (RULE.test(text)) {
      part = null;
      open = false;
      return;
    }

    const heading = HEADING.exec(text);
    if (heading) {
      const [, marks, title] = heading;
      const numbered = NUMBERED.exec(title);
      if (numbered) { startHymn(Number(numbered[1]), numbered[2]); open = false; return; }
      if (hymn && PART.test(title)) { startPart(title); open = true; return; }
      if (marks.length === 1 && !book && !hymns.length) { book = lyricLine(title); return; }
      // El nombre del libro puede repetirse en cada trozo del archivo.
      if (marks.length === 1 && book === lyricLine(title)) { part = null; open = false; return; }
      startCategory(lyricLine(title));
      open = false;
      return;
    }

    const bold = BOLD.exec(text);
    if (bold && hymn) {
      startPart(bold[1] || bold[2]);
      // La letra puede venir en los renglones siguientes, pegada, o cada renglón en su párrafo.
      open = !lines[i + 1];
      return;
    }

    // Un renglón suelto, sin parte abierta: el título de un himno o el nombre de una categoría.
    if (!part && first) {
      const starts = hymnAt(i);
      if (starts) { startHymn(starts.number, starts.title); open = false; return; }
      const alone = !lines[i + 1];
      const after = nextText(i);
      if (alone && after >= 0 && hymnAt(after)) {
        startCategory(lyricLine(text));
        open = false;
        return;
      }
      // Lo primero del archivo, solo en su renglón: el nombre del libro.
      if (alone && !hymns.length && !categories.length && !book) { book = lyricLine(text); return; }
    }

    if (part) {
      const line = lyricLine(text);
      if (line) part.lines.push(line);
      return;
    }
    // Letra sin nombre de parte: se guarda igual, como una parte sin rótulo.
    if (hymn) {
      startPart('');
      open = false;
      part.lines.push(lyricLine(text));
      return;
    }
    warnings.push({ line: i + 1, problem: 'Texto antes del primer himno.' });
  });

  for (const entry of hymns) {
    entry.parts = entry.parts.filter((p) => p.lines.length);
    if (!entry.parts.length) warnings.push({ number: entry.number, problem: 'Himno sin letra.' });
  }
  const seen = new Set();
  for (const entry of hymns) {
    if (seen.has(entry.number)) warnings.push({ number: entry.number, problem: 'Número repetido.' });
    seen.add(entry.number);
  }
  return { book, categories: categories.filter((c) => c.numbers.length), hymns, warnings };
}
