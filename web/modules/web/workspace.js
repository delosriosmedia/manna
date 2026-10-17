import { action, state, subscribe, upload } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { nameFromFile } from '../../core/names.js';

// "Informe_final-2.html" -> "Informe final 2"
const ADDED = (page) => (page.framable
  ? `«${page.name}» agregada: se verá en todas las pantallas.`
  : `«${page.name}» agregada. No se deja mostrar dentro de Manna: el proyector la abrirá en su propia ventana.`);

// Módulo Páginas web: presentaciones y juegos de internet (Canva, Google Slides, Genially, Kahoot)
// o archivos HTML propios, para proyectarlos a pantalla completa. Una lista; la elegida, con su barra.
function mount(el, ctx) {
  let pageId = null;
  let awaited = null; // la recién agregada, hasta que llegue con el estado
  const pages = () => state.web?.pages || [];
  const current = () => pages().find((p) => p.id === pageId) || null;
  const onAir = () => {
    const item = state.projection?.item;
    return state.projection?.mode === 'live' && item?.kind === 'web' ? item.id : null;
  };
  const choose = (id) => {
    pageId = id;
    awaited = id && !pages().some((p) => p.id === id) ? id : null;
    render();
  };

  const picker = h('input', { type: 'file', accept: '.html,.htm,text/html', hidden: true });
  picker.addEventListener('change', guard(async () => {
    const file = picker.files[0];
    picker.value = '';
    if (!file) return;
    const page = await upload(`/api/web?name=${encodeURIComponent(nameFromFile(file.name, 'Página'))}`, file, { headers: { 'Content-Type': 'text/html' } });
    toast(`«${page.name}» agregada.`);
    choose(page.id);
  }));

  function openAdd() {
    const url = h('input', { class: 'input', type: 'url', placeholder: 'https://www.canva.com/…', 'aria-label': 'Dirección de la página' });
    const name = h('input', { class: 'input', maxLength: 80, placeholder: 'Nombre (si no, el del sitio)', 'aria-label': 'Nombre' });
    const add = guard(async () => {
      const page = await action('web.add', { url: url.value, name: name.value });
      box.close();
      toast(ADDED(page));
      choose(page.id);
    });
    url.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    const box = dialog('Agregar una página',
      h('div', { class: 'web-add' }, url, name),
      h('p', { class: 'muted web-add-note' }, 'Se proyecta tal cual, así que necesita internet durante el culto. Si la página no se deja mostrar dentro de Manna (Kahoot, por ejemplo), el proyector la abre en su propia ventana.'),
      h('div', { class: 'row web-add-actions' },
        h('button', { class: 'btn', onclick: () => { box.close(); picker.click(); } }, icon('upload-simple', 16), 'Subir un archivo HTML'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: add }, 'Agregar')));
    url.focus();
  }

  const askName = (page) => {
    const input = h('input', { class: 'input', value: page.name, maxLength: 80, 'aria-label': 'Nombre' });
    const save = guard(async () => {
      await action('web.rename', { id: page.id, name: input.value });
      box.close();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const box = dialog('Cambiar el nombre', input,
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: save }, 'Guardar')));
    input.select();
  };
  const confirmRemove = (page) => {
    const box = dialog('Eliminar la página',
      h('p', {}, `«${page.name}» se quitará de la biblioteca. Si está en el orden del culto, ese elemento dejará de poder proyectarse.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('web.remove', { id: page.id });
          box.close();
        }) }, 'Eliminar')));
  };

  const project = guard(async () => {
    if (current()) await action('projection.show', { kind: 'web', data: { id: pageId } });
  });
  const list = h('div', { class: 'web-list' });
  const name = h('span', { class: 'sel-ref' });
  const bar = h('div', { class: 'abar web-bar', hidden: true }, name,
    h('button', { class: 'btn', onclick: guard(async () => {
      const page = current();
      await action('order.add', { kind: 'web', data: { id: page.id } });
      toast(`«${page.name}» añadida al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵')));
  el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Páginas web'), h('span', { class: 'spacer' }),
    ctx.canEdit && h('button', { class: 'btn', onclick: openAdd }, icon('plus', 16), 'Agregar página')), list, bar, picker);

  function render() {
    const all = pages();
    if (awaited && all.some((p) => p.id === awaited)) awaited = null;
    if (pageId && !awaited && !current()) pageId = null;
    const air = onAir();
    if (!all.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay páginas'),
        'Agrega la dirección de una presentación de Canva, Google Slides o Genially, o de un juego como Kahoot, o sube un archivo HTML propio. Se proyecta a pantalla completa.',
        ctx.canEdit && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: openAdd }, icon('plus', 16), 'Agregar página'))));
    } else {
      list.replaceChildren(...all.map((page) => h('div', { class: `web-item${page.id === pageId ? ' selected' : ''}${air === page.id ? ' live' : ''}`, dataset: { id: page.id } },
        h('button', { class: 'web-pick', 'aria-pressed': page.id === pageId, onclick: () => choose(page.id), ondblclick: () => { choose(page.id); project(); } },
          h('span', { class: 'kind k-web' }, icon('globe', 16)),
          h('span', { class: 'item-text' }, h('strong', {}, page.name), h('small', {}, air === page.id && h('span', { class: 'badge live' }, 'Al aire'), ` ${page.subtitle}`))),
        ctx.canEdit && h('button', { class: 'icon-btn sm web-more', 'aria-label': `Opciones de ${page.name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(page) },
          '-',
          { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(page) },
        ]) }, icon('dots-three', 16)))));
    }
    const page = current();
    bar.hidden = !page;
    name.textContent = page?.name || '';
  }
  subscribe('web', render);
  subscribe('projection', render);

  return {
    onShow: render,
    keys(e) {
      if (e.key === 'Enter' && current()) { project(); return true; }
      return false;
    },
  };
}

export default { id: 'paginas', name: 'Páginas web', icon: 'globe', mount };
