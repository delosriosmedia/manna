import { session } from './api.js';

// Los permisos de la función de esta página: la interfaz pregunta por el permiso, no por el nombre de la función.
let granted = [];
export const can = (permission) => granted.includes('*') || granted.includes(permission);

// Garantiza que este dispositivo tiene la función indicada antes de cargar la página.
// En el equipo principal se concede sin PIN; en los demás, se envía a la pantalla de inicio.
export async function ensureRole(role) {
  const current = await session.get();
  granted = current.permissions || [];
  if (current.role === role) return current;
  if (current.isLocal) {
    // Un Manna abierto de antes no conoce una función nueva: se dice, en vez de dejar la página en blanco.
    const opened = await session.open(role).catch((err) => { document.body.textContent = err.message; throw err; });
    granted = opened.permissions || [];
    return { ...current, ...opened };
  }
  location.replace(`/?volver=${encodeURIComponent(location.pathname)}`);
  return new Promise(() => {}); // la página se está yendo
}
