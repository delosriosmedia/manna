// Prototipo: encontrar citas bíblicas en un texto libre (bosquejo de sermón), sin modelos de lenguaje.
// 1. Gramática estricta del libro y los números. 2. Comprobación contra los capítulos y versículos que existen.
// 3. Contexto (horas, cantidades, minúsculas, nombres de persona). 4. Versículos sueltos («v. 18»), deducidos del
// texto del que se está hablando. 5. Si el documento copia el texto del versículo, se compara con la Biblia.
// Cada cita sale 'segura' o 'revisar' (con sus motivos); lo descartado, aparte, con el porqué.
// Calibrado el 2026-10-18 con once documentos reales de la iglesia (diez Word y un PDF de 185 páginas; solo en local).

// [número de libro, formas]. Las formas con número (1 Corintios) se reconocen por ordinal + base.
const BOOKS = [
  [1, 'Génesis', 'Gén', 'Gen', 'Gn', 'Ge'], [2, 'Éxodo', 'Éx', 'Ex', 'Exo', 'Exod'], [3, 'Levítico', 'Lev', 'Lv'],
  [4, 'Números', 'Núm', 'Num', 'Nm'], [5, 'Deuteronomio', 'Deut', 'Deu', 'Dt'], [6, 'Josué', 'Jos'], [7, 'Jueces', 'Jue', 'Jc'],
  [8, 'Rut', 'Rt'], [15, 'Esdras', 'Esd'], [16, 'Nehemías', 'Neh'], [17, 'Ester', 'Est'], [18, 'Job', 'Jb'],
  [19, 'Salmos', 'Salmo', 'Sal', 'Sl'], [20, 'Proverbios', 'Prov', 'Pr', 'Prv'], [21, 'Eclesiastés', 'Ecles', 'Ecle', 'Ecl', 'Ec', 'Qo'],
  [22, 'Cantares', 'Cantar de los Cantares', 'Cnt', 'Cant'], [23, 'Isaías', 'Isa', 'Is'], [24, 'Jeremías', 'Jer', 'Jr'],
  [25, 'Lamentaciones', 'Lam', 'Lm'], [26, 'Ezequiel', 'Ez', 'Eze', 'Ezeq'], [27, 'Daniel', 'Dan', 'Dn'], [28, 'Oseas', 'Ose', 'Os'],
  [29, 'Joel', 'Jl'], [30, 'Amós', 'Am'], [31, 'Abdías', 'Abd'], [32, 'Jonás', 'Jon'], [33, 'Miqueas', 'Miq', 'Mi'],
  [34, 'Nahúm', 'Nah'], [35, 'Habacuc', 'Hab'], [36, 'Sofonías', 'Sof'], [37, 'Hageo', 'Hag'], [38, 'Zacarías', 'Zac'],
  [39, 'Malaquías', 'Mal', 'Ml'], [40, 'Mateo', 'Mt', 'Mat'], [41, 'Marcos', 'Mr', 'Mc', 'Mar', 'Mrc'], [42, 'Lucas', 'Lc', 'Luc'],
  [43, 'Juan', 'Jn'], [44, 'Hechos', 'Hch', 'Hech', 'Hec', 'Hechos de los Apóstoles'], [45, 'Romanos', 'Rom', 'Ro', 'Rm'],
  [48, 'Gálatas', 'Gál', 'Gal', 'Gá', 'Ga'], [49, 'Efesios', 'Efes', 'Ef', 'Efe'], [50, 'Filipenses', 'Filip', 'Fil', 'Flp'],
  [51, 'Colosenses', 'Col'], [56, 'Tito', 'Tit', 'Tt'], [57, 'Filemón', 'Flm'], [58, 'Hebreos', 'Hebr', 'Heb', 'He'],
  [59, 'Santiago', 'Stg', 'Sant', 'Stgo', 'Sgo'], [65, 'Judas', 'Jud'], [66, 'Apocalipsis', 'Apoc', 'Apo', 'Ap'],
];
// Libros con número: base -> [libro del 1, del 2, del 3].
const NUMBERED = [
  [[9, 10], 'Samuel', 'Sam', 'Sa', 'Sm', 'S'], [[11, 12], 'Reyes', 'Rey', 'Re', 'R'], [[13, 14], 'Crónicas', 'Crón', 'Cro', 'Cron', 'Cr'],
  [[46, 47], 'Corintios', 'Corin', 'Cor', 'Co'], [[52, 53], 'Tesalonicenses', 'Tesal', 'Tes', 'Ts'], [[54, 55], 'Timoteo', 'Tim', 'Tm', 'Ti'],
  [[60, 61], 'Pedro', 'Ped', 'Pe', 'P'], [[62, 63, 64], 'Juan', 'Jn'],
];
// «S. Juan», «San Lucas», «1 S. Juan» (Primera de San Juan): el «San» de los evangelios y las cartas.
const SAINTS = new Set(['juan', 'jn', 'mateo', 'mt', 'marcos', 'mr', 'lucas', 'lc', 'pedro']);
// Formas que también son palabras corrientes, y libros que son nombres de persona: piden más pruebas.
const WORDLIKE = new Set(['hechos', 'numeros', 'is', 'am', 'os', 'mi', 'ro', 'he', 'col', 'sal', 'mal', 'ap', 'ez', 'pr', 'ec', 'ga',
  'jon', 'est', 'dan', 'mar', 'luc', 'jos', 'hab', 'sant', 'ef', 'fil', 'lam', 'cant', 'gen', 'ex', 'jer', 'jud', 'deu', 'tt', 'qo']);
const PERSON = new Set(['juan', 'marcos', 'lucas', 'mateo', 'daniel', 'samuel', 'rut', 'ester', 'job', 'josue', 'isaias', 'jeremias',
  'ezequiel', 'oseas', 'joel', 'amos', 'abdias', 'jonas', 'miqueas', 'nahum', 'habacuc', 'sofonias', 'hageo', 'zacarias', 'malaquias',
  'nehemias', 'esdras', 'tito', 'timoteo', 'pedro', 'santiago', 'judas', 'filemon']);
// Lo que puede seguir a un número suelto. Unidades: era una cantidad («Romanos 12 personas»). Verbos: era una cita
// («En Mateo 9 encontramos», «Ezequiel 28 son conocidos»).
const QUANTITY = new Set(['anos', 'ano', 'dias', 'dia', 'meses', 'mes', 'semanas', 'horas', 'hora', 'minutos', 'veces', 'personas',
  'hermanos', 'hermanas', 'ninos', 'jovenes', 'familias', 'miembros', 'goles', 'puntos', 'pesos', 'dolares', 'euros', 'kilos', 'litros',
  'litro', 'metros', 'cuadras', 'km', 'boletos', 'cajas', 'paquetes', 'folletos', 'puestos', 'reglas', 'cosas', 'mil', 'millones']);
const CITE_VERBS = new Set(['dice', 'dicen', 'decia', 'dijo', 'se', 'nos', 'son', 'es', 'esta', 'estan', 'habla', 'hablan', 'muestra',
  'ensena', 'relata', 'narra', 'presenta', 'describe', 'cuenta', 'aparece', 'aparecen', 'explica', 'declara', 'afirma', 'menciona',
  'hay', 'que', 'donde', 'cuando', 'leemos', 'vemos', 'tenemos', 'encontramos', 'registra', 'expresa', 'advierte', 'promete', 'el', 'la', 'los', 'las']);
const CITE_WORDS = new Set(['al', 'a', 'y', 'ss', 'vers', 'versiculo', 'versiculos', 'cap', 'capitulo', 'rvr', 'nvi', 'lbla', 'ntv', 'dhh']);
const NOT_PLURAL = new Set(['nos', 'les', 'los', 'las', 'es', 'mas', 'pues', 'tras', 'entonces', 'ademas', 'dios', 'jesus', 'cristo', 'antes', 'despues', 'jesucristo']);
// La versión que a veces sigue a la cita: «(RVR1960)», «NVI».
const VERSION_RE = /^\s*\(?\s*(RVR\s?1960|RV\s?1960|RV60|RVR|RV1909|RVA|NVI|LBLA|NBLA|NTV|DHH|TLA|PDT|RVC|NBV|BLP|JBS)\b/i;
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
const ORDINALS = new Map([
  ...['1', 'i', '1ra', '1era', '1a', '1ª', '1º', '1o', 'primera', 'primer', 'primero'].map((o) => [o, 1]),
  ...['2', 'ii', '2da', '2a', '2ª', '2º', '2o', 'segunda', 'segundo'].map((o) => [o, 2]),
  ...['3', 'iii', '3ra', '3era', '3a', '3ª', '3º', '3o', 'tercera', 'tercer', 'tercero'].map((o) => [o, 3]),
]);
const single = new Map();
for (const [n, ...forms] of BOOKS) for (const f of forms) single.set(fold(f), n);
const numbered = new Map();
for (const [ns, ...forms] of NUMBERED) for (const f of forms) numbered.set(fold(f), ns);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Sin tildes, letra a letra (misma longitud): «Galatas» y «Gálatas» son lo mismo. Se busca sobre esa copia del texto.
const plain = (s) => s.replace(/[À-ſ]/g, (c) => c.normalize('NFD')[0]);
const forms = [...new Set([...BOOKS.flatMap(([, ...f]) => f), ...NUMBERED.flatMap(([, ...f]) => f)].map(plain))].sort((a, b) => b.length - a.length);
// Un número romano («I Corintios») va seguido de espacio o punto: si no, la I de «Is» sería «I S» (1 Samuel).
const ord = '(?:1ra|1era|2da|3ra|3era|[123](?:ª|º|a|o)?|(?:iii|ii|i)(?=[\\s.])|primera|primero|primer|segunda|segundo|tercera|tercero|tercer)';
// El libro: ordinal opcional («1», «I», «1ra de», «Primera de»), «San» opcional, y una forma conocida (nunca un trozo).
const BOOK_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:(?<ord>${ord})\\.?\\s*(?:de\\s+|a\\s+)?)?(?:(?<saint>san|s\\.)\\s*)?(?<book>${forms.map(esc).join('|')})(?<dot>\\.)?(?![\\p{L}])`, 'giu');

// Tras un número de versículo, lo que no es otro número de la cita: un punto final sí; «:5» o «.5» pegados, no. Sin
// mirar más allá del espacio: en «Hechos 3:1-5.⏎1 Pedro y Juan…» el «1» es el versículo copiado debajo.
const END = '(?!\\d|[:.]\\d)';
// Dentro de una cita los números no saltan de línea (debajo suele ir el versículo copiado, con su número), salvo
// tras un guion: «9:26-⏎28».
const RANGE_RE = new RegExp(`[^\\S\\n]*(?:-|–|—|[^\\S\\n]+al[^\\S\\n]+|[^\\S\\n]+a[^\\S\\n]+)\\s*(\\d{1,3})(?:[:.](\\d{1,3}))?${END}`, 'y');

export function createDetector({ structure, verses: verseTexts = null }) {
  // structure(book) -> [versículos del capítulo 1, del 2, …] (el mayor de las biblias instaladas)
  // verses(book, chapter) -> [[texto del v. 1 en cada versión], …] o null: para comparar el texto copiado
  const chapters = (b) => structure(b)?.length || 0;
  const count = (b, c) => structure(b)?.[c - 1] || 0;

  function bookOf(m) {
    const key = fold(m.groups.book);
    if (m.groups.saint && !SAINTS.has(key)) return null;
    const o = m.groups.ord ? ORDINALS.get(fold(m.groups.ord).replace('.', '')) : null;
    if (o && numbered.has(key)) return numbered.get(key)[o - 1] || null;
    if (o && !numbered.has(key)) return null; // «2 Romanos»: no existe
    if (key === 'juan' || key === 'jn') return 43;
    if (numbered.has(key) && !single.has(key)) return null; // «Corintios 13» sin número: no se sabe cuál
    return single.get(key) || null;
  }

  // Versículos en lista tras el primero: «, 31», «,28,31-39», « y 32», «; 3:19», «, 28:1» (otro capítulo del mismo libro).
  function moreVerses(rest, at, chapter, parts) {
    const flags = new Set();
    for (;;) {
      const take = (re) => { re.lastIndex = at; const r = re.exec(rest); if (r) at = re.lastIndex; return r; };
      const newChapter = take(new RegExp(`[^\\S\\n]*[;,][^\\S\\n]*(\\d{1,3})[^\\S\\n]*[:.][^\\S\\n]*(\\d{1,3})(?:[^\\S\\n]*(?:-|–|—)\\s*(\\d{1,3}))?(?!\\d)`, 'y'));
      if (newChapter) { chapter = +newChapter[1]; parts.push({ chapter, from: +newChapter[2], to: newChapter[3] ? +newChapter[3] : +newChapter[2] }); continue; }
      const semiRange = take(new RegExp(`[^\\S\\n]*;[^\\S\\n]*(\\d{1,3})[^\\S\\n]*(?:-|–|—)\\s*(\\d{1,3})${END}`, 'y'));
      if (semiRange) { parts.push({ chapter, from: +semiRange[1], to: +semiRange[2] }); flags.add('semi'); continue; }
      const comma = take(new RegExp(`[^\\S\\n]*(?:,|[^\\S\\n]+y)[^\\S\\n]*(\\d{1,3})(?:[^\\S\\n]*(?:-|–|—)\\s*(\\d{1,3}))?${END}`, 'y'));
      if (comma) { parts.push({ chapter, from: +comma[1], to: comma[2] ? +comma[2] : +comma[1] }); continue; }
      return { at, flags };
    }
  }

  // Lee capítulo y versículos desde la posición i del texto. Devuelve { parts, end, style, flags } o null.
  function tail(text, i) {
    const rest = text.slice(i, i + 200);
    let at = 0;
    const take = (re) => { re.lastIndex = at; const r = re.exec(rest); if (r) at = re.lastIndex; return r; };
    const parts = [];
    // «capítulo 3 versículo 16», «Cap. 13: 1 - 3», «, Capitulo 5, versículos 14 y 15»
    const long = take(/\s*,?\s*(?:capitulo|cap\.?)\s*(\d{1,3})(?!\d)/iy);
    if (long) {
      const chapter = +long[1];
      const v = take(/(?:\s*[:.]\s*|\s*,?\s*(?:versiculos?|vers\.?|vv?\.)\s*)(\d{1,3})(?!\d)/iy);
      if (!v) { parts.push({ chapter, from: null, to: null }); return { parts, end: i + at, style: 'long' }; }
      const r = take(RANGE_RE);
      parts.push({ chapter, from: +v[1], to: r ? +r[1] : +v[1] });
      const more = moreVerses(rest, at, chapter, parts);
      return { parts, end: i + more.at, style: 'long', flags: more.flags };
    }
    // «Heb: 13:5-6» y «Mateo (26:51-52)»: dos puntos o un paréntesis entre el libro y la cita, solo si sigue «c:v».
    take(/(?:\s*:|\s*\()(?=\s*\d{1,3}\s*[:.]\s*\d)/y);
    const first = take(/\s*(\d{1,3})(?!\d)/y);
    if (!first) return null;
    const chapter = +first[1];
    let style = 'strong';
    // Capítulo:versículo («3:16», «3.16», «18 :24»); con duda, «3, 16» o «8 2» (separado por un espacio).
    let v = take(/(?:[^\S\n]*:[^\S\n]*|\.)(\d{1,3})(?!\d)/y);
    if (!v) {
      const save = at;
      v = take(new RegExp(`[^\\S\\n]*,[^\\S\\n]*(\\d{1,3})${END}`, 'y'));
      if (v && !/^\s*\d/.test(rest.slice(at))) style = 'comma';
      else {
        at = save;
        v = take(/[^\S\n]+(\d{1,3})(?=[^\S\n]*(?:\n|$|[.,;)]|y\s+\d|[-–]\s*\d|al\s+\d))/y);
        if (v) style = 'space'; else at = save;
      }
    }
    if (!v) {
      // Solo capítulo, o tramo de capítulos («Mt 5–7»).
      const span = take(new RegExp(`\\s*[-–—]\\s*(\\d{1,3})${END}`, 'y'));
      parts.push({ chapter, from: null, to: null, toChapter: span ? +span[1] : null });
      return { parts, end: i + at, style: 'chapter' };
    }
    if (/^0/.test(v[1])) return { parts: [], end: i + at, style: 'zero' }; // «9:00» es una hora
    const from = +v[1];
    let to = from;
    let toChapter = null;
    const r = take(RANGE_RE);
    if (r) { if (r[2]) { toChapter = +r[1]; to = +r[2]; } else to = +r[1]; }
    const open = take(/\s*(?:ss|y\s+sigs?\.?|y\s+ss)\b\.?/iy);
    parts.push({ chapter, from, to, toChapter, open: Boolean(open) });
    const more = moreVerses(rest, at, chapter, parts);
    return { parts, end: i + more.at, style, flags: more.flags };
  }

  // «5:14 y 15», «5:33, 34»: versículos seguidos del mismo capítulo, un solo pasaje.
  function merge(parts) {
    const out = [];
    for (const p of parts) {
      const last = out.at(-1);
      if (last && p.from != null && last.from != null && !last.toChapter && !p.toChapter && !last.open && last.chapter === p.chapter && p.from === last.to + 1) last.to = p.to;
      else out.push({ ...p });
    }
    return out;
  }

  function valid(book, p) {
    const last = chapters(book);
    if (!last || p.chapter < 1 || p.chapter > last) return false;
    if (p.toChapter && (p.toChapter <= p.chapter || p.toChapter > last)) return false;
    if (p.from == null) return true;
    if (p.from < 1 || p.from > count(book, p.chapter)) return false;
    if (p.toChapter) return p.to >= 1 && p.to <= count(book, p.toChapter);
    return p.to >= p.from && p.to <= count(book, p.chapter);
  }

  // ---- Comparar con el texto copiado en el documento ----
  const words = (s) => plain(s).toLowerCase().match(/\p{L}{4,}/gu) || [];
  // Qué parte de las palabras del versículo (en la versión que más se le parezca) está en el trozo del documento.
  function likeness(book, chapter, verse, bag) {
    const texts = verseTexts?.(book, chapter)?.[verse - 1];
    if (!texts) return 0;
    let best = 0;
    for (const t of texts) {
      const w = words(t);
      if (w.length < 3) continue;
      best = Math.max(best, w.filter((x) => bag.has(x)).length / w.length);
    }
    return best;
  }
  // Los versículos del capítulo cuyo texto está copiado en el trozo. Solo los de seis palabras largas o más, y casi
  // enteros: un versículo corto («Vino palabra de Jehová a mí, diciendo») se parece a cualquier párrafo.
  function versesIn(book, chapter, bag) {
    const n = count(book, chapter);
    const hits = [];
    for (let v = 1; v <= n; v += 1) {
      const long = (verseTexts?.(book, chapter)?.[v - 1] || []).some((t) => words(t).length >= 6);
      if (long && likeness(book, chapter, v, bag) >= 0.7) hits.push(v);
    }
    return hits;
  }
  // Lo copiado junto a la cita: las comillas que la tocan (justo antes o justo después) y las líneas de debajo que
  // empiezan por un número de versículo («12 Quién podrá…», «18: Y dijo…»; no «3. El trabajo…», que es una lista).
  // strict: solo eso; si no, también lo que sigue justo detrás (un versículo copiado sin comillas). La prosa del
  // sermón no cuenta para avisar de que el texto es de otro versículo: se parece a cualquiera.
  function copied(after, before, strict) {
    const parts = [];
    const q = /^[\s()—–:.,-]*["“«]([^"”»]{12,600})["”»]/.exec(after);
    if (q) parts.push(q[1]);
    const close = before.search(/["”»][\s.,;:)(—–-]*(?:s\.\s*)?$/);
    if (close >= 0) { const open = Math.max(before.lastIndexOf('"', close - 1), before.lastIndexOf('“', close - 1), before.lastIndexOf('«', close - 1)); if (open >= 0 && close - open > 12) parts.push(before.slice(open + 1, close)); }
    parts.push(...[...after.matchAll(/(?:^|\n)[^\S\n]*\d{1,3}(?::|[^\S\n])[^\S\n]*(\p{L}[^\n]{10,})/gu)].map((m) => m[1]));
    if (!strict) parts.push(after.slice(0, 300));
    return new Set(words(parts.join(' ')));
  }

  return function detect(raw) {
    // Una ligadura que el PDF no sabe escribir (la «ti» de Calibri) llega como un carácter nulo: «Corin\0os».
    const text = raw.normalize('NFC').replace(/\u0000/g, 'ti').replace(/\r/g, '').replace(/[^\S\n]*\n[^\S\n]*/g, '\n').replace(/-\n(?=\p{Ll})/gu, '');
    const flat = plain(text);
    const lineAt = (pos) => (text.slice(0, pos).match(/\n/g) || []).length + 1;
    const original = (a, b) => text.slice(a, b).trim();
    const found = [];
    const dropped = [];
    const drop = (pos, end, why) => dropped.push({ pos, line: lineAt(pos), source: original(pos, end), why });

    BOOK_RE.lastIndex = 0;
    for (let m; (m = BOOK_RE.exec(flat));) {
      const book = bookOf(m);
      const t = book && tail(flat, m.index + m[0].length);
      if (!t) continue; // un nombre sin número no es una cita
      const pos = m.index;
      const after = flat.slice(t.end, t.end + 30);
      const before = flat.slice(Math.max(0, pos - 50), pos);
      const key = fold(m.groups.book);
      const wordlike = WORDLIKE.has(key) && !m.groups.ord;
      const person = PERSON.has(key) && !m.groups.ord && !m.groups.saint;
      const capital = /^[\p{Lu}\d]/u.test(m.groups.ord || m.groups.saint || m.groups.book);
      if (t.style === 'zero') { drop(pos, t.end, 'parece una hora (versículo 00)'); continue; }
      t.parts = merge(t.parts);
      if (chapters(book) === 1) t.parts = t.parts.map((p) => (p.from == null ? { chapter: 1, from: p.chapter, to: p.toChapter || p.chapter, oneChapter: true } : p));
      const bad = t.parts.filter((p) => !valid(book, p));
      if (bad.length) { drop(pos, t.end, `no existe en la Biblia (${bad.map((p) => p.chapter + (p.from ? ':' + p.from : '')).join(', ')})`); continue; }
      if (/^\s*(?:a\.?\s?m\.?|p\.?\s?m\.?|hrs?\.?|horas|de la (?:manana|tarde|noche))(?![\p{L}])/iu.test(after) || /(?:a las|las)\s*$/i.test(before)) { drop(pos, t.end, 'parece una hora'); continue; }
      const reasons = [];
      const word = /^[^\S\n]*(\p{Ll}+)/u.exec(after)?.[1];
      const numberOnly = t.style === 'chapter';
      const enBefore = /(?:\ben|\bde|\bdel|leer|lea|leamos|busquemos en|vease|cf\.?)\s*$/i.test(before);
      if (numberOnly && word && !CITE_WORDS.has(word)) {
        // «Juan 3 hermanos», «Romanos 12 personas» son cantidades; «En Mateo 9 encontramos», una cita.
        const verbish = CITE_VERBS.has(word) || /mos$/.test(word);
        const plural = /s$/.test(word) && !NOT_PLURAL.has(word);
        if (QUANTITY.has(word) || (!verbish && !enBefore && (person || wordlike || plural))) { drop(pos, t.end, `le sigue «${word}»: parece una cantidad o una fecha`); continue; }
        if (!(verbish && enBefore) || person || wordlike) reasons.push(`le sigue «${word}»: ¿es la cita?`);
      }
      if (!capital) {
        // en minúsculas: «el salmo 23», «en hechos 12», «en romanos 8:28». Una palabra corriente suelta, no.
        if ((wordlike || person) && numberOnly && !enBefore) { drop(pos, t.end, 'en minúsculas, dentro de una frase'); continue; }
        if (!(wordlike || person) && numberOnly && !/(?:el|del|en|de)\s*$/i.test(before)) { drop(pos, t.end, 'en minúsculas, dentro de una frase'); continue; }
        if (wordlike || person) reasons.push('en minúsculas');
      }
      if (numberOnly && !t.parts[0].oneChapter && !reasons.length) {
        const lead = /(?:\(|;|:|lecturas?|leer|lea|texto|cf\.?|v[ée]ase|ver|\ben)\s*$/i.test(before) || /^\s*(?:[);,]|$)/.test(after) || /^\s*[.)]\s*(?:\p{Lu}|-|\d|$)/u.test(after);
        if (!lead) reasons.push(person || wordlike ? 'capítulo entero de un libro que también es un nombre' : 'capítulo entero sin más contexto');
      }
      if (t.style === 'comma') reasons.push('«3, 16»: se entendió capítulo 3, versículo 16');
      if (t.style === 'space') reasons.push(`«${t.parts[0].chapter} ${t.parts[0].from}»: se entendió capítulo ${t.parts[0].chapter}, versículo ${t.parts[0].from}`);
      if (t.flags?.has('semi')) reasons.push('«; 29-34» sin capítulo: se entendieron versículos del mismo capítulo');
      if (t.parts.some((p) => p.open)) reasons.push('«ss» (y siguientes): ¿hasta dónde?');
      // El texto del que se habla («Texto:», «Leer», al principio de una línea) frente a una cita de paso (entre
      // paréntesis o tras unas comillas): los «v. 18» que vienen se refieren al primero.
      const lineBefore = before.slice(before.lastIndexOf('\n') + 1);
      const side = /\(\s*(?:cf\.?\s*)?$|[”"»]\s*\(?\s*(?:--?\s*)?(?:s\.\s*)?$/i.test(before);
      const main = !side && (/^[\s\-•∙*·]*(?:[\p{L}\d]{1,3}[.)]\s*)*$/u.test(lineBefore)
        || /(?:texto(?:\s+(?:biblico|clave|base))?|lecturas?|introduccion|cita(?:\s+biblica)?|pasaje)\s*[:.\-–]*\s*$/i.test(lineBefore)
        || /(?:leer|lea|leamos|busquemos en(?: el)?|vamos a)\s*$/i.test(lineBefore));
      const version = VERSION_RE.exec(after)?.[1]?.toUpperCase().replace(/\s+/g, '') || null;
      found.push({ pos, end: t.end, line: lineAt(pos), source: original(pos, t.end), refs: t.parts.map((p) => ({ book, ...p })), version, main, side, confidence: reasons.length ? 'revisar' : 'segura', reasons });
    }
    // «cap. 3 de Colosenses», «el capítulo 13 de 1 Corintios»: el capítulo antes del libro.
    const BACK = /(?<![\p{L}])cap(?:itulo|\.)?\s*(\d{1,3})\s+(?:de|del)\s+(?:(?:la\s+)?(?:carta|epistola)\s+(?:a\s+)?(?:los\s+)?|(?:el\s+)?(?:libro|evangelio)\s+de\s+)?/giu;
    for (let r; (r = BACK.exec(flat));) {
      BOOK_RE.lastIndex = r.index + r[0].length;
      const m = BOOK_RE.exec(flat);
      if (!m || m.index !== r.index + r[0].length) continue;
      const book = bookOf(m);
      const p = { chapter: +r[1], from: null, to: null };
      if (!book || !valid(book, p)) continue;
      const end = m.index + m[0].length;
      if (found.some((c) => c.pos < end && r.index < c.end)) continue;
      found.push({ pos: r.index, end, line: lineAt(r.index), source: original(r.index, end), refs: [{ book, ...p }], version: null, main: true, confidence: 'segura', reasons: [] });
    }
    found.sort((a, b) => a.pos - b.pos);

    // Sin libro, entre paréntesis: «(25:22)», «(cf 12 :5-11, 17-19)». Del libro de la cita anterior: a revisar.
    const BARE = /\(\s*(?:cf\.?\s*|ver\s+|v[ée]ase\s+)?(?=\d{1,3}\s*:\s*\d)/giu;
    const bare = [];
    for (let r; (r = BARE.exec(flat));) {
      const at = r.index + r[0].length;
      if (found.some((c) => c.pos <= at && at < c.end)) continue;
      const prev = found.filter((c) => c.end <= r.index).at(-1);
      const t = tail(flat, at);
      if (!prev || !t || t.style !== 'strong') continue;
      const book = prev.refs[0].book;
      const refs = t.parts.map((p) => ({ book, ...p }));
      if (!refs.every((x) => valid(book, x))) continue;
      bare.push({ pos: at, end: t.end, line: lineAt(at), source: original(at, t.end), refs, version: null, main: false, side: true, confidence: 'revisar', reasons: [`sin libro: se entendió el de «${prev.source}»`] });
    }
    found.push(...bare);
    found.sort((a, b) => a.pos - b.pos);

    // «v. 18», «vv. 20-22», «versículos 4,7 y 8», «versículo 29 de Marcos 7», «versículo 46 del capítulo 8 de Lucas».
    const REL = /(?<![\p{L}])(?:vv?\.|versiculos?|vers\.)[^\S\n]*(\d{1,3})((?:[^\S\n]*(?:,|y|-|–|—|al|a)[^\S\n]*\d{1,3}(?!\d))*)/giu;
    const relative = [];
    for (let r; (r = REL.exec(flat));) {
      if (found.some((c) => c.pos <= r.index && r.index < c.end)) continue; // ya es parte de una cita («cap. 3 vers. 16»)
      const nums = [+r[1], ...(r[2].match(/[^\d]*\d+/g) || [])];
      const list = [];
      for (let k = 0; k < nums.length; k += 1) {
        const n = typeof nums[k] === 'number' ? nums[k] : +nums[k].replace(/\D/g, '');
        const isRange = typeof nums[k] === 'string' && /-|–|—|al|\ba\b/.test(nums[k].replace(/\d/g, ''));
        if (isRange && list.length) list.at(-1).to = n; else list.push({ from: n, to: n });
      }
      let end = r.index + r[0].length;
      const make = (book, chapter) => merge(list.map((x) => ({ book, chapter, from: x.from, to: x.to })));
      const ok = (refs) => refs.every((x) => valid(x.book, x));
      // Con el libro detrás: «versículo 29 de Marcos 7», «del capítulo 8 de Lucas».
      const tailBook = /^\s+(?:del\s+(?:capitulo|cap\.?)\s*(\d{1,3})\s+)?(?:de|en)\s+(?:el\s+libro\s+de\s+)?/i.exec(flat.slice(end, end + 40));
      if (tailBook) {
        BOOK_RE.lastIndex = end + tailBook[0].length;
        const m = BOOK_RE.exec(flat);
        if (m && m.index === end + tailBook[0].length && bookOf(m)) {
          const chapterAfter = /^\s*(\d{1,3})(?!\d|\s*[:.]\s*\d)/.exec(flat.slice(m.index + m[0].length));
          const chapter = tailBook[1] ? +tailBook[1] : chapterAfter ? +chapterAfter[1] : (chapters(bookOf(m)) === 1 ? 1 : null);
          if (chapter) {
            const refs = make(bookOf(m), chapter);
            end = m.index + m[0].length + (tailBook[1] || !chapterAfter ? 0 : chapterAfter[0].length);
            if (ok(refs)) {
              // la cita del libro que se leyó por separado («Marcos 7», «capítulo 8 de Lucas») es la misma: fuera
              for (let k = found.length - 1; k >= 0; k -= 1) if (found[k].pos < end && found[k].end > r.index) found.splice(k, 1);
              // cuenta como cita anterior para los «versículo 45» que vengan
              found.push({ pos: r.index, end, line: lineAt(r.index), source: original(r.index, end), refs, version: null, main: true, side: false, confidence: 'segura', reasons: [] });
              found.sort((a, b) => a.pos - b.pos);
              continue;
            }
          }
        }
      }
      // Sin libro: de la cita anterior; si esa es de paso (entre paréntesis o tras unas comillas), del último «Texto:» o
      // «Leer». La otra opción se ofrece al revisar, y si hay texto copiado, decide la comparación (abajo).
      const prev = found.filter((c) => c.end <= r.index).at(-1);
      const anchor = found.filter((c) => c.end <= r.index && c.main).at(-1);
      if (!prev) { drop(r.index, end, 'versículo suelto sin una cita antes'); continue; }
      const options = [anchor, prev].filter(Boolean)
        .map((c) => { const p = c.refs.at(-1); return { c, refs: make(p.book, p.toChapter || p.chapter) }; })
        .filter((o, k, a) => ok(o.refs) && a.findIndex((x) => x.refs[0].book === o.refs[0].book && x.refs[0].chapter === o.refs[0].chapter) === k);
      if (!options.length) { drop(r.index, end, 'ese versículo no existe en el capítulo de la cita anterior'); continue; }
      const pick = (prev.side ? options.find((o) => o.c === anchor) : options.find((o) => o.c === prev)) || options[0];
      const other = options.find((o) => o !== pick);
      relative.push({ pos: r.index, end, line: lineAt(r.index), source: original(r.index, end), refs: pick.refs, version: null, main: false, confidence: 'revisar',
        reasons: [`deducido de «${pick.c.source}»${other ? ` (¿o de «${other.c.source}»?)` : ''}`], alternative: other?.refs || null });
    }
    found.push(...relative);
    found.sort((a, b) => a.pos - b.pos);

    // ---- El texto copiado: confirma la cita, la precisa o avisa de que no cuadra ----
    if (verseTexts) {
      found.forEach((c, k) => {
        // el trozo de documento junto a la cita: lo que sigue (hasta la próxima cita) y, entre comillas, lo que precede
        const next = found[k + 1]?.pos ?? flat.length;
        const prevEnd = found[k - 1]?.end ?? 0;
        const after = flat.slice(c.end, Math.min(next, c.end + 700));
        const before = flat.slice(Math.max(prevEnd, c.pos - 400), c.pos);
        const bag = copied(after, before, false);
        const strictBag = copied(after, before, true);
        const ref = c.refs[0];
        const listed = c.refs.flatMap((x) => (x.from == null ? [] : Array.from({ length: (x.toChapter ? x.from : x.to) - x.from + 1 }, (_, j) => [x.chapter, x.from + j])));
        if (listed.length && listed.length <= 12) {
          const best = Math.max(...listed.map(([ch, v]) => likeness(ref.book, ch, v, bag)));
          if (best >= 0.6) { c.text = 'coincide'; return; }
          // ¿El texto copiado es de otro versículo del mismo capítulo (o de la otra opción)?
          // ¿Lo copiado (o lo que sigue) es de la otra opción, y bastante más que de la elegida?
          const altScore = c.alternative ? Math.max(...c.alternative.map((x) => (versesIn(x.book, x.chapter, bag).includes(x.from) ? likeness(x.book, x.chapter, x.from, bag) : 0))) : 0;
          const alt = altScore >= 0.7 && altScore > best + 0.3;
          if (alt) { c.refs = c.alternative; c.reasons = ['deducido por el texto copiado, que es de este pasaje']; c.text = 'coincide'; return; }
          const hits = versesIn(ref.book, ref.chapter, strictBag);
          if (hits.length && !hits.some((v) => listed.some(([ch, x]) => ch === ref.chapter && x === v))) {
            c.text = `el texto copiado es del versículo ${hits.slice(0, 3).join(', ')}`;
            c.confidence = 'revisar';
            c.reasons.push(c.text);
          }
        } else if (ref.from == null && !ref.toChapter) {
          // Capítulo entero: si lo que sigue es el texto de unos versículos, se propone precisarlos.
          const hits = versesIn(ref.book, ref.chapter, bag);
          if (hits.length && hits.length <= 8) {
            c.suggest = { from: Math.min(...hits), to: Math.max(...hits) };
            c.confidence = 'revisar';
            c.reasons.push(`el texto que sigue es de ${c.suggest.from === c.suggest.to ? `el versículo ${c.suggest.from}` : `los versículos ${c.suggest.from}-${c.suggest.to}`}: ¿solo esos?`);
          }
        }
      });
    }
    dropped.sort((a, b) => a.pos - b.pos);
    return { found, dropped };
  };
}

// Para leer: «Juan 3:16-18», «Mateo 5–7».
export function label(ref, names) {
  const name = names[ref.book - 1];
  if (ref.from == null) return `${name} ${ref.chapter}${ref.toChapter ? `–${ref.toChapter}` : ''}`;
  if (ref.toChapter) return `${name} ${ref.chapter}:${ref.from}–${ref.toChapter}:${ref.to}`;
  return `${name} ${ref.chapter}:${ref.from}${ref.to > ref.from ? `-${ref.to}` : ''}${ref.open ? ' y siguientes' : ''}`;
}
