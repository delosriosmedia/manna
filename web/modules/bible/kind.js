import { h } from '../../core/dom.js';
import { registerKind } from '../../core/kinds.js';
import { applyTextStyles, fitText } from '../projection/text.js';

// Tipo de contenido "pasaje bíblico": el texto de los versículos y la cita.
registerKind('verses', {
  icon: 'book-open-text',
  label: 'Biblia',
  unit: ['versículo', 'versículos'],
  title: (item) => (item.version ? `${item.reference} (${item.version})` : item.reference),
  key: (item) => `${item.versionId}|${item.reference}`,

  draw(host, { stage }) {
    const text = h('div', { class: 'stage-text' });
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
        const many = item.verses.length > 1;
        text.replaceChildren(...item.verses.flatMap((v) => [
          many ? h('sup', { class: 'stage-vn' }, String(v.n)) : null,
          `${v.text} `,
        ]).filter(Boolean));
        ref.textContent = item.version ? `${item.reference} (${item.version})` : item.reference;
        fit();
      },
      destroy() {
        observer.disconnect();
        stage.style.removeProperty('--fit');
      },
    };
  },
});
