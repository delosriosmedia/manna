import order from './order/workspace.js';
import bible from './bible/workspace.js';
import compare from './bible/compare.js';
import himnario from './hymns/workspace.js';
import medios from './media/workspace.js';
import diapositivas from './slides/workspace.js';
import televisores from './tv/workspace.js';
import settings from './settings/workspace.js';

// Módulos de la interfaz, en el orden en que aparecen en la barra.
// Para añadir uno: crea web/modules/<id>/workspace.js (ver la skill /nuevo-modulo) y regístralo aquí.
// Los marcados con "soon" están previstos pero aún no existen: se muestran atenuados.
// Los marcados con "hidden" están en pausa: no salen en la barra, pero siguen ahí (#id en la dirección).
// `needs` dice qué programas del equipo principal necesita cada uno (ver core/needs.js): con ello
// la revisión del equipo avisa de lo que no funcionará, y el propio módulo también al abrirlo.
// En el celular solo caben cuatro a la vista (el resto va en «Más»): primero, lo de todos los cultos.
export const MODULES = [
  order,
  bible,
  himnario,
  medios,
  compare,
  diapositivas,
  // En pausa por decisión del dueño (docs/ESTADO.md): al retomarlo, basta quitar `hidden`.
  { ...televisores, hidden: true },
  settings,
];

// Función "Control del orden": solo opera el orden del culto, sin editarlo.
export const ORDER_ONLY = [order];
