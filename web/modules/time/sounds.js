// Sonidos de los temporizadores (fase 32), hechos en el momento con el sintetizador del navegador (Web Audio): sin
// archivos de terceros. En los últimos 10 segundos, un tictac de reloj suave (tic y tac alternos); en los últimos 5,
// más marcado; y al llegar a cero, una alarma corta, suave y bonita: tres notas de campana que suben (la, do#, mi).
// Solo suena la pantalla que suena (la regla de una sola, ver projection/stage.js), con el volumen general de Manna.

let context = null;
const audio = () => {
  context ||= new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
};

// Un tono con su envolvente: sube en `attack` y se apaga en `decay` segundos.
function tone(c, { at, frequency, gain, attack = 0.004, decay, type = 'sine' }) {
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  osc.connect(amp).connect(c.destination);
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
}

// Un tic (second par) o un tac (impar), corto y seco, como la madera de un reloj de pared.
export function tick(second, { strong = false, volume = 1 } = {}) {
  if (volume <= 0) return;
  const c = audio();
  const at = c.currentTime + 0.01;
  const high = second % 2 === 0;
  const gain = (strong ? 0.32 : 0.14) * volume;
  tone(c, { at, frequency: high ? 1760 : 1320, gain, attack: 0.002, decay: strong ? 0.07 : 0.045, type: 'triangle' });
  tone(c, { at, frequency: high ? 3520 : 2640, gain: gain * 0.25, attack: 0.001, decay: 0.02 });
}

// La alarma: tres notas de campana que suben y la última se queda un poco más.
export function chime({ volume = 1 } = {}) {
  if (volume <= 0) return;
  const c = audio();
  const start = c.currentTime + 0.02;
  [[880, 0, 0.9], [1108.73, 0.2, 0.9], [1318.51, 0.4, 1.8]].forEach(([frequency, offset, decay]) => {
    const at = start + offset;
    tone(c, { at, frequency, gain: 0.22 * volume, attack: 0.01, decay });
    // El parcial que da el color de campana (no armónico), más bajo y más corto.
    tone(c, { at, frequency: frequency * 2.76, gain: 0.05 * volume, attack: 0.005, decay: decay * 0.4 });
  });
}
