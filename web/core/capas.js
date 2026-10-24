import { action, state } from './api.js';
import { h, guard, menu, toast } from './dom.js';
import { icon } from './icons.js';

// Las tres capas (módulo Capas, fase 31): quedan encima de todo lo que se proyecte hasta que se quiten. Cada módulo
// que tiene algo que puede ir en una capa pone, junto a «Proyectar», el botón «Capa» (layerButton) y la Capa elige.
//   chosen(): { kind, data, title } de lo elegido, o null
export function layerButton(chosen) {
  return h('button', {
    class: 'btn', title: 'Ponerlo en una capa: queda encima de todo lo que se proyecte',
    onclick: (e) => {
      const it = chosen();
      if (it) chooseLayer(e.currentTarget, it);
    },
  }, icon('stack', 16), 'Capa');
}

// El menú de las tres capas, con lo que tiene cada una (lo nuevo lo reemplaza).
export function chooseLayer(anchor, { kind, data, title }) {
  const slots = state.layers?.slots || [];
  menu(anchor, [1, 2, 3].map((n) => ({
    label: `Capa ${n}`,
    icon: 'stack',
    note: slots[n - 1]?.kind ? `en lugar de «${slots[n - 1].title}»` : 'vacía',
    onclick: guard(async () => {
      await action('layers.set', { n, kind, data });
      toast(`«${title}» está en la capa ${n}, encima de lo que se proyecte.`);
    }),
  })));
}
