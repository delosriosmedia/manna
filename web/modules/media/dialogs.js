import { action } from '../../core/api.js';
import { h, dialog, guard } from '../../core/dom.js';

// Ventanas que comparten las pantallas de Medios y Videos: pedir un nombre, cambiarlo y eliminar.

// Pide un texto corto (un nombre) y lo entrega a save, que puede fallar con un aviso sin cerrar la ventana.
export function askText(title, value, save, { max = 80, placeholder = '', action: label = 'Guardar' } = {}) {
  const input = h('input', { class: 'input', value, maxLength: max, placeholder, 'aria-label': 'Nombre' });
  const done = guard(async () => {
    await save(input.value);
    box.close();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  const box = dialog(title, input,
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
      h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: done }, label)));
  input.select();
}

export const askName = (entry) => askText('Cambiar el nombre', entry.name, (name) => action('media.rename', { id: entry.id, name }));

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
