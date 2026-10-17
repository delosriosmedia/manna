import { action, connectionId, state, subscribe } from '../../core/api.js';
import { h, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createJobsList } from '../../core/jobs.js';
import { kindBadge, kindOf } from '../../core/kinds.js';
import { prefs } from '../../core/prefs.js';
import { createStage } from './stage.js';
import { createLiveControls } from './live.js';
import { createDisplayToggle, describeLive, toggleMode } from './controls.js';
import { createVolume } from './volume.js';
import { createSearch } from './search.js';
import { createPreview } from './preview.js';
import { attachGestures } from './gestures.js';

const BAR_IDLE_MS = 2500; // sin mover el ratón ni pulsar una tecla, la barra de abajo se aparta

// «Escenario» (fase 13 de docs/PLAN.md): lo que está al aire ocupa el fondo y, encima, en cristal,
// lo que lo gobierna. Lo coloca core/shell.js; aquí solo se hacen las piezas y se mantienen al día.
//   bg         la proyección de fondo (en el celular, solo su color desenfocado: la imagen va en story)
//   status     estado al aire: qué se ve, «Solo fondo» y «Negro» y, en el control del equipo principal, el botón del proyector
//   queue      cola del culto: el orden para operar, con los pasos de lo que está al aire
//   transport  barra de abajo: los mandos de lo que está al aire (siempre a la vista) y, debajo, Anterior,
//              Siguiente, qué sigue y el volumen
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
  const stage = createStage(screen, { thumbnail: !ctx.isLocal });

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

  // ---- Lo marcado ----
  // { orderId, step, project }: el elemento de la cola o de «A continuación» que se tocó. Se ve con su borde cian y
  // un ▶ para proyectarlo; Intro (shell.js) y el doble toque también lo proyectan.
  let prepared = null;
  const markPrepared = () => {
    for (const row of [...queueList.querySelectorAll('.queue-item'), ...carousel.querySelectorAll('.story-card')]) row.classList.toggle('prepared', prepared?.orderId === row.dataset.id);
  };
  const projectPrepared = guard(async () => {
    if (!prepared?.project) return false;
    const go = prepared.project;
    prepared = null;
    markPrepared();
    await go();
    return true;
  });
  const search = ctx.canEdit ? createSearch({ canEdit: ctx.canEdit }) : null;
  const prepareOrder = (item, k = 0) => {
    prepared = { orderId: item.id, step: k, project: () => action('order.show', { id: item.id, step: k }) };
    markPrepared();
  };

  // ---- Cola del culto ----
  let queueOpen = prefs.get('cola', true);
  const queuePos = h('small', {});
  const queueList = h('div', { class: 'queue-list' });
  const jobs = h('div', { class: 'scene-jobs' });
  // El botón de plegar va siempre arriba a la derecha, y su forma dice qué hará: desplegada, la flecha hacia arriba
  // (plegar); plegada, la lista con la flecha hacia abajo (desplegar).
  const queueToggle = h('span', { class: 'queue-toggle', 'aria-hidden': 'true' });
  // Debajo del título, el nombre del orden en uso (si tiene).
  const queueName = h('span', { class: 'queue-name' });
  const queueHead = h('button', { class: 'queue-head', 'aria-expanded': String(queueOpen), onclick: () => setQueue(!queueOpen) },
    h('strong', {}, 'Cola del culto', queueName), queuePos, queueToggle);
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

  // El ▶ de la fila marcada (CSS: solo se ve en la que está marcada y no al aire).
  const playButton = (item, cls) => h('button', { class: `icon-btn sm ${cls}`, 'aria-label': `Proyectar «${item.title}»`, title: 'Proyectar (Intro)', onclick: projectPrepared }, icon('play', 14));
  const orderItems = () => state.order?.items || [];
  const liveSource = () => state.projection?.item?.source || null;
  // La cola solo se rehace si cambia lo que muestra (los elementos, el que está al aire o su paso); preparar otro
  // solo mueve su marca. Al rehacerla, el foco vuelve al mismo botón (data-key).
  let queueShape = null;
  const focusKey = (el) => el?.closest?.('[data-key]')?.dataset.key || null;
  function renderQueue() {
    const items = orderItems();
    const src = liveSource();
    const liveId = src?.orderId;
    const at = items.findIndex((i) => i.id === liveId);
    queuePos.textContent = at < 0 ? '' : `${items.slice(0, at + 1).filter((i) => i.kind !== 'section').length} de ${items.filter((i) => i.kind !== 'section').length}`;
    const shape = JSON.stringify([items.map((i) => [i.id, i.kind, i.title, i.subtitle, i.steps]), liveId, liveId ? src.step ?? 0 : null]);
    if (shape === queueShape) {
      markPrepared();
      return;
    }
    queueShape = shape;
    if (!items.length) {
      queueList.replaceChildren(h('p', { class: 'muted queue-empty' }, 'El orden del culto está vacío. Se prepara en el módulo Orden.'));
      return;
    }
    const focused = queueList.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    queueList.replaceChildren(...items.map((item, i) => {
      if (item.kind === 'section') return h('small', { class: 'queue-section' }, item.title);
      const live = item.id === liveId;
      const row = h('div', {
        class: `queue-item${live ? ' live' : ''}${prepared?.orderId === item.id ? ' prepared' : ''}${at >= 0 && i < at ? ' done' : ''}`,
        dataset: { id: item.id }, 'aria-current': live ? 'true' : null,
      }, h('button', { class: 'queue-main', dataset: { key: item.id }, title: item.title, onclick: () => prepareOrder(item), ondblclick: guard(() => action('order.show', { id: item.id })) },
        kindBadge(item.kind), h('span', { class: 'item-text' }, h('strong', {}, item.title), h('small', {}, item.subtitle))),
      playButton(item, 'queue-play'));
      if (!live || !(item.steps > 1)) return row;
      const now = src.step ?? 0;
      return h('div', { class: 'queue-live' }, row, h('div', { class: 'queue-steps' }, ...Array.from({ length: item.steps }, (_, k) =>
        h('button', { class: `step-cell${k === now ? ' on' : k < now ? ' done' : ''}`, dataset: { key: `${item.id}|${k}` }, 'aria-label': `Paso ${k + 1}`, 'aria-current': k === now ? 'step' : null, onclick: guard(() => action('order.show', { id: item.id, step: k })) }, String(k + 1)))));
    }));
    if (focused) [...queueList.querySelectorAll('[data-key]')].find((b) => b.dataset.key === focused)?.focus({ preventScroll: true });
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
      h('button', { class: 'chip tool-chip', dataset: { tool: id }, title: label, 'aria-label': label, 'aria-pressed': 'false', onclick: () => { tool = tool === id ? null : id; paintTools(); } }, icon(glyph, 15), h('span', { class: 'lbl' }, label)));
    const reset = h('button', { class: 'chip tool-chip', 'aria-label': 'Restablecer el zoom', title: 'Ver la imagen entera', onclick: () => gestures.reset() }, icon('arrow-counter-clockwise', 15), h('span', { class: 'lbl' }, 'Restablecer'));
    const el = h('div', { class: 'scene-tools', role: 'group', 'aria-label': 'Señalar y mover sobre la proyección', hidden: true }, ...chips, reset);
    toolSets.push({ el, chips, reset });
    return el;
  };
  function paintTools() {
    const item = state.projection?.item;
    const live = state.live?.uid === item?.uid ? state.live?.state : null;
    const pointable = Boolean(item) && state.projection.mode === 'live' && stage.pointable();
    // Lo que pasa PowerPoint también: al acercarlo, PowerPoint se aparta (server/modules/slides).
    const movable = pointable && Boolean(live?.zoom);
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
  // Una sola fila: Anterior, Siguiente, los mandos de lo que está al aire (con prioridades: lo que no cabe se queda en
  // «Más mandos»; ver shell.css), el volumen y «Más mandos».
  const barControls = h('div', { class: 'tb-live' });
  createLiveControls(barControls);
  const barTools = toolSet();
  const barExtra = h('div', { class: 'tb-extra' }, barTools, barControls);
  const noSound = h('button', { class: 'icon-btn no-sound', hidden: true, title: NO_SOUND, 'aria-label': 'No suena en ningún sitio', onclick: () => toast(NO_SOUND, 'error') }, icon('warning', 18));
  const volume = createVolume();
  const more = h('button', { class: 'icon-btn tb-more', 'aria-label': 'Más mandos', title: 'Más mandos', 'aria-haspopup': 'dialog', onclick: () => ctx.openControls?.() }, icon('sliders-horizontal', 18));
  // «Escuchar antes de añadir», solo fuera del equipo principal (este ya suena para la iglesia).
  const preview = ctx.isLocal ? null : createPreview();
  const transport = h('div', { class: 'transport-bar glass', role: 'group', 'aria-label': 'Al aire' },
    h('div', { class: 'tb-main' },
      h('button', { class: 'btn round', 'aria-label': 'Anterior', title: 'Anterior (←)', onclick: step(-1) }, icon('caret-left', 18)),
      h('button', { class: 'btn primary next', onclick: step(1) }, 'Siguiente', icon('caret-right', 18)),
      barExtra,
      h('div', { class: 'tb-volume' }, noSound, volume.el),
      more));
  // La barra se aparta (shell.css): con ratón y en pantalla ancha, tras unos segundos sin mover el ratón ni pulsar una
  // tecla, como en un reproductor de video; y, con ratón o con dedo, al tocar el fondo (la proyección), salvo con
  // «Señalar» o «Mover», donde el toque es para señalar. Moviendo el ratón (o con otro toque en el fondo) vuelve.
  let idle = null;
  let held = null; // dónde se tocó el fondo para esconderla: el temblor del clic no debe traerla de vuelta
  const wake = (e) => {
    if (e?.type === 'pointerdown' && e.target.closest?.('.scene-bg')) return; // el toque en el fondo la esconde (tapBackground)
    if (held && e?.type === 'mousemove' && Math.hypot(e.clientX - held.x, e.clientY - held.y) < 8) return;
    held = null;
    document.body.classList.remove('bar-idle', 'bar-off');
    clearTimeout(idle);
    idle = setTimeout(() => {
      // No se aparta mientras se usa: el ratón encima, algo suyo con el foco, o un menú o una ventana abiertos.
      if (transport.matches(':hover') || transport.contains(document.activeElement) || document.querySelector('.menu, .modal-backdrop')) wake();
      else document.body.classList.add('bar-idle');
    }, BAR_IDLE_MS);
  };
  for (const type of ['mousemove', 'pointerdown', 'keydown', 'wheel']) document.addEventListener(type, wake, { passive: true });
  // Lo que ocupa la barra: el cajón y la cola le dejan sitio.
  new ResizeObserver(() => { if (transport.offsetHeight) document.body.style.setProperty('--tb-h', `${transport.offsetHeight}px`); }).observe(transport);

  // ---- Mandos del tipo al aire ----
  const controls = h('div', { class: 'scene-controls' });
  createLiveControls(controls);
  createJobsList(jobs, { canDismiss: ctx.canEdit, filter: (job) => !job.quiet });

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
    h('div', { class: `story-volume${ctx.role === 'alabanza' ? ' big' : ''}` }, storyVolume.el),
    h('div', { class: 'story-next' }, h('div', { class: 'story-next-head' }, h('strong', {}, 'A continuación'), h('small', {}, 'Toca: marca · ▶ o doble toque: proyecta')), carousel));

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
      ? upcoming.map((item) => h('div', { class: `story-card${prepared?.orderId === item.id ? ' prepared' : ''}`, dataset: { id: item.id } },
        h('button', { class: 'story-main', title: item.title, onclick: () => prepareOrder(item), ondblclick: guard(() => action('order.show', { id: item.id })) },
          kindBadge(item.kind), h('strong', {}, item.title), h('small', {}, item.subtitle)),
        playButton(item, 'story-play')))
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
    black.setAttribute('aria-pressed', String(p.mode === 'black'));
    clear.setAttribute('aria-pressed', String(p.mode === 'clear' && Boolean(p.item)));
    barExtra.hidden = !(p.item && kindOf(p.item.kind)?.controls) && !stage.pointable();
    more.hidden = barExtra.hidden;
    paintTools();
    paintMotion();
    paintBackground(p.styles);
    // Lo marcado que ya está al aire sobra.
    const src = p.item?.source;
    if (prepared && p.mode === 'live' && src?.orderId === prepared.orderId && (prepared.step ?? 0) === (src?.step ?? 0)) prepared = null;
    renderQueue();
    renderStory(p);
  });
  subscribe('order', (o) => {
    queueName.textContent = o.name || '';
    renderQueue();
    if (state.projection) renderStory(state.projection);
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
    bg, status, mini, queue, transport, story, controls, search, preview,
    // En el celular la proyección va en el recuadro de «Historias»; en el escritorio, de fondo.
    place(narrow) {
      (narrow ? frame : bg).prepend(screen);
    },
    toggleMode,
    projectPrepared,
    // Un toque en el fondo (shell.js) esconde la barra de abajo, o la trae si ya estaba escondida (con el dedo no hay
    // «mover el ratón»).
    tapBackground(e) {
      if (document.body.classList.contains('bar-off')) wake();
      else {
        held = { x: e.clientX, y: e.clientY };
        clearTimeout(idle);
        document.body.classList.add('bar-off');
      }
    },
  };
}
