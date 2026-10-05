import fs from 'node:fs';
import path from 'node:path';

// Revisión del código sin ejecutarlo. El proyecto no tiene dependencias, así que tampoco tiene
// un analizador de terceros: esto busca, con reglas sencillas, los descuidos que un navegador
// solo delata cuando alguien pulsa justo ese botón.
//
//   1. Importar algo que el otro archivo no ofrece (la página entera deja de cargar).
//   2. Dar a una variable o a un parámetro el nombre de algo importado: lo importado deja de
//      existir en ese trozo. Así se rompió la subida del fondo en la 1.1: un campo llamado
//      `upload` tapaba la función `upload` y nadie lo vio hasta pulsarlo.
//   3. Que la interfaz pida al servidor una orden o una dirección que el servidor no tiene.
//
// Lo usa test/codigo.test.js, así que se comprueba con `npm test` antes de cada publicación.

// Quita comentarios y vacía textos y expresiones regulares, conservando el código que va dentro
// de `${…}` y las posiciones (cada carácter quitado se cambia por un espacio).
// keepStrings: deja los textos como están (para leer de dónde se importa y qué se pide).
export function strip(source, { keepStrings = false } = {}) {
  const out = [];
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');
  const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  const REGEX_WORDS = /(?:^|[^\w$.])(?:return|typeof|case|in|of|do|else|void|delete|throw|new|await|yield)$/;
  let last = ''; // último carácter con significado
  let i = 0;
  const n = source.length;

  function text(quote) {
    out.push(quote);
    i += 1;
    while (i < n && source[i] !== quote) {
      if (source[i] === '\\') { out.push(keepStrings ? source[i] : ' '); i += 1; }
      if (i < n) { out.push(keepStrings ? source[i] : blank(source[i])); i += 1; }
    }
    out.push(quote);
    i += 1;
    last = quote;
  }
  function template() {
    out.push('`');
    i += 1;
    while (i < n && source[i] !== '`') {
      if (source[i] === '\\') { out.push(keepStrings ? source[i] : ' '); i += 1; if (i < n) { out.push(keepStrings ? source[i] : blank(source[i])); i += 1; } continue; }
      if (source[i] === '$' && source[i + 1] === '{') {
        out.push('${');
        i += 2;
        code(true);
        out.push('}');
        i += 1;
        continue;
      }
      out.push(keepStrings ? source[i] : blank(source[i]));
      i += 1;
    }
    out.push('`');
    i += 1;
    last = '`';
  }
  function regex() {
    out.push('/');
    i += 1;
    let inClass = false;
    while (i < n && (source[i] !== '/' || inClass) && source[i] !== '\n') {
      if (source[i] === '\\') { out.push(' '); i += 1; }
      else if (source[i] === '[') inClass = true;
      else if (source[i] === ']') inClass = false;
      out.push(' ');
      i += 1;
    }
    out.push('/');
    i += 1;
    while (i < n && /[a-z]/.test(source[i])) { out.push(' '); i += 1; }
    last = '/';
  }
  // inTemplate: se está dentro de `${…}` y se sale al cerrar su llave.
  function code(inTemplate) {
    let depth = 0;
    while (i < n) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === '/' && next === '/') { while (i < n && source[i] !== '\n') { out.push(' '); i += 1; } continue; }
      if (ch === '/' && next === '*') {
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { out.push(blank(source[i])); i += 1; }
        out.push('  ');
        i += 2;
        continue;
      }
      if (ch === '\'' || ch === '"') { text(ch); continue; }
      if (ch === '`') { template(); continue; }
      if (ch === '/') {
        const before = out.join('').slice(-12).trimEnd();
        if (last === '' || REGEX_AFTER.has(last) || REGEX_WORDS.test(before)) { regex(); continue; }
      }
      if (inTemplate) {
        if (ch === '{') depth += 1;
        if (ch === '}') {
          if (depth === 0) return;
          depth -= 1;
        }
      }
      out.push(ch);
      if (!/\s/.test(ch)) last = ch;
      i += 1;
    }
  }
  code(false);
  return out.join('');
}

// Lo que un archivo importa: [{ from, names: [{ imported, local }], line }].
// imported: 'default', '*' o el nombre pedido. Los import() al vuelo no cuentan.
export function importsOf(source) {
  const kept = strip(source, { keepStrings: true });
  const found = [];
  const pattern = /(^|[\n;])\s*import\s+([^'"`;]*?)\s*from\s*['"]([^'"]+)['"]|(^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;
  for (const m of kept.matchAll(pattern)) {
    const line = kept.slice(0, m.index + m[0].indexOf('import')).split('\n').length;
    if (m[5]) { found.push({ from: m[5], names: [], line }); continue; }
    const names = [];
    let clause = m[2].trim();
    const braces = /\{([^}]*)\}/.exec(clause);
    if (braces) {
      for (const part of braces[1].split(',').map((p) => p.trim()).filter(Boolean)) {
        const [imported, local] = part.split(/\s+as\s+/).map((p) => p.trim());
        names.push({ imported, local: local || imported });
      }
      clause = clause.replace(braces[0], '');
    }
    for (const part of clause.split(',').map((p) => p.trim()).filter(Boolean)) {
      const star = /^\*\s+as\s+([\w$]+)$/.exec(part);
      names.push(star ? { imported: '*', local: star[1] } : { imported: 'default', local: part });
    }
    found.push({ from: m[3], names, line });
  }
  return found;
}

// Lo que un archivo ofrece a los demás. `all: true` si reexporta todo de otro (no se puede saber).
export function exportsOf(source) {
  const code = strip(source);
  const names = new Set();
  for (const m of code.matchAll(/\bexport\s+(?:async\s+)?function\s*\*?\s*([\w$]+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bexport\s+(?:const|let|var|class)\s+([\w$]+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',').map((p) => p.trim()).filter(Boolean)) names.add(part.split(/\s+as\s+/).pop().trim());
  }
  if (/\bexport\s+default\b/.test(code)) names.add('default');
  return { names, all: /\bexport\s*\*\s*from\b/.test(code) };
}

// Nombres que crea una lista de parámetros o un patrón: "a, { b, c: d } = {}, ...resto" -> a, b, d, resto.
export function bindingsOf(pattern) {
  const names = [];
  const clean = pattern.replace(/=\s*[^,{}[\]]*/g, ' '); // valores por defecto sencillos
  for (const m of clean.matchAll(/(?:([\w$]+)\s*:\s*)?(\.\.\.)?\s*([\w$]+)\s*(?=[,}\])]|$)/g)) names.push(m[3]);
  return names.filter((name) => !/^\d/.test(name));
}

const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'await', 'typeof', 'with']);

// Nombres que el archivo declara por su cuenta (variables, funciones, clases y parámetros),
// con la línea de cada uno: [{ name, line }]. No distingue ámbitos: basta para la regla 2.
export function declaredIn(source) {
  let code = strip(source);
  // Las líneas de import no son declaraciones propias.
  code = code.replace(/(^|[\n;])(\s*import\b[^;\n]*(?:\n[^;\n]*)*?;)/g, (all, start, statement) => start + statement.replace(/[^\n]/g, ' '));
  const found = [];
  const add = (name, index) => { if (name) found.push({ name, line: code.slice(0, index).split('\n').length }); };
  const each = (pattern, pick) => { for (const m of code.matchAll(pattern)) pick(m); };

  each(/\b(?:const|let|var)\s+([\w$]+)/g, (m) => add(m[1], m.index));
  each(/\b(?:const|let|var)\s+(\{[^=;]*?\}|\[[^=;]*?\])\s*=/g, (m) => bindingsOf(m[1].slice(1, -1)).forEach((name) => add(name, m.index)));
  each(/\b(?:for\s*\(\s*)?(?:const|let|var)\s+(\{[^=;]*?\}|\[[^=;]*?\])\s+(?:of|in)\b/g, (m) => bindingsOf(m[1].slice(1, -1)).forEach((name) => add(name, m.index)));
  each(/\bfunction\s*\*?\s*([\w$]+)\s*\(/g, (m) => add(m[1], m.index));
  each(/\bclass\s+([\w$]+)/g, (m) => add(m[1], m.index));
  each(/\bcatch\s*\(\s*([\w$]+)\s*\)/g, (m) => add(m[1], m.index));
  // Parámetros: function f(a, b), (a, b) =>, a =>, y los métodos abreviados nombre(a, b) {
  each(/\bfunction\s*\*?\s*[\w$]*\s*\(([^()]*)\)/g, (m) => bindingsOf(m[1]).forEach((name) => add(name, m.index)));
  each(/\(([^()]*)\)\s*=>/g, (m) => bindingsOf(m[1]).forEach((name) => add(name, m.index)));
  each(/(?:^|[^\w$.)\]])([\w$]+)\s*=>/g, (m) => add(m[1], m.index));
  each(/(?:^|[\s,{;])(?:async\s+)?([\w$]+)\s*\(([^()]*)\)\s*\{/g, (m) => { if (!NOT_METHODS.has(m[1])) bindingsOf(m[2]).forEach((name) => add(name, m.index)); });
  return found;
}

// Todos los .js de una carpeta, sin lo de terceros.
export function sourceFiles(dir, skip = ['vendor', 'node_modules']) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full, skip));
    else if (/\.m?js$/.test(entry.name)) files.push(full);
  }
  return files.sort();
}

// Reglas 1 y 2 sobre un conjunto de archivos. webRoot: carpeta a la que apuntan las rutas que
// empiezan por "/" (así importa la web). Devuelve una lista de textos, vacía si todo está bien.
export function checkModules(files, { root, webRoot = null }) {
  const problems = [];
  const cache = new Map();
  const read = (file) => {
    if (!cache.has(file)) cache.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
    return cache.get(file);
  };
  for (const file of files) {
    const source = read(file);
    const where = path.relative(root, file);
    const imported = new Map(); // nombre local -> de dónde viene
    for (const entry of importsOf(source)) {
      if (!/^[./]/.test(entry.from)) continue; // módulos de Node
      const target = entry.from.startsWith('/') ? (webRoot ? path.join(webRoot, entry.from) : null) : path.resolve(path.dirname(file), entry.from);
      if (!target) continue;
      const other = read(target);
      if (other === null) {
        problems.push(`${where}:${entry.line} importa "${entry.from}", que no existe.`);
        continue;
      }
      const offered = exportsOf(other);
      for (const { imported: name, local } of entry.names) {
        imported.set(local, entry.from);
        if (name !== '*' && !offered.all && !offered.names.has(name)) {
          problems.push(`${where}:${entry.line} importa "${name}" de "${entry.from}", que no lo ofrece.`);
        }
      }
    }
    for (const { name, line } of declaredIn(source)) {
      if (imported.has(name)) problems.push(`${where}:${line} declara "${name}", que tapa lo importado de "${imported.get(name)}". Ponle otro nombre.`);
    }
  }
  return [...new Set(problems)];
}

// Regla 3: lo que la interfaz pide y el servidor no tiene.
export function checkContract(webFiles, serverFiles, { root }) {
  const actions = new Set();
  const routes = [];
  const endpoints = []; // { method, path }: lo mismo que routes, con su método
  for (const file of serverFiles) {
    const kept = strip(fs.readFileSync(file, 'utf8'), { keepStrings: true });
    for (const m of kept.matchAll(/\.action\(\s*'([\w.]+)'/g)) actions.add(m[1]);
    for (const m of kept.matchAll(/\.route\(\s*'(GET|POST|PUT|DELETE)'\s*,\s*'([^']+)'/g)) {
      routes.push(m[2]);
      endpoints.push({ method: m[1], path: m[2] });
    }
  }
  const modules = new Set([...actions].map((name) => name.split('.')[0]));
  const asPattern = (route) => new RegExp(`^${route.split('/').map((part) => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`);
  const known = routes.map(asPattern);
  const problems = [];
  for (const file of webFiles) {
    const kept = strip(fs.readFileSync(file, 'utf8'), { keepStrings: true });
    const where = path.relative(root, file);
    const lineOf = (index) => kept.slice(0, index).split('\n').length;
    // Una orden es un texto "modulo.verbo" que se pasa a una función: a action(), o a una propia
    // que la envuelve (run('order.clear')). Se reconocen por el módulo, que es uno de los del servidor.
    for (const m of kept.matchAll(/\(\s*'([a-z]+)\.([\w]+)'/g)) {
      if (modules.has(m[1]) && !actions.has(`${m[1]}.${m[2]}`)) problems.push(`${where}:${lineOf(m.index)} envía la orden "${m[1]}.${m[2]}", que el servidor no tiene.`);
    }
    for (const m of kept.matchAll(/['"`](\/api\/[^'"`\s?]*)/g)) {
      // Lo variable (`${id}`) vale por cualquier tramo de la dirección.
      const asked = m[1].replace(/\$\{[^}]*\}/g, 'x').replace(/\/$/, '');
      if (!known.some((pattern) => pattern.test(asked))) problems.push(`${where}:${lineOf(m.index)} pide "${m[1]}", que el servidor no atiende.`);
    }
  }
  return { problems, actions, routes, endpoints, matches: (route, pathname) => asPattern(route).test(pathname) };
}
