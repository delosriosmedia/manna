import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectorWindow } from '../server/modules/projection/ventana.js';

// La ventana de proyección del equipo principal, con pantallas y un Chrome de mentira (auditoría integral, S5-08 y
// N2-1-1). Antes, una caída de Chrome contaba como «cerrada a mano» y dejaba el escritorio en el proyector, y una
// consulta de pantallas lenta o fallida la cerraba.
const SCREENS = [{ primary: true, x: 0, y: 0, width: 1920, height: 1080 }, { primary: false, x: 1920, y: 0, width: 1920, height: 1080 }];

function setup({ listing = async () => ({ supported: true, screens: SCREENS }) } = {}) {
  const state = { on: true, opened: 0, display: {} };
  let exit = null;
  const projector = createProjectorWindow({
    list: () => listing(),
    windowless: false,
    open: (screen, onExit) => { state.opened += 1; exit = onExit; return { kill() {} }; },
    isOn: () => state.on,
    turnOff: () => { state.on = false; },
    publish: (next) => { Object.assign(state.display, next); },
  });
  return { state, projector, close: (...args) => exit(...args) };
}

test('cerrada a mano (Chrome sale bien) se apaga y no se reabre', async () => {
  const { state, projector, close } = setup();
  await projector.reconcile();
  assert.equal(state.opened, 1);
  close(0, null);
  await projector.reconcile();
  assert.equal(state.on, false, 'queda apagada');
  assert.equal(state.opened, 1, 'no se reabre sola');
});

test('si Chrome se cae, se vuelve a abrir; tras tres caídas en 5 minutos, se deja', async () => {
  const { state, projector, close } = setup();
  await projector.reconcile();
  close(1, null);
  await projector.reconcile();
  assert.equal(state.on, true, 'una caída no la apaga');
  assert.equal(state.opened, 2, 'se reabre');
  close(null, 'SIGSEGV');
  await projector.reconcile();
  close(3221225477, null); // así sale en Windows una violación de acceso
  await projector.reconcile();
  assert.equal(state.opened, 4, 'tres caídas, tres reaperturas');
  close(1, null);
  await projector.reconcile();
  assert.equal(state.on, false, 'la cuarta en 5 minutos la apaga, para no quedar en un bucle');
  assert.equal(state.opened, 4);
});

test('una consulta de pantallas fallida o lenta no cierra la ventana', async () => {
  let supported = true;
  const { state, projector } = setup({ listing: async () => (supported ? { supported, screens: SCREENS } : { supported, screens: [] }) });
  await projector.reconcile();
  supported = false;
  await projector.reconcile();
  assert.equal(projector.isOpen(), true, 'sigue abierta');
  assert.equal(state.display.supported, false, 'y se dice que no se pudo consultar');
});

// La consulta se repite cada 5 s y puede tardar hasta 8 (PowerShell, en un equipo cargado): no se amontonan.
test('mientras una consulta de pantallas sigue, no se lanza otra', async () => {
  let release;
  let asked = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const { state, projector } = setup({ listing: async () => { asked += 1; await gate; return { supported: true, screens: SCREENS }; } });
  const both = Promise.all([projector.reconcile(), projector.reconcile()]);
  release();
  await both;
  assert.equal(asked, 1, 'una sola consulta');
  assert.equal(state.opened, 1);
});
