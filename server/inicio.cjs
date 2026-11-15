// Entrada para un hosting que carga la aplicación con require() (LiteSpeed, en Hostinger: fase 36). Manna es un módulo
// ES que espera al cargar: se abre con import().
// El hosting va en UTC: de noche en Colombia, un orden nuevo salía con la fecha y el nombre de mañana (N1-3-7). La hora
// de las iglesias de hoy; otra la pone la variable TZ del sitio.
process.env.TZ ||= 'America/Bogota';
import('./index.js').catch((err) => {
  console.error('No se pudo iniciar Manna:', err?.stack || err);
  process.exit(1);
});
