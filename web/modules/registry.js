import order from './order/workspace.js';
import bible from './bible/workspace.js';
import settings from './settings/workspace.js';

// Módulos de la interfaz, en el orden en que aparecen en la barra.
// Para añadir uno: crea web/modules/<id>/workspace.js (ver la skill /nuevo-modulo) y regístralo aquí.
// Los marcados con "soon" están previstos pero aún no existen: se muestran atenuados.
export const MODULES = [
  order,
  bible,
  { id: 'himnario', name: 'Himnario', icon: 'music-notes', soon: true },
  { id: 'imagenes', name: 'Imágenes', icon: 'image', soon: true },
  { id: 'videos', name: 'Videos', icon: 'video', soon: true },
  { id: 'diapositivas', name: 'Diapositivas', icon: 'presentation-chart', soon: true },
  settings,
];

// Función "Control del orden": solo opera el orden del culto, sin editarlo.
export const ORDER_ONLY = [order];
