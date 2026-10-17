// Funciones que puede elegir un dispositivo al conectarse.
// Un módulo nuevo añade aquí sus permisos al rol que corresponda, o un rol nuevo con su página en web/.
export const ROLES = [
  {
    id: 'control',
    name: 'Control completo',
    description: 'Biblia, himnario, videos, medios, textos, páginas, el orden del culto y los ajustes.',
    path: '/control',
    requiresPin: true,
    permissions: ['*'],
  },
  {
    id: 'alabanza',
    name: 'Servicio de alabanza',
    description: 'Himnario, videos, orden y Biblia, con el volumen siempre a la vista.',
    path: '/alabanza',
    requiresPin: true,
    permissions: ['projection.control', 'order.edit', 'media.edit', 'jobs.manage', 'hymns.favorite'],
  },
  {
    id: 'presentador',
    name: 'Presentador de diapositivas',
    description: 'Pasa una presentación, señala con el dedo y acerca lo que haga falta.',
    path: '/presentador',
    requiresPin: true,
    permissions: ['projection.control', 'slides.edit'],
  },
  {
    id: 'orden',
    name: 'Control del orden',
    description: 'Solo pasa el orden del culto, sin editarlo. Pensado para el celular.',
    path: '/orden',
    requiresPin: true,
    permissions: ['projection.control'],
  },
  {
    id: 'proyeccion',
    name: 'Pantalla de proyección',
    description: 'Para un televisor o una pantalla más: solo muestra.',
    path: '/proyeccion',
    requiresPin: false,
    permissions: [],
  },
];
