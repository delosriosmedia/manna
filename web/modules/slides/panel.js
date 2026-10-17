import { action, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { describeJob } from '../../core/jobs.js';
import { kindBadge } from '../../core/kinds.js';
import { whenLabel } from '../../core/time.js';
import { acceptsDeck, openDeckUpload } from './upload.js';
import { pageUrl, plural, thumbUrl } from './deck.js';

const SOURCES = { pdf: 'PDF', powerpoint: 'PowerPoint' };

// Las presentaciones de Medios (fase 22 de docs/PLAN.md): las de la iglesia (PDF o PowerPoint), convertidas
// en imágenes. Primero la lista; al elegir una, sus diapositivas, que ocupan Medios hasta volver con
// «Presentaciones». Tiene la forma de los grupos de Medios (media/workspace.js), que la importa: es la
// excepción a que un módulo no importe archivos de otro. lib es lo que le da Medios.
export function createSlidesPanel(ctx, lib) {
  let deckId = null;  // presentación elegida
  let page = 1;       // diapositiva elegida en ella
  let followed = '';  // lo último que se siguió de lo que está al aire
  // Presentación recién subida que aún no ha llegado con el estado: la respuesta de la subida
  // puede adelantarse al aviso del servidor. Se elige en cuanto aparezca.
  let awaited = null;
  const decks = () => lib.filter([...(state.slides?.decks || [])].sort((a, b) => a.added - b.added));
  const current = () => decks().find((d) => d.id === deckId) || null;
  const jobOf = (id) => (state.jobs?.list || []).filter((j) => j.owner === 'slides' && j.ref === id).at(-1) || null;
  // Qué diapositiva de qué presentación está al aire: { id, number } o null.
  const onAir = () => {
    const item = state.projection?.item;
    return state.projection?.mode === 'live' && item?.kind === 'slides' ? { id: item.id, number: item.number } : null;
  };

  const startUpload = (file) => openDeckUpload(file, { onDone: (id) => { lib.added([id]); choose(id); } });
  const back = h('button', { class: 'btn deck-back', onclick: () => choose(null) }, icon('caret-left', 16), 'Presentaciones');
  const list = h('div', { class: 'deck-list' });
  const pages = h('div', {});
  const el = h('div', { class: 'decks', dataset: { view: 'list', panel: 'diapositivas' } }, list, h('div', { class: 'deck-pages' }, back, pages));

  // "Diapositiva 3 de 12" (en el celular, "3 de 12") y, al lado, el nombre de la presentación.
  const where = h('span', {});
  const name = h('span', { class: 'hint' });
  const project = guard(async () => {
    const deck = current();
    if (deck?.status === 'ready') await action('projection.show', { kind: 'slides', data: { id: deck.id }, step: page - 1 });
  });
  const show = h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const bar = h('div', { class: 'abar media-bar deck-bar', hidden: true, dataset: { panel: 'diapositivas' } },
    h('span', { class: 'sel-ref' }, h('span', { class: 'deck-long' }, 'Diapositiva '), where), name,
    h('button', { class: 'btn', onclick: guard(async () => {
      const deck = current();
      await action('order.add', { kind: 'slides', data: { id: deck.id } });
      toast(`«${deck.name}» añadida al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    show);

  function choose(id, number = null) {
    if (id) lib.picked();
    awaited = id && !decks().some((d) => d.id === id) ? id : null;
    deckId = id;
    const air = onAir();
    page = number ?? (air && air.id === id ? air.number : 1);
    render();
    if (id) pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });
  }
  function pick(number) {
    page = number;
    render();
  }

  const askName = (deck) => {
    const input = h('input', { class: 'input', value: deck.name, maxLength: 80, 'aria-label': 'Nombre' });
    const save = guard(async () => {
      await action('slides.rename', { id: deck.id, name: input.value });
      box.close();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const box = dialog('Cambiar el nombre', input,
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), h('button', { class: 'btn primary', onclick: save }, 'Guardar')));
    input.select();
  };
  const confirmRemove = (deck) => {
    const box = dialog('Eliminar la presentación',
      h('p', {}, `«${deck.name}» se quitará de la biblioteca. Si está en el orden del culto, ese elemento dejará de poder proyectarse.`),
      h('div', { class: 'row', style: 'justify-content: flex-end;' },
        h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: guard(async () => {
          await action('slides.remove', { id: deck.id });
          box.close();
        }) }, 'Eliminar')));
  };

  // Lo que hay que saber de una presentación que aún no está lista.
  function statusOf(deck) {
    if (deck.status === 'ready') return null;
    if (deck.status === 'converting') {
      const job = jobOf(deck.id);
      const progress = Math.round((job?.progress || 0) * 100);
      return h('div', { class: 'deck-status' },
        h('div', { class: `bar${job?.progress == null ? ' busy' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress }, h('span', { style: `width: ${progress}%;` })),
        h('small', {}, ['PowerPoint la está convirtiendo', job && describeJob(job)].filter(Boolean).join(' · ')));
    }
    return h('div', { class: 'deck-status error' }, h('small', {}, deck.error || 'No se pudo convertir.'));
  }

  function renderList(all, air) {
    list.replaceChildren(...all.map((deck) => {
      const usable = deck.status === 'ready';
      const facts = [usable && plural(deck.pages), deck.live && deck.liveable ? 'PowerPoint en vivo' : SOURCES[deck.source], whenLabel(deck.added)].filter(Boolean).join(' · ');
      return h('div', { class: `deck${deck.id === deckId ? ' selected' : ''}${air?.id === deck.id ? ' live' : ''}${usable ? '' : ' pending'}`, dataset: { id: deck.id, status: deck.status, ...(ctx.canEdit && { drag: deck.id, name: deck.name }) } },
        h('button', { class: 'deck-pick', 'aria-pressed': deck.id === deckId, onclick: () => choose(deck.id) },
          h('span', { class: `deck-cover${usable ? '' : ' blank'}` },
            usable ? h('img', { src: thumbUrl(deck, 1), alt: '', loading: 'lazy' }) : icon('presentation-chart', 26), kindBadge('slides'),
            air?.id === deck.id && h('span', { class: 'badge live' }, 'Al aire')),
          h('span', { class: 'item-text' }, h('strong', {}, deck.name), h('small', {}, facts))),
        statusOf(deck),
        ctx.canEdit && h('button', { class: 'icon-btn sm deck-more', 'aria-label': `Opciones de ${deck.name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(deck) },
          ...lib.menu(deck, e.currentTarget),
          // En vivo la pasa el propio PowerPoint en el proyector, con sus videos y animaciones (solo Windows).
          ...(deck.liveable ? [deck.live
            ? { label: 'Pasar como imágenes', note: 'Con zoom y puntero, sin animaciones', icon: 'images', onclick: guard(() => action('slides.live', { id: deck.id, on: false })) }
            : { label: 'Pasar con PowerPoint', note: 'Con sus videos y animaciones', icon: 'monitor', onclick: guard(() => action('slides.live', { id: deck.id, on: true })) }] : []),
          '-',
          { label: 'Eliminar', icon: 'trash', onclick: () => confirmRemove(deck) },
        ]) }, icon('dots-three', 16)));
    }));
  }

  function renderPages(deck, air) {
    if (!deck) {
      delete pages.dataset.key;
      pages.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'Elige una presentación'), 'Aquí verás sus diapositivas, para empezar por la que quieras.'));
      return;
    }
    if (deck.status !== 'ready') {
      delete pages.dataset.key;
      pages.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, deck.status === 'converting' ? 'PowerPoint está convirtiendo esta presentación' : 'Esta presentación no se pudo convertir'),
        deck.status === 'converting' ? 'Aparecerá aquí en cuanto termine. Puedes seguir usando Manna mientras tanto.' : deck.error));
      return;
    }
    // La rejilla solo se rehace si cambia la presentación: así las imágenes no se vuelven a pedir.
    const key = `${deck.id}|${deck.pages}`;
    if (pages.dataset.key !== key) {
      pages.dataset.key = key;
      pages.replaceChildren(h('div', { class: 'slide-grid' }, ...Array.from({ length: deck.pages }, (_, i) =>
        h('button', { class: 'slide-pick', dataset: { n: i + 1 }, onclick: () => pick(i + 1), ondblclick: () => { pick(i + 1); project(); } },
          h('span', { class: 'slide-thumb' }, h('img', { src: thumbUrl(deck, i + 1), alt: '', loading: 'lazy' })),
          h('span', { class: 'slide-n' }, String(i + 1))))));
    }
    for (const button of pages.querySelectorAll('.slide-pick')) {
      const n = Number(button.dataset.n);
      const live = air?.id === deck.id && air.number === n;
      button.classList.toggle('selected', n === page);
      button.classList.toggle('live', live);
      button.setAttribute('aria-pressed', n === page);
      const badge = button.querySelector('.badge');
      if (live && !badge) button.querySelector('.slide-thumb').append(h('span', { class: 'badge live' }, 'Al aire'));
      if (!live && badge) badge.remove();
    }
  }

  function render() {
    const all = decks();
    if (awaited && all.some((d) => d.id === awaited)) {
      deckId = awaited;
      page = 1;
      awaited = null;
    }
    if (deckId && !current()) deckId = null;
    const air = onAir();
    // La selección acompaña a lo que está al aire: al avanzar con "Siguiente", se marca esa diapositiva.
    const following = air ? `${air.id}|${air.number}` : '';
    let reveal = false;
    if (following !== followed) {
      followed = following;
      if (air && air.id === deckId) {
        page = air.number;
        reveal = true;
      }
    }
    const deck = current();
    if (deck && page > Math.max(1, deck.pages)) page = 1;
    el.dataset.view = deck ? 'pages' : 'list';
    back.hidden = !deck;
    renderList(all, air);
    renderPages(deck, air);
    if (reveal) pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });

    const usable = deck?.status === 'ready';
    bar.hidden = !deck;
    if (deck) {
      where.textContent = usable ? `${page} de ${deck.pages}` : '';
      where.parentElement.hidden = !usable;
      name.textContent = deck.name;
      show.disabled = !usable;
      bar.querySelectorAll('.btn:not(.primary)').forEach((b) => { b.disabled = !usable; });
    }
    if (el.isConnected && !el.hidden) {
      ctx.setPreview(usable ? { kind: 'slides', id: deck.id, title: deck.name, reference: `Diapositiva ${page}`, number: page, pages: deck.pages, url: pageUrl(deck, page), thumb: thumbUrl(deck, page), width: deck.width, height: deck.height, fit: 'contain' } : null);
    }
  }
  subscribe('slides', render);
  subscribe('projection', render);
  subscribe('tools', render);
  subscribe('jobs', () => { if (decks().some((d) => d.status === 'converting')) render(); });

  return {
    id: 'diapositivas', label: 'Presentaciones', kind: 'slides', el, bar,
    items: decks,
    clear: () => choose(null),
    render,
    accepts: acceptsDeck,
    upload: (files) => startUpload(files.find(acceptsDeck) || files[0]),
    onShow: render,
    keys(e) {
      const deck = current();
      if (deck?.status !== 'ready') return false;
      if (e.key === 'Enter') { project(); return true; }
      // ↑ ↓ mueven la selección sin tocar la proyección (← → gobiernan lo que está al aire).
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        pick(Math.max(1, Math.min(deck.pages, page + (e.key === 'ArrowDown' ? 1 : -1))));
        pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });
        return true;
      }
      return false;
    },
  };
}

