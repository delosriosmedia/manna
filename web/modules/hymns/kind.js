import { guard, h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { clipControls, drawClip } from '../projection/clip.js';
import { drawPicture, pictureControls } from '../projection/picture.js';
import { allPagesButton, clipRow, goToStep, mando, stepCells } from '../projection/slot.js';
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
    const lyrics = h('button', { class: 'btn song-lyrics t2', 'aria-label': 'Letra', title: 'Letra', onclick: guard(() => openLyrics(number)) }, icon('rows', 16), h('span', { class: 'lbl' }, 'Letra'));
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

  // En la ranura de «En vivo»: el sonido, la letra y, debajo, lo de cualquier cosa que suena.
  slot(host, api) {
    let number = null;
    const tracks = TRACKS.map(([id, label]) => h('button', { class: 'ev-seg-btn', dataset: { track: id }, onclick: () => api.send({ track: id }) }, icon(id === 'vocal' ? 'music-notes' : 'waveform', 13), h('span', {}, label)));
    const clip = clipRow(api);
    host.replaceChildren(h('div', { class: 'ev-seg', role: 'group', 'aria-label': 'Sonido del himno' }, ...tracks),
      mando({ label: 'Letra', glyph: 'file-text', onclick: guard(() => openLyrics(number)) }), api.more(), clip.el || '');
    return {
      update(live, item) {
        number = item.number;
        const current = live?.track || item.track;
        for (const button of tracks) {
          const id = button.dataset.track;
          button.classList.toggle('on', id === current);
          button.setAttribute('aria-pressed', id === current);
          button.disabled = id === 'instrumental' && !item.instrumental;
          if (id === 'instrumental') button.lastChild.textContent = item.instrumental ? 'Pista' : 'Sin pista';
        }
        clip.update(live);
      },
      destroy: clip.destroy,
    };
  },
});

function lyricsStrip(host, now) {
  let item = null;
  const pages = (next) => next.thumbs.map((thumb, k) => ({ thumb, label: k === 0 ? 'Portada' : String(k) }));
  const cells = Array.from({ length: 3 }, (_, i) => {
    const picture = h('img', { alt: '' });
    const label = h('small', {});
    const el = h('button', { class: 'ev-tira-pic', onclick: () => item && goToStep(item, Number(el.dataset.k)) }, h('span', {}, picture), label);
    return { el, picture, label, i };
  });
  const all = allPagesButton({ now, pages });
  host.replaceChildren(h('div', { class: 'ev-tira' }, ...cells.map((c) => c.el), all.el));
  return {
    update(_, next) {
      item = next;
      all.update(next);
      const at = now(next);
      const list = pages(next);
      const from = Math.max(0, Math.min(at - 1, list.length - 3));
      for (const c of cells) {
        const k = from + c.i;
        c.el.classList.toggle('ev-off', k >= list.length);
        if (k >= list.length) continue;
        c.el.dataset.k = k;
        if (c.picture.getAttribute('src') !== list[k].thumb) c.picture.src = list[k].thumb;
        c.label.textContent = `${list[k].label}${k === at ? ' · al aire' : k === at + 1 ? ' · sigue' : ''}`;
        c.el.classList.toggle('on', k === at);
      }
    },
  };
}

// Tipo «Letra del himno» (Letras sin música): las diapositivas del himnario original, una por paso, como una
// imagen que se acerca y se desplaza. Se pasa a mano y no sale del himno: tras la última viene otra vez la portada
// (lo decide el servidor). Sus mandos: por cuál va, la que sigue y el encuadre.
registerKind('lyrics', {
  icon: 'images',
  label: 'Letra del himno',
  unit: ['diapositiva', 'diapositivas'],
  stepLabel: (_item, k) => (k === 0 ? 'Portada' : `Diapositiva ${k + 1}`),
  title: (item) => `${item.number} · ${item.title} · ${item.index} de ${item.pages}`,
  key: (item) => item.url,
  background: false,
  draw: (host, options) => drawPicture(host, { ...options, backdrop: true }),

  controls(host, tools) {
    const where = h('strong', {});
    const left = h('small', { class: 't3' });
    const picture = h('img', { alt: '' });
    const label = h('span', {});
    const next = h('div', { class: 'slide-next t3' }, h('span', { class: 'slide-next-thumb' }, picture), h('span', { class: 'slide-next-text' }, h('small', {}, 'Sigue'), label));
    const framing = h('div', { class: 'live-part slide-framing' });
    host.replaceChildren(h('div', { class: 'slide-info' }, h('div', { class: 'slide-count' }, where, left), next), framing);
    const view = pictureControls(framing, tools, { fits: false });
    return {
      update(state, item) {
        where.replaceChildren(...(item.index === 1 ? ['Portada', h('span', { class: 'lbl' }, ` · ${item.pages} en total`)] : [h('span', { class: 'lbl' }, 'Diapositiva '), `${item.index} de ${item.pages}`]));
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

  slot(host, api) {
    const now = (item) => item.index - 1;
    // En Alabanza, una tira con sus imágenes: la de antes, la que sale y las que siguen.
    if (api.seekHost) return lyricsStrip(host, now);
    const cells = stepCells(4, { total: (item) => item.pages, now, name: (k) => (k === 0 ? 'Portada' : String(k)) });
    const all = allPagesButton({ now, pages: (item) => item.thumbs.map((thumb, k) => ({ thumb, label: k === 0 ? 'Portada' : String(k) })) });
    host.replaceChildren(...cells.els, api.tool('point'), api.tool('move'), all.el, api.more());
    return { update(_, item) { cells.update(item); all.update(item); } };
  },
});

