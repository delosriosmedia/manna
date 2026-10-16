import { action, connectionId, state, subscribe } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createJobsList } from '../../core/jobs.js';
import { keyOf, kindBadge, kindOf, titleOf } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';
import { createStage } from './stage.js';
import { createLiveControls } from './live.js';
import { createDisplayToggle, describeLive, toggleMode } from './controls.js';
import { createVolume } from './volume.js';
import { createSearch } from './search.js';
import { createListener } from './listen.js';
import { createPreview } from './preview.js';
import { attachGestures } from './gestures.js';

// «Escenario» (fase 13 de docs/PLAN.md): lo que está al aire ocupa el fondo y, encima, en cristal,
// lo que lo gobierna. Lo coloca core/shell.js; aquí solo se hacen las piezas y se mantienen al día.
//   bg         la proyección de fondo (en el celular, solo su color desenfocado: la imagen va en story)
//   status     estado al aire: qué se ve, «Solo fondo» y «Negro» y, en el control del equipo principal, el botón del proyector
//   queue      cola del culto: el orden para operar, con los pasos de lo que está al aire
//   transport  barra de abajo: los mandos de lo que está al aire (siempre a la vista) y, debajo, Anterior,
//              Siguiente, qué sigue y el volumen
//   prep       tarjeta «Preparado»: lo elegido, con Proyectar y Añadir al orden
//   story      celular («Historias»): la proyección en su recuadro, con toques para pasar y lo que sigue
//   controls   los mandos del tipo al aire (live.js) para el celular, que el shell abre en una capa; en el
//              escritorio van en la barra de abajo
//   search     «Buscar en todo» (search.js), solo en las funciones que preparan el culto (canEdit)
// Fuera del equipo principal, la proyección de fondo se dibuja ligera (thumbnail): un video muestra su
// imagen y no se reproduce, para no gastar batería ni red.
const step = (delta) => guard(() => action('projection.step', { delta }));
const NO_SOUND = 'Ahora mismo no suena en ningún sitio. El sonido sale por el equipo principal: abre ahí la proyección o el control y, si ya está abierto, haz un clic en su página.';

export function createEscenario(ctx) {
  // ---- Proyección ----
  const screen = h('div', { class: 'scene-screen' });
  const ambient = h('div', { class: 'scene-ambient', 'aria-hidden': 'true' });
  const bg = h('div', { class: 'scene-bg', 'aria-hidden': 'true' }, ambient, screen);
  // En un dispositivo remoto, lo que suena va sin apuro: si alguien lo escucha aquí, no se oye a saltos.
  const stage = createStage(screen, { thumbnail: !ctx.isLocal, loose: !ctx.isLocal });

  // ---- Estado al aire ----
  const pills = [];
  const livePill = () => {
    const el = h('span', { class: 'live-pill' });
    pills.push(el);
    return el;
  };
  const caption = h('strong', { class: 'scene-caption' });
  const power = ctx.role === 'control' && ctx.isLocal ? createDisplayToggle({ compact: true }) : null;
  // «Solo fondo» y «Negro», junto a lo que está al aire (en el celular van en «Historias»).
  const clear = h('button', { class: 'chip mode-chip', title: 'Ocultar el texto y dejar el fondo', onclick: () => toggleMode('clear') }, 'Solo fondo', h('kbd', {}, 'C'));
  const black = h('button', { class: 'chip mode-chip', title: 'Pantalla en negro', onclick: () => toggleMode('black') }, 'Negro', h('kbd', {}, 'B'));
  const status = h('div', { class: 'scene-status glass' }, livePill(), caption,
    h('div', { class: 'scene-modes', role: 'group', 'aria-label': 'Qué se ve en la proyección' }, clear, black), power);
  // En el celular, la cabecera del cajón dice lo que está al aire (el cajón tapa el recuadro).
  const miniCaption = h('strong', { class: 'scene-caption' });
  const mini = h('div', { class: 'scene-mini' }, livePill(), miniCaption);

  // ---- Lo preparado ----
  // { item?, kind?, title, subtitle?, project?, add?, orderId?, preview? }. preview: lo que un módulo tiene
  // seleccionado (setPreview); se proyecta desde el propio módulo, así que la tarjeta solo lo muestra.
  let prepared = null;
  const prepMonitor = h('div', { class: 'monitor prep-monitor' });
  const prepStage = createStage(prepMonitor, { thumbnail: true });
  const prepBadge = h('span', { class: 'prep-badge' });
  const prepTitle = h('strong', {});
  const prepSub = h('small', {});
  const prepLabel = h('small', { class: 'prep-label' });
  const prepAdd = h('button', { class: 'btn', onclick: guard(async () => {
    await prepared?.add?.();
    toast(`«${prepared.title}» añadido al orden del culto.`);
  }) }, icon('plus', 15), 'Añadir al orden');
  const prepGo = h('button', { class: 'btn primary', onclick: () => projectPrepared() }, 'Proyectar', h('kbd', {}, '↵'));
  const prep = h('section', { class: 'prep glass', 'aria-label': 'Preparado', hidden: true },
    h('div', { class: 'prep-head' }, prepLabel, h('button', { class: 'icon-btn sm', 'aria-label': 'Quitar lo preparado', onclick: () => clearPrepared() }, icon('x', 14))),
    prepMonitor,
    h('div', { class: 'prep-text' }, prepBadge, h('span', { class: 'item-text' }, prepTitle, prepSub)),
    h('div', { class: 'prep-actions' }, prepAdd, prepGo));

  // La cola deja sitio a la tarjeta, mida lo que mida (con o sin miniatura).
  new ResizeObserver(() => document.body.style.setProperty('--prep-h', `${prep.offsetHeight}px`)).observe(prep);

  function renderPrepared() {
    const p = state.projection;
    const src = p?.item?.source;
    // Lo preparado que ya está al aire sobra.
    const onAir = prepared && p?.mode === 'live' && ((prepared.orderId && src?.orderId === prepared.orderId && (prepared.step ?? 0) === (src?.step ?? 0))
      || (prepared.item && keyOf(prepared.item) === keyOf(p.item)));
    prep.hidden = !prepared || onAir;
    document.body.classList.toggle('has-prep', !prep.hidden);
    if (prep.hidden) return;
    prepLabel.textContent = prepared.project ? 'PREPARADO' : 'SELECCIONADO';
    prepMonitor.hidden = !prepared.item;
    if (prepared.item) prepStage.render({ mode: 'live', item: prepared.item, styles: p?.styles || {} });
    prepBadge.replaceChildren(prepared.kind ? kindBadge(prepared.kind) : '');
    prepTitle.textContent = prepared.title || titleOf(prepared.item);
    prepSub.textContent = prepared.subtitle || (prepared.project ? '' : 'Se proyecta desde su módulo');
    prepGo.hidden = !prepared.project;
    prepAdd.hidden = !prepared.add;
  }
  function prepare(next) {
    prepared = next;
    renderPrepared();
    renderQueue();
  }
  function clearPrepared() {
    prepare(null);
  }
  const projectPrepared = guard(async () => {
    if (!prepared?.project) return false;
    const go = prepared.project;
    clearPrepared();
    await go();
    return true;
  });
  const search = ctx.canEdit ? createSearch({ prepare, projectPrepared, canEdit: ctx.canEdit }) : null;
  const prepareOrder = (item, k = 0) => prepare({
    kind: item.kind, title: item.title, subtitle: item.steps > 1 ? `${item.subtitle} · paso ${k + 1}` : item.subtitle,
    orderId: item.id, step: k, project: () => action('order.show', { id: item.id, step: k }),
  });

  // ---- Cola del culto ----
  let queueOpen = prefs.get('cola', true);
  const queuePos = h('small', {});
  const queueList = h('div', { class: 'queue-list' });
  const jobs = h('div', { class: 'scene-jobs' });
  // El botón de plegar va siempre arriba a la derecha, y su forma dice qué hará: desplegada, la flecha hacia arriba
  // (plegar); plegada, la lista con la flecha hacia abajo (desplegar).
  const queueToggle = h('span', { class: 'queue-toggle', 'aria-hidden': 'true' });
  const queueHead = h('button', { class: 'queue-head', 'aria-expanded': String(queueOpen), onclick: () => setQueue(!queueOpen) },
    h('strong', {}, 'Cola del culto'), queuePos, queueToggle);
  const queue = h('aside', { class: 'queue glass', 'aria-label': 'Cola del culto' }, queueHead, jobs, queueList);
  function setQueue(open) {
    queueOpen = open;
    prefs.set('cola', open);
    queue.classList.toggle('closed', !open);
    queueHead.setAttribute('aria-expanded', String(open));
    queueHead.title = open ? 'Plegar la cola del culto' : 'Desplegar la cola del culto';
    queueToggle.replaceChildren(...(open ? [icon('caret-up', 18)] : [icon('rows', 18), icon('caret-down', 14)]));
    document.body.classList.toggle('queue-closed', !open);
  }
  setQueue(queueOpen);

  const orderItems = () => state.order?.items || [];
  const liveSource = () => state.projection?.item?.source || null;
  function renderQueue() {
    const items = orderItems();
    const src = liveSource();
    const liveId = src?.orderId;
    const at = items.findIndex((i) => i.id === liveId);
    queuePos.textContent = at < 0 ? '' : `${items.slice(0, at + 1).filter((i) => i.kind !== 'section').length} de ${items.filter((i) => i.kind !== 'section').length}`;
    if (!items.length) {
      queueList.replaceChildren(h('p', { class: 'muted queue-empty' }, 'El orden del culto está vacío. Se prepara en el módulo Orden.'));
      return;
    }
    queueList.replaceChildren(...items.map((item, i) => {
      if (item.kind === 'section') return h('small', { class: 'queue-section' }, item.title);
      const live = item.id === liveId;
      const row = h('button', {
        class: `queue-item${live ? ' live' : ''}${prepared?.orderId === item.id ? ' prepared' : ''}${at >= 0 && i < at ? ' done' : ''}`,
        dataset: { id: item.id }, title: item.title,
        onclick: () => prepareOrder(item), ondblclick: guard(() => action('order.show', { id: item.id })),
      }, kindBadge(item.kind), h('span', { class: 'item-text' }, h('strong', {}, item.title), h('small', {}, item.subtitle)));
      if (!live || !(item.steps > 1)) return row;
      const now = src.step ?? 0;
      return h('div', { class: 'queue-live' }, row, h('div', { class: 'queue-steps' }, ...Array.from({ length: item.steps }, (_, k) =>
        h('button', { class: `step-cell${k === now ? ' on' : k < now ? ' done' : ''}`, 'aria-label': `Paso ${k + 1}`, onclick: guard(() => action('order.show', { id: item.id, step: k })) }, String(k + 1)))));
    }));
  }

  // ---- Señalar y Mover, sobre la proyección ----
  // Como en el Presentador: el dedo o el ratón señalan en la proyección o mueven y acercan el encuadre, sobre la
  // proyección de fondo (escritorio) o el recuadro de «Historias» (celular). Solo con lo que sabe situar un punto
  // (una imagen, una diapositiva, una página); «Mover», además, con lo que se puede acercar.
  let tool = null;
  // En el fondo entero (la proyección no recibe el ratón); en el celular, en el recuadro (más abajo).
  const gestures = attachGestures(bg, { stage, tool: () => tool, box: screen });
  const toolSets = [];
  const toolSet = () => {
    const chips = [['point', 'hand-pointing', 'Señalar'], ['move', 'arrows-out-cardinal', 'Mover']].map(([id, glyph, label]) =>
      h('button', { class: 'chip tool-chip', dataset: { tool: id }, 'aria-pressed': 'false', onclick: () => { tool = tool === id ? null : id; paintTools(); } }, icon(glyph, 15), label));
    const reset = h('button', { class: 'chip tool-chip', 'aria-label': 'Restablecer el zoom', title: 'Ver la imagen entera', onclick: () => gestures.reset() }, icon('arrow-counter-clockwise', 15), 'Restablecer');
    const el = h('div', { class: 'scene-tools', role: 'group', 'aria-label': 'Señalar y mover sobre la proyección', hidden: true }, ...chips, reset);
    toolSets.push({ el, chips, reset });
    return el;
  };
  function paintTools() {
    const item = state.projection?.item;
    const live = state.live?.uid === item?.uid ? state.live?.state : null;
    const pointable = Boolean(item) && state.projection.mode === 'live' && stage.pointable();
    // Lo que pasa PowerPoint no se acerca desde Manna (su punto, sí).
    const movable = pointable && Boolean(live?.zoom) && !item.powerpoint;
    if ((tool === 'point' && !pointable) || (tool === 'move' && !movable)) tool = null;
    for (const set of toolSets) {
      set.el.hidden = !pointable;
      for (const chip of set.chips) {
        chip.hidden = chip.dataset.tool === 'move' && !movable;
        chip.classList.toggle('on', chip.dataset.tool === tool);
        chip.setAttribute('aria-pressed', String(chip.dataset.tool === tool));
      }
      set.reset.hidden = !movable;
      set.reset.disabled = !gestures.framed();
    }
    if (tool) bg.dataset.tool = tool; else delete bg.dataset.tool;
    if (tool) frame.dataset.tool = tool; else delete frame.dataset.tool;
  }

  // ---- Barra de transporte ----
  const upNext = h('strong', {});
  // Los mandos de lo que está al aire, siempre a la vista encima de los botones de pasar (en el escritorio).
  const barControls = h('div', { class: 'tb-live' });
  createLiveControls(barControls);
  const barTools = toolSet();
  const barExtra = h('div', { class: 'tb-extra' }, barTools, barControls);
  const noSound = h('button', { class: 'icon-btn no-sound', hidden: true, title: NO_SOUND, 'aria-label': 'No suena en ningún sitio', onclick: () => toast(NO_SOUND, 'error') }, icon('warning', 18));
  const volume = createVolume();
  // «Escuchar aquí», en los dispositivos que no son el equipo principal (este ya suena para la iglesia).
  const listener = ctx.isLocal ? null : createListener(stage);
  // «Escuchar antes de añadir», también solo fuera del equipo principal.
  const preview = ctx.isLocal ? null : createPreview();
  const transport = h('div', { class: 'transport-bar glass', role: 'group', 'aria-label': 'Al aire' }, barExtra,
    h('div', { class: 'tb-main' },
      h('button', { class: 'btn round', 'aria-label': 'Anterior', title: 'Anterior (←)', onclick: step(-1) }, icon('caret-left', 18)),
      h('button', { class: 'btn primary next', onclick: step(1) }, 'Siguiente', icon('caret-right', 18)),
      h('div', { class: 'up-next' }, h('small', {}, 'SIGUE'), upNext),
      h('div', { class: 'tb-volume' }, noSound, volume.el), listener?.button()));
  // Lo que ocupa la barra (crece con los mandos): el cajón, la cola y «Preparado» le dejan sitio.
  new ResizeObserver(() => { if (transport.offsetHeight) document.body.style.setProperty('--tb-h', `${transport.offsetHeight}px`); }).observe(transport);

  function nextText() {
    const items = orderItems();
    const src = liveSource();
    const at = items.findIndex((i) => i.id === src?.orderId);
    if (at >= 0) {
      const cur = items[at];
      if (cur.steps > 1 && (src.step ?? 0) + 1 < cur.steps) return `${cur.title} · paso ${(src.step ?? 0) + 2}`;
      return items.slice(at + 1).find((i) => i.kind !== 'section')?.title || 'Fin del orden del culto';
    }
    return state.projection?.item ? 'El paso siguiente' : 'Nada en pantalla';
  }

  // ---- Mandos del tipo al aire ----
  const controls = h('div', { class: 'scene-controls' });
  createLiveControls(controls);
  createJobsList(jobs, { canDismiss: ctx.canEdit });

  // ---- Celular: «Historias» ----
  const segments = h('div', { class: 'story-steps', 'aria-hidden': 'true' });
  const frame = h('div', { class: 'story-frame' }, segments,
    h('button', { class: 'story-zone prev', 'aria-label': 'Anterior', onclick: step(-1) }),
    h('button', { class: 'story-zone next', 'aria-label': 'Siguiente', onclick: step(1) }));
  attachGestures(frame, { stage, tool: () => tool, box: screen });
  const storyTitle = h('strong', {});
  const storySub = h('small', {});
  const modes = [['live', 'Al aire'], ['clear', 'Solo fondo'], ['black', 'Negro']].map(([mode, label]) => h('button', {
    class: 'seg-btn', dataset: { mode }, 'aria-pressed': 'false', onclick: guard(() => action('projection.mode', { mode })),
  }, label));
  const storyVolume = createVolume();
  const carousel = h('div', { class: 'story-next-list' });
  const story = h('main', { class: 'story', 'aria-label': 'Al aire' },
    frame,
    h('div', { class: 'story-caption' }, livePill(), h('span', { class: 'item-text' }, storyTitle, storySub),
      h('button', { class: 'icon-btn story-controls', 'aria-label': 'Mandos de lo que está al aire', onclick: () => ctx.openControls?.() }, icon('sliders-horizontal', 18))),
    h('p', { class: 'story-hint' }, 'Toca la imagen: a la derecha avanza, a la izquierda vuelve.'),
    toolSet(),
    h('div', { class: 'story-modes', role: 'group', 'aria-label': 'Qué se ve en la proyección' }, ...modes),
    h('div', { class: `story-volume${ctx.role === 'alabanza' ? ' big' : ''}` }, storyVolume.el, listener?.button()),
    h('div', { class: 'story-next' }, h('div', { class: 'story-next-head' }, h('strong', {}, 'A continuación'), h('small', {}, 'Toca: prepara · doble toque: proyecta')), carousel));

  function renderStory(p) {
    const items = orderItems();
    const src = p.item?.source;
    const cur = items.find((i) => i.id === src?.orderId);
    const total = cur?.steps > 1 ? cur.steps : p.item?.pages > 1 ? p.item.pages : 0;
    const now = cur ? (src.step ?? 0) : (p.item?.index ?? p.item?.number ?? 1) - 1; // index: la diapositiva de una letra; number, la de una presentación
    segments.replaceChildren(...Array.from({ length: Math.min(total, 40) }, (_, k) => h('span', { class: k < now ? 'done' : k === now ? 'on' : '' })));
    const live = describeLive(p);
    storyTitle.textContent = live.text || live.label;
    storySub.textContent = total ? `paso ${now + 1} de ${total}` : live.text ? live.label : '';
    for (const b of modes) {
      const on = (b.dataset.mode === 'live' && p.mode === 'live' && Boolean(p.item)) || (b.dataset.mode !== 'live' && p.mode === b.dataset.mode);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    const at = items.findIndex((i) => i.id === src?.orderId);
    const upcoming = items.slice(at + 1).filter((i) => i.kind !== 'section').slice(0, 8);
    carousel.replaceChildren(...(upcoming.length
      ? upcoming.map((item) => h('button', { class: 'story-card', title: item.title, onclick: () => prepareOrder(item), ondblclick: guard(() => action('order.show', { id: item.id })) },
        kindBadge(item.kind), h('strong', {}, item.title), h('small', {}, item.subtitle)))
      : [h('p', { class: 'muted' }, items.length ? 'No queda nada más en el orden.' : 'El orden del culto está vacío.')]));
  }

  // ---- Al día ----
  function paintBackground(styles = {}) {
    ambient.style.background = styles.backgroundType === 'image' && styles.bgImage
      ? `url("${styles.bgImage}") center / cover no-repeat`
      : styles.backgroundType === 'gradient' ? styles.bgGradient : styles.bgColor || '#000';
  }
  subscribe('projection', (p) => {
    stage.render(p);
    const live = describeLive(p);
    bg.dataset.state = live.state;
    frame.dataset.state = live.state;
    for (const pill of pills) {
      pill.textContent = live.state === 'live' ? '● AL AIRE' : live.state === 'black' ? 'NEGRO' : live.state === 'clear' ? 'SOLO FONDO' : 'NADA';
      pill.dataset.state = live.state;
    }
    caption.textContent = live.text || live.label;
    miniCaption.textContent = caption.textContent;
    black.classList.toggle('on', p.mode === 'black');
    clear.classList.toggle('on', p.mode === 'clear' && Boolean(p.item));
    barExtra.hidden = !(p.item && kindOf(p.item.kind)?.controls) && !stage.pointable();
    paintTools();
    paintMotion();
    upNext.textContent = nextText();
    paintBackground(p.styles);
    renderQueue();
    renderStory(p);
    renderPrepared();
  });
  subscribe('order', () => {
    renderQueue();
    if (state.projection) renderStory(state.projection);
    upNext.textContent = nextText();
  });
  // Con un video en movimiento detrás, el cristal deja de desenfocar (shell.css, body.moving): desenfocar lo que
  // cambia en cada fotograma es lo que más gasta la tarjeta gráfica.
  const paintMotion = () => document.body.classList.toggle('moving', Boolean(screen.querySelector('.clip-view.on-air video')));
  subscribe('live', (l) => {
    stage.setLive(l);
    paintTools();
    paintMotion();
  });
  // El punto rojo del Presentador también se ve en el fondo (y en el recuadro de «Historias»).
  subscribe('pointer', (p) => stage.setPointer(p));
  subscribe('conexiones', ({ sonido }) => {
    stage.setSound(Boolean(sonido) && sonido === connectionId());
    noSound.hidden = Boolean(sonido);
  });

  return {
    bg, status, mini, queue, transport, prep, story, controls, search, preview,
    // En el celular la proyección va en el recuadro de «Historias»; en el escritorio, de fondo.
    place(narrow) {
      (narrow ? frame : bg).prepend(screen);
    },
    toggleMode,
    prepare,
    projectPrepared,
    clearPrepared,
    // Lo que el módulo abierto tiene seleccionado (o null): se muestra, y se proyecta desde el módulo.
    setPreview(item) {
      if (!item) {
        if (prepared?.preview) clearPrepared();
        return;
      }
      prepare({ item, title: titleOf(item), preview: true });
    },
  };
}
