import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { registerKind } from '../../core/kinds.js';
import { drawPicture, pictureControls } from '../projection/picture.js';

// Tipo de contenido "imagen": ocupa la pantalla entera, completa (con bandas negras) o llenándola,
// y mientras está al aire se puede acercar y desplazar. El dibujo y los mandos del encuadre son
// los de cualquier cosa que se proyecta como imagen (projection/picture.js).
registerKind('image', {
  icon: 'image',
  label: 'Imagen',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.url,
  background: false,
  draw: drawPicture,
  controls: pictureControls,
});

// Un video de YouTube añadido por su enlace desde la nube (fase 36): solo se ve en el orden hasta que lo descargue la
// iglesia; no se proyecta (el servidor lo dice con `unavailable`). Su miniatura lo explica.
registerKind('ytlink', {
  icon: 'youtube-logo',
  label: 'YouTube',
  unit: null,
  title: (item) => item.title,
  key: (item) => item.videoId,
  background: false,
  draw(host) {
    const note = h('p', {});
    host.replaceChildren(h('div', { class: 'ytlink' }, icon('youtube-logo', 40), note));
    return { update(item) { note.textContent = item.unavailable || item.title || ''; } };
  },
});
