import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { PRESENTADOR_MODULES } from '../modules/registry.js';

// Presentador de diapositivas: una sola pantalla, sin escenario, porque ella misma muestra en grande
// lo que está en pantalla y lleva sus mandos.
const me = await ensureRole('presentador');

createShell({
  role: 'presentador',
  isLocal: me.isLocal,
  modules: PRESENTADOR_MODULES,
  layout: 'full',
});
