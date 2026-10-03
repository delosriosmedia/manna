// Punto de entrada. Solo comprueba la versión de Node antes de cargar el resto,
// para poder dar un mensaje claro en equipos con un Node antiguo.
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`\nManna necesita Node.js 18 o superior (este equipo tiene ${process.versions.node}).`);
  console.error('Descarga la versión LTS en https://nodejs.org/es/download\n');
  process.exit(1);
}

const { start } = await import('./app.js');
start().catch((err) => {
  console.error('\nNo se pudo iniciar Manna:', err.message);
  process.exit(1);
});
