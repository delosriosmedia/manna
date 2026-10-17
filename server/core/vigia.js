import { spawn } from 'node:child_process';

// Vigilante de un programa externo (spawn con `tied` en core/tools.js): lo abre y lo cierra en cuanto se
// corta su entrada, una tubería desde Manna. La tubería se cierra sola cuando Manna deja de existir, de
// cualquier forma (Apagar, un cuelgue, el Administrador de tareas), así que el programa no se queda suelto.
const [file, ...args] = process.argv.slice(2);
const child = spawn(file, args, { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
const end = () => child.kill();
process.stdin.on('end', end).on('close', end).on('error', end).resume();
process.on('SIGTERM', end);
child.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
