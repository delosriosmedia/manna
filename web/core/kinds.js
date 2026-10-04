// Tipos de contenido en la interfaz: cómo se llama, se reconoce, se dibuja y se gobierna cada uno.
// Cada módulo registra el suyo (web/modules/<id>/kind.js, listados en web/modules/kinds.js):
//
//   registerKind('image', {
//     icon, label,            icono y nombre en el orden del culto
//     unit,                   ['diapositiva', 'diapositivas'], o null si no tiene pasos que contar
//     title(item),            texto de una línea para el panel "Al aire"
//     key(item),              identidad de lo dibujado: si no cambia, es lo mismo en pantalla
//     background,             false si ocupa toda la pantalla (imagen, video); por defecto se dibuja
//                             sobre el fondo elegido en Ajustes (texto)
//     draw(host, { stage, sound }) -> { update(item, { mode, styles }), live?(state, { volume }), stop?(), destroy?() }
//                             dibuja el contenido dentro de host. `stage` es el escenario entero;
//                             `sound` dice si esta pantalla es la que suena
//     controls?(host, { send }) -> { update(state, item), destroy?() }
//                             mandos en vivo. send(patch) ejecuta projection.control
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
