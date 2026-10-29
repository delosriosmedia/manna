// ¿La versión a es más nueva que la b? («1.51.0» > «1.50.2»)
export const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => String(v).split('.').map(Number));
  const i = [0, 1, 2].find((n) => (x[n] || 0) !== (y[n] || 0));
  return i !== undefined && (x[i] || 0) > (y[i] || 0);
};
