import { HttpError } from '../../core/router.js';
import { applyClock, createClock, freezeClock } from '../../core/playback.js';

export const PATTERNS = ['ajuste', 'barras', 'blanco'];

// Tipo de contenido "imagen de prueba": sirve para encuadrar el proyector o un televisor
// (bordes, colores) y, con su cronómetro, para ver que todas las pantallas van a la par.
// Es también el ejemplo más pequeño de un tipo con mandos en vivo: ver live() y control().
export function registerTestCard(app) {
  app.kind('testcard', {
    label: 'Imagen de prueba',
    describe: () => ({ title: 'Imagen de prueba', subtitle: 'Para encuadrar la pantalla', steps: 1, data: {} }),
    resolve: () => ({ title: 'Imagen de prueba' }),
    live(_content, previous) {
      const saved = previous?.state;
      if (saved && PATTERNS.includes(saved.pattern)) return { pattern: saved.pattern, clock: freezeClock(saved.clock, previous.at) };
      return { pattern: 'ajuste', clock: createClock() };
    },
    control(state, patch, { now }) {
      if (patch.pattern !== undefined && !PATTERNS.includes(patch.pattern)) throw new HttpError(400, 'Esa imagen de prueba no existe.');
      return { pattern: patch.pattern ?? state.pattern, clock: applyClock(state.clock, patch, now) };
    },
  });
}
