import { action } from '../../core/api.js';
import { h, dialog, guard } from '../../core/dom.js';

// Ventanas que comparten las pestañas de Medios: cambiar el nombre y eliminar.

export function askName(entry) {
  const input = h('input', { class: 'input', value: entry.name, maxLength: 80, 'aria-label': 'Nombre' });
  const save = guard(async () => {
    await action('media.rename', { id: entry.id, name: input.value });
    box.close();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const box = dialog('Cambiar el nombre', input,
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
      h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: save }, 'Guardar')));
  input.select();
}

// what: "la imagen", "el video", "el audio".
export function confirmRemove(entry, what) {
  const box = dialog(`Eliminar ${what}`,
    h('p', {}, `«${entry.name}» se quitará de la biblioteca. Si está en el orden del culto, ese elemento dejará de poder proyectarse.`),
    h('div', { class: 'row', style: 'justify-content: flex-end;' },
      h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
      h('button', { class: 'btn danger', onclick: guard(async () => {
        await action('media.remove', { id: entry.id });
        box.close();
      }) }, 'Eliminar')));
}
