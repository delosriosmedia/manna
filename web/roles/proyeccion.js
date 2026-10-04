import { connect, session, subscribe } from '../core/api.js';
import { $ } from '../core/dom.js';
import { createStage } from '../modules/projection/stage.js';
import { preferStableAddress } from '../core/upgrade.js';

// Pantalla de proyección: solo muestra. La usan la ventana de la segunda pantalla
// y cualquier dispositivo que elija esta función.
const me = await session.get().catch(() => null);
// Una sola salida de sonido: suena la pantalla de proyección del equipo principal.
// Las demás reproducen en silencio, para que no haya eco ni desfases.
const stage = createStage($('#stage'), { sound: Boolean(me?.isLocal) });
subscribe('projection', (p) => stage.render(p));
subscribe('live', (live) => stage.setLive(live));
connect('proyeccion');
// Una pantalla remota que entró por la IP pasa a la dirección con nombre si puede.
if (me) preferStableAddress(me);

const toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};
document.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

// Mantiene la pantalla encendida en celulares y tabletas (si el navegador lo permite).
const keepAwake = () => navigator.wakeLock?.request('screen').catch(() => {});
keepAwake();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake();
});

const hint = $('#hint');
// En la ventana de kiosco ya está a pantalla completa: no hace falta la pista.
if (window.innerHeight >= screen.height - 2) hint.remove();
else setTimeout(() => { hint.style.opacity = 0; }, 5000);
