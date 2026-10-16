import { guard, h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { clipControls, drawClip } from '../projection/clip.js';
import { drawPicture, pictureControls } from '../projection/picture.js';
import { openLyrics } from './lyrics.js';

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

  // Lo que se oye: cantado (el video) o la pista, según el mando.

  controls(host, tools) {
    const buttons = TRACKS.map(([id, label]) => h('button', { class: 'btn grow', dataset: { track: id }, onclick: () => tools.send({ track: id }) }, label));
    let number = null;
    // La letra entera, para leerla en este dispositivo (lo pidió el dueño para Alabanza).
    const lyrics = h('button', { class: 'btn song-lyrics', onclick: guard(() => openLyrics(number)) }, icon('rows', 16), 'Letra');
    const row = h('div', { class: 'transport song-tracks', role: 'group', 'aria-label': 'Sonido del himno' }, ...buttons, lyrics);
    // Debajo, los mandos de cualquier cosa que suena.
    const rest = h('div', { class: 'live-part' });
    host.replaceChildren(row, rest);
    const clip = clipControls(rest, tools);
    return {
      update(live, item) {
        number = item.number;
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

// Tipo «Letra del himno» (Letras sin música): las diapositivas del himnario original, una por paso, como una
// imagen que se acerca y se desplaza. Se pasa a mano y no sale del himno: tras la última viene otra vez la portada
// (lo decide el servidor). Sus mandos: por cuál va, la que sigue y el encuadre.
registerKind('lyrics', {
  icon: 'images',
  label: 'Letra del himno',
  unit: ['diapositiva', 'diapositivas'],
  title: (item) => `${item.number} · ${item.title} · ${item.index} de ${item.pages}`,
  key: (item) => item.url,
  background: false,
  draw: drawPicture,

  controls(host, tools) {
    const where = h('strong', {});
    const left = h('small', {});
    const picture = h('img', { alt: '' });
    const label = h('span', {});
    const next = h('div', { class: 'slide-next' }, h('span', { class: 'slide-next-thumb' }, picture), h('span', { class: 'slide-next-text' }, h('small', {}, 'Sigue'), label));
    const framing = h('div', { class: 'live-part slide-framing' });
    host.replaceChildren(h('div', { class: 'slide-info' }, h('div', { class: 'slide-count' }, where, left), next), framing);
    const view = pictureControls(framing, tools, { fits: false });
    return {
      update(state, item) {
        where.textContent = item.index === 1 ? `Portada · ${item.pages} en total` : `Diapositiva ${item.index} de ${item.pages}`;
        left.textContent = item.index === item.pages ? 'Es la última' : `Quedan ${item.pages - item.index}`;
        next.classList.toggle('none', !item.next);
        if (item.next) {
          if (picture.getAttribute('src') !== item.next.thumb) picture.src = item.next.thumb;
          label.textContent = item.next.index === 1 ? 'La portada, otra vez' : `Diapositiva ${item.next.index}`;
        }
        view.update(state, item);
      },
      destroy: () => view.destroy(),
    };
  },
});

