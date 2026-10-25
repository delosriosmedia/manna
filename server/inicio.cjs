// Entrada para un hosting que carga la aplicación con require() (LiteSpeed, en Hostinger: fase 36). Manna es un módulo
// ES que espera al cargar: se abre con import().
import('./index.js').catch((err) => {
  console.error('No se pudo iniciar Manna:', err?.stack || err);
  process.exit(1);
});
