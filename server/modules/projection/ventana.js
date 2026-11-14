import { secondScreen } from './display.js';

// Si Chrome se cae, se vuelve a abrir solo, hasta tres veces en 5 minutos: más sería un bucle.
const REOPENS = 3;
const REOPEN_WINDOW_MS = 5 * 60_000;

// La ventana de proyección del equipo principal: abierta solo si está encendida y hay segunda pantalla.
// Lo que toca el sistema (list: las pantallas; open(pantalla, alSalir): abrir Chrome) llega de fuera, para probarla.
export function createProjectorWindow({ list, open, isOn, turnOff, publish, windowless }) {
  let child = null;
  let closing = false;
  let place = null; // la pantalla en que está
  let running = null; // la consulta de pantallas en curso
  const crashes = [];

  function close() {
    if (!child) return;
    closing = true;
    child.kill();
    child = null;
  }

  function openOn(screen) {
    closing = false;
    place = screen;
    const mine = open(screen, (code, signal) => {
      if (child !== mine) return;
      child = null;
      if (closing) return;
      // Chrome salió bien: alguien la cerró a mano (Alt+F4, Cmd+Q) y se apaga, para no reabrirla sola. Sin código ni
      // señal, Chrome no se pudo abrir: reintentar no lo arreglaría. Con otra salida se cayó (la tarjeta gráfica, la
      // memoria, una actualización de Windows) y se vuelve a abrir enseguida (S5-08 de la auditoría integral).
      const crashed = (typeof code === 'number' && code !== 0) || Boolean(signal);
      const now = Date.now();
      while (crashes.length && crashes[0] < now - REOPEN_WINDOW_MS) crashes.shift();
      if (!crashed || crashes.length >= REOPENS) {
        turnOff();
        return;
      }
      crashes.push(now);
      publish({ open: false });
      reconcile();
    });
    child = mine;
  }

  // Una a la vez: la consulta se repite cada 5 s y puede tardar hasta 8 en un equipo cargado (N2-1-1).
  function reconcile() {
    running ||= check().finally(() => { running = null; });
    return running;
  }
  async function check() {
    const { supported, screens } = await list();
    // Una consulta que falló o se pasó de tiempo no dice que se haya quitado la pantalla: la ventana no se toca.
    if (!supported) {
      publish({ supported });
      return;
    }
    const target = windowless ? null : secondScreen(screens);
    const want = isOn() && Boolean(target);
    if (want && !child) openOn(target);
    else if (!want && child) close();
    publish({ supported, hasSecond: Boolean(target), open: Boolean(child) });
  }

  return { reconcile, close, isOpen: () => Boolean(child), place: () => place };
}
