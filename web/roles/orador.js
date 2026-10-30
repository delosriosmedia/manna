import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { PRESENTADOR_MODULES } from '../modules/registry.js';

// Orador completo: una sola pantalla, sin escenario, porque ella misma muestra en grande lo que está en pantalla y
// lleva sus mandos.
const me = await ensureRole('presentador');

createShell({
  role: 'presentador',
  isLocal: me.isLocal,
  user: me.user,
  modules: PRESENTADOR_MODULES,
  layout: 'full',
});
