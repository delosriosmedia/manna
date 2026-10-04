// Demostración: arranca Manna con un orden del culto de ejemplo y datos temporales, sin tocar
// los reales. Sirve para enseñar o revisar la interfaz.
//
// Uso:  node scripts/demo.mjs
// Luego abre  http://localhost:8123/control       la app
//             http://localhost:8123/vista-previa  la app en el marco de un celular o una tableta
import os from 'node:os';
import path from 'node:path';
import { seedExample } from './lib/ejemplo.mjs';

const data = path.join(os.tmpdir(), 'manna-demo');
seedExample(data);
Object.assign(process.env, { MANNA_DATA: data, MANNA_NAME: 'manna-demo', MANNA_NO_OPEN: '1', PORT: process.env.PORT || '8123' });
await import('../server/index.js');
