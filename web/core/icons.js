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
