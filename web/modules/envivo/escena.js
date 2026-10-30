import { action, api, connectionId, silenceMs, state, stepAir, subscribe } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { kindBadge, kindOf, titleOf } from '../../core/kinds.js';
import { positionAt } from '../../core/playback.js';
import { createSender } from '../../core/sender.js';
import { attachGestures } from '../projection/gestures.js';
import { createLiveControls } from '../projection/live.js';
import { createPreview } from '../projection/preview.js';
import { createSearch } from '../projection/search.js';
import { mando, plainSlot } from '../projection/slot.js';
import { createStage, lightLayer, withOver } from '../projection/stage.js';
import { ballSlider } from '../projection/deslizador.js';
import { describeLive, toggleMode } from '../projection/controls.js';
import { createOrador } from './orador.js';
import { guardTouches } from './toques.js';

// «En vivo» (fases 44 a 47, tableros T y U, DESIGN.md 12 ter): la pantalla de un celular o una tableta. Arriba, lo que está al
// aire tal cual; debajo, sus mandos en una ranura de alto fijo, las capas y el volumen, el orden y, abajo, la franja del
// pulgar y el dock. Las piezas son hermanas en una sola rejilla (envivo.css) para que girar el dispositivo las recoloque
// sin rehacer nada: conservan el desplazamiento, la hoja abierta y lo escrito. La rejilla la compone core/shell.js con
// compose(), porque la marca, el dock y el cajón son suyos.
const OFFLINE_MS = 12_000;
const BACK_MS = 10_000;
const SEGMENTS = 24; // desde 25 pasos, una barra continua: ningún segmento baja de 4 px
const NO_SOUND = 'Ahora mismo no suena en ningún sitio. El sonido sale por el equipo principal: abre ahí la proyección o el control.';
const toolLabels = { point: ['Señalar', 'hand-pointing'], move: ['Mover', 'arrows-out-cardinal'] };

//   variant  'control' (Control total) o 'alabanza': el reproductor, con el avance y el transporte aparte; el volumen a pasos;
//            la lista, la sección del canto al aire, con la pista de cada canto; y las capas, una pastilla que abre una hoja
//            'orador' y 'sencillo': lo de en medio es suyo (orador.js)
export function createEnVivo(ctx, { variant = 'control' } = {}) {
  const player = variant === 'alabanza';
  const orator = variant === 'orador' || variant === 'sencillo';
  const buzz = () => { if (variant === 'sencillo') navigator.vibrate?.(15); }; // sin mirar: se siente que pasó
  // ---- La vista: se ve tal cual y no responde al toque, salvo con «Señalar» o «Mover» ----
  const screen = h('div', { class: 'ev-screen', 'data-vista': '' });
  const stage = createStage(screen, { thumbnail: !ctx.isLocal, moving: !ctx.isLocal });
  const band = h('div', { class: 'ev-steps', 'aria-hidden': 'true' });
  const vista = h('div', { class: 'ev-vista' }, screen, band);
  let tool = null;
  const gestures = attachGestures(vista, { stage, tool: () => tool, box: screen });
  const infoTitle = h('b', {});
  const infoStep = h('small', {});
  const infoNext = h('small', {});
  const info = h('div', { class: 'ev-info' }, infoTitle, infoStep, infoNext);
  const nowName = player && h('strong', { class: 'ev-now' }); // acostado, el título va bajo la vista

  // ---- La barra de arriba: el estado ----
  const pill = h('span', { class: 'ev-pill' });
  const statusTitle = h('strong', { class: 'ev-title' });
  const statusWhere = h('small', { class: 'ev-where' });
  const capasChip = player && h('button', { class: 'ev-chip-capas', hidden: true, onclick: () => dialog('Capas', capas) });
  const status = h('div', { class: 'ev-status glass', role: 'status' }, pill, statusTitle, statusWhere, capasChip);
  const search = ctx.can('order.edit') ? createSearch() : null;
  const preview = ctx.isLocal ? null : createPreview();

  // ---- El orden ----
  const list = h('div', { class: 'ev-list' });
  const backText = h('span', {});
  const backTime = h('small', {});
  const back = h('button', { class: 'ev-back', 'data-tapa': '', hidden: true }, icon('arrow-left', 14), backText, backTime);
  const listBox = h('div', { class: 'ev-listbox' }, list, back);
  const prepView = h('div', { class: 'ev-prep-view' });
  const prepStage = createStage(prepView, { thumbnail: true });
  const prepName = h('b', {});
  const prepPut = mando({ label: 'Poner', glyph: 'play', cls: 'ev-put', onclick: () => projectPrepared() });
  const prep = h('div', { class: 'ev-prep' }, prepView, h('div', { class: 'ev-prep-text' }, h('span', {}, 'Marcada'), prepName), prepPut);

  // ---- La ranura de mandos ----
  const slot = h('div', { class: 'ev-slot' });
  const send = guard((patch) => action('projection.control', patch));
  const toolButtons = new Set();
  // En Alabanza, lo que suena lleva su avance y su transporte en su propio sitio (clipRow).
  const seekBox = player && h('div', { class: 'ev-seekbox' });
  const trans = player && h('div', { class: 'ev-trans' });
  const slotApi = {
    send,
    seekHost: seekBox,
    transportHost: trans,
    more: () => mando({ label: 'Más', glyph: 'dots-three', cls: 'ev-mas', onclick: () => ctx.openControls?.() }),
    tool(id) {
      const [label, glyph] = toolLabels[id];
      const b = mando({ label, glyph, onclick: () => { tool = tool === id ? null : id; paintTools(); } });
      b.dataset.tool = id;
      toolButtons.add(b);
      return b;
    },
  };
  const controls = h('div', { class: 'scene-controls' });
  createLiveControls(controls);

  // ---- Capas y volumen ----
  const capas = h('div', { class: 'ev-capas', role: 'group', 'aria-label': 'Capas' });
  const addLayer = ctx.can('layers.edit') && ctx.has('capas') && h('button', { class: 'ev-isle ev-add', 'aria-label': 'Poner algo en una capa', onclick: () => ctx.go('capas') }, h('span', { class: 'num' }, icon('plus', 12)));
  if (addLayer) capas.append(addLayer);
  const isles = new Map(); // n -> { el, name, slot }
  const volume = player ? createStepVolume() : createBallVolume();
  const noSound = h('button', { class: 'ev-nosound', hidden: true, 'aria-label': 'No suena en ningún sitio', title: NO_SOUND, onclick: () => toast(NO_SOUND, 'error') }, icon('warning', 16));
  let volumeBox = null;
  const volumeAsButton = h('button', { class: 'ev-vol-btn', 'aria-label': 'Volumen', onclick: () => {
    volumeBox ||= createBallVolume();
    dialog('Volumen', volumeBox.el);
  } }, icon('speaker-high', 14), h('span', { class: 'ev-amount' }));
  const vol = h('div', { class: 'ev-vol' }, noSound, volume.el, !player && volumeAsButton);
  const mid = h('div', { class: 'ev-mid' }, !player && capas, vol, trans);

  // ---- La franja del pulgar ----
  const modeButton = (mode, label, glyph) => h('button', { class: 'ev-mode', 'data-peligro': '', dataset: { mode }, 'aria-pressed': 'false', title: label, onclick: () => toggleMode(mode) }, icon(glyph, 15), h('span', {}, label));
  const clear = modeButton('clear', 'Solo fondo', 'text-t-slash');
  const black = modeButton('black', 'Negro', 'pantalla-negra');
  const modos = h('div', { class: 'ev-modos', role: 'group', 'aria-label': 'Qué se ve en la proyección' }, clear, black);
  const prev = h('button', { class: 'ev-prev', 'data-paso': '', 'aria-label': 'Anterior', title: 'Anterior (←)', onclick: guard(async () => { await stepAir(-1); buzz(); }) }, icon('caret-left', 17), variant === 'sencillo' && h('span', {}, 'Anterior'));
  const nextTop = h('span', {});
  const nextSub = h('small', {});
  const nextCaret = icon('caret-right', 16);
  let nextAct = null;
  const next = h('button', { class: 'ev-next', 'data-paso': '', onclick: guard(async () => { await nextAct?.(); buzz(); }) }, h('span', { class: 'ev-two' }, nextTop, nextSub), nextCaret, variant === 'sencillo' && h('span', { class: 'ev-fin' }, icon('check', 26)));
  const pasos = h('div', { class: 'ev-pasos', role: 'group', 'aria-label': 'Pasar' }, prev, next);
  const strip = h('div', { class: 'ev-strip' }, modos, pasos);

  const root = h('div', { class: 'ev', dataset: { variant } });
  const oratorBody = orator ? createOrador(ctx, { variant, root, slot, slotApi, back }) : null;
  const steadyTools = [...toolButtons]; // los del orador no dependen de lo que esté al aire
  const touches = guardTouches(root, { list: oratorBody?.scroller ?? list, controls: slot, cover: back });

  // ---- Lo que se dice de lo que está al aire ----
  const items = () => state.order?.items || [];
  const rows = () => items().filter((i) => i.kind !== 'section');
  const numberOf = (id) => { const at = rows().findIndex((i) => i.id === id); return at < 0 ? null : at + 1; };
  const numbered = (id, title) => (numberOf(id) ? `${numberOf(id)} · ${title}` : title);
  const shortTitle = (item) => (item ? (item.ref ? item.reference : titleOf(item)) : '');
  const stepName = (item, k) => kindOf(item.kind)?.stepLabel?.(item, k) ?? `Paso ${k + 1}`;
  function whatFollows(p) {
    const n = p.next;
    if (!n || n.end) return '';
    if (n.animation) return 'Animación';
    if (n.over) {
      if (n.step == null) return 'Quitar el versículo';
      return `v. ${p.over.data.ref.verseStart + n.step}${orator && p.item?.kind === 'slides' ? ` · luego la ${p.item.number}` : ''}`;
    }
    if (n.inside && p.item) return stepName(p.item, n.step ?? 0);
    return n.orderId ? numbered(n.orderId, n.title) : n.title;
  }

  // ---- Conexión: sin barra nueva, para que nada se mueva ----
  const offline = () => silenceMs() > OFFLINE_MS;
  const ago = () => `hace ${Math.round(silenceMs() / 1000)} s`;

  // La cuenta, solo en el completo: en el teléfono, delante, porque el nombre se corta por detrás.
  function oratorTitle(p) {
    if (p.over) return `Encima · ${p.over.title}`;
    if (!(p.item?.pages > 1)) return shortTitle(p.item);
    if (variant === 'sencillo') return p.item.title;
    const page = `${p.item.index ?? p.item.number} de ${p.item.pages}`;
    return ctx.layout().startsWith('tableta') ? `${p.item.title} · diapositiva ${page}` : `${page} · ${p.item.title}`;
  }
  function paintStatus(p) {
    const live = describeLive(p);
    const away = offline();
    root.dataset.state = away ? 'offline' : live.state;
    const words = { live: 'AL AIRE', black: 'NEGRO', clear: 'SOLO FONDO', empty: 'NADA' };
    pill.replaceChildren(...(away ? [icon('wifi-slash', 12), 'SIN CONEXIÓN'] : [live.state === 'live' && h('i', {}), words[live.state]].filter(Boolean)));
    const at = numberOf(p.item?.source?.orderId);
    const total = rows().length;
    if (away) {
      statusTitle.textContent = `${ago()} · última imagen`;
      statusWhere.textContent = '';
      return;
    }
    if (live.state === 'empty') {
      statusTitle.textContent = state.order?.name || 'Nada al aire';
      statusWhere.textContent = total ? String(total) : '';
      return;
    }
    const clock = state.live?.uid === p.item?.uid ? state.live?.state?.clock : null;
    const ended = player && p.mode === 'clear' && clock?.duration != null && positionAt(clock) >= clock.duration - 0.5;
    statusTitle.textContent = orator ? oratorTitle(p) : `${ended ? 'Terminó · ' : ''}${shortTitle(p.item)}`;
    statusWhere.textContent = at && variant === 'control' ? `${at} de ${total}` : '';
    if (at && state.order?.name) statusWhere.dataset.name = state.order.name; else delete statusWhere.dataset.name;
  }

  function paintStrip(p) {
    const { item, mode } = p;
    for (const [button, label, on] of [[clear, 'Solo fondo', mode === 'clear' && Boolean(item)], [black, 'Negro', mode === 'black']]) {
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
      button.lastChild.textContent = on ? 'Quitar' : label;
      button.setAttribute('aria-label', on ? `Quitar ${label}` : label);
    }
    prev.disabled = !item;
    const first = rows()[0];
    const say = (top, sub, act, kind = '') => {
      nextTop.textContent = top;
      nextSub.textContent = sub;
      nextSub.hidden = !sub;
      nextAct = act;
      next.disabled = !act;
      next.dataset.kind = kind;
    };
    if (offline()) say('Reconectando…', '', null, 'off');
    else if (!item) say('Empezar', first ? `1 · ${first.title}` : 'Nada en el orden', first ? () => action('order.show', { id: first.id }) : null, first ? '' : 'off');
    else if (oratorBody?.finished(p)) say('Fin', 'Ya no hay más diapositivas', null, 'end');
    else if (p.next?.end) {
      if (first) say('Ir al primero', '', () => action('order.show', { id: first.id }), 'first');
      else say('Fin', '', null, 'off');
    } else {
      const follows = whatFollows(p);
      say('Siguiente', mode === 'live' || !follows ? follows : `Vuelve con ${follows}`, () => stepAir(1));
    }
  }

  // Por qué paso va: la banda de debajo de la vista siempre existe, para que nada salte.
  function paintBand(p) {
    const cur = items().find((i) => i.id === p.item?.source?.orderId);
    const total = cur?.steps > 1 ? cur.steps : p.item?.pages > 1 ? p.item.pages : 0;
    const now = cur ? (p.item.source.step ?? 0) : (p.item?.index ?? p.item?.number ?? 1) - 1;
    const signature = `${total}|${now}`;
    if (band.dataset.key !== signature) {
      band.dataset.key = signature;
      const whole = total > SEGMENTS || total < 2;
      band.classList.toggle('whole', whole);
      band.replaceChildren(...(whole
        ? [h('i', { style: `width: ${total ? ((now + 1) / total) * 100 : 0}%` })]
        : Array.from({ length: total }, (_, k) => h('i', { class: k === now ? 'on' : k < now ? 'done' : '' }))));
    }
    infoTitle.textContent = shortTitle(p.item) || 'Nada al aire';
    if (nowName) nowName.textContent = shortTitle(p.item);
    const version = p.item?.version ? ` · ${p.item.version}` : '';
    infoStep.textContent = p.item ? `${total > 1 ? `Paso ${now + 1} de ${total}` : kindOf(p.item.kind)?.label ?? ''}${version}` : '';
    const follows = whatFollows(p);
    infoNext.textContent = follows ? `Sigue: ${follows}` : '';
  }

  // ---- La ranura ----
  let mounted = null;
  function mountSlot(key, item) {
    mounted?.view.destroy?.();
    slot.replaceChildren();
    toolButtons.clear();
    for (const b of steadyTools) toolButtons.add(b);
    if (!item) {
      const has = rows().length;
      slot.append(h('div', { class: 'ev-nada' }, h('b', {}, 'Nada al aire'), h('small', {}, has ? 'Toca una fila del orden, o «Empezar» para el primero.' : 'Cuando haya algo en el orden, se pone desde aquí.')));
      mounted = { key, has, view: {} };
      return;
    }
    const def = kindOf(item.kind);
    const make = def?.slot ?? plainSlot(def?.controls ? 'Sus mandos están en «Más».' : 'Sin mandos.');
    mounted = { key, view: make(slot, slotApi) || {} };
  }
  const paintPlayer = () => { slot.dataset.player = String(Boolean(seekBox?.firstChild)); };
  function paintSlot() {
    const item = state.projection?.item;
    const key = item?.kind ?? 'nada';
    const stale = mounted?.key !== key || (!item && mounted.has !== rows().length);
    const update = () => {
      const now = state.projection?.item;
      const nowKey = now?.kind ?? 'nada';
      if (mounted?.key !== nowKey || (!now && mounted.has !== rows().length)) mountSlot(nowKey, now);
      if (now) mounted.view.update?.(state.live?.uid === now.uid ? state.live.state : null, now);
      paintPlayer();
      paintTools();
    };
    // Otro tipo cambia los mandos de sitio: si hay un dedo encima, espera.
    if (stale && mounted) touches.whenCalm('slot', update);
    else if (!stale || !mounted) update();
  }
  function paintTools() {
    const item = state.projection?.item;
    const live = state.live?.uid === item?.uid ? state.live?.state : null;
    const pointable = Boolean(item) && state.projection.mode === 'live' && stage.pointable();
    const movable = pointable && Boolean(live?.zoom);
    if ((tool === 'point' && !pointable) || (tool === 'move' && !movable)) tool = null;
    for (const b of toolButtons) {
      const id = b.dataset.tool;
      b.disabled = id === 'point' ? !pointable : !movable;
      b.classList.toggle('sel', id === tool);
      b.setAttribute('aria-pressed', String(id === tool));
    }
    if (tool) vista.dataset.tool = tool; else delete vista.dataset.tool;
  }

  // ---- El orden: un toque marca; solo la marcada lleva ▶ ----
  let prepared = null; // { id, project }
  let shape = null;
  const rowOf = new Map(); // id -> { row, tag }
  let listEls = [];        // lo que hay en la lista, en el orden de items()
  const markRow = (item) => {
    if (item.id === state.projection?.item?.source?.orderId && state.projection.mode === 'live') return;
    prepared = { id: item.id, project: () => action('order.show', { id: item.id }) };
    paintRows();
    paintPrep(item);
  };
  const projectPrepared = guard(async () => {
    if (!prepared) return false;
    const go = prepared.project;
    prepared = null;
    paintRows();
    paintPrep(null);
    await go();
    return true;
  });
  function buildRows() {
    const all = items();
    const signature = JSON.stringify(all.map((i) => [i.id, i.kind, i.title, i.subtitle, i.data?.track]));
    if (signature === shape) return false;
    shape = signature;
    rowOf.clear();
    listEls = [];
    if (!rows().length) {
      list.replaceChildren(h('div', { class: 'ev-vacio' }, h('b', {}, 'El orden está vacío'), h('small', {}, 'Añade algo desde Biblia, Himnario o Medios.'),
        ctx.has('orden') && mando({ label: 'Abrir Orden', glyph: 'list-numbers', onclick: () => ctx.go('orden') })));
      return true;
    }
    let n = 0;
    listEls = all.map((item) => {
      if (item.kind === 'section') return h('div', { class: 'ev-sec' }, h('span', {}, item.title));
      n += 1;
      const tag = h('span', { class: 'ev-tag' });
      // En Alabanza, el número es el del himno; y la pista de cada canto se elige antes de que salga.
      const number = player ? item.data?.number ?? '' : n;
      const track = player && item.kind === 'song' && ctx.can('order.edit') && trackChip(item);
      const row = h('div', { class: 'ev-row', dataset: { id: item.id } },
        h('button', { class: 'ev-row-main', title: item.title, onclick: () => markRow(item) },
          h('span', { class: 'ev-n' }, String(number)), kindBadge(item.kind),
          h('span', { class: 'ev-t' }, h('b', {}, item.title), item.subtitle && h('small', {}, item.subtitle))),
        track,
        h('button', { class: 'ev-play', 'aria-label': `Poner «${item.title}»`, title: 'Poner (Intro)', onclick: () => projectPrepared() }, icon('play', 12)),
        tag);
      rowOf.set(item.id, { row, tag });
      return row;
    });
    list.replaceChildren(...listEls, player && ctx.has('orden') ? h('button', { class: 'ev-all', onclick: () => ctx.go('orden') }, 'Ver todo el orden') : '');
    return true;
  }
  const trackChip = (item) => {
    const pista = item.data?.track === 'instrumental';
    return h('button', { class: 'ev-pista', 'aria-label': `${item.title}: suena ${pista ? 'la pista' : 'cantado'}. Cambiar`, onclick: guard(() => action('order.setTrack', { id: item.id, track: pista ? 'vocal' : 'instrumental' })) },
      pista && icon('waveform', 12), pista ? 'Pista' : 'Cantado');
  };
  // En Alabanza, la lista es la sección del canto al aire; en la tableta, lo que viene después sigue a la vista, atenuado.
  function paintSection() {
    if (!player) return;
    const all = items();
    const at = all.findIndex((i) => i.id === state.projection?.item?.source?.orderId);
    let from = 0;
    let to = all.length;
    if (at >= 0) {
      for (let i = at; i >= 0; i -= 1) if (all[i].kind === 'section') { from = i; break; }
      for (let i = at + 1; i < all.length; i += 1) if (all[i].kind === 'section') { to = i; break; }
    }
    listEls.forEach((el, i) => {
      el.classList.toggle('ev-before', i < from);
      el.classList.toggle('ev-out', i >= to);
    });
  }
  function paintRows() {
    const p = state.projection;
    const liveId = p?.item?.source?.orderId;
    const at = rows().findIndex((i) => i.id === liveId);
    rows().forEach((item, i) => {
      const entry = rowOf.get(item.id);
      if (!entry) return;
      const live = item.id === liveId;
      entry.row.classList.toggle('live', live);
      entry.row.classList.toggle('done', at >= 0 && i < at);
      entry.row.classList.toggle('marked', prepared?.id === item.id && !live);
      entry.row.toggleAttribute('aria-current', live);
      entry.tag.textContent = live ? { live: 'AL AIRE', black: 'EN NEGRO', clear: 'SOLO FONDO' }[p.mode] ?? 'AL AIRE' : '';
    });
    if (prepared && !rowOf.has(prepared.id)) { prepared = null; paintPrep(null); }
  }
  // Lo al aire se lleva a la vista: de pie en un teléfono, lo que sigue arriba (lo que sale ya está en la barra).
  let shownLive = null;
  function bringLive() {
    const id = state.projection?.item?.source?.orderId;
    if (!id || id === shownLive || !rowOf.has(id)) return;
    touches.whenCalm('list', () => {
      const row = rowOf.get(id)?.row;
      if (!row || !list.clientHeight) return;
      shownLive = id;
      const phoneUp = ctx.layout() === 'telefono-pie';
      const target = phoneUp ? row.nextElementSibling ?? row : row;
      list.scrollTop = ctx.layout().startsWith('tableta') ? row.offsetTop - (list.clientHeight - row.offsetHeight) / 2 : target.offsetTop;
    });
  }
  function paintList() {
    buildRows();
    paintRows();
    paintSection();
    bringLive();
  }
  // La tableta enseña lo marcado con su imagen, y «Poner» aparte.
  async function paintPrep(item) {
    prep.classList.toggle('empty', !item);
    prepPut.disabled = !item;
    prepName.textContent = item ? numbered(item.id, item.title) : 'Toca una fila para marcarla';
    if (!state.projection || !ctx.layout().startsWith('tableta')) return;
    if (!item) {
      prepStage.render({ mode: 'clear', item: null, styles: state.projection.styles });
      return;
    }
    try {
      const { steps } = await api(`/api/order/${encodeURIComponent(item.id)}/steps`);
      if (prepared?.id === item.id && steps[0]) prepStage.render({ mode: 'live', item: steps[0], styles: state.projection.styles });
    } catch { /* sin imagen: se sigue viendo su nombre */ }
  }

  // ---- «Volver a…» 10 s, en un sitio fijo; «Volver al orden» mientras se esté fuera de él ----
  let lastOrder = null; // { id, step }: por dónde iba el orden antes de salir de él
  let backUid = null;
  let backUntil = 0;
  function paintBack() {
    const p = state.projection;
    const offer = p?.back;
    const source = p?.item?.source;
    if (source?.orderId) lastOrder = { id: source.orderId, step: source.step };
    if (orator && p?.over) {
      back.hidden = false;
      backText.textContent = p.item?.kind === 'slides' ? `Volver a la diapositiva ${p.item.number}` : `Volver a ${shortTitle(p.item)}`;
      backTime.textContent = '';
      back.onclick = guard(() => action('projection.overClear'));
      return;
    }
    if (offer && offer.uid === p.item?.uid) {
      if (backUid !== offer.uid) {
        backUid = offer.uid;
        backUntil = Date.now() + BACK_MS;
      }
      const left = Math.ceil((backUntil - Date.now()) / 1000);
      if (left > 0) {
        back.hidden = false;
        backText.textContent = `Volver a ${numbered(offer.orderId, offer.title)}`;
        backTime.textContent = `${left} s`;
        back.onclick = guard(async () => { back.hidden = true; await action('projection.back'); });
        return;
      }
    }
    const away = p?.item && !source?.orderId && lastOrder && numberOf(lastOrder.id);
    back.hidden = !away;
    if (away) {
      const item = rows().find((i) => i.id === lastOrder.id);
      backText.textContent = `Volver al orden · ${numbered(item.id, item.title)}`;
      backTime.textContent = '';
      back.onclick = guard(() => action('order.show', { id: lastOrder.id, step: lastOrder.step ?? 0 }));
    }
  }

  // ---- Capas: cada isla con su estado y su cuenta; con 3 o 4, su número y su icono ----
  function paintIsles(slots = state.layers?.slots || []) {
    const loaded = slots.filter((s) => s.kind);
    capas.dataset.many = String(loaded.length >= 3);
    mid.dataset.many = String(loaded.length >= 3);
    mid.dataset.none = String(!loaded.length);
    if (capasChip) {
      capasChip.hidden = !loaded.length;
      capasChip.setAttribute('aria-label', loaded.length === 1 ? '1 capa' : `${loaded.length} capas`);
      capasChip.replaceChildren(icon('stack', 12), `${loaded.length} `, h('span', {}, loaded.length === 1 ? 'capa' : 'capas')); // acostado, su icono en vez de la palabra
    }
    for (const [n, isle] of isles) if (!loaded.some((s) => s.n === n)) { isle.el.remove(); isles.delete(n); }
    for (const s of loaded) {
      let isle = isles.get(s.n);
      if (!isle) {
        const name = h('span', { class: 'ev-isle-name' });
        const glyph = h('span', { class: 'ev-isle-icon' });
        const el = h('button', { class: 'ev-isle', dataset: { n: s.n }, onclick: guard(() => action('layers.visible', { n: s.n, visible: !state.layers?.slots?.[s.n - 1]?.visible })) }, h('span', { class: 'num' }, String(s.n)), glyph, name);
        isle = { el, name, glyph, slot: s };
        isles.set(s.n, isle);
        const after = [...isles.keys()].filter((n) => n > s.n).sort()[0];
        capas.insertBefore(el, after ? isles.get(after).el : addLayer || null);
      }
      isle.slot = s;
      isle.glyph.replaceChildren(icon(kindOf(s.kind)?.icon || 'stack', 14));
      isle.el.classList.toggle('on', s.visible);
      isle.el.setAttribute('aria-pressed', String(s.visible));
      isle.el.setAttribute('aria-label', `Capa ${s.n}: ${s.title}. ${s.visible ? 'A la vista: un toque la apaga' : 'Apagada: un toque la enciende'}`);
      paintIsleName(isle);
    }
    if (addLayer) addLayer.hidden = loaded.length >= 4;
  }
  function paintIsleName(isle) {
    const count = kindOf(isle.slot.kind)?.count;
    isle.name.textContent = count ? count(isle.slot.content) : isle.slot.title;
    isle.name.classList.toggle('mono', Boolean(count));
  }
  // La proyección dibuja también las capas ligeras: «tal cual».
  const paintLayers = () => stage.setLayers(withOver((state.layers?.slots || []).map(lightLayer(ctx.isLocal)), state.projection));

  // ---- Al día ----
  let lastUid = null;
  function paintAll() {
    const p = state.projection;
    if (!p) return;
    paintStatus(p);
    paintStrip(p);
    paintBand(p);
    paintSlot();
    paintBack();
    if (oratorBody) oratorBody.paint(p); else paintList();
  }
  subscribe('projection', (p) => {
    if (p.item?.uid !== lastUid) {
      lastUid = p.item?.uid;
      touches.airChanged();
    }
    stage.render(p);
    if (prepared && p.mode === 'live' && p.item?.source?.orderId === prepared.id) {
      prepared = null;
      paintPrep(null);
    }
    paintLayers();
    paintAll();
  });
  subscribe('layers', ({ slots }) => {
    paintLayers();
    paintIsles(slots);
  });
  subscribe('order', () => paintAll());
  subscribe('live', (l) => {
    stage.setLive(l);
    paintSlot();
    amountOf(l.volume ?? 1);
    oratorBody?.live?.();
  });
  subscribe('pointer', (p) => stage.setPointer(p));
  subscribe('conexiones', ({ sonido }) => {
    stage.setSound(Boolean(sonido) && sonido === connectionId());
    noSound.hidden = Boolean(sonido);
  });
  const amountOf = (v) => {
    const el = volumeAsButton.querySelector('.ev-amount');
    el.textContent = `${Math.round(v * 100)} %`;
    el.classList.toggle('warn', v === 0);
  };
  // Cada segundo: lo que cuenta (el aviso de «Volver», la cuenta de las capas, cuánto hace que no se oye al servidor).
  let wasAway = false;
  setInterval(() => {
    for (const isle of isles.values()) paintIsleName(isle);
    if (!state.projection) return;
    if (!back.hidden) {
      paintBack();
      if (back.hidden) oratorBody?.paint(state.projection);
    }
    const away = offline();
    if (away || away !== wasAway) {
      wasAway = away;
      paintStatus(state.projection);
      paintStrip(state.projection);
    }
  }, 1000);

  return {
    status, controls, search, preview, toggleMode, projectPrepared,
    // La rejilla (envivo.css), con lo que es del shell: la marca, el dock y el cajón.
    compose({ brand, dockbar, drawer }) {
      const top = h('header', { class: 'ev-top' }, brand, status, search?.button, ...(oratorBody?.topExtras ?? []));
      const head = h('div', { class: 'ev-head' }, vista, info, nowName);
      const middle = oratorBody?.nodes ?? [slot, seekBox, mid, !player && prep, listBox];
      root.append(...[top, head, ...middle, drawer, strip, dockbar].filter(Boolean));
      paintPrep(null);
      return root;
    },
    gestures,
  };
}

// El volumen de Alabanza: a pasos de 5 %, sin bola; su nivel solo se muestra.
function createStepVolume() {
  let current = 1;
  const sender = createSender(guard((patch) => action('projection.volume', patch)));
  const fill = h('i', {});
  const amount = h('span', { class: 'ev-amount' });
  const paint = (v) => {
    current = v;
    fill.style.width = `${v * 100}%`;
    amount.textContent = `${Math.round(v * 100)} %`;
    amount.classList.toggle('warn', v === 0);
  };
  const by = (d) => () => {
    const v = Math.max(0, Math.min(1, Math.round((current + d) * 20) / 20));
    paint(v);
    sender.push({ volume: v });
  };
  const el = h('div', { class: 'ev-volsteps', role: 'group', 'aria-label': 'Volumen de Manna' },
    h('button', { class: 'ev-mute', 'aria-label': 'Bajar el volumen', onclick: by(-0.05) }, icon('minus', 14)),
    h('span', { class: 'ev-level' }, fill),
    h('button', { class: 'ev-mute', 'aria-label': 'Subir el volumen', onclick: by(0.05) }, icon('plus', 14)),
    amount);
  subscribe('live', ({ volume }) => { if (!sender.busy) paint(volume ?? 1); });
  paint(state.live?.volume ?? 1);
  return { el };
}

// El volumen, con silencio y cifra. Solo se arrastra su bola; se aplica al soltar (DESIGN.md 12 ter, regla 2).
function createBallVolume() {
  let before = 1; // a qué volumen se vuelve al quitar el silencio
  let current = 1;
  const send = guard((volume) => action('projection.volume', { volume }));
  const amount = h('span', { class: 'ev-amount' });
  const say = (v) => {
    amount.textContent = `${Math.round(v * 100)} %`;
    amount.classList.toggle('warn', v === 0);
  };
  const paint = (v) => {
    current = v;
    say(v);
    bar.set(v * 100, 100);
    mute.replaceChildren(icon(v === 0 ? 'speaker-x' : v < 0.5 ? 'speaker-low' : 'speaker-high', 14));
    mute.setAttribute('aria-label', v === 0 ? 'Quitar el silencio' : 'Silenciar');
  };
  const bar = ballSlider({ label: 'Volumen de Manna', step: 5, onMove: (v) => say(v == null ? current : v / 100), onCommit: (v) => { paint(v / 100); send(v / 100); } });
  const mute = h('button', { class: 'ev-mute', onclick: () => {
    if (current > 0) before = current;
    const v = current > 0 ? 0 : before || 1;
    paint(v);
    send(v);
  } });
  const el = h('div', { class: 'ev-volume' }, mute, bar.el, amount);
  subscribe('live', ({ volume }) => { if (!bar.busy()) paint(volume ?? 1); });
  paint(state.live?.volume ?? 1);
  return { el };
}
