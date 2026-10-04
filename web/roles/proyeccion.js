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
// Un televisor no tiene doble clic ni tecla F: en su navegador, el botón OK del control (o un toque
// del puntero) pone la pantalla completa. Solo entra, nunca sale: si llegan dos pulsaciones
// seguidas no se deshace. Para salir está el botón "Atrás" del televisor.
const isTv = /smart-?tv|tizen|web0s|webos|hbbtv|netcast|viera|bravia/i.test(navigator.userAgent);
const enterFullscreen = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
};
document.addEventListener('dblclick', toggleFullscreen);
if (isTv) document.addEventListener('click', enterFullscreen);
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  else if (e.key === 'Enter') enterFullscreen();
});

// Mantiene la pantalla encendida en celulares y tabletas (si el navegador lo permite).
const keepAwake = () => navigator.wakeLock?.request('screen').catch(() => {});
keepAwake();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake();
});

const hint = $('#hint');
if (isTv) hint.textContent = 'Pulsa OK en el control para pantalla completa';
// En la ventana de kiosco ya está a pantalla completa: no hace falta la pista.
if (window.innerHeight >= screen.height - 2) hint.remove();
else setTimeout(() => { hint.style.opacity = 0; }, 5000);
