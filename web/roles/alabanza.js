import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { ALABANZA_MODULES } from '../modules/registry.js';
import { createDock } from '../modules/projection/dock.js';

// Servicio de alabanza: centrado en himnos, videos y orden del culto, con volumen permanente.
const me = await ensureRole('alabanza');

createShell({
  role: 'alabanza',
  isLocal: me.isLocal,
  modules: ALABANZA_MODULES,
  createDock,
});
