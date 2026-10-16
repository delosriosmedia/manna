import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { readImageInfo } from '../../core/images.js';
import { cleanName } from '../../core/names.js';
import { applyView, initialView } from '../../core/view.js';
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
//     status: 'receiving' | 'converting' | 'ready' | 'error', error, original, live }
//   receiving: el navegador aún está enviando las páginas (no se publica)
//   original:  el PowerPoint tal cual se subió (desde la 1.14), en data/presentaciones/: no se sirve
//   live:      se pasa con el propio PowerPoint mientras está al aire (ver «PowerPoint en vivo», abajo)

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
    const keep = deck.status !== 'receiving' && (deck.status !== 'ready' || fs.existsSync(dirOf(deck)));
    if (!keep) {
      fs.rmSync(dirOf(deck), { recursive: true, force: true });
      dropOriginal(deck);
    }
    return keep;
  });
  for (const deck of decks()) {
    if (deck.status === 'converting') Object.assign(deck, { status: 'error', error: 'La conversión se interrumpió. Elimínala y vuelve a subir la presentación.' });
  }

  const pageUrl = (deck, n) => `/media/${FOLDER}/${deck.id}/${n}.${deck.ext}`;
  const thumbUrl = (deck, n) => (deck.thumbs ? `/media/${FOLDER}/${deck.id}/m${n}.jpg` : pageUrl(deck, n));
  // La interfaz arma la dirección de cada diapositiva con `base`, `ext` y `thumbs`: no se publica la lista.
  const view = (deck) => ({
    id: deck.id, name: deck.name, source: deck.source, pages: deck.pages, width: deck.width || 0, height: deck.height || 0, added: deck.added,
    status: deck.status, error: deck.error || null, base: `/media/${FOLDER}/${deck.id}/`, ext: deck.ext || 'jpg', thumbs: Boolean(deck.thumbs),
    // Tras un fallo de PowerPoint va como imágenes, y el menú ofrece volver a intentarlo.
    live: Boolean(deck.live) && !failed.has(deck.id), liveable: liveable(deck),
  });
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
  const liveable = (deck) => Boolean(deck.original) && liveSupported() && app.tools.has('powerpoint');
  const failed = new Set(); // las que PowerPoint no pudo pasar: van como imágenes hasta que se vuelva a pedir
  const inPowerPoint = (deck) => Boolean(deck.live) && liveable(deck) && !failed.has(deck.id);
  let session = null; // { deck, live, showing, at }: at = la diapositiva en que está PowerPoint (1…)

  function wanted() {
    const { item, mode, display } = store.get('projection') || {};
    if (item?.kind !== 'slides' || mode !== 'live' || !(display?.open || fake)) return null;
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
        current.live.send('parar').then((said) => answer(current, said));
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
    try { app.services.projection.present({ kind: 'slides', data: { id: mine.deck.id }, step: number - 1, orderId: item.source.orderId }); } catch { /* la presentación ya no está */ }
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
  store.on('change', (ns) => {
    if (ns === 'projection') sync();
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
      // La pasa PowerPoint: en el proyector no hay zoom de Manna; el puntero lo dibuja una capa encima del pase.
      powerpoint: inPowerPoint(deck),
      // La que viene, para verla antes de pasar a ella.
      next: n < deck.pages ? { number: n + 1, thumb: thumbUrl(deck, n + 1) } : null,
    };
  };
  app.kind('slides', {
    label: 'Diapositivas',
    describe(data) {
      const deck = ready(data?.id);
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
    async step(item, delta) {
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
    if (!app.tools.has('powerpoint')) throw new HttpError(409, 'Este equipo no tiene PowerPoint para convertir la presentación. Guárdala como PDF (Archivo → Exportar) y sube el PDF.');
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
      pages: 0, ext: 'jpg', thumbs: false, width: 0, height: 0, added: Date.now(), status: 'converting', error: null,
      original: null, live: false,
    };
    decks().push(deck);
    commit();

    const out = path.join(app.tmpDir, `diapositivas-${id}`);
    exporter.run({
      id, name: deck.name, input, dir: out,
      onDone(result) {
        const still = decks().includes(deck);
        try {
          if (result.ok && still) {
            adopt(deck, result.pages);
            // Se guarda el original, para pasarla en vivo; en Windows con PowerPoint, así empieza.
            fs.mkdirSync(originals, { recursive: true });
            fs.renameSync(input, path.join(originals, `${id}${ext}`));
            Object.assign(deck, { original: `${id}${ext}` });
            deck.live = liveable(deck);
          } else if (still && !result.cancelled) Object.assign(deck, { status: 'error', error: result.error });
        } catch (err) {
          Object.assign(deck, { status: 'error', error: err instanceof HttpError ? err.message : 'No se pudieron guardar las diapositivas.' });
        }
        fs.rmSync(out, { recursive: true, force: true });
        fs.rmSync(input, { force: true });
        if (still) commit();
      },
    });
    return view(deck);
  });

  // Pasa a la biblioteca las imágenes que dejó PowerPoint: [{ file, thumb }], en orden.
  function adopt(deck, pages) {
    if (pages.length > MAX_PAGES) throw new HttpError(413, `Esa presentación tiene ${pages.length} diapositivas; Manna admite hasta ${MAX_PAGES}.`);
    const first = readImageInfo(pages[0].file);
    const ext = EXT[first?.type];
    if (!ext) throw new HttpError(415, 'PowerPoint entregó algo que no son imágenes.');
    fs.mkdirSync(dirOf(deck), { recursive: true });
    let thumbs = true;
    pages.forEach((page, i) => {
      if (readImageInfo(page.file)?.type !== first.type) throw new HttpError(415, 'PowerPoint entregó imágenes de tipos distintos.');
      fs.renameSync(page.file, path.join(dirOf(deck), `${i + 1}.${ext}`));
      if (page.thumb && readImageInfo(page.thumb)?.type === 'jpeg') fs.renameSync(page.thumb, path.join(dirOf(deck), `m${i + 1}.jpg`));
      else thumbs = false;
    });
    Object.assign(deck, { pages: pages.length, ext, thumbs, width: first.width, height: first.height, status: 'ready', error: null, added: Date.now() });
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
    if (on && !liveSupported()) throw new HttpError(409, 'Pasar con PowerPoint solo se puede en un equipo principal con Windows.');
    if (on && !app.tools.has('powerpoint')) throw new HttpError(409, 'Este equipo no tiene PowerPoint.');
    if (on && !deck.original) throw new HttpError(409, 'De esta presentación no se guardó el PowerPoint original (se subió como PDF o antes de la versión 1.14). Súbela de nuevo como PowerPoint.');
    deck.live = Boolean(on);
    failed.delete(deck.id);
    if (session?.deck === deck) closeSession();
    commit();
    app.services.projection?.refresh();
    sync();
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
