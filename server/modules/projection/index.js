import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { listScreens, secondScreen } from './display.js';
import { openKiosk } from './launcher.js';
import { liveToRestore } from './live.js';

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
const SCREEN_POLL_MS = 5000;

// Módulo Proyección: qué se muestra (contenido, modo, estilos) y la ventana en la segunda pantalla.
export default function setup(app) {
  const { store, services } = app;
  const saved = app.storage('proyeccion', { styles: {}, displayOn: true });
  const mediaDir = path.join(app.dataDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  store.register('projection', {
    mode: 'clear', // 'live' = contenido visible, 'clear' = solo fondo, 'black' = negro
    item: null,    // { kind, ...contenido, source: { kind, data, step, orderId } }
    styles: { ...DEFAULT_STYLES, ...saved.data.styles },
    display: { supported: true, hasSecond: false, on: saved.data.displayOn, open: false },
  });
  const get = () => store.get('projection');

  // ---- Contenido ----
  // Cambia lo que está en pantalla y lo anota en disco (solo de dónde sale, no el texto)
  // para recuperarlo si el servidor se reinicia. Ver live.js.
  function setLive(patch) {
    store.set('projection', patch);
    touchLive();
  }

  function touchLive() {
    const { mode, item } = get();
    saved.data.live = item ? { mode, source: item.source, at: Date.now() } : null;
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
  //   step     null = el elemento entero; 0..n-1 = uno de sus pasos
  //   orderId  si viene del orden del culto, para que "siguiente" recorra el orden
  function present({ kind, data, step = null, orderId = null }, mode = 'live') {
    const content = app.kinds.get(kind)?.resolve(data, step);
    if (!content) throw new HttpError(404, 'Ese contenido ya no está disponible.');
    const item = { kind, ...content, source: { kind, data, step, orderId } };
    setLive({ item, mode });
    return item;
  }
  services.projection = { present };

  // Se restaura cuando todos los módulos han registrado sus tipos de contenido.
  store.on('listening', () => {
    const restore = liveToRestore(saved.data.live);
    if (!restore) return;
    try { present(restore.source, restore.mode); } catch { /* ese contenido ya no existe */ }
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
    setLive({ item: null, mode: 'clear' });
  });

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
    const data = await ctx.raw(20 * 1024 * 1024);
    removeBackgroundFile();
    const name = `fondo-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(mediaDir, name), data);
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
