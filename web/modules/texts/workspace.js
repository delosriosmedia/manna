import { action, state, subscribe } from '../../core/api.js';
import { chooseLayer } from '../../core/capas.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { whenLabel } from '../../core/time.js';
import { createStage } from '../projection/stage.js';

const NARROW = 600; // por debajo de este ancho del cajón, una cosa cada vez (lo mismo dice texts.css)
const MAX_TEXT = 4000;
const MAX_AUTHOR = 80;
// Como en el servidor (server/modules/texts/text.js): una línea en blanco pasa a otra pantalla.
const partsOf = (text) => text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const firstLine = (text) => text.trim().split('\n')[0].slice(0, 60);
// El aspecto del texto fijo (como en server/modules/texts/text.js): cada opción, con lo que se ve en su botón.
const LOOK = { font: 'sora', size: 'm', place: 'bc', box: 'pill', motion: 'still', speed: 'normal' };
const OPTIONS = {
  font: [['sora', 'Sora'], ['atkinson', 'Atkinson'], ['lexend', 'Lexend'], ['merriweather', 'Merriweather']],
  size: [['xs', 'Muy pequeño'], ['s', 'Pequeño'], ['m', 'Mediano'], ['l', 'Grande'], ['xl', 'Muy grande'], ['xxl', 'Enorme']],
  box: [['none', 'Sin recuadro'], ['stripe', 'Franja'], ['pill', 'Píldora']],
  motion: [['still', 'Quieto'], ['scroll', 'Pasando']],
  speed: [['slow', 'Lento'], ['normal', 'Normal'], ['fast', 'Rápido']],
};
const PLACES = [
  ['tl', 'Arriba a la izquierda'], ['tc', 'Arriba en el centro'], ['tr', 'Arriba a la derecha'],
  ['ml', 'En medio a la izquierda'], ['mc', 'En el centro'], ['mr', 'En medio a la derecha'],
  ['bl', 'Abajo a la izquierda'], ['bc', 'Abajo en el centro'], ['br', 'Abajo a la derecha'],
];
const FONT_FAMILY = { sora: "'Sora'", atkinson: "'Atkinson Hyperlegible'", lexend: "'Lexend'", merriweather: "'Merriweather', serif" };
const STYLE_ICON = { normal: 'text-aa', quote: 'quotes', fixed: 'push-pin' };

// Módulo Textos (fase 18 de docs/PLAN.md): mensajes y citas para proyectar. A un lado, los guardados; al otro,
// el que se escribe. Lo escrito se guarda con «Guardar», y también al proyectarlo, al añadirlo al orden o al
// pasar a otro, para no perderlo.
function mount(el, ctx) {
  let selected = null;  // id del texto abierto; null = uno nuevo
  let style = 'normal';
  let look = { ...LOOK }; // el aspecto, si es un texto fijo
  let open = false;     // en el cajón estrecho: el editor (true) o la lista
  let awaited = null;   // el recién guardado, hasta que llegue con el estado
  let base = { text: '', style: 'normal', author: '', look: { ...LOOK } }; // lo guardado de lo que está en el editor
  const texts = () => state.texts?.list || [];
  const current = () => texts().find((t) => t.id === selected) || null;

  const area = h('textarea', { class: 'input text-area', rows: 7, maxLength: MAX_TEXT, placeholder: 'Escribe aquí el mensaje', 'aria-label': 'Texto' });
  const author = h('input', { class: 'input', maxLength: MAX_AUTHOR, placeholder: 'Autor de la cita', 'aria-label': 'Autor' });
  const authorRow = h('label', { class: 'text-author' }, h('span', {}, '—'), author);
  // El texto fijo va en una capa: solo donde se proyecta (en la nube no hay capas).
  const styles = [['normal', 'Texto'], ['quote', 'Cita'], ...(ctx.canProject ? [['fixed', 'Fijo']] : [])].map(([id, label]) =>
    h('button', { class: 'chip', type: 'button', role: 'radio', dataset: { style: id }, onclick: () => { style = id; render(); } }, icon(STYLE_ICON[id], 15), label));
  // El aspecto del texto fijo: una fila de botones por opción, y el sitio en la cuadrícula del reloj.
  const lookButtons = [];
  const choice = (key, value, label, extra = {}) => {
    const b = h('button', { class: 'chip', type: 'button', role: 'radio', dataset: { key, value }, onclick: () => { look = { ...look, [key]: value }; paint(); }, ...extra }, label);
    lookButtons.push(b);
    return b;
  };
  const lookRow = (key, title) => h('div', { class: 'text-look-row', dataset: { key } }, h('span', { class: 'text-look-title' }, title),
    h('div', { class: 'row text-look-chips', role: 'radiogroup', 'aria-label': title }, ...OPTIONS[key].map(([value, label]) =>
      choice(key, value, label, key === 'font' ? { style: `font-family: ${FONT_FAMILY[value]}` } : {}))));
  const places = h('div', { class: 'text-places', role: 'radiogroup', 'aria-label': 'Dónde va' },
    ...PLACES.map(([value, label]) => choice('place', value, '', { class: 'chip text-place', title: label, 'aria-label': label })));
  const speedRow = lookRow('speed', 'Velocidad');
  // Cómo se verá en la proyección, sobre el fondo de Ajustes, mientras se elige (como en Tiempo).
  const screen = h('div', { class: 'text-preview' });
  const preview = createStage(screen);
  const lookPanel = h('div', { class: 'text-look' }, screen, h('div', { class: 'text-options' }, lookRow('font', 'Letra'), lookRow('size', 'Tamaño'),
    h('div', { class: 'text-look-row' }, h('span', { class: 'text-look-title' }, 'Dónde va'), places),
    lookRow('box', 'Recuadro'), lookRow('motion', 'Movimiento'), speedRow,
    h('p', { class: 'muted text-look-note' }, 'El color se ajusta solo a lo que haya detrás, para que siempre se lea.')));
  const save = h('button', { class: 'btn', onclick: () => commit() }, icon('check', 16), 'Guardar');
  const info = h('small', { class: 'text-info' });
  const back = h('button', { class: 'btn text-back', onclick: () => leave(() => { open = false; }) }, icon('caret-left', 16), 'Textos');
  const editor = h('div', { class: 'text-editor' },
    back,
    h('div', { class: 'text-styles', role: 'radiogroup', 'aria-label': 'Qué es' }, ...styles),
    area, authorRow, lookPanel, h('div', { class: 'text-foot' }, info, save));
  const list = h('div', { class: 'text-list' });
  const body = h('div', { class: 'texts', dataset: { view: 'list' } }, list, editor);

  const where = h('span', { class: 'sel-ref' });
  const project = guard(async () => {
    const id = await commit(true);
    if (!id) return;
    await action('projection.show', { kind: 'text', data: { id }, step: partsOf(area.value).length > 1 ? 0 : null });
  });
  const show = h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const add = h('button', { class: ctx.canProject ? 'btn' : 'btn primary', onclick: guard(async () => {
    const id = await commit(true);
    if (!id) return;
    await action('order.add', { kind: 'text', data: { id } });
    toast(`«${firstLine(area.value)}» añadido al orden del culto.`);
  }) }, icon('plus', 16), 'Añadir al orden');
  // El texto fijo no se proyecta ni va al orden: va en una capa, encima de lo que se proyecte.
  const layer = h('button', { class: 'btn primary', onclick: guard(async (e) => {
    const anchor = e.currentTarget;
    const id = await commit(true);
    if (id) chooseLayer(anchor, { kind: 'fixed', data: { id }, title: firstLine(area.value) });
  }) }, icon('stack', 16), 'Poner en una capa');
  const hint = h('span', { class: 'hint' });
  const bar = h('div', { class: 'abar text-bar' }, where, hint, add, ctx.canProject && show, layer);
  const fresh = h('button', { class: 'btn', onclick: () => leave(() => { selected = null; open = true; fill(); }) }, icon('plus', 16), 'Nuevo texto');
  el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Textos'), h('span', { class: 'spacer' }), ctx.canEdit && fresh), body, bar);

  // Lo que hay en el editor, y si difiere de lo guardado.
  const draft = () => ({ text: area.value.trim(), style, author: style === 'quote' ? author.value.trim() : '', look: style === 'fixed' ? look : LOOK });
  const differs = (a, b) => a.text !== b.text || a.style !== b.style || a.author !== b.author || JSON.stringify(a.look || LOOK) !== JSON.stringify(b.look || LOOK);
  const dirty = () => differs(draft(), base);
  // Guarda si hace falta y devuelve el id (null si no hay nada que guardar). quiet: sin aviso.
  async function commit(quiet = false) {
    if (!area.value.trim()) { area.focus(); return null; }
    if (!dirty() && selected) return selected;
    const { id } = await action('texts.save', { id: selected || undefined, style, text: area.value, author: author.value, look });
    if (!selected) awaited = id;
    selected = id;
    base = draft();
    if (!quiet) toast('Texto guardado.');
    render();
    return id;
  }
  // Antes de pasar a otro texto o a la lista, se guarda lo escrito (si se puede).
  const leave = guard(async (then) => {
    if (ctx.canEdit && dirty()) await commit(true);
    then();
    render();
  });
  function fill() {
    const t = current();
    base = { text: t?.text || '', style: t?.style || 'normal', author: t?.author || '', look: { ...LOOK, ...(t?.look || {}) } };
    area.value = base.text;
    author.value = base.author;
    style = base.style;
    look = { ...base.look };
  }
  const choose = (id) => leave(() => { selected = id; open = true; fill(); });
  const confirmRemove = (t) => {
    const box = dialog('Eliminar el texto',
      h('p', {}, `«${firstLine(t.text)}» se quitará de la lista. Si está en el orden del culto, ese elemento dejará de poder proyectarse.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('texts.remove', { id: t.id });
          box.close();
        }) }, 'Eliminar')));
  };

  function renderList() {
    const all = texts();
    const air = state.projection?.mode === 'live' && state.projection.item?.kind === 'text' ? state.projection.item.id : null;
    if (!all.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay textos'),
        'Escribe un mensaje (un anuncio, una bienvenida, un motivo de oración) o una cita con su autor para proyectarlo con el fondo y la letra de la Biblia.'));
      return;
    }
    list.replaceChildren(...all.map((t) => {
      const parts = partsOf(t.text).length;
      const facts = [t.style === 'quote' ? (t.author || 'Cita') : t.style === 'fixed' ? 'Texto fijo' : 'Texto', t.style !== 'fixed' && parts > 1 && `${parts} partes`, whenLabel(t.updated)].filter(Boolean).join(' · ');
      return h('div', { class: `text-card${t.id === selected ? ' selected' : ''}${t.id === air ? ' live' : ''}`, dataset: { id: t.id } },
        h('button', { class: 'text-pick', 'aria-pressed': t.id === selected, onclick: () => choose(t.id), ondblclick: () => { choose(t.id); if (t.style !== 'fixed') project(); } },
          h('span', { class: 'text-kind' }, icon(STYLE_ICON[t.style] || 'text-aa', 16)),
          h('span', { class: 'item-text' }, h('strong', {}, firstLine(t.text)), h('small', {}, facts)),
          t.id === air && h('span', { class: 'badge live' }, 'Al aire')),
        ctx.canEdit && h('button', { class: 'icon-btn sm text-more', 'aria-label': `Opciones de ${firstLine(t.text)}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(t) },
        ]) }, icon('dots-three', 16)));
    }));
  }

  function render() {
    if (awaited && current()) awaited = null;
    else if (selected && !current() && selected !== awaited) { selected = null; fill(); } // lo borraron
    const narrow = el.clientWidth > 0 && el.clientWidth < NARROW;
    body.dataset.view = narrow && !open ? 'list' : 'edit';
    back.hidden = !narrow;
    renderList();
    paint();
  }
  // Lo que cambia al escribir: sin rehacer la lista.
  function paint() {
    const narrow = el.clientWidth > 0 && el.clientWidth < NARROW;
    for (const b of styles) {
      b.classList.toggle('on', b.dataset.style === style);
      b.setAttribute('aria-checked', String(b.dataset.style === style));
    }
    authorRow.hidden = style !== 'quote';
    const fixed = style === 'fixed';
    lookPanel.hidden = !fixed;
    editor.dataset.style = style;
    speedRow.hidden = look.motion !== 'scroll';
    for (const b of lookButtons) {
      const on = look[b.dataset.key] === b.dataset.value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
    for (const input of [area, author, ...styles, ...lookButtons]) input.disabled = !ctx.canEdit;
    if (fixed && state.projection?.styles) {
      preview.render({ mode: 'live', item: { kind: 'fixed', uid: 0, text: area.value.trim() || 'Así se verá tu texto', look }, styles: state.projection.styles });
    }
    const parts = partsOf(area.value);
    info.textContent = fixed ? 'Se queda en pantalla, encima de todo lo que se proyecte. Ponlo con «Poner en una capa»; si ya está en una, al guardar se cambia ahí también.' : parts.length > 1 ? `${parts.length} partes: se pasan con «Siguiente»` : 'Una línea en blanco pasa a otra pantalla';
    hint.textContent = fixed ? 'Va en una capa, como el reloj' : 'Una línea en blanco pasa a otra pantalla';
    add.hidden = show.hidden = fixed;
    layer.hidden = !fixed;
    save.disabled = !dirty();
    save.hidden = !ctx.canEdit;
    const text = area.value.trim();
    where.textContent = text ? firstLine(text) : 'Texto nuevo';
    bar.hidden = !text || (narrow && !open);
    show.disabled = add.disabled = layer.disabled = !text || (!ctx.canEdit && dirty());
  }
  area.addEventListener('input', paint);
  author.addEventListener('input', paint);
  subscribe('texts', () => {
    // Si lo abierto cambió (en otro dispositivo, o el servidor lo limpió al guardar) y aquí no hay cambios, se ve lo nuevo.
    const t = current();
    if (t && !dirty() && differs(t, base)) fill();
    render();
  });
  subscribe('projection', () => { renderList(); paint(); }); // también la letra y el fondo de Ajustes de la vista previa

  return {
    onShow: render,
    keys(e) {
      if (e.key !== 'Enter' || !area.value.trim() || style === 'fixed') return false;
      if (ctx.canProject) project();
      else add.click();
      return true;
    },
  };
}

export default { id: 'textos', name: 'Textos', icon: 'text-aa', mount };
