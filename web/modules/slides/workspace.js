import { action, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { describeJob } from '../../core/jobs.js';
import { whenLabel } from '../../core/time.js';
import { acceptsDeck, DECK_ACCEPT, hasPowerPoint, openDeckUpload } from './upload.js';

const SOURCES = { pdf: 'PDF', powerpoint: 'PowerPoint' };
// Con sitio para las dos columnas, siempre hay una presentación abierta.
const wide = matchMedia('(min-width: 860px)');
const plural = (n) => `${n} ${n === 1 ? 'diapositiva' : 'diapositivas'}`;
const pageUrl = (deck, n) => `${deck.base}${n}.${deck.ext}`;
// Sin miniaturas (según cómo se convirtió) se usa la propia imagen.
const thumbUrl = (deck, n) => (deck.thumbs ? `${deck.base}m${n}.jpg` : pageUrl(deck, n));

// Módulo Diapositivas: las presentaciones de la iglesia (PDF o PowerPoint), convertidas en
// imágenes. A la izquierda, las presentaciones; a la derecha, las diapositivas de la elegida.
// En pantallas estrechas se ve una cosa cada vez.
function mount(el, ctx) {
  let deckId = null;  // presentación elegida
  let page = 1;       // diapositiva elegida en ella
  let followed = '';  // lo último que se siguió de lo que está al aire
  // Presentación recién subida que aún no ha llegado con el estado: la respuesta de la subida
  // puede adelantarse al aviso del servidor. Se elige en cuanto aparezca.
  let awaited = null;
  const decks = () => state.slides?.decks || [];
  const current = () => decks().find((d) => d.id === deckId) || null;
  const jobOf = (id) => (state.jobs?.list || []).filter((j) => j.owner === 'slides' && j.ref === id).at(-1) || null;
  // Qué diapositiva de qué presentación está al aire: { id, number } o null.
  const onAir = () => {
    const item = state.projection?.item;
    return state.projection?.mode === 'live' && item?.kind === 'slides' ? { id: item.id, number: item.number } : null;
  };

  const picker = h('input', { type: 'file', accept: DECK_ACCEPT, hidden: true });
  const startUpload = (file) => openDeckUpload(file, { onDone: (id) => choose(id) });
  picker.addEventListener('change', () => {
    if (picker.files[0]) startUpload(picker.files[0]);
    picker.value = '';
  });
  const uploader = ctx.canEdit && h('button', { class: 'btn', onclick: () => picker.click() }, icon('upload-simple', 16), h('span', {}, 'Subir', h('span', { class: 'deck-long' }, ' presentación')));
  const back = h('button', { class: 'btn deck-back', onclick: () => choose(null) }, icon('caret-left', 16), 'Presentaciones');
  const list = h('div', { class: 'deck-list' });
  const pages = h('div', { class: 'deck-pages' });
  const body = h('div', { class: 'decks', dataset: { view: 'list' } }, list, pages);

  // "Diapositiva 3 de 12" (en el celular, "3 de 12") y, al lado, el nombre de la presentación.
  const where = h('span', {});
  const name = h('span', { class: 'hint' });
  const project = guard(async () => {
    const deck = current();
    if (deck?.status === 'ready') await action('projection.show', { kind: 'slides', data: { id: deck.id }, step: page - 1 });
  });
  const show = h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const bar = h('div', { class: 'abar deck-bar', hidden: true },
    h('span', { class: 'sel-ref' }, h('span', { class: 'deck-long' }, 'Diapositiva '), where), name,
    h('button', { class: 'btn', onclick: guard(async () => {
      const deck = current();
      await action('order.add', { kind: 'slides', data: { id: deck.id } });
      toast(`«${deck.name}» añadida al orden del culto.`);
    }) }, icon('plus', 16), 'Añadir al orden'),
    show);
  el.replaceChildren(h('div', { class: 'ws-head' }, back, h('h1', {}, 'Diapositivas'), h('span', { class: 'spacer' }), uploader), body, bar, picker);

  function choose(id, number = null) {
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
    if (!all.length) {
      list.replaceChildren(h('div', { class: 'empty' }, h('strong', {}, 'Aún no hay presentaciones'),
        hasPowerPoint()
          ? 'Sube un PDF o una presentación de PowerPoint. Cada diapositiva queda como una imagen: se ve igual en todas las pantallas y se puede acercar.'
          : 'Sube una presentación en PDF. Cada página queda como una imagen: se ve igual en todas las pantallas y se puede acercar. (Para subir un PowerPoint tal cual hace falta PowerPoint en el equipo principal; guardarlo como PDF sirve igual.)',
        ctx.canEdit && h('div', { class: 'row', style: 'justify-content: center; margin-top: 14px;' },
          h('button', { class: 'btn primary', onclick: () => picker.click() }, icon('upload-simple', 16), 'Subir presentación'))));
      return;
    }
    list.replaceChildren(...all.map((deck) => {
      const usable = deck.status === 'ready';
      const facts = [usable && plural(deck.pages), SOURCES[deck.source], whenLabel(deck.added)].filter(Boolean).join(' · ');
      return h('div', { class: `deck${deck.id === deckId ? ' selected' : ''}${air?.id === deck.id ? ' live' : ''}${usable ? '' : ' pending'}`, dataset: { id: deck.id, status: deck.status } },
        h('button', { class: 'deck-pick', 'aria-pressed': deck.id === deckId, onclick: () => choose(deck.id) },
          h('span', { class: `deck-cover${usable ? '' : ' blank'}` },
            usable ? h('img', { src: thumbUrl(deck, 1), alt: '', loading: 'lazy' }) : icon('presentation-chart', 26),
            air?.id === deck.id && h('span', { class: 'badge live' }, 'Al aire')),
          h('span', { class: 'item-text' }, h('strong', {}, deck.name), h('small', {}, facts))),
        statusOf(deck),
        ctx.canEdit && h('button', { class: 'icon-btn sm deck-more', 'aria-label': `Opciones de ${deck.name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(deck) },
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
    if (!deckId && wide.matches && all.length) {
      deckId = (all.find((d) => d.id === air?.id) || all[0]).id;
      page = air?.id === deckId ? air.number : 1;
    }
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
    body.dataset.view = deck ? 'pages' : 'list';
    el.classList.toggle('deck-open', Boolean(deck));
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

  // Arrastrar un archivo desde el escritorio.
  if (ctx.canEdit) {
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    el.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      el.classList.add('dropping');
    });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('dropping'); });
    el.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      el.classList.remove('dropping');
      const files = [...e.dataTransfer.files];
      startUpload(files.find(acceptsDeck) || files[0]);
    });
  }

  return {
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

export default {
  id: 'diapositivas', name: 'Diapositivas', icon: 'presentation-chart', mount,
  // PowerPoint es opcional: sin él se suben los PDF. El módulo lo explica al elegir un archivo.
  needs: [{ tools: ['powerpoint'], feature: 'abrir presentaciones de PowerPoint (los PDF sí funcionan)' }],
};
