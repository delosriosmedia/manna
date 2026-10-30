import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { imageInfo, readImageInfo } from '../../core/images.js';
import { cleanName } from '../../core/names.js';
import { applyView, initialView } from '../../core/view.js';
import { fontsFor, installFont, officeBlocked, officeFolder, showInFinder } from './fuentes.js';
import { hasMotion } from './pptx.js';
import { createExporter, isPresentation, liveSupported, openLive, PRESENTATION_EXTENSIONS } from './powerpoint.js';

// Módulo Diapositivas: presentaciones convertidas en imágenes, una por diapositiva. Así se ven
// igual en cualquier pantalla y se gobiernan como una imagen (acercar, desplazar). A cambio se
// pierden las animaciones, las transiciones y los videos incrustados.
//
// Llegan de dos formas:
//   - un PDF: lo convierte en imágenes el navegador de quien lo sube (con pdf.js) y las envía
//     una a una. El servidor no sabe leer un PDF;
//   - un PowerPoint: se sube el archivo y el PowerPoint del equipo principal exporta las
//     diapositivas (powerpoint.js). Sin PowerPoint, se pide el PDF.
//
// Cada presentación es una carpeta data/media/diapositivas/<id>/ con 1.jpg, 2.jpg… y, si las hay,
// sus miniaturas m1.jpg, m2.jpg…, más una ficha en data/diapositivas.json:
//   { id, name, source: 'pdf' | 'powerpoint', pages, ext, thumbs, width, height, added,
//     status: 'receiving' | 'converting' | 'church' | 'ready' | 'error', error, original, live, atChurch, missingFonts, redone }
//   receiving: el navegador aún está enviando las páginas (no se publica)
//   church:    en la nube, un PowerPoint que se convierte en el equipo de la iglesia al llegar (decisión 64)
//   atChurch:  en la nube, ya llegó a la iglesia: quedan su ficha y sus miniaturas
//   original:  el PowerPoint tal cual se subió (desde la 1.14), en data/presentaciones/: no se sirve
//   live:      se pasa «con animaciones» (DeckCraft o PowerPoint en vivo, abajo), si se eligió en su menú (liveChosen);
//              si nadie lo eligió, va así cuando tiene animaciones, transiciones, video o sonido (motion, pptx.js)
//   missingFonts: las letras que usa y no están en el equipo ni dentro de la presentación (fuentes.js)
//   redone:    cuándo se convirtió de nuevo: va en la dirección de cada imagen, para que nadie vea la de antes

const FOLDER = 'diapositivas';
const MAX_PAGES = 500;
const PAGE_LIMIT = 15 * 1024 * 1024;
const THUMB_LIMIT = 500 * 1024;
const FILE_LIMIT = 2 * 1024 ** 3; // un PowerPoint con videos dentro puede pesar mucho
const SOURCES = { pdf: 'PDF', powerpoint: 'PowerPoint' };
const EXT = { jpeg: 'jpg', png: 'png' };

export default function setup(app) {
  const { store } = app;
  const base = path.join(app.uploadsDir, FOLDER);
  const saved = app.storage('diapositivas', { decks: [] });
  const exporter = createExporter(app);
  const decks = () => saved.data.decks;
  const dirOf = (deck) => path.join(base, deck.id);
  // Los PowerPoint originales, fuera de data/media: lo que hay ahí se sirve a cualquiera de la red.
  const originals = path.join(app.dataDir, 'presentaciones');
  const originalOf = (deck) => (deck.original ? path.join(originals, deck.original) : null);
  const dropOriginal = (deck) => { if (deck.original) fs.rmSync(originalOf(deck), { force: true }); };

  // Lo que quedó a medias al apagar: una subida sin terminar se borra; una conversión, se dice.
  saved.data.decks = decks().filter((deck) => {
    const keep = deck.status !== 'receiving' && (deck.status !== 'ready' || deck.atChurch || fs.existsSync(dirOf(deck)));
    if (!keep) {
      fs.rmSync(dirOf(deck), { recursive: true, force: true });
      dropOriginal(deck);
    }
    return keep;
  });
  for (const deck of decks()) {
    if (deck.status === 'converting') Object.assign(deck, { status: 'error', error: 'La conversión se interrumpió. Elimínala y vuelve a subir la presentación.' });
  }

  const again = (deck) => (deck.redone ? `?v=${deck.redone}` : '');
  const pageUrl = (deck, n) => `/media/${FOLDER}/${deck.id}/${n}.${deck.ext}${again(deck)}`;
  const thumbUrl = (deck, n) => (deck.thumbs ? `/media/${FOLDER}/${deck.id}/m${n}.${deck.thumbExt || 'jpg'}${again(deck)}` : pageUrl(deck, n));
  // La interfaz arma la dirección de cada diapositiva con `base`, `ext` y `thumbs`: no se publica la lista.
  const view = (deck) => ({
    id: deck.id, name: deck.name, source: deck.source, pages: deck.pages, width: deck.width || 0, height: deck.height || 0, added: deck.added,
    status: deck.status, error: deck.error || null, base: `/media/${FOLDER}/${deck.id}/`, ext: deck.ext || 'jpg', thumbs: Boolean(deck.thumbs), thumbExt: deck.thumbExt || 'jpg', ...(deck.atChurch && { atChurch: true }), ...(deck.cover && { cover: true }),
    ...(deck.missingFonts?.length && { missingFonts: deck.missingFonts }), ...(deck.redone && { redone: deck.redone }),
    // Tras un fallo de PowerPoint va como imágenes, y el menú ofrece volver a intentarlo.
    live: liveOf(deck) && !failed.has(deck.id), liveable: liveable(deck),
  });
  // Las categorías de Medios aceptan presentaciones: así saben si una existe.
  app.services.slides = { has: (id) => decks().some((d) => d.id === id && d.status !== 'receiving') };
  const publish = () => store.set('slides', { decks: decks().filter((d) => d.status !== 'receiving').sort((a, b) => b.added - a.added).map(view) });
  const commit = () => {
    saved.save();
    publish();
  };
  const find = (id) => {
    const deck = decks().find((d) => d.id === id);
    if (!deck) throw new HttpError(404, 'Esa presentación ya no está en la biblioteca.');
    return deck;
  };
  const ready = (id) => decks().find((d) => d.id === id && d.status === 'ready') || null;

  // ---- PowerPoint en vivo (fase 12) ----
  // Una presentación con `live` la pasa el propio PowerPoint (powerpoint.js, openLive) a pantalla completa en la
  // pantalla de proyección mientras está al aire, encima de la ventana de Manna. Esa ventana, los celulares y los
  // televisores siguen viendo la foto de la diapositiva por la que va, que también queda si PowerPoint falla.
  // Solo en Windows, con PowerPoint y con la ventana de proyección abierta (con el PowerPoint de mentira de las
  // pruebas, también sin ella). La presentación queda abierta tras el pase, para volver a ella enseguida; se
  // cierra al pasar otra, al quitarle el modo o al apagar Manna.
  const fake = Boolean(process.env.MANNA_POWERPOINT_PRUEBA);
  const withPowerPoint = () => liveSupported() && app.tools.has('powerpoint');
  const withDeckCraft = () => app.tools.has('deckcraft-web');
  // Se puede pasar con animaciones: con DeckCraft (en cualquier equipo) o, sin él, con PowerPoint (en Windows).
  const liveable = (deck) => Boolean(deck.original) && (withDeckCraft() || withPowerPoint());
  const failed = new Set(); // las que PowerPoint no pudo pasar: van como imágenes hasta que se vuelva a pedir
  // Con animaciones: lo elegido en su menú o, si nadie eligió, si algo se mueve en ella (pedido del dueño, 2026-10-29).
  const liveOf = (deck) => Boolean(deck.original) && Boolean(deck.liveChosen ? deck.live : deck.motion);
  const inPowerPoint = (deck) => liveOf(deck) && !withDeckCraft() && withPowerPoint() && !failed.has(deck.id);
  const inDeckCraft = (deck) => liveOf(deck) && withDeckCraft();
  let session = null; // { deck, live, showing, at }: at = la diapositiva en que está PowerPoint (1…)
  // Acercada o desplazada («Mover»), PowerPoint se aparta y se ve la imagen de Manna con su encuadre; vuelve con la
  // vista completa o al pasar de diapositiva.
  const framed = (item) => {
    const { uid, state: v } = store.get('live') || {};
    return uid === item.uid && Boolean(v) && (v.zoom > 1 || Math.abs(v.x - 0.5) > 0.001 || Math.abs(v.y - 0.5) > 0.001);
  };

  function wanted() {
    const { item, mode, display } = store.get('projection') || {};
    // Con una capa a la vista (fase 31), la ventana de PowerPoint la taparía: va como imágenes hasta que se oculte.
    if (item?.kind !== 'slides' || mode !== 'live' || !(display?.open || fake) || framed(item) || !item.powerpoint) return null;
    const deck = ready(item.source.data?.id);
    return deck && inPowerPoint(deck) ? { deck, number: item.number } : null;
  }
  // Lleva PowerPoint a lo que está al aire (o termina el pase si ya no le toca).
  function sync() {
    const want = wanted();
    if (session && session.deck !== want?.deck && want) closeSession();
    if (!want) {
      if (session?.showing) {
        const current = session;
        current.showing = false;
        // Si mientras tanto volvió a pasarla (se acercó y se alejó enseguida), lo que valga lo dirá esa orden.
        current.live.send('parar').then((said) => current.showing || answer(current, said));
      }
      return;
    }
    if (!session) {
      const mine = { deck: want.deck, live: null, showing: false, at: 0 };
      const job = app.jobs.start({ title: `Abriendo «${want.deck.name}» en PowerPoint`, owner: 'slides', ref: want.deck.id });
      mine.live = openLive({ input: originalOf(want.deck), onEvent: (said) => heard(mine, said) });
      if (!mine.live) { job.fail('Este equipo no puede pasarla con PowerPoint.'); return; }
      mine.job = job;
      session = mine;
    }
    if (session.showing && session.at === want.number) return;
    const current = session;
    current.showing = true;
    current.at = want.number;
    current.live.send('ir', want.number).then((said) => {
      current.job?.done('Listo');
      current.job = null;
      // Manna ya eligió esa diapositiva: no hay nada que seguir.
      if (said.what === 'diapositiva') current.at = said.value;
      else answer(current, said);
    });
  }
  function closeSession() {
    session?.live.close();
    session = null;
  }
  // Lo que contesta PowerPoint a una orden.
  function answer(mine, said) {
    if (mine !== session) return;
    if (said.what === 'diapositiva') follow(mine, said.value);
    else if (said.what === 'parado') mine.showing = false;
    else if (!['fin', 'inicio'].includes(said.what)) fail(mine, said.what === 'error' ? said.text : `PowerPoint ${said.what === 'sinrespuesta' ? 'no contestó' : 'se cerró'}.`);
  }
  // Lo que dice PowerPoint por su cuenta: alguien pasó, cerró el pase o pasó de la última en el equipo.
  function heard(mine, said) {
    if (said.what === 'cerrado') {
      if (mine === session) fail(mine, said.error || 'PowerPoint se cerró.');
      return;
    }
    if (mine !== session) return;
    if (said.what === 'diapositiva') follow(mine, said.value);
    else if (said.what === 'parado') mine.showing = false;
    // Al pasar de la última en el equipo (PowerPoint ya volvió a ella), Manna sigue con lo que venga en el orden.
    else if (said.what === 'fin') {
      follow(mine, mine.deck.pages);
      Promise.resolve(app.run('projection.step', { delta: 1 })).catch(() => {});
    }
  }
  // Pone al aire la foto de la diapositiva en que está PowerPoint.
  function follow(mine, number) {
    mine.at = number;
    const { item } = store.get('projection');
    if (item?.kind !== 'slides' || item.source.data?.id !== mine.deck.id || item.number === number || !number) return;
    try { app.services.projection.present({ kind: 'slides', data: { id: mine.deck.id }, step: number - 1, orderId: item.source.orderId }, 'live', null, false); } catch { /* la presentación ya no está */ }
  }
  function fail(mine, why) {
    console.error(`PowerPoint no pudo pasar «${mine.deck.name}»: ${String(why).trim()}`);
    failed.add(mine.deck.id);
    const job = mine.job || app.jobs.start({ title: `PowerPoint en vivo: «${mine.deck.name}»`, owner: 'slides', ref: mine.deck.id });
    job.fail('PowerPoint no pudo pasarla: se ve como imágenes. Para volver a intentarlo, elige «Pasar con PowerPoint» en la presentación.');
    mine.job = null;
    if (mine === session) closeSession();
    publish();
    app.services.projection?.refresh();
  }
  // Una capa a la vista o el versículo del orador: PowerPoint, en su ventana, los taparía.
  const hidingPowerPoint = () => Boolean(app.services.layers?.covering() || app.services.projection?.covering());
  let covering = false;
  store.on('change', (ns) => {
    // Al mostrar u ocultar una capa, lo que está al aire vuelve a decir si lo pasa PowerPoint (y sync lo sigue).
    if ((ns === 'layers' || ns === 'projection') && covering !== hidingPowerPoint()) {
      covering = !covering;
      app.services.projection?.refresh();
    }
    // Los mandos, solo si son de lo que está al aire (al proyectar algo, llegan antes que ello).
    if (ns === 'projection' || (ns === 'live' && store.get('live').uid === store.get('projection')?.item?.uid)) sync();
    // «Señalar» sobre una presentación en vivo: el punto lo dibuja PowerPoint encima del pase (S39). Cambia muchas
    // veces por segundo: no se espera la respuesta.
    else if (ns === 'pointer' && session?.showing) {
      const p = store.get('pointer');
      const onAir = store.get('projection')?.item;
      if (p.x != null && p.uid !== onAir?.uid) return;
      session.live.send('punto', p.x == null ? '' : `${p.x.toFixed(4)} ${p.y.toFixed(4)}`);
    }
  });

  store.register('slides', { decks: [] });
  publish();
  saved.save();
  app.onClose(() => {
    exporter.close();
    closeSession();
  });

  // ---- DeckCraft con animaciones (fase 33, parte 3) ----
  // Con DeckCraft web instalado (la copia de Manna, en data/herramientas/deckcraft-web), una presentación con `live` la
  // pasa DeckCraft dentro de la ventana del proyector, la pantalla que suena (siempre del equipo principal), con sus
  // animaciones y transiciones y debajo de las capas; las demás pantallas ven la imagen de la diapositiva en que va.
  // «Siguiente» y «Anterior» se le pasan a esa ventana (el espacio `deckcraft`: cuántas teclas lleva y cuál), y ella
  // dice por dónde va (POST /api/slides/deckcraft), también cada 10 s: sin noticias suyas en 25 s, va como imágenes.
  // Sin DeckCraft web, en Windows con PowerPoint, la pasa PowerPoint (arriba).
  const ALIVE_MS = 25_000;
  app.mount('/deckcraft/', () => path.join(app.dataDir, 'herramientas', 'deckcraft-web'));
  store.register('deckcraft', { count: 0, key: null });
  let shown = { id: null, page: null, step: 0, at: 0, ended: false }; // lo último que dijo la ventana del proyector
  const showing = (id) => shown.id === id && !shown.ended && Date.now() - shown.at < ALIVE_MS;
  // Solo el equipo principal: de ahí es la ventana del proyector (un túnel o un proxy de este equipo no cuenta).
  const projector = (ctx) => { if (!ctx.isLocal) throw new HttpError(403, 'Esto solo lo pide la ventana del proyector del equipo principal.'); };
  app.route('GET', '/api/slides/:id/original', (ctx) => {
    projector(ctx);
    const deck = ready(ctx.params.id);
    if (!deck?.original || !inDeckCraft(deck)) throw new HttpError(404, 'Esa presentación no se pasa con DeckCraft.');
    ctx.file(originalOf(deck));
  });
  // Las letras que usa y están en el equipo: DeckCraft con animaciones no ve las del sistema (fuentes.js).
  app.route('GET', '/api/slides/:id/fuentes', (ctx) => {
    projector(ctx);
    const deck = ready(ctx.params.id);
    if (!deck?.original || !inDeckCraft(deck)) throw new HttpError(404, 'Esa presentación no se pasa con DeckCraft.');
    const fonts = [];
    for (const file of checkFonts(deck)) {
      try { fonts.push(fs.readFileSync(file).toString('base64')); } catch { /* ya no está */ }
    }
    return { fonts };
  });
  app.route('POST', '/api/slides/deckcraft', async (ctx) => {
    projector(ctx);
    const { id, page, step, ended } = await ctx.json();
    const deck = ready(String(id ?? ''));
    if (!deck || !inDeckCraft(deck)) return { ok: false };
    shown = { id: deck.id, page: Number.isInteger(page) && page >= 1 && page <= deck.pages ? page : null, step: Number(step) || 0, at: Date.now(), ended: ended === true };
    const { item } = store.get('projection');
    if (item?.kind !== 'slides' || item.source.data?.id !== deck.id) return { ok: true };
    // Alguien pasó (o DeckCraft llegó a otra diapositiva): al aire, la imagen de esa. Pasada la última, desde la
    // última sigue lo que venga en el orden, como con PowerPoint.
    const at = shown.ended ? deck.pages : shown.page;
    if (at && item.number !== at) {
      try { app.services.projection.present({ kind: 'slides', data: { id: deck.id }, step: at - 1, orderId: item.source.orderId }, 'live', null, false); } catch { /* ya no está */ }
    }
    if (shown.ended) await Promise.resolve(app.run('projection.step', { delta: 1 })).catch(() => {});
    return { ok: true };
  });

  // ---- Tipo de contenido ----
  // data = { id }. Cada diapositiva es un paso; "siguiente" las recorre. Lo que se proyecta es
  // una imagen: sus mandos en vivo son los del encuadre (acercar y desplazar), que vuelven a la
  // vista completa en cada diapositiva.
  const content = (deck, step) => {
    const index = Math.max(0, Math.min(deck.pages - 1, Number.isInteger(step) ? step : 0));
    const n = index + 1;
    return {
      id: deck.id, title: deck.name, reference: `Diapositiva ${n}`, number: n, pages: deck.pages,
      url: pageUrl(deck, n), thumb: thumbUrl(deck, n), width: deck.width, height: deck.height, fit: 'contain',
      // La pasa PowerPoint (salvo acercada: ver framed); el puntero lo dibuja una capa encima del pase. Con una capa
      // de Manna a la vista (fase 31), PowerPoint la taparía: va como imágenes (covered) hasta que se oculte.
      powerpoint: inPowerPoint(deck) && !hidingPowerPoint(),
      covered: inPowerPoint(deck) && hidingPowerPoint(),
      // La pasa DeckCraft en la ventana del proyector (ver arriba).
      deckcraft: inDeckCraft(deck),
      // La que viene, para verla antes de pasar a ella.
      next: n < deck.pages ? { number: n + 1, thumb: thumbUrl(deck, n + 1) } : null,
    };
  };
  app.kind('slides', {
    label: 'Diapositivas',
    describe(data) {
      const deck = ready(data?.id);
      // En la nube, un PowerPoint que aún no se ha convertido (decisión 64): sus diapositivas se sabrán en la iglesia.
      const waiting = !deck && decks().find((d) => d.id === data?.id && d.status === 'church');
      if (waiting) return { title: waiting.name, subtitle: 'PowerPoint · se prepara en la iglesia', steps: 1, data: { id: waiting.id } };
      return deck ? { title: deck.name, subtitle: SOURCES[deck.source] || 'Presentación', steps: deck.pages, data: { id: deck.id } } : null;
    },
    resolve(data, step) {
      const deck = decks().find((d) => d.id === data?.id);
      if (!deck) return null;
      if (deck.status !== 'ready') return { title: deck.name, unavailable: deck.status === 'converting' ? `«${deck.name}» aún se está convirtiendo. Estará lista en un momento.` : deck.error || 'Esa presentación no se puede proyectar.' };
      return content(deck, step);
    },
    neighbor(data, step, delta) {
      const deck = ready(data?.id);
      const target = (Number.isInteger(step) ? step : 0) + delta;
      return deck && target >= 0 && target < deck.pages ? { data: { id: deck.id }, step: target } : null;
    },
    live: (item, previous) => initialView('contain', previous?.state),
    control: (state, patch) => applyView(state, { ...patch, fit: 'contain' }),
    // Con PowerPoint en vivo, «siguiente» y «anterior» los da PowerPoint: así pasan también las animaciones. Al
    // terminar la presentación (o antes de la primera), Manna sigue como siempre: lo que venga en el orden.
    // Qué pondrá «Siguiente» lo sabe quien la pasa: puede ser una animación.
    peek: (item) => (item.deckcraft || item.powerpoint ? { animation: true } : null),
    async step(item, delta) {
      // Con DeckCraft: la tecla va a la ventana del proyector. «Anterior» en el principio de la primera sigue con lo de
      // antes en el orden.
      if (item.deckcraft && showing(item.source.data?.id)) {
        if (delta < 0 && shown.page === 1 && !shown.step) return false;
        const { count } = store.get('deckcraft');
        store.set('deckcraft', { count: count + 1, key: delta > 0 ? 'ArrowRight' : 'ArrowLeft' });
        return true;
      }
      const mine = session;
      if (!mine?.showing || mine.deck.id !== item.source.data?.id) return false;
      const said = await mine.live.send(delta > 0 ? 'siguiente' : 'anterior');
      answer(mine, said);
      return said.what === 'diapositiva';
    },
  });

  // ---- Subir un PDF, ya convertido en imágenes por el navegador ----
  // 1. POST /api/slides?name=&pages=       crea la presentación (aún no se ve)
  // 2. POST /api/slides/:id/pages/:n       cada página, en JPG; con ?mini=1, su miniatura
  // 3. orden slides.finish                 comprueba que están todas y la publica
  app.route('POST', '/api/slides', (ctx) => {
    ctx.require('slides.edit');
    const pages = Number(ctx.query.get('pages'));
    if (!Number.isInteger(pages) || pages < 1) throw new HttpError(400, 'Ese PDF no tiene páginas.');
    if (pages > MAX_PAGES) throw new HttpError(413, `Esa presentación tiene ${pages} páginas; Manna admite hasta ${MAX_PAGES}.`);
    const deck = {
      id: crypto.randomBytes(6).toString('hex'), name: cleanName(ctx.query.get('name')) || 'Presentación', source: 'pdf',
      pages, ext: 'jpg', thumbs: false, width: 0, height: 0, added: Date.now(), status: 'receiving', error: null,
    };
    fs.mkdirSync(dirOf(deck), { recursive: true });
    decks().push(deck);
    saved.save();
    return { id: deck.id };
  });

  app.route('POST', '/api/slides/:id/pages/:n', async (ctx) => {
    ctx.require('slides.edit');
    if (app.cloud) app.services.church?.room(Number(ctx.req.headers['content-length']) || 0);
    const deck = find(ctx.params.id);
    const n = Number(ctx.params.n);
    if (deck.status !== 'receiving' || !Number.isInteger(n) || n < 1 || n > deck.pages) throw new HttpError(400, 'Esa página no corresponde a esta presentación.');
    const mini = ctx.query.get('mini') === '1';
    const target = path.join(dirOf(deck), mini ? `m${n}.jpg` : `${n}.jpg`);
    await ctx.save(target, mini ? THUMB_LIMIT : PAGE_LIMIT);
    // Se reconoce por su contenido: lo que no es un JPG se borra y se rechaza.
    const info = readImageInfo(target);
    if (info?.type !== 'jpeg') {
      fs.rmSync(target, { force: true });
      throw new HttpError(415, 'Cada página debe llegar como una imagen JPG.');
    }
    if (!mini && n === 1) Object.assign(deck, { width: info.width, height: info.height });
    return { ok: true };
  });

  app.action('slides.finish', { permission: 'slides.edit' }, ({ id }) => {
    const deck = find(id);
    if (deck.status !== 'receiving') return view(deck);
    const has = (name) => fs.existsSync(path.join(dirOf(deck), name));
    const numbers = Array.from({ length: deck.pages }, (_, i) => i + 1);
    if (!numbers.every((n) => has(`${n}.jpg`))) throw new HttpError(409, 'Faltan páginas por llegar. Vuelve a subir la presentación.');
    Object.assign(deck, { thumbs: numbers.every((n) => has(`m${n}.jpg`)), status: 'ready', added: Date.now() });
    commit();
    return view(deck);
  });

  // ---- Subir un PowerPoint: lo convierte el PowerPoint del equipo principal ----
  app.route('POST', '/api/slides/powerpoint', async (ctx) => {
    ctx.require('slides.edit');
    const ext = String(ctx.query.get('ext') || '').toLowerCase();
    if (!PRESENTATION_EXTENSIONS.includes(ext)) throw new HttpError(415, 'Manna admite presentaciones de PowerPoint (.pptx, .ppt, .ppsx) y PDF.');
    if (app.cloud) app.services.church?.room(Number(ctx.req.headers['content-length']) || 0);
    if (!app.cloud && !app.tools.has('deckcraft') && !app.tools.has('powerpoint')) throw new HttpError(409, 'Este equipo no tiene con qué convertir la presentación: instala DeckCraft desde la revisión del equipo, o guárdala como PDF (en PowerPoint, Archivo → Exportar) y sube el PDF.');
    const id = crypto.randomBytes(6).toString('hex');
    fs.mkdirSync(app.tmpDir, { recursive: true });
    const input = path.join(app.tmpDir, `presentacion-${id}${ext}`);
    await ctx.save(input, FILE_LIMIT);
    const head = Buffer.alloc(8);
    const file = fs.openSync(input, 'r');
    fs.readSync(file, head, 0, 8, 0);
    fs.closeSync(file);
    if (!isPresentation(head)) {
      fs.rmSync(input, { force: true });
      throw new HttpError(415, 'Ese archivo no es una presentación de PowerPoint.');
    }
    const deck = {
      id, name: cleanName(ctx.query.get('name')) || 'Presentación', source: 'powerpoint',
      pages: 0, ext: 'jpg', thumbs: false, width: 0, height: 0, added: Date.now(), status: app.cloud ? 'church' : 'converting', error: null,
      original: null, live: false,
    };
    decks().push(deck);
    // En la nube no hay con qué convertirla: se guarda tal cual y la convierte el equipo de la iglesia al recibirla.
    if (app.cloud) {
      fs.mkdirSync(originals, { recursive: true });
      fs.renameSync(input, path.join(originals, `${id}${ext}`));
      deck.original = `${id}${ext}`;
      commit();
      return view(deck);
    }
    commit();
    convert(deck, input, ext);
    return view(deck);
  });

  // Convierte un PowerPoint en imágenes (DeckCraft o PowerPoint), en segundo plano; then: al terminar bien.
  function convert(deck, input, ext, then = () => {}) {
    const { id } = deck;
    const first = !deck.original;
    const out = path.join(app.tmpDir, `diapositivas-${id}`);
    exporter.run({
      id, name: deck.name, input, dir: out,
      onDone(result) {
        const still = decks().includes(deck);
        try {
          if (result.ok && still) {
            adopt(deck, result.pages);
            // Se guarda el original, para pasarla en vivo; en Windows con PowerPoint, así empieza.
            if (first) {
              fs.mkdirSync(originals, { recursive: true });
              fs.renameSync(input, path.join(originals, `${id}${ext}`));
              Object.assign(deck, { original: `${id}${ext}` });
            } else deck.redone = Date.now();
            deck.motion = hasMotion(originalOf(deck));
            checkFonts(deck);
            then();
          } else if (still && !result.cancelled) Object.assign(deck, first ? { status: 'error', error: result.error } : { status: 'ready' });
        } catch (err) {
          Object.assign(deck, { status: 'error', error: err instanceof HttpError ? err.message : 'No se pudieron guardar las diapositivas.' });
        }
        fs.rmSync(out, { recursive: true, force: true });
        fs.rmSync(input, { force: true });
        if (still) commit();
      },
    });
  }

  // ---- De la nube al equipo de la iglesia (decisión 64; ver modules/media) ----
  // Un PDF llega ya en imágenes (las convirtió el navegador de quien lo subió); un PowerPoint, tal cual, y se
  // convierte aquí. En la nube, al recibirlo la iglesia, quedan la ficha y las miniaturas.
  const rel = (file) => path.relative(app.dataDir, file);
  app.services.slides.transfer = {
    types: ['slides'],
    has: (id) => decks().some((d) => d.id === id),
    pending: () => decks().filter((d) => !d.atChurch && (d.status === 'church' || (d.status === 'ready' && d.source === 'pdf'))).map((d) => ({
      type: 'slides', id: d.id, entry: { name: d.name, source: d.source, pages: d.pages, ext: d.status === 'church' ? path.extname(d.original) : null },
      files: d.status === 'church' ? { original: rel(originalOf(d)) }
        : Object.fromEntries(fs.readdirSync(dirOf(d)).filter((f) => /^m?\d+\.jpg$/.test(f)).map((f) => [f, rel(path.join(dirOf(d), f))])),
    })),
    delivered(id) {
      const deck = decks().find((d) => d.id === id);
      if (!deck || deck.atChurch) return;
      dropOriginal(deck);
      // Las diapositivas grandes se van; las miniaturas se quedan (sin ellas, la primera hace de miniatura).
      if (deck.thumbs) for (let n = 1; n <= deck.pages; n += 1) fs.rmSync(path.join(dirOf(deck), `${n}.${deck.ext}`), { force: true });
      deck.atChurch = true;
      commit();
    },
    adopt({ id, entry }, files) {
      const name = cleanName(entry.name) || 'Presentación';
      if (entry.source === 'powerpoint') {
        const ext = String(entry.ext || '').toLowerCase();
        if (!PRESENTATION_EXTENSIONS.includes(ext) || !files.original) throw new Error('No llegó una presentación.');
        const deck = { id, name, source: 'powerpoint', pages: 0, ext: 'jpg', thumbs: false, width: 0, height: 0, added: Date.now(), status: 'converting', error: null, original: null, live: false };
        decks().push(deck);
        commit();
        // Ya convertida, el orden que la usa sabe cuántas diapositivas tiene.
        convert(deck, files.original, ext, () => app.services.order?.refresh('slides', id));
        return;
      }
      const pages = Number(entry.pages);
      if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) throw new Error('No llegó una presentación.');
      const deck = { id, name, source: 'pdf', pages, ext: 'jpg', thumbs: false, width: 0, height: 0, added: Date.now(), status: 'ready', error: null };
      fs.mkdirSync(dirOf(deck), { recursive: true });
      for (const [file, from] of Object.entries(files)) if (/^m?\d+\.jpg$/.test(file) && readImageInfo(from)?.type === 'jpeg') fs.renameSync(from, path.join(dirOf(deck), file));
      const has = (file) => fs.existsSync(path.join(dirOf(deck), file));
      const numbers = Array.from({ length: pages }, (_, i) => i + 1);
      if (!numbers.every((n) => has(`${n}.jpg`))) {
        fs.rmSync(dirOf(deck), { recursive: true, force: true });
        throw new Error('Faltan diapositivas.');
      }
      const first = readImageInfo(path.join(dirOf(deck), '1.jpg'));
      Object.assign(deck, { thumbs: numbers.every((n) => has(`m${n}.jpg`)), width: first.width, height: first.height });
      decks().push(deck);
      commit();
    },
    // La biblioteca del equipo, para que la nube la muestre: cada presentación con su portada (cover: en la nube solo
    // está la portada; sus diapositivas, en la iglesia).
    summary: () => decks().filter((d) => d.status === 'ready').map((d) => ({
      type: 'slides', id: d.id, entry: { name: d.name, source: d.source, pages: d.pages, width: d.width, height: d.height },
      thumb: path.join(dirOf(d), d.thumbs ? `m1.${d.thumbExt || 'jpg'}` : `1.${d.ext || 'jpg'}`),
    })),
    mirror(items) {
      const listed = new Set(items.map((x) => x.id));
      for (const gone of decks().filter((d) => d.atChurch && !listed.has(d.id))) fs.rmSync(dirOf(gone), { recursive: true, force: true });
      saved.data.decks = decks().filter((d) => !d.atChurch || listed.has(d.id));
      for (const { id, entry } of items) {
        const found = decks().find((d) => d.id === id);
        if (found && !found.atChurch) continue;
        const pages = Math.min(MAX_PAGES, Math.max(1, Number(entry.pages) || 1));
        const next = { name: cleanName(entry.name) || 'Presentación', source: SOURCES[entry.source] ? entry.source : 'pdf', pages, width: Number(entry.width) || 0, height: Number(entry.height) || 0 };
        if (found) Object.assign(found, next);
        else decks().push({ id, ext: 'jpg', thumbs: false, added: Date.now(), status: 'ready', error: null, atChurch: true, cover: true, ...next });
      }
      commit();
    },
    lacking: () => decks().filter((d) => d.atChurch && d.cover && !fs.existsSync(path.join(dirOf(d), `1.${d.ext}`))).map((d) => d.id),
    thumb(id, buffer) {
      const deck = decks().find((d) => d.id === id && d.atChurch && d.cover);
      const ext = EXT[imageInfo(buffer)?.type];
      if (!deck || !ext) return false;
      fs.mkdirSync(dirOf(deck), { recursive: true });
      fs.writeFileSync(path.join(dirOf(deck), `1.${ext}`), buffer);
      deck.ext = ext;
      commit();
      return true;
    },
  };

  // Pasa a la biblioteca las imágenes que dejó PowerPoint: [{ file, thumb }], en orden.
  function adopt(deck, pages) {
    if (pages.length > MAX_PAGES) throw new HttpError(413, `Esa presentación tiene ${pages.length} diapositivas; Manna admite hasta ${MAX_PAGES}.`);
    const first = readImageInfo(pages[0].file);
    const ext = EXT[first?.type];
    if (!ext) throw new HttpError(415, 'La conversión entregó algo que no son imágenes.');
    fs.mkdirSync(dirOf(deck), { recursive: true });
    // Las miniaturas, en JPEG (PowerPoint) o en PNG (DeckCraft), todas del mismo tipo; si no, se usa la diapositiva.
    const thumbType = pages[0].thumb ? readImageInfo(pages[0].thumb)?.type : null;
    const thumbExt = thumbType === 'jpeg' || thumbType === 'png' ? EXT[thumbType] : null;
    let thumbs = Boolean(thumbExt);
    pages.forEach((page, i) => {
      if (readImageInfo(page.file)?.type !== first.type) throw new HttpError(415, 'La conversión entregó imágenes de tipos distintos.');
      fs.renameSync(page.file, path.join(dirOf(deck), `${i + 1}.${ext}`));
      if (thumbs && page.thumb && readImageInfo(page.thumb)?.type === thumbType) fs.renameSync(page.thumb, path.join(dirOf(deck), `m${i + 1}.${thumbExt}`));
      else thumbs = false;
    });
    Object.assign(deck, { pages: pages.length, ext, thumbs, thumbExt: thumbs ? thumbExt : 'jpg', width: first.width, height: first.height, status: 'ready', error: null, added: Date.now() });
  }

  // ---- Órdenes ----
  app.action('slides.rename', { permission: 'slides.edit' }, ({ id, name }) => {
    const clean = cleanName(name);
    if (!clean) throw new HttpError(400, 'Escribe un nombre.');
    find(id).name = clean;
    commit();
    app.services.projection?.refresh();
  });

  // Pasarla con PowerPoint (on) o como imágenes. Volver a pedirlo tras un fallo lo intenta de nuevo.
  app.action('slides.live', { permission: 'slides.edit' }, ({ id, on }) => {
    const deck = find(id);
    if (on && !withDeckCraft() && !liveSupported()) throw new HttpError(409, 'Para pasarla con animaciones hace falta «DeckCraft con animaciones» (Ajustes → Revisar el equipo) o, en Windows, PowerPoint.');
    if (on && !withDeckCraft() && !app.tools.has('powerpoint')) throw new HttpError(409, 'Este equipo no tiene PowerPoint. Para pasarla con animaciones, instala «DeckCraft con animaciones» (Ajustes → Revisar el equipo).');
    if (on && !deck.original) throw new HttpError(409, 'De esta presentación no se guardó el PowerPoint original (se subió como PDF o antes de la versión 1.14). Súbela de nuevo como PowerPoint.');
    Object.assign(deck, { live: Boolean(on), liveChosen: true });
    failed.delete(deck.id);
    if (session?.deck === deck) closeSession();
    commit();
    app.services.projection?.refresh();
    sync();
  });

  // Las letras que faltan, al día en la ficha; devuelve los archivos de las que están. Sin el original, nada.
  function checkFonts(deck) {
    if (app.cloud || !deck.original) return [];
    try {
      const { files, missing } = fontsFor(originalOf(deck));
      if (missing.join('|') !== (deck.missingFonts || []).join('|')) {
        if (missing.length) deck.missingFonts = missing;
        else delete deck.missingFonts;
        commit();
      }
      return files;
    } catch {
      return [];
    }
  }
  // Al abrir, las de las presentaciones que ya estaban (se pudo instalar o quitar alguna letra desde entonces), y si algo
  // se mueve en las de antes de la 1.59.1, que no lo apuntaban.
  const review = setTimeout(() => decks().forEach((deck) => {
    if (deck.original && deck.motion === undefined && !app.cloud) {
      deck.motion = hasMotion(originalOf(deck));
      commit();
    }
    checkFonts(deck);
  }), 5000);
  review.unref();
  app.onClose(() => clearTimeout(review));

  // Otra vez desde el PowerPoint original: tras instalar las letras que faltaban, o con un DeckCraft más nuevo.
  app.action('slides.reconvert', { permission: 'slides.edit' }, ({ id }) => reconvert(find(id)));
  function reconvert(deck) {
    if (deck.status !== 'ready' || !deck.original || deck.atChurch) throw new HttpError(409, 'Esta presentación no se puede convertir de nuevo: no se guardó su PowerPoint.');
    if (!app.tools.has('deckcraft') && !app.tools.has('powerpoint')) throw new HttpError(409, 'Este equipo no tiene con qué convertirla: instala DeckCraft desde la revisión del equipo.');
    // Mientras tanto se sigue viendo la de antes; el avance va en la cola.
    const ext = path.extname(deck.original);
    const input = path.join(app.tmpDir, `presentacion-${deck.id}-${Date.now()}${ext}`);
    fs.mkdirSync(app.tmpDir, { recursive: true });
    fs.copyFileSync(originalOf(deck), input);
    convert(deck, input, ext, () => {
      app.services.order?.refresh('slides', deck.id);
      app.services.projection?.refresh();
    });
  }

  // Las que le faltan, de los repositorios de letras libres (las que estén ahí; fuentes.js), y después la convierte de
  // nuevo con ellas. Solo el
  // administrador: se instalan en el equipo principal. Responde enseguida; el avance va en la cola.
  app.action('slides.installFonts', { permission: 'system.admin' }, ({ id }) => {
    const deck = find(id);
    if (app.cloud || !deck.missingFonts?.length) throw new HttpError(409, 'A esta presentación no le falta ninguna letra en este equipo.');
    const job = app.jobs.start({ title: 'Instalando sus letras', owner: 'slides', ref: deck.id });
    (async () => {
      // Las instaladas a mano desde la última vez (con el Finder, en Mac) ya no se buscan.
      const { missing } = fontsFor(originalOf(deck));
      let absent = [];
      let installed = deck.missingFonts.filter((family) => !missing.includes(family)).length;
      for (const family of missing) {
        job.update({ detail: family });
        if ((await installFont(family)).length) installed += 1;
        else absent.push(family);
      }
      // Las de Microsoft Office (Aptos, Jumble…) no están en ningún repositorio: si el equipo tiene PowerPoint, se abre
      // la presentación con él y Office baja las suyas que use, a su carpeta, que Manna ya mira (así pasó en un Mac,
      // 2026-10-29: al convertirla con PowerPoint, Office bajó Jumble y Fredoka One).
      const office = absent.length > 0 && app.tools.has('powerpoint');
      if (office) {
        job.update({ detail: 'Pidiéndoselas a Office' });
        const ext = path.extname(deck.original);
        const input = path.join(app.tmpDir, `presentacion-${deck.id}-office${ext}`);
        const dir = path.join(app.tmpDir, `office-${deck.id}`);
        fs.mkdirSync(app.tmpDir, { recursive: true });
        fs.copyFileSync(originalOf(deck), input);
        await new Promise((done) => exporter.run({ id: deck.id, name: deck.name, input, dir, powerpoint: true, title: `Pidiendo a Office las letras de «${deck.name}»`, onDone: done }));
        fs.rmSync(input, { force: true });
        fs.rmSync(dir, { recursive: true, force: true });
        const still = fontsFor(originalOf(deck)).missing;
        installed += absent.filter((family) => !still.includes(family)).length;
        absent = absent.filter((family) => still.includes(family));
      }
      checkFonts(deck);
      if (installed) reconvert(deck);
      const inOffice = officeBlocked() ? absent.filter((family) => officeFolder(family)) : [];
      const nowhere = absent.filter((family) => !inOffice.includes(family));
      if (inOffice.length) showInFinder(inOffice.map((family) => officeFolder(family)));
      const one = nowhere.length === 1;
      const single = inOffice.length === 1;
      const note = [
        nowhere.length ? `${nowhere.join(', ')} no ${one ? 'está' : 'están'} en Google Fonts, Fontsource ni Font Squirrel${office ? `, ni Office ${one ? 'la' : 'las'} bajó` : ''}: hay que instalarla${one ? '' : 's'} a mano y pulsar «Revisar de nuevo».` : '',
        inOffice.length ? `${inOffice.join(', ')} ya ${single ? 'la' : 'las'} bajó Office, pero macOS no deja que Manna ${single ? 'la' : 'las'} recoja. ${single ? 'Se abrió su carpeta' : 'Se abrieron sus carpetas'} en el Finder del equipo principal: dale doble clic a ${single ? 'la letra' : 'cada letra'} → Instalar, y pulsa «Revisar de nuevo».` : '',
      ].filter(Boolean).join(' ');
      if (note) job.fail(installed ? `Las demás se instalaron. ${note}` : note);
      else job.done('Instaladas');
    })().catch((err) => job.fail(err.message || 'No se pudieron instalar.'));
  });

  app.action('slides.remove', { permission: 'slides.edit' }, ({ id }) => {
    const deck = find(id);
    exporter.cancel(deck.id);
    exporter.forget(deck.id);
    if (session?.deck === deck) closeSession();
    dropOriginal(deck);
    fs.rmSync(dirOf(deck), { recursive: true, force: true });
    saved.data.decks = decks().filter((d) => d.id !== id);
    commit();
  });
}
