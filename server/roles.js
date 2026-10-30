// Funciones que puede elegir un dispositivo al conectarse.
// Un módulo nuevo añade aquí sus permisos al rol que corresponda, o un rol nuevo con su página en web/.
export const ROLES = [
  {
    id: 'control',
    name: 'Control total',
    description: 'Biblia, himnario, medios, textos, páginas, el orden del culto y los ajustes.',
    path: '/control',
    requiresPin: true,
    permissions: ['*'],
  },
  {
    id: 'alabanza',
    name: 'Alabanza',
    description: 'Himnario, medios, orden y Biblia, con el volumen siempre a la vista.',
    path: '/alabanza',
    requiresPin: true,
    permissions: ['projection.control', 'order.edit', 'media.edit', 'slides.edit', 'jobs.manage', 'hymns.favorite', 'hymns.read'],
  },
  {
    // Se llamó Presentador hasta la 1.61 (decisión 69): conserva su identificador, así los usuarios y la nube no cambian.
    id: 'presentador',
    name: 'Orador completo',
    description: 'Pasa su presentación, sus versículos y sus textos, señala con el dedo y acerca lo que haga falta.',
    path: '/orador',
    requiresPin: true,
    permissions: ['projection.control', 'slides.edit', 'hymns.read'],
  },
  // Los mismos permisos: solo cambia su pantalla (decisión 70).
  {
    id: 'orador-sencillo',
    name: 'Orador sencillo',
    description: 'Siguiente y Anterior bien grandes, por cuál va y un versículo cuando haga falta.',
    path: '/orador-sencillo',
    requiresPin: true,
    permissions: ['projection.control', 'slides.edit', 'hymns.read'],
  },
  // Solo en la nube (fase 36, `nube: true`): preparar el culto desde casa, y administrar los usuarios (el administrador, con su PIN).
  // En la nube no hay otras; en el equipo de la iglesia, estas no están.
  {
    id: 'preparacion',
    name: 'Preparar el culto',
    description: 'Los órdenes del culto, con la Biblia, el himnario, los medios y los textos, desde casa.',
    path: '/preparacion',
    requiresPin: true,
    nube: true,
    // Subir fotos, videos y presentaciones desde casa (decisión 64): el espacio y si se puede, los decide el superadministrador.
    permissions: ['order.edit', 'hymns.favorite', 'hymns.read', 'texts.edit', 'media.edit', 'slides.edit'],
  },
  {
    id: 'administrar',
    name: 'Administrar la iglesia',
    description: 'Los usuarios y el equipo de la iglesia. Entra un administrador, con su PIN.',
    path: '/administrar',
    requiresPin: true,
    nube: true,
    permissions: ['users.manage'],
  },
  // Solo en el sitio del superadministrador de Manna Iglesia (fase 39, `super: true`): allí no hay otra.
  {
    id: 'superadmin',
    name: 'Superadministrador',
    description: 'Las iglesias de Manna Iglesia: su estado, lo que puede usar cada una y el espacio del plan. Con contraseña.',
    path: '/superadmin',
    requiresPin: true,
    nube: true,
    super: true,
    permissions: ['super.manage'],
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
