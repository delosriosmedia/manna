import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { clipControls, drawClip } from '../projection/clip.js';

// Tipo de contenido "himno": el video del himno, con el sonido cantado o con la pista
// instrumental. Se reproduce con las piezas comunes de lo que suena (projection/clip.js); lo
// propio es elegir entre los dos sonidos, también mientras está al aire.
export const TRACKS = [['vocal', 'Cantado'], ['instrumental', 'Pista']];
export const trackName = (track) => (track === 'instrumental' ? 'Pista' : 'Cantado');

registerKind('song', {
  icon: 'music-notes',
  label: 'Himno',
  unit: null,
  title: (item) => `${item.number} · ${item.title}`,
  key: (item) => `himno ${item.number}`,
  background: false,

  draw(host) {
    const number = h('div', { class: 'song-number' });
    const title = h('div', { class: 'stage-ref' });
    const track = h('div', { class: 'song-track' });
    return drawClip(host, {
      // El archivo depende del sonido elegido: el video tal cual (cantado) o su copia con la pista.
      sources: (item, live) => [(live?.track || item.track) === 'instrumental' ? item.instrumental : item.url],
      // Fuera del aire (vista previa, miniatura) se ve una ficha con el número y el título.
      build: () => [h('div', { class: 'stage-inner song-card' }, icon('music-notes', 64), number, title, track)],
      make: () => h('video', { class: 'clip-video' }),
      onItem(item) {
        number.textContent = item.number;
        title.textContent = item.title;
        track.textContent = trackName(item.track);
      },
    });
  },

  controls(host, tools) {
    const buttons = TRACKS.map(([id, label]) => h('button', { class: 'btn grow', dataset: { track: id }, onclick: () => tools.send({ track: id }) }, label));
    const row = h('div', { class: 'transport song-tracks', role: 'group', 'aria-label': 'Sonido del himno' }, ...buttons);
    // Debajo, los mandos de cualquier cosa que suena.
    const rest = h('div', { class: 'live-part' });
    host.replaceChildren(row, rest);
    const clip = clipControls(rest, tools);
    return {
      update(live, item) {
        const current = live?.track || item.track;
        for (const button of buttons) {
          const id = button.dataset.track;
          button.classList.toggle('on', id === current);
          button.setAttribute('aria-pressed', id === current);
          button.disabled = id === 'instrumental' && !item.instrumental;
          button.title = button.disabled ? 'Este himno no tiene pista instrumental disponible en este equipo' : '';
        }
        clip.update(live, item);
      },
      destroy: () => clip.destroy(),
    };
  },
});
