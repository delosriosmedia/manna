import order from './order/workspace.js';
import bible from './bible/workspace.js';
import settings from './settings/workspace.js';

// Módulos de la interfaz, en el orden en que aparecen en la barra.
// Para añadir uno: crea web/modules/<id>/workspace.js (ver la skill /nuevo-modulo) y regístralo aquí.
// Los marcados con "soon" están previstos pero aún no existen: se muestran atenuados.
// `needs` dice qué programas del equipo principal necesita cada uno (ver core/needs.js): con ello
// la revisión del equipo avisa de lo que no funcionará, y el propio módulo también al abrirlo.
export const MODULES = [
  order,
  bible,
  { id: 'himnario', name: 'Himnario', icon: 'music-notes', soon: true,
    needs: [{ tools: ['ffmpeg'], feature: 'elegir la pista instrumental de un himno' }] },
  { id: 'medios', name: 'Medios', icon: 'image', soon: true,
    needs: [
      { tools: ['ffmpeg'], feature: 'convertir los videos y audios que el navegador no reproduce' },
      { tools: ['yt-dlp', 'ffmpeg'], feature: 'descargar videos de YouTube' },
    ] },
  { id: 'diapositivas', name: 'Diapositivas', icon: 'presentation-chart', soon: true,
    needs: [{ tools: ['powerpoint'], feature: 'abrir presentaciones de PowerPoint (los PDF sí funcionan)' }] },
  settings,
];

// Función "Control del orden": solo opera el orden del culto, sin editarlo.
export const ORDER_ONLY = [order];
