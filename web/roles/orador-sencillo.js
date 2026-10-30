import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { ORADOR_MODULES, PRESENTADOR_MODULES } from '../modules/registry.js';
import { createEnVivo } from '../modules/envivo/escena.js';

// Orador sencillo: los mismos permisos que el completo. En el computador usa la misma pantalla; en un móvil, su control de bolsillo.
const me = await ensureRole('orador-sencillo');

createShell({
  role: 'orador-sencillo',
  isLocal: me.isLocal,
  user: me.user,
  modules: PRESENTADOR_MODULES,
  layout: 'full',
  church: me.church,
  createLiveScene: (ctx) => createEnVivo(ctx, { variant: 'sencillo' }),
  liveModules: ORADOR_MODULES,
  liveDock: ['biblia', 'medios', 'textos'],
});
