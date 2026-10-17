import { action, state } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { askText } from './dialogs.js';

// Categorías de la pantalla Videos: una fila con «Todos», las que haya creado la iglesia y «Nueva categoría».
// La elegida filtra la lista (se recuerda en este dispositivo). Un video puede estar en varias; se ponen
// y se quitan desde su menú (items). Borrar una categoría no borra sus videos (server/modules/media).
export function createCategories(ctx, onChange) {
  let active = prefs.get('videos.categoria') || null;
  const all = () => state.media?.categories || [];
  const current = () => all().find((c) => c.id === active) || null;
  const choose = (id) => {
    active = id;
    prefs.set('videos.categoria', id);
    onChange();
  };

  const create = (video = null) => askText('Nueva categoría', '', async (name) => {
    const { id } = await action('media.categoryAdd', { name });
    if (video) await action('media.categoryToggle', { id, video: video.id, on: true });
    if (video) toast(`«${video.name}» está en «${name.trim()}».`);
    else choose(id);
  }, { max: 40, placeholder: 'Por ejemplo: Niños, Domingo, Jóvenes', action: 'Crear' });
  const remove = (category) => {
    const box = dialog('Eliminar la categoría',
      h('p', {}, `La categoría «${category.name}» desaparece. Sus videos siguen en la biblioteca.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('media.categoryRemove', { id: category.id });
          box.close();
        }) }, 'Eliminar')));
  };
  const options = (category, anchor) => menu(anchor, [
    { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askText('Cambiar el nombre', category.name, (name) => action('media.categoryRename', { id: category.id, name }), { max: 40 }) },
    { label: 'Eliminar la categoría', icon: 'trash', note: 'Sus videos se quedan', onclick: () => remove(category) },
  ]);

  const el = h('div', { class: 'video-cats', role: 'group', 'aria-label': 'Categorías' });
  function render() {
    if (active && !current()) active = null; // la borraron (aquí o en otro dispositivo)
    const chip = (id, label, count) => h('button', { class: `chip${active === id ? ' on' : ''}`, 'aria-pressed': String(active === id), onclick: () => choose(id) },
      label, count != null && h('small', {}, String(count)));
    el.replaceChildren(
      chip(null, 'Todos'),
      ...all().flatMap((c) => [
        chip(c.id, c.name, c.videos.length),
        ctx.canEdit && c.id === active && h('button', { class: 'icon-btn sm', 'aria-label': `Opciones de la categoría ${c.name}`, onclick: (e) => options(c, e.currentTarget) }, icon('dots-three', 16)),
      ].filter(Boolean)),
      ctx.canEdit && h('button', { class: 'chip add', onclick: () => create() }, icon('plus', 14), 'Nueva categoría'),
    );
  }

  // Las categorías del video, para ponerlo o quitarlo de cada una.
  function pick(clip, anchor) {
    menu(anchor, [
      ...all().map((c) => {
        const inside = c.videos.includes(clip.id);
        return { label: c.name, icon: inside ? 'check' : 'plus', note: inside ? 'Quitar' : 'Agregar', onclick: guard(() => action('media.categoryToggle', { id: c.id, video: clip.id, on: !inside })) };
      }),
      all().length && '-',
      { label: 'Nueva categoría…', icon: 'plus', onclick: () => create(clip) },
    ].filter(Boolean));
  }

  return {
    el,
    render,
    // Los videos de la categoría elegida (todos, sin ella).
    filter: (list) => {
      const c = current();
      return c ? list.filter((clip) => c.videos.includes(clip.id)) : list;
    },
    // Lo que se dice si la elegida aún no tiene videos.
    empty: () => current() && h('div', { class: 'empty' }, h('strong', {}, `«${current().name}» aún no tiene videos`),
      ctx.canEdit ? 'En «Todos», abre el menú de un video (⋯) y elige «Categorías» para ponerlo aquí.' : 'Desde el equipo principal se le pueden poner videos.'),
    // Para el menú de cada video (anchor: su botón ⋯, donde se abre la lista de categorías).
    items(clip, anchor) {
      const c = current();
      return [
        { label: 'Categorías…', icon: 'folder-simple', onclick: () => pick(clip, anchor) },
        c && c.videos.includes(clip.id) && { label: `Quitar de «${c.name}»`, icon: 'x', onclick: guard(() => action('media.categoryToggle', { id: c.id, video: clip.id, on: false })) },
      ].filter(Boolean);
    },
  };
}
