// Preferencias de este dispositivo (no se comparten): versión de la Biblia elegida, último módulo…
// Lo compartido entre dispositivos vive en el servidor, nunca aquí.
export const prefs = {
  // Lo guardado con otra forma que la que se espera (una lista donde va un texto, de una versión anterior) se ignora:
  // antes impedía abrir la Biblia sin ningún aviso (I1-05 de la auditoría integral).
  get(key, fallback = null) {
    try {
      const value = JSON.parse(localStorage.getItem(`manna.${key}`)) ?? fallback;
      if (fallback != null && (typeof value !== typeof fallback || Array.isArray(value) !== Array.isArray(fallback))) return fallback;
      return value;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(`manna.${key}`, JSON.stringify(value)); } catch { /* modo privado: no se recuerda */ }
  },
};
