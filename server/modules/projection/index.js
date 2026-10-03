import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { listScreens, secondScreen } from './display.js';
import { openKiosk } from './launcher.js';

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
    item: null,
    styles: { ...DEFAULT_STYLES, ...saved.data.styles },
    display: { supported: true, hasSecond: false, on: saved.data.displayOn, open: false },
  });
  const get = () => store.get('projection');

  // ---- Contenido ----
  function show({ versionId, ref }) {
    const item = services.bible.passage(versionId, ref);
    if (!item) throw new HttpError(404, 'Ese pasaje no existe en la versión elegida.');
    store.set('projection', { item: { kind: 'verses', ...item }, mode: 'live' });
    return item;
  }

  app.action('projection.show', { permission: 'projection.control' }, show);

  app.action('projection.step', { permission: 'projection.control' }, ({ delta }) => {
    const { item } = get();
    if (!item) return null;
    const ref = services.bible.step(item.versionId, item.ref, delta < 0 ? -1 : 1);
    return ref ? show({ versionId: item.versionId, ref }) : null;
  });

  app.action('projection.mode', { permission: 'projection.control' }, ({ mode }) => {
    if (!['live', 'clear', 'black'].includes(mode)) throw new HttpError(400, 'Modo no válido.');
    store.set('projection', { mode: mode === 'live' && !get().item ? 'clear' : mode });
  });

  app.action('projection.clear', { permission: 'projection.control' }, () => {
    store.set('projection', { item: null, mode: 'clear' });
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
