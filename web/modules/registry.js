import order from './order/workspace.js';
import bible from './bible/workspace.js';
import compare from './bible/compare.js';
import medios from './media/workspace.js';
import televisores from './tv/workspace.js';
import settings from './settings/workspace.js';

// Módulos de la interfaz, en el orden en que aparecen en la barra.
// Para añadir uno: crea web/modules/<id>/workspace.js (ver la skill /nuevo-modulo) y regístralo aquí.
// Los marcados con "soon" están previstos pero aún no existen: se muestran atenuados.
// `needs` dice qué programas del equipo principal necesita cada uno (ver core/needs.js): con ello
// la revisión del equipo avisa de lo que no funcionará, y el propio módulo también al abrirlo.
export const MODULES = [
  order,
  bible,
  compare,
  medios,
  { id: 'himnario', name: 'Himnario', icon: 'music-notes', soon: true,
    needs: [{ tools: ['ffmpeg'], feature: 'elegir la pista instrumental de un himno' }] },
  { id: 'diapositivas', name: 'Diapositivas', icon: 'presentation-chart', soon: true,
    needs: [{ tools: ['powerpoint'], feature: 'abrir presentaciones de PowerPoint (los PDF sí funcionan)' }] },
  televisores,
  settings,
];

// Función "Control del orden": solo opera el orden del culto, sin editarlo.
export const ORDER_ONLY = [order];
