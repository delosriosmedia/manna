import { session } from './api.js';

// Garantiza que este dispositivo tiene la función indicada antes de cargar la página.
// En el equipo principal se concede sin PIN; en los demás, se envía a la pantalla de inicio.
export async function ensureRole(role) {
  const current = await session.get();
  if (current.role === role) return current;
  if (current.isLocal) {
    await session.open(role);
    return { ...current, role };
  }
  location.replace(`/?volver=${encodeURIComponent(location.pathname)}`);
  return new Promise(() => {}); // la página se está yendo
}
