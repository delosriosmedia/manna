import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { MODULES } from '../modules/registry.js';
import { createEscenario } from '../modules/projection/escenario.js';
import { createEnVivo } from '../modules/envivo/escena.js';
import { connectionTools } from '../modules/system/conexion.js';

// Control total: todos los módulos. Arriba, el wifi (conexión por internet) y el QR (dispositivos).
const me = await ensureRole('control');

createShell({
  role: 'control',
  isLocal: me.isLocal,
  user: me.user,
  modules: MODULES,
  church: me.church,
  createScene: createEscenario,
  createLiveScene: createEnVivo,
  topTools: [connectionTools(me)],
});
