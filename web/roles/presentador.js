import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { PRESENTADOR_MODULES } from '../modules/registry.js';
import { toggleMode } from '../modules/projection/controls.js';

// Presentador de diapositivas: una sola pantalla, sin panel «Al aire», porque ella misma muestra en
// grande lo que está en pantalla y lleva sus mandos.
const me = await ensureRole('presentador');

document.body.classList.add('no-dock');
createShell({
  role: 'presentador',
  isLocal: me.isLocal,
  modules: PRESENTADOR_MODULES,
  createDock: () => ({ toggleMode, setPreview() {} }),
});
