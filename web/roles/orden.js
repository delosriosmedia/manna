import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { ORDER_ONLY } from '../modules/registry.js';
import { createDock } from '../modules/projection/dock.js';

// Control del orden: pensado para el celular. Solo proyecta lo que ya está en el orden del culto.
const me = await ensureRole('orden');

createShell({ role: 'orden', isLocal: me.isLocal, modules: ORDER_ONLY, createDock });
