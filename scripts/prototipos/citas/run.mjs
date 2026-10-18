// Prototipo del detector de citas (bandeja de ideas, I1 e I2; docs/ideas.md). Uso, desde la raíz:
//   node scripts/prototipos/citas/run.mjs scripts/prototipos/citas/casos.json      (casos con lo esperado)
//   node scripts/prototipos/citas/run.mjs scripts/prototipos/citas/bosquejo1.txt   (un texto: seguras, a revisar y descartadas)
// Valida contra las biblias de Contenido/Biblias (el mayor número de versículos de las instaladas).
import fs from 'node:fs';
import { CANON } from '../../../server/modules/bible/canon.js';
import { createDetector, label } from './detector.mjs';
import { loadBibles } from './biblias.mjs';
// Las versiones no cuentan igual los versículos (2 Co 13: 13 en la 1909, 14 en la 1960): vale el mayor de las instaladas.
const detect = createDetector(loadBibles());
const names = CANON.map((b) => b.name);
const file = process.argv[2];
if (file.endsWith('.json')) {
  const cases = JSON.parse(fs.readFileSync(file, 'utf8'));
  let ok = 0;
  for (const c of cases) {
    const { found } = detect(c.text);
    const got = found.map((f) => f.refs.map((r) => label(r, names)).join(' + ') + (f.confidence === 'revisar' ? ' (revisar)' : ''));
    const pass = JSON.stringify(got) === JSON.stringify(c.expect);
    if (pass) ok += 1;
    else console.log(`✖ ${c.text}\n    esperado: ${JSON.stringify(c.expect)}\n    salió:    ${JSON.stringify(got)}`);
  }
  console.log(`${ok} de ${cases.length} casos bien`);
} else {
  const { found, dropped } = detect(fs.readFileSync(file, 'utf8'));
  for (const f of found) console.log(`${f.confidence === 'segura' ? '✔' : '?'} l.${f.line} «${f.source}» → ${f.refs.map((r) => label(r, names)).join(' + ')}${f.reasons.length ? `  [${f.reasons.join('; ')}]` : ''}`);
  for (const d of dropped) console.log(`· descartada «${d.source}»: ${d.why}`);
  console.log(`${found.filter((f) => f.confidence === 'segura').length} seguras, ${found.filter((f) => f.confidence === 'revisar').length} a revisar, ${dropped.length} descartadas`);
}
