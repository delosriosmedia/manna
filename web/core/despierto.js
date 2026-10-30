import { h } from './dom.js';

// La pantalla de un celular no se apaga a mitad de un culto (decisión 69). Los celulares entran por http, donde el navegador
// no da Wake Lock: lo que la mantiene encendida es un video mudo en bucle, muy pequeño y sin que se vea. Donde sí hay Wake
// Lock (por https), se pide también. Un navegador puede pedir que antes se toque la página: se reintenta al tocarla.
export function keepAwake() {
  const video = h('video', { class: 'keep-awake', src: '/core/despierto.mp4', loop: true, tabIndex: -1, 'aria-hidden': 'true' });
  video.muted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  document.body.append(video);
  const hold = () => {
    if (document.visibilityState !== 'visible') return;
    video.play().catch(() => { /* espera a que se toque la página */ });
    navigator.wakeLock?.request('screen').catch(() => { /* por http no lo da */ });
  };
  hold();
  document.addEventListener('visibilitychange', hold);
  document.addEventListener('pointerdown', () => { if (video.paused) hold(); });
}
