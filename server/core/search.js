// Búsqueda de texto compartida (Biblia; después, himnario). Sin importar tildes ni mayúsculas,
// por niveles y con un índice de palabras para que responda en milisegundos:
//
//   exact    la frase tal cual (la última palabra puede estar a medio escribir)
//   words    todas las palabras, en cualquier orden
//   similar  otras formas de las mismas palabras ("amó", "amar", "amor") y sinónimos bíblicos
//
// No usa un modelo de lenguaje: las "parecidas" salen de reglas del español (raíces de
// palabras), una tabla de verbos irregulares y una lista corta de sinónimos escrita a mano.

const ACCENTS = /[̀-ͯ]/g;

// "¡Señor, ven!" -> "senor ven": minúsculas, sin tildes ni signos, un solo espacio entre palabras.
export function fold(text) {
  return String(text ?? '').normalize('NFD').replace(ACCENTS, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Lo mismo que fold(), carácter a carácter, anotando de qué posición del original sale cada uno.
// Solo se usa con los pocos textos que se devuelven, para marcar lo encontrado.
function foldWithMap(text) {
  let folded = '';
  const map = [];
  let gap = false;
  for (let i = 0; i < text.length; i += 1) {
    const plain = text[i].normalize('NFD').replace(ACCENTS, '').toLowerCase();
    for (const ch of plain) {
      if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
        if (gap && folded) {
          folded += ' ';
          map.push(i);
        }
        gap = false;
        folded += ch;
        map.push(i);
      } else gap = true;
    }
  }
  return { folded, map };
}

// ---- Raíces de palabras ----

const list = (text) => text.trim().split(/\s+/);

// Verbos y nombres cuyas formas no comparten principio, o son demasiado cortas para las reglas.
// Cada grupo se reduce a la misma raíz. Se omiten a propósito las formas que también son otra
// palabra ("vino", "amén", "oro", "sabia", "hacia"): juntarían cosas que no tienen que ver.
const FAMILIES = {
  '=am': 'amar ama amo amas aman amamos amais amaba amaban amabas amado amada amados amadas amando amare amaras amara amaran amaremos ames ame amemos amaos amad amaron amaste amasteis amor amores amante amantes',
  '=or': 'orar ora oras oran oramos oraba oraban orado orando orare oraras orara oraran orad oren ores oraron oraste oracion oraciones',
  '=dar': 'dar da doy das dan damos dais daba daban dado dada dados dadas dando dare daras dara daran daremos den des demos dad dio diste dimos disteis dieron diera dieras dieran diese diere dadme dadle dale dales danos dame',
  dec: 'decir dice dices dicen digo decimos decis decia decian dicho dicha dichos diciendo dire diras dira diran diremos diga digas digan digamos decid dijo dije dijiste dijimos dijisteis dijeron dijera dijere dijese dijeran',
  hac: 'hacer hace haces hacen hago hacemos haceis hacian hecho hecha hechos hechas haciendo hare haras hara haran haremos haga hagas hagan hagamos haced hizo hice hiciste hicimos hicisteis hicieron hiciera hiciere hiciese hicieran',
  '=venir': 'venir viene vienes vienen vengo venimos venis venia venian venido venida viniendo vendre vendras vendra vendran vendremos venga vengas vengan vengamos venid vine viniste vinimos vinisteis vinieron viniera viniere viniese vinieran',
  '=ver': 'ver veo ves vemos veis veia veian visto vistos viendo vere vera veran veremos vea veas vean veamos ved vio viste vimos visteis vieron viera viere viese vieran',
  '=tener': 'tener tiene tienes tienen tengo tenemos teneis tenia tenian tenido teniendo tendre tendras tendra tendran tendremos tenga tengas tengan tengamos tened tuvo tuve tuviste tuvimos tuvisteis tuvieron tuviera tuviere tuviese tuvieran',
  pod: 'poder puede puedes pueden puedo podemos podeis podia podian podido pudiendo podre podras podra podran podremos pueda puedas puedan podamos pudo pude pudiste pudimos pudisteis pudieron pudiera pudiere pudiese pudieran',
  quer: 'querer quiere quieres quieren quiero queremos quereis queria querian queriendo querre querras querra querran quiera quieras quieran queramos quiso quise quisiste quisimos quisieron quisiera quisiere quisiese quisieran',
  sab: 'saber sabe sabes saben sabemos sabeis sabian sabido sabiendo sabre sabras sabra sabran sabremos sepa sepas sepan sepamos sabed supo supe supiste supimos supisteis supieron supiera supiere supiese supieran',
  '=morir': 'morir muere mueres mueren muero morimos moris moria morian muerto muerta muertos muertas muriendo morire moriras morira moriran moriremos muera mueras mueran muramos morid murio moriste murieron muriera muriere muriese murieran muerte muertes',
  '=oir': 'oir oye oyes oyen oigo oimos oia oian oido oyendo oire oiras oira oiran oiremos oiga oigas oigan oigamos oid oyo oiste oyeron oyera oyere oyese oyeran',
  pon: 'poner pone pones ponen pongo ponemos poneis ponia ponian puesto puesta puestos puestas poniendo pondre pondras pondra pondran pondremos ponga pongas pongan pongamos poned puso puse pusiste pusimos pusisteis pusieron pusiera pusiere pusiese pusieran',
  sal: 'salgo saldre saldras saldra saldran saldremos salga salgas salgan salgamos',
  tra: 'traer trae traen traigo traia traido trayendo traere traiga traigan trajo traje trajiste trajimos trajeron trajera',
  '=caer': 'caer cae caen caigo caia caido cayendo caere caiga caigan cayo caiste caimos cayeron cayera',
  ped: 'pide pides piden pido pida pidas pidan pidio pidieron pidiendo pidiera',
  segu: 'sigue sigues siguen sigo siga sigas sigan siguio siguieron siguiendo siguiera',
  serv: 'sirve sirves sirven sirvo sirva sirvan sirvio sirvieron sirviendo siervo sierva siervos siervas',
  sent: 'siente sientes sienten siento sienta sintio sintieron sintiendo',
  dorm: 'duerme duermes duermen duermo duerma durmio durmieron durmiendo',
  volv: 'vuelve vuelves vuelven vuelvo vuelva vuelvan vuelto vueltos volved',
  nac: 'nazca nazco nazcan',
  conoc: 'conozco conozca conozcas conozcan',
  bendec: 'bendice bendices bendicen bendigo bendijo bendije bendijeron bendiga bendigas bendigan bendito bendita benditos benditas bendicion bendiciones bendiciendo',
  maldec: 'maldice maldicen maldijo maldijeron maldito maldita malditos malditas maldicion maldiciones',
  rog: 'ruega ruegas ruegan ruego ruegue rueguen',
  mostr: 'muestra muestras muestran muestro muestre muestren',
  encontr: 'encuentra encuentras encuentran encuentro encuentre encuentren',
  perd: 'pierde pierdes pierden pierdo pierda pierdan',
  entend: 'entiende entiendes entienden entiendo entienda entiendan',
  pens: 'piensa piensas piensan pienso piense piensen',
  despert: 'despierta despiertas despiertan despierto despierte',
  tem: 'temor temores',
  repos: 'reposo reposos',
  // "creó" (crear) y "creo" (creer) se escriben igual sin tilde: solo se separan las formas inequívocas.
  '=crear': 'crear creado creada creados creadas creando creacion creador creaste crearon creare creara',
  '=leer': 'leer lee leen leo leia leido leyo leyeron leyendo leed',
  luz: 'luces', voz: 'voces', vez: 'veces', cruz: 'cruces', pez: 'peces', juez: 'jueces', feliz: 'felices', raiz: 'raices',
};
const IRREGULAR = new Map(Object.entries(FAMILIES).flatMap(([root, forms]) => list(forms).map((form) => [form, root])));

// Palabras que las reglas estropearían ("dios" quedaría como "dio").
const KEEP = new Set(list('dios jesus mas pues tres seis cruz feliz amen caridad hacia'));

// Terminaciones del español (ya sin tildes). Se quita la más larga que deje al menos tres letras.
const ENDINGS = list(`
  amientos imientos amiento imiento aciones uciones iciones acion ucion icion adores adoras ador adora
  ancias encias ancia encia idades idad ables ibles able ible istas ista ismos ismo osos osas oso osa
  ivos ivas ivo iva antes entes ante ente yentes yente eros eras ero era
  ieramos aramos iesemos asemos abamos iamos ieron yeron aron asteis isteis abais aremos eremos iremos
  arian erian irian aria eria iria aran eran iran aras iras ara iera ieras yera yere yese yeran iese ieses ase ases
  aste iste aban abas aba ian ias ia adas idas ados idos ada ida ado ido ando iendo yendo
  amos emos imos ais eis are ere ire ares eres ires ar er ir an en as es ios io yo os a e o s
`).sort((a, b) => b.length - a.length);

// Raíz aproximada de una palabra ya plegada con fold(). "salvación", "salvó" y "salvador" -> "salv".
export function stem(word) {
  const known = IRREGULAR.get(word);
  if (known) return known;
  if (word.length <= 3 || KEEP.has(word) || /\d/.test(word)) return word;
  const base = word.endsWith('mente') && word.length >= 9 ? word.slice(0, -5) : word;
  for (const ending of ENDINGS) {
    if (base.length - ending.length >= 3 && base.endsWith(ending)) return base.slice(0, -ending.length);
  }
  return base;
}

// Sinónimos bíblicos: palabras distintas que las versiones usan para lo mismo.
// "Jehová" en una versión es "Señor" en otra; "caridad" en la Reina-Valera antigua es "amor".
const SYNONYMS = [
  'senor jehova yahve adonai',
  'cristo mesias ungido',
  'diablo satanas maligno tentador',
  'misericordia compasion piedad clemencia',
  'gozo alegria regocijo jubilo',
  'pecado transgresion iniquidad maldad rebelion',
  'salvacion redencion rescate',
  'amor caridad',
  'temor miedo',
  'mandamiento precepto estatuto ordenanza',
  'siervo esclavo criado',
  'templo santuario tabernaculo',
  'oracion plegaria ruego suplica',
  'reposo descanso',
  'camino senda vereda',
  'pacto alianza',
  'gentiles naciones paganos',
  'iglesia congregacion asamblea',
].map((group) => [...new Set(list(group).map(stem))]);
const SYNONYM_STEMS = new Map();
for (const group of SYNONYMS) for (const s of group) SYNONYM_STEMS.set(s, group);

// Palabras que están en casi todos los textos: no cuentan para "todas las palabras" ni para "parecidas".
const COMMON = new Set(list('de la el los las y a en que del al un una unos unas por con se su sus lo le les es no mi mis tu tus te me ni o e u si ya pero como para son fue era ha he han'));

const MAX_WORDS = 12;

// Prepara una búsqueda una sola vez, para pasarla después por varios índices.
export function prepareQuery(text) {
  const words = fold(String(text ?? '').slice(0, 200)).split(' ').filter(Boolean).slice(0, MAX_WORDS);
  const picked = words.filter((w) => !COMMON.has(w));
  const content = picked.length ? picked : words;
  // Por cada palabra con contenido, las raíces que valen como "parecidas": la suya y las de sus sinónimos.
  const roots = content.map((w) => {
    const own = stem(w);
    return new Set([own, ...(SYNONYM_STEMS.get(own) || [])]);
  });
  const last = words.at(-1) || '';
  return {
    words,
    content,
    roots,
    phrase: words.join(' '),
    last,
    // Con menos de dos letras no se busca: saldría media Biblia.
    empty: words.join('').length < 2,
    allRoots: new Set(roots.flatMap((set) => [...set])),
  };
}

// ---- Índice ----

const EMPTY = new Uint32Array(0);

function intersect(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i += 1;
      j += 1;
    } else if (a[i] < b[j]) i += 1;
    else j += 1;
  }
  return out;
}

// Índice de un conjunto de textos (los versículos de una versión, las letras de un himnario).
// find(consulta) devuelve, por nivel, las posiciones de los textos que coinciden, sin repetir
// en un nivel lo que ya salió en el anterior.
//
// Se guarda compacto, porque hay uno por versión de la Biblia: el vocabulario ordenado y, en una
// sola tabla, en qué textos aparece cada palabra.
export function createTextIndex(texts) {
  const size = texts.length;
  const folded = new Array(size); // cada texto plegado, con un espacio a cada lado
  const lists = new Map();        // palabra -> posiciones de los textos que la contienen (provisional)
  for (let i = 0; i < size; i += 1) {
    const plain = fold(texts[i]);
    folded[i] = ` ${plain} `;
    if (!plain) continue;
    for (const word of plain.split(' ')) {
      const docs = lists.get(word);
      if (!docs) lists.set(word, [i]);
      else if (docs[docs.length - 1] !== i) docs.push(i);
    }
  }
  const vocabulary = [...lists.keys()].sort();
  const starts = new Uint32Array(vocabulary.length + 1); // dónde empieza cada palabra en `table`
  vocabulary.forEach((word, i) => { starts[i + 1] = starts[i] + lists.get(word).length; });
  const table = new Uint32Array(starts[vocabulary.length]);
  const families = new Map(); // raíz -> palabra o palabras del vocabulario con esa raíz (por su número)
  vocabulary.forEach((word, i) => {
    table.set(lists.get(word), starts[i]);
    const root = stem(word);
    const family = families.get(root);
    if (family === undefined) families.set(root, i);
    else if (typeof family === 'number') families.set(root, [family, i]);
    else family.push(i);
  });
  lists.clear();

  const docsOfWord = (i) => table.subarray(starts[i], starts[i + 1]);

  // Primera palabra del vocabulario que no va antes que `text` (búsqueda binaria).
  function lowerBound(text) {
    let lo = 0;
    let hi = vocabulary.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (vocabulary[mid] < text) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  // Números de las palabras que empiezan por un prefijo: en el vocabulario ordenado van seguidas.
  function startingWith(prefix) {
    const out = [];
    for (let i = lowerBound(prefix); i < vocabulary.length && vocabulary[i].startsWith(prefix); i += 1) out.push(i);
    return out;
  }

  function wordDocs(word) {
    const i = lowerBound(word);
    return vocabulary[i] === word ? docsOfWord(i) : EMPTY;
  }

  // Une los textos de varias palabras, en orden y sin repetir.
  function union(wordNumbers) {
    if (wordNumbers.length === 1) return docsOfWord(wordNumbers[0]);
    const seen = new Uint8Array(size);
    let count = 0;
    for (const i of wordNumbers) {
      for (let k = starts[i]; k < starts[i + 1]; k += 1) {
        if (!seen[table[k]]) {
          seen[table[k]] = 1;
          count += 1;
        }
      }
    }
    const out = new Uint32Array(count);
    for (let doc = 0, k = 0; k < count; doc += 1) {
      if (seen[doc]) {
        out[k] = doc;
        k += 1;
      }
    }
    return out;
  }

  const all = (sets) => (sets.length ? sets.sort((a, b) => a.length - b.length).reduce(intersect) : []);

  function find(query) {
    if (query.empty) return { exact: [], words: [], similar: [] };
    const { words, content, last } = query;
    // La última palabra puede estar a medio escribir: vale cualquier palabra que empiece así.
    const lastWords = startingWith(last);
    const lastDocs = union(lastWords);
    const docsOf = (word) => (word === last ? lastDocs : wordDocs(word));
    const taken = new Uint8Array(size);
    const take = (docs) => {
      const fresh = [];
      for (const doc of docs) {
        if (!taken[doc]) {
          taken[doc] = 1;
          fresh.push(doc);
        }
      }
      return fresh;
    };

    // 1. La frase tal cual. Primero las que terminan en palabra completa.
    const whole = [];
    const partial = [];
    const needle = ` ${query.phrase}`;
    for (const doc of all(words.map(docsOf))) {
      if (!folded[doc].includes(needle)) continue;
      (folded[doc].includes(`${needle} `) ? whole : partial).push(doc);
    }
    const exact = take([...whole, ...partial]);

    // 2. Todas las palabras con contenido, en cualquier orden.
    const together = take(all(content.map(docsOf)));

    // 3. Parecidas: cada palabra, en cualquiera de sus formas o por un sinónimo.
    const similar = take(all(query.roots.map((roots, i) => {
      const family = [...roots].flatMap((root) => families.get(root) ?? []);
      return union(content[i] === last ? [...new Set([...family, ...lastWords])] : family);
    })));

    return { exact, words: together, similar };
  }

  return { size, find };
}

// ---- Marcar lo encontrado ----

const isMark = (ch) => ch >= '̀' && ch <= 'ͯ';

// Tramos [inicio, fin) del texto original que hay que resaltar para un resultado de ese nivel.
export function findMarks(text, query, level) {
  const { folded, map } = foldWithMap(text);
  const spans = [];
  const add = (start, end) => { if (end > start) spans.push([start, end]); };

  if (level === 'exact') {
    // Solo donde la frase empieza en principio de palabra.
    for (let at = folded.indexOf(query.phrase); at >= 0; at = folded.indexOf(query.phrase, at + 1)) {
      if (at === 0 || folded[at - 1] === ' ') add(at, at + query.phrase.length);
    }
  } else {
    let start = 0;
    for (const word of folded.split(' ')) {
      const end = start + word.length;
      const hit = level === 'words'
        ? query.content.includes(word) || (word.startsWith(query.last) && query.content.includes(query.last))
        : query.allRoots.has(stem(word)) || (query.content.includes(query.last) && word.startsWith(query.last));
      if (hit) add(start, end);
      start = end + 1;
    }
  }

  // De posiciones en el texto plegado a posiciones en el original (una tilde suelta va con su letra).
  return spans.map(([start, end]) => {
    let to = map[end - 1] + 1;
    while (to < text.length && isMark(text[to])) to += 1;
    return [map[start], to];
  });
}
