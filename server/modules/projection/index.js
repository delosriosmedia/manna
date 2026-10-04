import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { listScreens, secondScreen } from './display.js';
import { openKiosk } from './launcher.js';
import { liveToRestore } from './live.js';
import { registerTestCard } from './testcard.js';

const DEFAULT_STYLES = {
  fontSize: 48,
  fontFamily: 'sans',
  textColor: '#ffffff',
  refColor: '#ffd166',
  refPosition: 'bottom-center',
  backgroundType: 'gradient',
  bgColor: '#0f172a',
  bgGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)',
  bgImage: '',
  overlayOpacity: 0.35,
  textShadow: 'strong',
};

const STYLE_RULES = {
  fontSize: (v) => Number.isFinite(v) && v >= 20 && v <= 120,
  fontFamily: (v) => ['sans', 'serif', 'trebuchet', 'impact'].includes(v),
  textColor: (v) => /^#[0-9a-f]{6}$/i.test(v),
  refColor: (v) => /^#[0-9a-f]{6}$/i.test(v),
  refPosition: (v) => ['bottom-center', 'bottom-right', 'top-center'].includes(v),
  backgroundType: (v) => ['gradient', 'solid', 'image'].includes(v),
  bgColor: (v) => /^#[0-9a-f]{6}$/i.test(v),
  bgGradient: (v) => typeof v === 'string' && /^(radial|linear)-gradient\([#0-9a-z%,.\s()-]+\)$/i.test(v) && v.length < 200,
  overlayOpacity: (v) => Number.isFinite(v) && v >= 0 && v <= 1,
  textShadow: (v) => ['strong', 'soft', 'outline', 'none'].includes(v),
};

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const BACKGROUND_LIMIT = 20 * 1024 * 1024;
const SCREEN_POLL_MS = 5000;

// Módulo Proyección: qué se muestra (contenido, modo, estilos), sus mandos en vivo y la ventana
// en la segunda pantalla.
export default function setup(app) {
  const { store, services } = app;
  const saved = app.storage('proyeccion', { styles: {}, displayOn: true, volume: 1 });
  const mediaDir = app.uploadsDir;

  store.register('projection', {
    mode: 'clear', // 'live' = contenido visible, 'clear' = solo fondo, 'black' = negro
    item: null,    // { kind, uid, ...contenido, source: { kind, data, step, orderId } }
    styles: { ...DEFAULT_STYLES, ...saved.data.styles },
    display: { supported: true, hasSecond: false, on: saved.data.displayOn, open: false },
  });
  // Lo que cambia mientras algo está al aire va en un espacio aparte, para que mover un mando
  // (el zoom de una imagen, el avance de un video) no reenvíe todo el contenido proyectado.
  //   uid     a qué proyección pertenece `state` (coincide con projection.item.uid)
  //   state   estado de los mandos del tipo que está al aire, o null si no tiene
  //   volume  volumen general de Manna, de 0 a 1: vale para todo lo que suene
  const validVolume = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
  store.register('live', { uid: 0, state: null, volume: validVolume(saved.data.volume) ? saved.data.volume : 1 });
  const get = () => store.get('projection');
  let uid = 0;

  // ---- Contenido ----
  // Cambia lo que está en pantalla y lo anota en disco (solo de dónde sale, no el texto)
  // para recuperarlo si el servidor se reinicia. Ver live.js.
  function setLive(patch) {
    store.set('projection', patch);
    touchLive();
  }

  function touchLive() {
    const { mode, item } = get();
    saved.data.live = item ? { mode, source: item.source, state: store.get('live').state, at: Date.now() } : null;
    saved.save();
  }

  // "at" marca la última vez que el servidor estuvo vivo con ese contenido.
  const liveTimer = setInterval(() => { if (get().item) touchLive(); }, 60_000);
  liveTimer.unref();
  app.onClose(() => {
    clearInterval(liveTimer);
    if (get().item) touchLive();
  });

  // Proyecta un contenido. source: { kind, data, step, orderId }.
  //   step      null = el elemento entero; 0..n-1 = uno de sus pasos
  //   orderId   si viene del orden del culto, para que "siguiente" recorra el orden
  //   previous  { state, at }: mandos en vivo que tenía antes de un reinicio del servidor
  function present({ kind, data, step = null, orderId = null }, mode = 'live', previous = null) {
    const def = app.kinds.get(kind);
    const content = def?.resolve(data, step);
    if (!content) throw new HttpError(404, 'Ese contenido ya no está disponible.');
    uid += 1;
    const item = { kind, ...content, uid, source: { kind, data, step, orderId } };
    // Primero los mandos y después el contenido: cuando una pantalla recibe lo nuevo,
    // su estado en vivo ya está ahí.
    store.set('live', { uid, state: def.live?.(content, previous) ?? null });
    setLive({ item, mode });
    return item;
  }
  services.projection = { present };

  // Se restaura cuando todos los módulos han registrado sus tipos de contenido.
  store.on('listening', () => {
    const restore = liveToRestore(saved.data.live);
    if (!restore) return;
    try { present(restore.source, restore.mode, restore.previous); } catch { /* ese contenido ya no existe */ }
  });

  app.action('projection.show', { permission: 'projection.control' }, ({ kind, data, step }) =>
    present({ kind, data, step: Number.isInteger(step) ? step : null }));

  // Anterior / siguiente. Si lo proyectado viene del orden del culto, recorre sus pasos y
  // luego pasa al elemento vecino; si no, lo decide el tipo de contenido.
  app.action('projection.step', { permission: 'projection.control' }, ({ delta }) => {
    const { item } = get();
    if (!item) return null;
    const d = delta < 0 ? -1 : 1;
    const { kind, data, step, orderId } = item.source;
    if (orderId && services.order?.has(orderId)) {
      const next = services.order.neighbor(orderId, step, d);
      return next ? present(next) : null;
    }
    const next = app.kinds.get(kind)?.neighbor?.(data, step, d);
    return next ? present({ kind, ...next }) : null;
  });

  app.action('projection.mode', { permission: 'projection.control' }, ({ mode }) => {
    if (!['live', 'clear', 'black'].includes(mode)) throw new HttpError(400, 'Modo no válido.');
    setLive({ mode: mode === 'live' && !get().item ? 'clear' : mode });
  });

  app.action('projection.clear', { permission: 'projection.control' }, () => {
    store.set('live', { uid: 0, state: null });
    setLive({ item: null, mode: 'clear' });
  });

  // ---- Mandos en vivo ----
  // Una orden para lo que está al aire (zoom, pausa, avance…). Qué órdenes existen y cuáles
  // valen lo decide el tipo de contenido, en su control().
  app.action('projection.control', { permission: 'projection.control' }, (patch) => {
    const { item } = get();
    const def = item && app.kinds.get(item.kind);
    const live = store.get('live');
    if (!def?.control || live.uid !== item.uid || !live.state) throw new HttpError(409, 'Lo que está en pantalla no tiene mandos.');
    const clean = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
    store.set('live', { state: def.control(live.state, clean, { content: item, now: Date.now() }) });
    touchLive();
  });

  // Volumen general de Manna. No toca el volumen del equipo.
  app.action('projection.volume', { permission: 'projection.control' }, ({ volume }) => {
    if (!validVolume(volume)) throw new HttpError(400, 'El volumen va de 0 a 1.');
    saved.data.volume = volume;
    saved.save();
    store.set('live', { volume });
  });

  registerTestCard(app);

  // ---- Estilos ----
  // patch viene del cliente y se valida; extra lo pone el servidor.
  function setStyles(patch, extra = {}) {
    const clean = {};
    for (const [k, v] of Object.entries(patch || {})) if (STYLE_RULES[k]?.(v)) clean[k] = v;
    const styles = { ...get().styles, ...clean, ...extra };
    saved.data.styles = styles;
    saved.save();
    store.set('projection', { styles });
  }

  function removeBackgroundFile() {
    const current = get().styles.bgImage;
    if (current.startsWith('/media/')) fs.rm(path.join(mediaDir, path.basename(current)), { force: true }, () => {});
  }

  app.action('projection.styles', { permission: 'projection.style' }, (patch) => {
    const leavingImage = patch.backgroundType && patch.backgroundType !== 'image';
    if (leavingImage) removeBackgroundFile();
    setStyles(patch, leavingImage ? { bgImage: '' } : {});
  });

  // La imagen de fondo se guarda como archivo en data/media, no dentro del estado.
  app.route('POST', '/api/projection/background', async (ctx) => {
    ctx.require('projection.style');
    const ext = IMAGE_TYPES[(ctx.req.headers['content-type'] || '').split(';')[0]];
    if (!ext) throw new HttpError(415, 'Usa una imagen JPG, PNG, WebP o GIF.');
    const name = `fondo-${Date.now()}${ext}`;
    await ctx.save(path.join(mediaDir, name), BACKGROUND_LIMIT);
    removeBackgroundFile();
    setStyles({}, { backgroundType: 'image', bgImage: `/media/${name}` });
    return { url: `/media/${name}` };
  });

  // ---- Ventana en la segunda pantalla ----
  let child = null;
  let closing = false;
  const setDisplay = (patch) => store.set('projection', { display: { ...get().display, ...patch } });

  function closeWindow() {
    if (!child) return;
    closing = true;
    child.kill();
    child = null;
  }

  function openWindow(screen) {
    closing = false;
    const mine = openKiosk({
      url: `http://localhost:${app.port}/proyeccion`,
      screen,
      profileDir: path.join(app.dataDir, 'navegador-proyeccion'),
      onExit: () => {
        if (child !== mine) return;
        child = null;
        // Si alguien cerró la ventana a mano, se considera "apagada" para no reabrirla sola.
        if (!closing) {
          saved.data.displayOn = false;
          saved.save();
          setDisplay({ on: false, open: false });
        }
      },
    });
    child = mine;
  }

  // Deja la ventana en el estado correcto: abierta solo si está encendida Y hay segunda pantalla.
  async function reconcile() {
    const { supported, screens } = await listScreens();
    const target = secondScreen(screens);
    const want = get().display.on && Boolean(target);
    if (want && !child) openWindow(target);
    else if (!want && child) closeWindow();
    const next = { supported, hasSecond: Boolean(target), open: Boolean(child) };
    const cur = get().display;
    if (Object.keys(next).some((k) => next[k] !== cur[k])) setDisplay(next);
  }

  app.action('projection.display', { permission: 'system.display' }, async ({ on }) => {
    const { screens } = await listScreens();
    if (on && !secondScreen(screens)) {
      throw new HttpError(409, 'No hay una segunda pantalla conectada al equipo principal.');
    }
    saved.data.displayOn = Boolean(on);
    saved.save();
    setDisplay({ on: Boolean(on) });
    await reconcile();
  });

  let timer = null;
  store.on('listening', () => {
    reconcile();
    timer = setInterval(reconcile, SCREEN_POLL_MS);
    timer.unref();
  });
  app.onClose(() => {
    clearInterval(timer);
    closeWindow();
  });
}
