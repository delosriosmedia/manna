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
