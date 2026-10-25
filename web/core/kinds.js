// Tipos de contenido en la interfaz: cómo se llama, se reconoce, se dibuja y se gobierna cada uno.
// Cada módulo registra el suyo (web/modules/<id>/kind.js, listados en web/modules/kinds.js):
//
//   registerKind('image', {
//     icon, label,            icono y nombre en el orden del culto
//     unit,                   ['diapositiva', 'diapositivas'], o null si no tiene pasos que contar
//     wholeUpTo,              hasta cuántos pasos se ofrece además proyectarlo entero ("Todo junto")
//     title(item),            texto de una línea para el estado de lo que está al aire
//     key(item),              identidad de lo dibujado: si no cambia, es lo mismo en pantalla
//     background,             false si ocupa toda la pantalla (imagen, video); por defecto se dibuja
//                             sobre el fondo elegido en Ajustes (texto)
//     cover,                  true si en una capa va con el fondo de Ajustes, a pantalla completa, y tapa lo que hay
//                             debajo (los versículos, fase 34); si no, en una capa se dibuja sin fondo
//     draw(host, { stage, thumbnail }) -> { update(item, { mode, styles }), live?(state, { volume, sound, still }), stop?(), destroy?(),
//                                          locate?(x, y), spot?(clientX, clientY) }
//                             locate y spot pasan de un punto del contenido (0 a 1) a la página y al revés:
//                             con ellos el escenario muestra el puntero del presentador
//                             dibuja el contenido dentro de host. `stage` es el escenario entero.
//                             live() recibe el estado de los mandos (null si lo dibujado no está al
//                             aire: una vista previa), el volumen general y si esta pantalla suena
//     controls?(host, { send }) -> { update(state, item), destroy?() }
//                             mandos en vivo. send(patch) ejecuta projection.control
//     island?(item) -> { el, destroy?() } | null
//                             en la barra de capas (escenario), la burbuja que se desprende de la ficha de una capa con
//                             esto: la cuenta y los botones de un temporizador (item es el contenido de la capa)
//   });
//
// El color del tipo va en .kind.k-<tipo> de core/app.css.
import { icon } from './icons.js';

const kinds = new Map();

export function registerKind(name, def) {
  kinds.set(name, def);
}

export const kindOf = (name) => kinds.get(name) || null;

export const titleOf = (item) => (item ? kindOf(item.kind)?.title?.(item) ?? item.title ?? '' : '');

export const keyOf = (item) => (item ? `${item.kind}|${kindOf(item.kind)?.key?.(item) ?? item.title ?? ''}` : '');

export function kindBadge(kind) {
  const el = document.createElement('span');
  el.className = `kind k-${kind}`;
  el.append(icon(kindOf(kind)?.icon || 'rows', 16));
  return el;
}
