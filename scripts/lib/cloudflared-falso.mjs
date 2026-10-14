import fs from 'node:fs';
import path from 'node:path';

// Un cloudflared de mentira, para probar la conexión por internet sin salir a internet. Escribe lo
// mismo que el de verdad en lo que Manna lee (la dirección del túnel rápido y «Registered tunnel
// connection») y se queda abierto. Con una clave que empieza por «malo», falla como una clave no válida.
// En `log` apunta con qué argumentos se abrió y si recibió una clave (nunca la clave).
export function writeFakeCloudflared(dir, { log = null } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'cloudflared');
  fs.writeFileSync(file, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('cloudflared version 2099.1.0 (built 2099-01-01)'); process.exit(0); }
const token = process.env.TUNNEL_TOKEN || '';
${log ? `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, token: Boolean(token) }) + '\\n');` : ''}
const say = (line) => fs.writeSync(2, line + '\\n');
say('INF Starting tunnel');
if (token.startsWith('malo')) { say('ERR Couldn\\'t start tunnel error="Unauthorized: Invalid tunnel secret"'); process.exit(1); }
if (args.includes('--url')) say('INF |  https://manna-de-prueba.trycloudflare.com  |');
setTimeout(() => say('INF Registered tunnel connection connIndex=0 location=prueba'), 100);
setInterval(() => {}, 1000);
`);
  fs.chmodSync(file, 0o755);
  return file;
}
