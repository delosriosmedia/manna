import { h } from '../../core/dom.js';
import { registerKind } from '../../core/kinds.js';
import { applyTextStyles, fitText } from '../projection/text.js';

// Tipo de contenido "texto" (módulo Textos): un mensaje o una cita sobre el fondo de la proyección, con la letra
// y los colores de Ajustes, como un pasaje bíblico. La cita va entre comillas (abre en su primera parte y
// cierra en la última) y lleva su autor debajo, en el sitio y el color de la cita bíblica.
registerKind('text', {
  icon: 'text-aa',
  label: 'Texto',
  unit: ['parte', 'partes'],
  wholeUpTo: 3,
  title: (item) => (item.parts > 1 && item.part ? `${item.title} · ${item.part} de ${item.parts}` : item.title),
  key: (item) => `${item.id}|${item.part}|${item.style}|${item.author}|${item.text}`,

  draw(host, { stage }) {
    const text = h('div', { class: 'stage-text stage-message' });
    const ref = h('div', { class: 'stage-ref' });
    const inner = h('div', { class: 'stage-inner' }, text, ref);
    host.replaceChildren(inner);
    const fit = () => fitText(stage, host, inner);
    const observer = new ResizeObserver(fit);
    observer.observe(stage);

    return {
      update(item, { styles }) {
        applyTextStyles(inner, styles);
        text.style.color = styles.textColor;
        ref.style.color = styles.refColor;
        const quote = item.style === 'quote';
        const first = !item.part || item.part === 1;
        const last = !item.part || item.part === item.parts;
        text.textContent = quote ? `${first ? '«' : ''}${item.text}${last ? '»' : ''}` : item.text;
        ref.textContent = quote && last && item.author ? `— ${item.author}` : '';
        ref.hidden = !ref.textContent;
        fit();
      },
      destroy() {
        observer.disconnect();
        stage.style.removeProperty('--fit');
      },
    };
  },
});
