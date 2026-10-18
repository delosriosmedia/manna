import { action, state } from './api.js';
import { h, dialog, guard, toast } from './dom.js';

// La carpeta de contenido de la iglesia (fase 29): la eligen Ajustes y el aviso de que falta (shell.js), solo en el
// equipo principal. Cambiarla no reinicia Manna.

// ¿Hace falta elegirla? No se encuentra, o solo tiene la Reina-Valera 1909 y ningún himno (lo que trae el instalador).
// null: aún no se sabe (el himnario se está leyendo).
export function contentMissing() {
  const content = state.system?.content;
  if (!content || !state.hymns?.ready) return null;
  if (!content.exists) return 'lost';
  return !state.hymns.count && (state.bible?.versions?.length || 0) <= 1 ? (content.chosen ? 'empty' : 'unchosen') : null;
}

// La ventana del sistema y, si la elegida no parece una carpeta de contenido, una pregunta antes de usarla.
export const chooseContent = guard(async () => {
  const picked = await action('system.contentPick', {}, { timeout: 0 });
  if (!picked?.dir) return;
  const name = picked.dir.split(/[\\/]/).pop() || picked.dir;
  const use = guard(async () => {
    await action('system.contentSet', { dir: picked.dir });
    toast(`Manna ya usa la carpeta de contenido «${name}».`);
  });
  if (picked.looks) return use();
  const box = dialog('¿Usar esta carpeta?',
    h('p', {}, `«${picked.dir}» no tiene las carpetas Biblias, Himnario ni Medios. Si la usas, Manna se las añade, con sus instrucciones y la Reina-Valera 1909, sin tocar nada de lo que ya tenga.`),
    h('div', { class: 'row', style: 'justify-content: flex-end;' },
      h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => { box.close(); await use(); } }, 'Usar esta carpeta')));
});
