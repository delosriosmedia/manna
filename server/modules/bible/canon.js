// Los 66 libros en orden canónico: [nombre, abreviatura, ...otras formas de escribirlo]. Es la única lista: la usan la
// cita rápida (findBook) y el detector de citas de un texto (citas.js), que sabe además de ordinales («1ra de», «I»).
const BOOKS = [
  ['Génesis', 'Gn', 'gen', 'ge', 'Gén'],
  ['Éxodo', 'Éx', 'exo', 'exod', 'Ex'],
  ['Levítico', 'Lv', 'lev'],
  ['Números', 'Nm', 'num', 'nu', 'Núm'],
  ['Deuteronomio', 'Dt', 'deut', 'deu'],
  ['Josué', 'Jos'],
  ['Jueces', 'Jue', 'jc', 'juec'],
  ['Rut', 'Rt', 'ruth'],
  ['1 Samuel', '1 S', '1sam', '1sa', '1sm'],
  ['2 Samuel', '2 S', '2sam', '2sa', '2sm'],
  ['1 Reyes', '1 R', '1re', '1rey'],
  ['2 Reyes', '2 R', '2re', '2rey'],
  ['1 Crónicas', '1 Cr', '1cro', '1cron'],
  ['2 Crónicas', '2 Cr', '2cro', '2cron'],
  ['Esdras', 'Esd'],
  ['Nehemías', 'Neh', 'ne'],
  ['Ester', 'Est'],
  ['Job', 'Job', 'jb'],
  ['Salmos', 'Sal', 'salmo', 'slm', 'sl', 'ps'],
  ['Proverbios', 'Pr', 'prov', 'pro', 'prv'],
  ['Eclesiastés', 'Ec', 'ecl', 'ecles', 'ecle', 'qo'],
  ['Cantares', 'Cnt', 'cant', 'cantar', 'Cantar de los Cantares'],
  ['Isaías', 'Is', 'isa'],
  ['Jeremías', 'Jer', 'jr'],
  ['Lamentaciones', 'Lm', 'lam'],
  ['Ezequiel', 'Ez', 'eze', 'ezeq'],
  ['Daniel', 'Dn', 'dan'],
  ['Oseas', 'Os', 'ose'],
  ['Joel', 'Jl'],
  ['Amós', 'Am'],
  ['Abdías', 'Abd', 'ab'],
  ['Jonás', 'Jon'],
  ['Miqueas', 'Mi', 'miq'],
  ['Nahúm', 'Nah', 'na'],
  ['Habacuc', 'Hab'],
  ['Sofonías', 'Sof'],
  ['Hageo', 'Hag', 'ageo'],
  ['Zacarías', 'Zac'],
  ['Malaquías', 'Mal', 'ml'],
  ['Mateo', 'Mt', 'mat'],
  ['Marcos', 'Mr', 'mc', 'mar', 'mrc'],
  ['Lucas', 'Lc', 'luc'],
  ['Juan', 'Jn'],
  ['Hechos', 'Hch', 'hech', 'hec', 'Hechos de los Apóstoles'],
  ['Romanos', 'Ro', 'rom', 'rm'],
  ['1 Corintios', '1 Co', '1cor', '1corin'],
  ['2 Corintios', '2 Co', '2cor', '2corin'],
  ['Gálatas', 'Gá', 'gal', 'ga'],
  ['Efesios', 'Ef', 'efe', 'efes'],
  ['Filipenses', 'Fil', 'flp', 'filip'],
  ['Colosenses', 'Col'],
  ['1 Tesalonicenses', '1 Ts', '1tes', '1tesal'],
  ['2 Tesalonicenses', '2 Ts', '2tes', '2tesal'],
  ['1 Timoteo', '1 Ti', '1tim', '1tm'],
  ['2 Timoteo', '2 Ti', '2tim', '2tm'],
  ['Tito', 'Tit', 'tt'],
  ['Filemón', 'Flm', 'filem'],
  ['Hebreos', 'He', 'heb', 'hebr'],
  ['Santiago', 'Stg', 'sant', 'stgo', 'sgo'],
  ['1 Pedro', '1 P', '1pe', '1ped'],
  ['2 Pedro', '2 P', '2pe', '2ped'],
  ['1 Juan', '1 Jn'],
  ['2 Juan', '2 Jn'],
  ['3 Juan', '3 Jn'],
  ['Judas', 'Jud'],
  ['Apocalipsis', 'Ap', 'apoc', 'apo'],
];

// minúsculas, sin tildes, sin espacios ni puntos: "1 Crónicas" -> "1cronicas"
export function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
const key = (text) => normalize(text).replace(/[\s.]+/g, '');

export const BOOK_FORMS = BOOKS;
export const CANON = BOOKS.map(([name, abbr], i) => ({ n: i + 1, name, abbr }));

const exact = new Map();
BOOKS.forEach((forms, i) => forms.forEach((f) => { if (!exact.has(key(f))) exact.set(key(f), i + 1); }));

// Devuelve el número de libro (1-66) para un nombre o abreviatura, o null.
export function findBook(input) {
  let k = key(input.replace(/^\s*(iii|ii|i)\s+/i, (_, r) => `${r.length} `));
  if (!k) return null;
  if (exact.has(k)) return exact.get(k);
  if (k.length < 2) return null;
  const hit = CANON.find((b) => key(b.name).startsWith(k));
  return hit ? hit.n : null;
}
