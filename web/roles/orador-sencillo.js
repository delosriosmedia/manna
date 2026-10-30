import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { PRESENTADOR_MODULES } from '../modules/registry.js';

// Orador sencillo: los mismos permisos que el completo. Hasta su pantalla (fase 47), usa la misma.
const me = await ensureRole('orador-sencillo');

createShell({
  role: 'orador-sencillo',
  isLocal: me.isLocal,
  user: me.user,
  modules: PRESENTADOR_MODULES,
  layout: 'full',
});
