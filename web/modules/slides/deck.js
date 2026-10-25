// Las direcciones de las diapositivas de una presentación (el estado solo publica base, ext y thumbs) y cómo se
// dicen cuántas son. Las usan la biblioteca (workspace.js) y el Presentador (presenter.js).
export const pageUrl = (deck, n) => `${deck.base}${n}.${deck.ext}`;
export const thumbUrl = (deck, n) => (deck.thumbs ? `${deck.base}m${n}.${deck.thumbExt || 'jpg'}` : pageUrl(deck, n));
export const plural = (n) => `${n} ${n === 1 ? 'diapositiva' : 'diapositivas'}`;
