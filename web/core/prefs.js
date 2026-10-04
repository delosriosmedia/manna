// Preferencias de este dispositivo (no se comparten): versión de la Biblia elegida, último módulo…
// Lo compartido entre dispositivos vive en el servidor, nunca aquí.
export const prefs = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(`manna.${key}`)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`manna.${key}`, JSON.stringify(value)); } catch { /* modo privado: no se recuerda */ }
  },
};
