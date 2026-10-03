// Funciones que puede elegir un dispositivo al conectarse.
// Un módulo nuevo añade aquí sus permisos al rol que corresponda, o un rol nuevo con su página en web/.
export const ROLES = [
  {
    id: 'control',
    name: 'Control completo',
    description: 'Biblia, búsqueda, estilos, guion y pantalla de proyección.',
    path: '/control',
    requiresPin: true,
    permissions: ['*'],
  },
  {
    id: 'guion',
    name: 'Control del guion',
    description: 'Solo proyecta los versículos guardados en el guion de culto.',
    path: '/guion',
    requiresPin: true,
    permissions: ['projection.control'],
  },
  {
    id: 'proyeccion',
    name: 'Pantalla de proyección',
    description: 'Muestra lo mismo que la pantalla principal. No controla nada.',
    path: '/proyeccion',
    requiresPin: false,
    permissions: [],
  },
];
