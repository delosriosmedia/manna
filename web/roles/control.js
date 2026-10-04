import { ensureRole } from '../core/session.js';
import { guard } from '../core/dom.js';
import { createShell } from '../core/shell.js';
import { MODULES } from '../modules/registry.js';
import { createDock } from '../modules/projection/dock.js';
import { openDevicesDialog } from '../modules/system/devices.js';

// Control completo: todos los módulos.
const me = await ensureRole('control');

createShell({
  role: 'control',
  isLocal: me.isLocal,
  modules: MODULES,
  createDock,
  extras: [{ id: 'dispositivos', name: 'Dispositivos', icon: 'devices', onclick: guard(() => openDevicesDialog(me.isLocal)) }],
});
