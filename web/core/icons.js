// Iconos de la interfaz: una sola familia (Phosphor, trazo regular), sin emojis.
// Los disponibles están en web/vendor/phosphor/sprite.svg; para añadir uno,
// ver scripts/actualizar-iconos.mjs.
const SVG = 'http://www.w3.org/2000/svg';

export function icon(name, size = 18) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `/vendor/phosphor/sprite.svg#${name}`);
  svg.append(use);
  return svg;
}

// Icono y nombre de cada tipo de elemento del orden del culto.
// Un módulo nuevo añade aquí el suyo (y su color en .kind.k-<tipo> de core/app.css).
export const KINDS = {
  verses: { icon: 'book-open-text', label: 'Biblia', unit: ['versículo', 'versículos'] },
  song: { icon: 'music-notes', label: 'Himno', unit: ['estrofa', 'estrofas'] },
  image: { icon: 'image', label: 'Imagen', unit: ['imagen', 'imágenes'] },
  video: { icon: 'video', label: 'Video', unit: null },
  slides: { icon: 'presentation-chart', label: 'Diapositivas', unit: ['diapositiva', 'diapositivas'] },
};

export function kindBadge(kind) {
  const el = document.createElement('span');
  el.className = `kind k-${kind}`;
  el.append(icon(KINDS[kind]?.icon || 'rows', 16));
  return el;
}
