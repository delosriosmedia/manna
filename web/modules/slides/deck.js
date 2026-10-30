// Las direcciones de las diapositivas de una presentación (el estado solo publica base, ext y thumbs) y cómo se
// dicen cuántas son. Las usan la biblioteca (workspace.js) y el Presentador (presenter.js).
// Convertida de nuevo (redone), la dirección cambia: así nadie sigue viendo la imagen de antes.
const again = (deck) => (deck.redone ? `?v=${deck.redone}` : '');
export const pageUrl = (deck, n) => `${deck.base}${n}.${deck.ext}${again(deck)}`;
export const thumbUrl = (deck, n) => (deck.thumbs ? `${deck.base}m${n}.${deck.thumbExt || 'jpg'}${again(deck)}` : pageUrl(deck, n));
export const plural = (n) => `${n} ${n === 1 ? 'diapositiva' : 'diapositivas'}`;
