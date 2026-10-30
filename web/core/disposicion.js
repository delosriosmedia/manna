// Qué pantalla le toca a cada dispositivo (decisión 71, DESIGN.md 12 ter, regla 12). Un móvil nunca ve la de computador.
// Se mira el lado corto de la ventana: girar el dispositivo no cambia de familia. Acostado, las barras del navegador se
// comen la altura: una tableta de 7 pulgadas deja unos 520 px y el teléfono más grande no pasa de unos 430.
export function layoutFor({ mobile, width, height }) {
  if (!mobile && width >= 860) return 'computador';
  if (height >= width) return width < 600 ? 'telefono-pie' : 'tableta-pie';
  return height < 480 ? 'telefono-acostado' : 'tableta-acostada';
}

// ¿Este dispositivo es móvil? El puntero principal es el dedo (lo que ya usa `html.touch`), un iPad aunque tenga teclado
// o ratón (se presenta como Mac con pantalla táctil) o un Android. El equipo principal es siempre computador, y un
// portátil táctil, también: su puntero principal es el ratón. `?tactil` lo fuerza en las pruebas.
export const isMobile = ({ main = false, forced = false, coarse = false, ipad = false, android = false }) => forced || (!main && (coarse || ipad || android));
