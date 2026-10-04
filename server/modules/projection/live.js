// Si el servidor se reinicia en medio de una reunión (un cierre accidental, un fallo),
// lo que estaba en pantalla se recupera, siempre que el reinicio sea reciente.
export const RESTORE_WINDOW_MS = 15 * 60_000;

// saved: { mode, source: { kind, data, step, orderId }, at } guardado en disco. Devuelve lo que
// hay que restaurar ({ mode, source }), o null si no hay nada o ya pasó demasiado tiempo.
export function liveToRestore(saved, now = Date.now()) {
  if (!saved?.source?.kind || !saved.source.data) return null;
  if (!Number.isFinite(saved.at) || now - saved.at > RESTORE_WINDOW_MS || saved.at > now) return null;
  const mode = ['live', 'clear', 'black'].includes(saved.mode) ? saved.mode : 'live';
  return { mode, source: saved.source };
}
