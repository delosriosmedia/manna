import { action, state, subscribe } from '../../core/api.js';
import { h, dialog, guard, menu, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { describeJob } from '../../core/jobs.js';
import { kindBadge } from '../../core/kinds.js';
import { whenLabel } from '../../core/time.js';
import { acceptsDeck, openDeckUpload } from './upload.js';
import { pageUrl, plural, thumbUrl } from './deck.js';

const SOURCES = { pdf: 'PDF', powerpoint: 'PowerPoint', keynote: 'Keynote' };

// Las presentaciones de Medios (fase 22 de docs/PLAN.md): las de la iglesia (PDF o PowerPoint), convertidas
// en imágenes. Tocar una la elige (para proyectarla o añadirla); sus diapositivas solo se ven con «Ver
// diapositivas», en `side`, que Medios pone al lado de la lista o, sin sitio, encima: la lista no cambia. Tiene la
// forma de los grupos de Medios (media/workspace.js), que la importa: es la excepción a que un módulo no importe
// archivos de otro. lib es lo que le da Medios.
export function createSlidesPanel(ctx, lib) {
  let deckId = null;  // presentación elegida
  let page = 1;       // diapositiva elegida en ella
  let followed = '';  // lo último que se siguió de lo que está al aire
  // Presentación recién subida que aún no ha llegado con el estado: la respuesta de la subida
  // puede adelantarse al aviso del servidor. Se elige en cuanto aparezca.
  let awaited = null;
  const decks = () => lib.filter([...(state.slides?.decks || [])].sort((a, b) => a.added - b.added));
  const current = () => decks().find((d) => d.id === deckId) || null;
  const jobsOf = (id) => (state.jobs?.list || []).filter((j) => j.owner === 'slides' && j.ref === id);
  const jobOf = (id) => jobsOf(id).at(-1) || null;
  // Qué diapositiva de qué presentación está al aire: { id, number } o null.
  const onAir = () => {
    const item = state.projection?.item;
    return state.projection?.mode === 'live' && item?.kind === 'slides' ? { id: item.id, number: item.number } : null;
  };

  const startUpload = (file) => openDeckUpload(file, { cloud: !ctx.canProject, onDone: (id) => { lib.added([id]); choose(id); } });
  const list = h('div', { class: 'deck-list' });
  const el = h('div', { class: 'decks', dataset: { panel: 'diapositivas' } }, list);
  let open = false;   // sus diapositivas se ven (las pidió «Ver diapositivas»)
  const pages = h('div', {});
  const title = h('strong', {});
  const side = h('aside', { class: 'deck-side', hidden: true, 'aria-label': 'Diapositivas' },
    h('div', { class: 'deck-side-head' },
      h('button', { class: 'btn deck-back', onclick: () => showPages(false) }, icon('caret-left', 16), 'Presentaciones'),
      title,
      h('button', { class: 'icon-btn deck-close', 'aria-label': 'Cerrar las diapositivas', title: 'Cerrar', onclick: () => showPages(false) }, icon('x', 16))),
    pages);

  // "Diapositiva 3 de 12" (en el celular, "3 de 12") y, al lado, el nombre de la presentación.
  const where = h('span', {});
  const name = h('span', { class: 'hint' });
  const add = guard(async () => {
    const deck = current();
    await action('order.add', { kind: 'slides', data: { id: deck.id } });
    toast(`«${deck.name}» añadida al orden del culto.`);
  });
  // Sin proyección (al preparar el culto en la nube), Intro añade al orden.
  const project = guard(async () => {
    const deck = current();
    if (deck && !ctx.canProject) await add();
    else if (deck?.status === 'ready') await action('projection.show', { kind: 'slides', data: { id: deck.id }, step: page - 1 });
  });
  const show = ctx.canProject && h('button', { class: 'btn primary', onclick: () => project() }, icon('play', 16), 'Proyectar', h('kbd', {}, '↵'));
  const see = h('button', { class: 'btn deck-see', onclick: () => showPages(!open) }, icon('eye', 16), h('span', {}, 'Ver diapositivas'));
  const bar = h('div', { class: 'abar media-bar deck-bar', hidden: true, dataset: { panel: 'diapositivas' } },
    h('span', { class: 'sel-ref' }, h('span', { class: 'deck-long' }, 'Diapositiva '), where), name, see,
    ctx.can('order.edit') && h('button', { class: `btn${ctx.canProject ? '' : ' primary'}`, onclick: () => add() }, icon('plus', 16), 'Añadir al orden'),
    show);

  function choose(id, number = null) {
    if (id) lib.picked();
    else open = false; // sin nada elegido, las de la próxima solo se ven si se piden
    awaited = id && !decks().some((d) => d.id === id) ? id : null;
    const same = id === deckId; // tocar otra vez la elegida no cambia la diapositiva escogida
    deckId = id;
    const air = onAir();
    page = number ?? (same ? page : air && air.id === id ? air.number : 1);
    render();
    if (id) pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });
  }
  function pick(number) {
    page = number;
    render();
  }
  function showPages(on) {
    open = on;
    render();
    if (!on) return;
    // Al lado, la lista se estrecha y se reacomoda: la elegida sigue a la vista. Encima, la lista no se toca.
    const card = list.querySelector('.deck.selected');
    if (card && getComputedStyle(card).visibility === 'visible') card.scrollIntoView({ block: 'nearest' });
    pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });
  }

  const askName = (deck) => {
    const input = h('input', { class: 'input', value: deck.name, maxLength: 80, 'aria-label': 'Nombre' });
    const save = guard(async () => {
      await action('slides.rename', { id: deck.id, name: input.value });
      box.close();
    });
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
    // En la nube (decisión 64), un PowerPoint se convierte en el equipo de la iglesia al llegar.
    if (deck.status === 'church') return h('div', { class: 'deck-status' }, h('small', {}, 'Se convierte en el equipo de la iglesia al llegar.'));
    if (deck.status === 'ready' && deck.atChurch) return h('div', { class: 'deck-status' }, h('small', {}, 'Ya está en la iglesia.'));
    const job = jobOf(deck.id);
    // Convertida de nuevo: mientras tanto se sigue viendo la de antes, con el avance debajo.
    // Las letras que faltan: el administrador las instala desde aquí (las de Google Fonts); si no, se dice cómo.
    if (deck.status === 'ready' && job?.state !== 'running') {
      // De Keynote: lo que no se pudo traducir (un gráfico, una tabla) sale de su miniatura.
      const soft = deck.soft && h('small', {}, `${deck.soft.length === 1 ? `La diapositiva ${deck.soft[0]} lleva` : `Las diapositivas ${deck.soft.join(', ')} llevan`} algo que Manna no sabe traducir (un gráfico, una tabla, un video): se ve con menos nitidez.`);
      if (!deck.missingFonts) return soft ? h('div', { class: 'deck-status' }, soft) : null;
      const failed = jobsOf(deck.id).filter((j) => j.state === 'error').at(-1);
      return h('div', { class: 'deck-status error' },
        h('small', {}, `Faltan letras en este equipo: ${deck.missingFonts.join(', ')}.${ctx.user?.admin ? '' : ' Instálalas y elige «Convertir de nuevo».'}`),
        failed && h('small', {}, failed.error),
        soft,
        // Tras un intento, lo que queda por hacer es a mano: el botón revisa lo instalado y, si ya están, la convierte.
        ctx.user?.admin && h('button', { class: 'btn deck-fonts', onclick: guard(() => action('slides.installFonts', { id: deck.id })) }, icon(failed ? 'arrow-clockwise' : 'download-simple', 16), failed ? 'Revisar de nuevo' : 'Instalar las que faltan'));
    }
    if (deck.status === 'ready' || deck.status === 'converting') {
      const progress = Math.round((job?.progress || 0) * 100);
      return h('div', { class: 'deck-status' },
        h('div', { class: `bar${job?.progress == null ? ' busy' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress }, h('span', { style: `width: ${progress}%;` })),
        h('small', {}, [deck.status === 'ready' ? job.title : 'Se está convirtiendo', job && describeJob(job)].filter(Boolean).join(' · ')));
    }
    return h('div', { class: 'deck-status error' }, h('small', {}, deck.error || 'No se pudo convertir.'));
  }

  function renderList(all, air) {
    // Con DeckCraft web instalado (fase 33, parte 3), «en vivo» lo pasa DeckCraft en la ventana del proyector.
    const deckcraft = state.tools?.list?.some((t) => t.id === 'deckcraft-web' && t.found);
    list.replaceChildren(...all.map((deck) => {
      const usable = deck.status === 'ready';
      const facts = [usable && plural(deck.pages), deck.live && deck.liveable ? (deckcraft ? 'Con animaciones' : 'PowerPoint en vivo') : SOURCES[deck.source], whenLabel(deck.added)].filter(Boolean).join(' · ');
      return h('div', { class: `deck${deck.id === deckId ? ' selected' : ''}${air?.id === deck.id ? ' live' : ''}${usable ? '' : ' pending'}`, dataset: { id: deck.id, status: deck.status, ...(ctx.can('slides.edit') && { drag: deck.id, name: deck.name }) } },
        h('button', { class: 'deck-pick', 'aria-pressed': deck.id === deckId, onclick: () => choose(deck.id) },
          h('span', { class: `deck-cover${usable ? '' : ' blank'}` },
            usable ? h('img', { src: thumbUrl(deck, 1), alt: '', loading: 'lazy' }) : icon('presentation-chart', 26), kindBadge('slides'),
            air?.id === deck.id && h('span', { class: 'badge live' }, 'Al aire')),
          h('span', { class: 'item-text' }, h('strong', {}, deck.name), h('small', {}, facts))),
        statusOf(deck),
        ctx.can('slides.edit') && h('button', { class: 'icon-btn sm deck-more', 'aria-label': `Opciones de ${deck.name}`, onclick: (e) => menu(e.currentTarget, [
          { label: 'Cambiar el nombre', icon: 'pencil-simple', onclick: () => askName(deck) },
          ...lib.menu(deck, e.currentTarget),
          ...(usable && deck.source !== 'pdf' && !deck.atChurch ? [{ label: 'Convertir de nuevo', note: 'Tras instalar las letras que le faltaban', icon: 'arrow-clockwise', onclick: guard(() => action('slides.reconvert', { id: deck.id })) }] : []),
          // En vivo la pasa DeckCraft en la ventana del proyector o, sin él, el propio PowerPoint (solo Windows).
          ...(deck.liveable ? [deck.live
            ? { label: 'Pasar como imágenes', note: 'Con zoom y puntero, sin animaciones', icon: 'images', onclick: guard(() => action('slides.live', { id: deck.id, on: false })) }
            : deckcraft
              ? { label: 'Pasar con animaciones', note: 'DeckCraft, con sus transiciones y animaciones', icon: 'monitor', onclick: guard(() => action('slides.live', { id: deck.id, on: true })) }
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
        h('strong', {}, deck.status === 'church' ? 'Se convierte en el equipo de la iglesia' : deck.status === 'converting' ? 'Se está convirtiendo esta presentación' : 'Esta presentación no se pudo convertir'),
        deck.status === 'church' ? 'Sus diapositivas se verán en la iglesia. Ya se puede añadir al orden del culto.' : deck.status === 'converting' ? 'Aparecerá aquí en cuanto termine. Puedes seguir usando Manna mientras tanto.' : deck.error));
      return;
    }
    // Una presentación de la iglesia vista desde la nube (decisión 64): solo está su portada; las diapositivas, allá.
    if (deck.cover) {
      delete pages.dataset.key;
      pages.replaceChildren(h('div', { class: 'empty' }, h('img', { class: 'deck-cover-only', src: thumbUrl(deck, 1), alt: '' }),
        h('strong', {}, 'Está en el equipo de la iglesia'), `Sus ${plural(deck.pages)} se ven allá. Ya se puede añadir al orden del culto.`));
      return;
    }
    // La rejilla solo se rehace si cambia la presentación: así las imágenes no se vuelven a pedir.
    const key = `${deck.id}|${deck.pages}|${deck.redone || ''}`;
    if (pages.dataset.key !== key) {
      pages.dataset.key = key;
      pages.replaceChildren(h('div', { class: 'slide-grid' }, ...Array.from({ length: deck.pages }, (_, i) =>
        h('button', { class: 'slide-pick', dataset: { n: i + 1 }, onclick: () => pick(i + 1), ondblclick: () => { pick(i + 1); project(); } },
          h('span', { class: 'slide-thumb' }, h('img', { src: pageUrl(deck, i + 1), alt: '', loading: 'lazy', decoding: 'async' })),
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
    // Ya no está (borrada, otra categoría). Lo recién subido que aún no llega no cuenta: la columna sigue como estaba.
    if (deckId && !current() && !awaited) {
      deckId = null;
      open = false;
    }
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
    side.hidden = !(deck && open);
    if (deck) title.textContent = deck.name;
    renderList(all, air);
    renderPages(deck, air);
    if (reveal) pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });

    const usable = deck?.status === 'ready';
    bar.hidden = !deck;
    if (deck) {
      where.textContent = usable ? `${page} de ${deck.pages}` : '';
      where.parentElement.hidden = !usable;
      name.textContent = deck.name;
      if (show) show.disabled = !usable;
      bar.querySelectorAll('.btn:not(.primary):not(.deck-see)').forEach((b) => { b.disabled = !usable; });
      // Abiertas, siempre se pueden cerrar desde aquí. En el celular en horizontal va solo el icono: su nombre, en la etiqueta.
      see.disabled = !usable && !open;
      see.lastChild.textContent = see.title = open ? 'Ocultar diapositivas' : 'Ver diapositivas';
      see.setAttribute('aria-label', see.title);
    }
  }
  subscribe('slides', render);
  subscribe('projection', render);
  subscribe('tools', render);
  subscribe('jobs', () => { if (decks().some((d) => d.status === 'converting')) render(); });

  return {
    id: 'diapositivas', label: 'Presentaciones', kind: 'slides', el, bar, side,
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
      // ↑ ↓ mueven la selección sin tocar la proyección (← → gobiernan lo que está al aire); solo si se ven las
      // diapositivas: si no, nadie vería cuál queda elegida, y desplazan la lista.
      if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        pick(Math.max(1, Math.min(deck.pages, page + (e.key === 'ArrowDown' ? 1 : -1))));
        pages.querySelector('.slide-pick.selected')?.scrollIntoView({ block: 'nearest' });
        return true;
      }
      return false;
    },
  };
}

