import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { PREPARACION_MODULES } from '../modules/registry.js';
import { createPreview } from '../modules/projection/preview.js';

// Preparar el culto (en la nube, fase 36): los órdenes, con la Biblia, el himnario, los medios y los textos, en cinco
// pestañas y sin proyección. Lo que suena se escucha solo en este dispositivo.
const me = await ensureRole('preparacion');

createShell({
  role: 'preparacion',
  isLocal: me.isLocal,
  user: me.user,
  modules: PREPARACION_MODULES,
  layout: 'pestanas',
  createScene: () => ({ preview: createPreview() }),
});
