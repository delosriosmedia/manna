import { connectionIsLocal } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { clipControls, drawClip } from '../projection/clip.js';
import { watchOriginals } from './probe.js';

// Tipos de contenido "video", "youtube" y "audio". Se reproducen con las piezas comunes de lo que
// suena (projection/clip.js); aquí va lo propio de Medios: qué archivo usa cada pantalla, la
// imagen del video y sus subtítulos.

// Qué archivos puede reproducir esta pantalla, del preferido al de reserva. Las del equipo
// principal usan el original cuando su navegador puede con él (`local`): sin esperar a la
// conversión y sin perder calidad. Las demás, la copia que reproduce cualquiera (`url`), que puede
// no estar lista todavía. Si el original falla aquí, se pasa a la copia.
const sources = (item) => [connectionIsLocal() && item.local, item.url];

// Un video: de la biblioteca o de YouTube. Se reproducen igual; cambian el icono y el nombre.
const video = {
  icon: 'video',
  label: 'Video',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.id || item.title,
  background: false,
  draw(host) {
    const poster = h('img', { class: 'clip-poster', alt: '', hidden: true });
    return drawClip(host, {
      sources,
      build: () => [poster],
      make: () => h('video', { class: 'clip-video' }),
      onItem(item, media) {
        poster.hidden = !item.poster;
        if (item.poster && poster.getAttribute('src') !== item.poster) poster.src = item.poster;
        // Una pista por cada subtítulo que tenga, en su orden.
        const wanted = (item.subtitles || []).map((track) => track.url).join();
        if (media.dataset.tracks === wanted) return;
        media.dataset.tracks = wanted;
        media.replaceChildren(...(item.subtitles || []).map((track) => h('track', { kind: 'subtitles', srclang: track.lang === 'sub' ? 'es' : track.lang, label: track.label, src: track.url })));
      },
    });
  },
  controls: clipControls,
};
registerKind('video', video);
registerKind('youtube', { ...video, icon: 'youtube-logo', label: 'YouTube' });

registerKind('audio', {
  icon: 'waveform',
  label: 'Audio',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.id || item.title,
  // Se ve el fondo de la proyección, con el nombre de lo que suena.
  draw(host) {
    const title = h('div', { class: 'stage-ref' });
    return drawClip(host, {
      sources,
      build: () => [h('div', { class: 'stage-inner clip-audio' }, icon('waveform', 64), title)],
      make: () => h('audio', {}),
      onItem(item) { title.textContent = item.title; },
    });
  },
  controls: clipControls,
});

// Las pantallas del equipo principal comprueban qué videos pueden reproducir sin convertir.
watchOriginals();
