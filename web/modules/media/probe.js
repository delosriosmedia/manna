import { connectionIsLocal, connectionRole, state, subscribe } from '../../core/api.js';

// ¿Puede este equipo reproducir un video tal cual, sin esperar a su conversión?
//
// Lo comprueban las pantallas del equipo principal (su proyección y su control) con cada video
// que hay que convertir: lo cargan a escondidas, lo dejan correr un momento y miran si la imagen
// avanza sin perder cuadros. Se lo dicen al servidor, y desde entonces ese video se puede proyectar
// ya, con el archivo original, en las pantallas de ese equipo. Lo que diga la pantalla de
// proyección manda sobre lo que diga el control: es la que ve el público.
const LOAD_MS = 10_000;
const PLAY_MS = 1500;

// true si el navegador reproduce `url` con soltura; false si no puede o va a trompicones.
export async function canPlay(url) {
  const video = document.createElement('video');
  // Tiene que estar en la página y "a la vista" para que el navegador lo reproduzca de verdad.
  video.style.cssText = 'position: fixed; left: 0; top: 0; width: 2px; height: 2px; opacity: 0; pointer-events: none;';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  document.body.append(video);
  const wait = (events, ms) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve('tiempo'), ms);
    for (const name of events) video.addEventListener(name, () => { clearTimeout(timer); resolve(name); }, { once: true });
  });
  try {
    video.src = url;
    if (await wait(['loadeddata', 'error'], LOAD_MS) !== 'loadeddata' || !video.videoWidth) return false;
    try { await video.play(); } catch { return false; }
    await new Promise((resolve) => { setTimeout(resolve, PLAY_MS); });
    const quality = video.getVideoPlaybackQuality?.();
    const frames = quality?.totalVideoFrames ?? 0;
    const dropped = quality?.droppedVideoFrames ?? 0;
    // Avanzó de verdad y mostró casi todos los cuadros.
    return video.currentTime > PLAY_MS / 1000 * 0.5 && frames > 5 && dropped / frames < 0.25;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}

let started = false;
// Deja a esta página pendiente de los videos por comprobar. Solo hace algo en el equipo principal.
export function watchOriginals() {
  if (started) return;
  started = true;
  const done = new Set(); // lo ya comprobado en esta página
  let busy = false;

  async function next() {
    if (busy || !connectionIsLocal() || document.visibilityState !== 'visible') return;
    const mine = connectionRole() === 'proyeccion' ? 'proyeccion' : 'control';
    // Lo que nadie ha comprobado, o lo que comprobó el control y ahora puede comprobar la proyección.
    const pending = (state.media?.videos || []).find((clip) => clip.original && !done.has(clip.id)
      && (clip.original.playable == null || (mine === 'proyeccion' && clip.original.by !== 'proyeccion')));
    if (!pending) return;
    busy = true;
    done.add(pending.id);
    try {
      const ok = await canPlay(pending.original.url);
      await fetch(`/api/media/clips/${pending.id}/original`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok, by: mine }) });
    } catch { /* se quedará sin comprobar: se esperará a la conversión, como siempre */ }
    busy = false;
    next();
  }
  subscribe('media', next);
  // Una pestaña en segundo plano no reproduce: se comprueba al volver a ella.
  document.addEventListener('visibilitychange', next);
}
