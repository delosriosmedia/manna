// Funciones que puede elegir un dispositivo al conectarse.
// Un módulo nuevo añade aquí sus permisos al rol que corresponda, o un rol nuevo con su página en web/.
export const ROLES = [
  {
    id: 'control',
    name: 'Control completo',
    description: 'Biblia, orden del culto, ajustes y pantalla de proyección.',
    path: '/control',
    requiresPin: true,
    permissions: ['*'],
  },
  {
    id: 'orden',
    name: 'Control del orden',
    description: 'Solo proyecta lo que ya está en el orden del culto. Pensado para el celular.',
    path: '/orden',
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
