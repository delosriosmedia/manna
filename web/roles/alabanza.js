import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { ALABANZA_MODULES } from '../modules/registry.js';
import { createEscenario } from '../modules/projection/escenario.js';

// Servicio de alabanza: centrado en himnos, videos y orden del culto, con volumen permanente.
const me = await ensureRole('alabanza');

createShell({
  role: 'alabanza',
  isLocal: me.isLocal,
  user: me.user,
  modules: ALABANZA_MODULES,
  createScene: createEscenario,
});
