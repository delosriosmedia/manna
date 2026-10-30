import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { ORADOR_MODULES, PRESENTADOR_MODULES } from '../modules/registry.js';
import { createEnVivo } from '../modules/envivo/escena.js';

// Orador completo: una sola pantalla, sin escenario, porque ella misma muestra en grande lo que está en pantalla y
// lleva sus mandos.
const me = await ensureRole('presentador');

createShell({
  role: 'presentador',
  isLocal: me.isLocal,
  user: me.user,
  modules: PRESENTADOR_MODULES,
  layout: 'full',
  church: me.church,
  createLiveScene: (ctx) => createEnVivo(ctx, { variant: 'orador' }),
  liveModules: ORADOR_MODULES,
  liveDock: ['biblia', 'medios', 'textos'],
});
