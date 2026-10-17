import { action, state } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { askText } from './dialogs.js';

// Categorías de Medios (fase 22 de docs/PLAN.md): una fila con «Principal», las que haya creado la iglesia y
// «Nueva categoría». «Principal» tiene lo que no está en ninguna; cada elemento (imagen, video, audio o
// presentación) está en una sola, y al ponerlo en una sale del principal. La elegida filtra lo que se ve (se
// recuerda en este dispositivo). Un elemento se cambia de categoría arrastrándolo hasta su nombre (drag.js,
// que busca `data-category`) o desde su menú (items). Borrar una categoría devuelve sus elementos al principal.
export function createCategories(ctx, onChange) {
  let active = prefs.get('medios.categoria') || null;
  const all = () => state.media?.categories || [];
  const current = () => all().find((c) => c.id === active) || null;
  const home = (id) => all().find((c) => c.items.includes(id)) || null;
  // Todo lo que hay en la biblioteca, para contar lo de cada categoría (las ya borradas no cuentan).
  const library = () => [...(state.media?.images || []), ...(state.media?.videos || []), ...(state.media?.youtube || []),
    ...(state.media?.audios || []), ...(state.slides?.decks || [])];
  const choose = (id) => {
    active = id;
    prefs.set('medios.categoria', id);
    onChange();
  };

  // item: { id, name }; to: la categoría ({ id, name }) o null para el principal.
  async function move(item, to) {
    if ((home(item.id)?.id || null) === (to?.id || null)) return;
    await action('media.categoryMove', { item: item.id, to: to?.id || null });
    toast(to ? `«${item.name}» está ahora en «${to.name}».` : `«${item.name}» volvió a Principal.`);
  }

  const create = (item = null) => askText('Nueva categoría', '', async (name) => {
    const { id } = await action('media.categoryAdd', { name });
    if (item) await move(item, { id, name: name.trim() });
    else choose(id);
  }, { max: 40, placeholder: 'Por ejemplo: Niños, Domingo, Jóvenes', action: 'Crear' });
  const remove = (category) => {
    const box = dialog('Eliminar la categoría',
      h('p', {}, `La categoría «${category.name}» desaparece. Lo que tiene vuelve a Principal: no se borra nada.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('media.categoryRemove', { id: category.id });
          box.close();
        }) }, 'Eliminar')));
  };
  const options = (category, anchor) => menu(anchor, [
    { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askText('Cambiar el nombre', category.name, (name) => action('media.categoryRename', { id: category.id, name }), { max: 40 }) },
    { label: 'Eliminar la categoría', icon: 'trash', note: 'Lo que tiene vuelve a Principal', onclick: () => remove(category) },
  ]);

  const el = h('div', { class: 'media-cats', role: 'group', 'aria-label': 'Categorías' });
  // En una fila que se desliza (celular), la elegida y su menú se traen a la vista al elegirla.
  let shown;
  const reveal = () => {
    const on = el.querySelector('.chip.on');
    if (!on || el.scrollWidth <= el.clientWidth) return;
    const end = on.nextElementSibling?.matches('.icon-btn') ? on.nextElementSibling : on;
    const row = el.getBoundingClientRect();
    const right = end.getBoundingClientRect().right - row.right;
    const left = row.left - on.getBoundingClientRect().left;
    if (right > 0) el.scrollLeft += right;
    else if (left > 0) el.scrollLeft -= left;
  };
  function render() {
    // La borraron (aquí o en otro dispositivo). Antes de que llegue el estado no se sabe.
    if (active && state.media && !current()) active = null;
    const ids = new Set(library().map((x) => x.id));
    const taken = new Set(all().flatMap((c) => c.items));
    const chip = (id, label, count) => h('button', { class: `chip${active === id ? ' on' : ''}`, 'aria-pressed': String(active === id), dataset: { category: id || '' }, onclick: () => choose(id) },
      label, h('small', {}, String(count)));
    el.replaceChildren(
      chip(null, 'Principal', [...ids].filter((id) => !taken.has(id)).length),
      ...all().flatMap((c) => [
        chip(c.id, c.name, c.items.filter((id) => ids.has(id)).length),
        ctx.canEdit && c.id === active && h('button', { class: 'icon-btn sm', 'aria-label': `Opciones de la categoría ${c.name}`, onclick: (e) => options(c, e.currentTarget) }, icon('dots-three', 16)),
      ].filter(Boolean)),
      ctx.canEdit && h('button', { class: 'chip add', onclick: () => create() }, icon('plus', 14), 'Nueva categoría'),
    );
    if (shown !== active && state.media) {
      shown = active;
      requestAnimationFrame(reveal);
    }
  }

  // Las categorías a las que se puede llevar el elemento.
  function pick(item, anchor) {
    const from = home(item.id);
    menu(anchor, [
      from && { label: 'Principal', icon: 'squares-four', note: `Sacar de «${from.name}»`, onclick: guard(() => move(item, null)) },
      ...all().filter((c) => c !== from).map((c) => ({ label: c.name, icon: 'folder-simple', onclick: guard(() => move(item, c)) })),
      (from ? all().length > 1 : all().length > 0) && '-',
      { label: 'Nueva categoría…', icon: 'plus', onclick: () => create(item) },
    ].filter(Boolean));
  }

  return {
    el,
    render,
    // Lo de la categoría elegida o, en «Principal», lo que no está en ninguna.
    filter(list) {
      const c = current();
      if (c) return list.filter((x) => c.items.includes(x.id));
      const taken = new Set(all().flatMap((x) => x.items));
      return list.filter((x) => !taken.has(x.id));
    },
    // Lo que se dice si no hay nada que mostrar, pero la biblioteca no está vacía.
    empty: () => (current()
      ? h('div', { class: 'empty' }, h('strong', {}, `«${current().name}» aún no tiene nada`),
        ctx.canEdit ? 'Desde «Principal», arrastra hasta su nombre lo que quieras guardar aquí, o elige «Mover a una categoría» en su menú (⋯).' : 'Desde el equipo principal se le pueden poner elementos.')
      : h('div', { class: 'empty' }, h('strong', {}, 'Todo está en sus categorías'), 'Lo que subas o descargues aparecerá aquí.')),
    // Lo recién subido o descargado entra en la categoría elegida.
    adopt(ids) {
      const c = current();
      for (const id of c ? ids : []) action('media.categoryMove', { item: id, to: c.id }).catch(() => {});
    },
    // Arrastrado hasta una categoría (key: su id, o '' para el principal).
    drop(item, key) {
      const to = key ? all().find((c) => c.id === key) : null;
      if (key && !to) return;
      guard(() => move(item, to))();
    },
    // Para el menú de cada elemento (anchor: su botón ⋯, donde se abre la lista de categorías).
    items(item, anchor) {
      const from = home(item.id);
      return [
        { label: 'Mover a una categoría…', icon: 'folder-simple', onclick: () => pick(item, anchor) },
        from && { label: `Sacar de «${from.name}»`, icon: 'x', note: 'Vuelve a Principal', onclick: guard(() => move(item, null)) },
      ].filter(Boolean);
    },
  };
}
