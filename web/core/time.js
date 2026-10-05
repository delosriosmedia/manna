// Cuándo pasó algo, dicho como lo diría una persona: "hoy, 20:34", "ayer, 9:05", "4 oct, 18:20"
// (con el año si no es este). La hora sale en el formato del propio dispositivo.
export function whenLabel(moment, now = Date.now()) {
  const date = new Date(moment);
  const today = new Date(now);
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(today) - midnight(date)) / 86_400_000);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `hoy, ${time}`;
  if (days === 1) return `ayer, ${time}`;
  const day = date.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }) });
  return `${day}, ${time}`;
}
