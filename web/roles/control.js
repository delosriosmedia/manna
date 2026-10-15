import { action, state } from '../core/api.js';
import { ensureRole } from '../core/session.js';
import { guard, toast } from '../core/dom.js';
import { createShell } from '../core/shell.js';
import { MODULES } from '../modules/registry.js';
import { createEscenario } from '../modules/projection/escenario.js';
import { openDevicesDialog } from '../modules/system/devices.js';

// Control completo: todos los módulos.
const me = await ensureRole('control');

createShell({
  role: 'control',
  isLocal: me.isLocal,
  modules: MODULES,
  createScene: createEscenario,
  extras: [
    { id: 'dispositivos', name: 'Dispositivos', icon: 'devices', onclick: guard(() => openDevicesDialog(me.isLocal)) },
    // Encender o apagar la conexión por internet (Cloudflare) sin ir a Ajustes. No se ofrece a quien entra por
    // internet: apagarla le cortaría a él mismo.
    !me.internet && { id: 'internet', name: 'Conexión por internet', icon: 'globe',
      note: () => ({ off: 'Apagada · tocar para encender', starting: 'Conectando… · tocar para apagar', on: 'Encendida · tocar para apagar' })[state.internet?.status] || 'Con un problema · tocar para apagar',
      onclick: guard(async () => {
        const on = !state.internet?.on;
        await action('internet.set', { on });
        toast(on ? 'Conectando por internet…' : 'Conexión por internet apagada.');
      }) },
  ].filter(Boolean),
});
