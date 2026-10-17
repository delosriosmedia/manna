// Auditoría de adaptación a pantallas: abre la app real en un Chrome sin ventana, con los tamaños
// de los dispositivos que se usan en la iglesia, y comprueba lo que importa para operar:
//
//   - nada se sale por los lados (sin desplazamiento horizontal)
//   - el dock de módulos está a la vista (en el celular va abajo, con nombres, y se desliza si no caben)
//   - lo que está al aire se ve y se gobierna siempre. Escritorio y tableta horizontal (860 px o más): la barra
//     de estado y los botones de la barra de transporte, a la vista, y las piezas flotantes (cajón, cola, tarjeta
//     «Preparado», barras, dock) sin pisarse. Celular: el
//     recuadro de «Historias» por encima del cajón (o, con el cajón a pantalla completa, el estado «AL AIRE»)
//   - la acción principal de cada pantalla (Proyectar), dentro del cajón, se alcanza sin desplazarse y nada la tapa
//   - queda sitio útil para el contenido (lista de versículos, orden del culto)
//   - en pantallas táctiles, los botones tienen tamaño para el dedo (40 px o más)
//   - los títulos largos del orden del culto se leen (no se cortan en una sola línea)
//   - los mandos en vivo de lo que está al aire caben, en la capa «Mandos» y en el orden
//   - los resultados de la búsqueda y el aviso de un módulo al que le falta un programa caben
//   - «Buscar en todo» cabe y, con un resultado preparado, deja a la vista la tarjeta «Preparado» por encima
//   - Biblia (también comparando dos versiones) y Orden (también el Mapa del culto) caben en el cajón ancho, en el
//     estrecho de 440 px y en el celular: se miden por su cajón, no por la pantalla
//   - la tarjeta de un televisor y su control remoto caben, con teclas para el dedo
//   - la biblioteca de imágenes deja a la vista su acción principal, y los mandos de una imagen
//     al aire caben en la capa de mandos
//   - el himnario (todos, por categorías, letras sin música y lo encontrado al buscar) deja a la vista «Proyectar» y el
//     sonido elegido, y los mandos de un himno al aire (cantado o pista, avance, volumen) caben
//   - en Diapositivas, las presentaciones y las diapositivas de la elegida dejan a la vista
//     «Proyectar», y los mandos de una diapositiva al aire (por dónde va, la que sigue, acercar) caben
//   - el Presentador (sin escenario) deja a la vista la diapositiva grande, Anterior / Siguiente /
//     Negro, las herramientas de señalar y mover y los mandos en vivo, y su lista de presentaciones cabe
//   - Páginas web: la lista (una de internet que se deja mostrar, otra que no y un archivo HTML, con nombres
//     largos) y la barra de la elegida caben y dejan a la vista «Proyectar»
//   - en la función de alabanza, el volumen de Manna está a la vista (barra de transporte; en el celular, grande bajo el recuadro)
//   - en YouTube, el campo del enlace cabe en la cabecera y los mandos de un video con subtítulos
//     en dos idiomas (botón y lista) caben en la capa de mandos
//
// Uso:  node scripts/auditar-responsive.mjs             resumen en la terminal
//       node scripts/auditar-responsive.mjs capturas    además guarda una imagen de cada pantalla
//       node scripts/auditar-responsive.mjs biblia 360x640 844x390 1280x720
//                                                       solo las pantallas y los tamaños cuyo nombre lleva
//                                                       alguna de esas palabras (sin contar tildes)
// Reparte los tamaños entre tres Chrome a la vez, cada uno con su servidor (puertos 8124, 8126 y 8128)
// y sus datos temporales. Necesita Node 22 o superior y Chrome o Edge.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { killOnExit, sleep, startChrome } from './lib/chrome.mjs';
import { seedExample } from './lib/ejemplo.mjs';
import { startFakeTv } from './lib/tv-falso.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Separados de dos en dos: si un puerto está ocupado, el servidor prueba el siguiente.
const PORTS = [8124, 8126, 8128];
const SHOTS = process.argv.includes('capturas');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-responsive-'));

const DEVICES = [
  { name: 'Celular pequeño, vertical', w: 360, h: 640, touch: true },
  { name: 'Celular, vertical', w: 390, h: 844, touch: true },
  { name: 'Celular grande, vertical', w: 430, h: 932, touch: true },
  { name: 'Celular, horizontal', w: 844, h: 390, touch: true },
  { name: 'Tableta, vertical', w: 768, h: 1024, touch: true },
  { name: 'Tableta, horizontal', w: 1024, h: 768, touch: true },
  { name: 'Tableta pequeña, horizontal', w: 960, h: 540, touch: true },
  { name: 'Tableta grande, horizontal', w: 1366, h: 1024, touch: true },
  { name: 'Portátil', w: 1280, h: 720, touch: false },
  { name: 'Escritorio', w: 1920, h: 1080, touch: false },
];

// Abre la capa «Mandos» (en el celular, con el botón de la tarjeta de lo al aire; en el resto, el de la barra de transporte).
// En el escritorio los mandos van siempre a la vista en la barra de abajo (fase 14); en el celular, en su capa.
const OPEN_CONTROLS = `if (matchMedia('(max-width: 859px)').matches) document.querySelector('.story-controls').click()`;
const LIVE_CONTROLS = '.tb-extra .live-controls, .controls-pop .live-controls';

// Pantallas a revisar. prepare: lo que hay que hacer tras cargar. primary: la acción principal.
// page: se revisa con esa página web (id de data/paginas.json) al aire.
// show: se revisa con ese elemento del ejemplo al aire ('testcard', 'image', 'video', 'youtube' o 'slides': todos tienen mandos en vivo).
const SCREENS = [
  { name: 'Biblia', url: '/control#biblia', primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Biblia: búsqueda', url: '/control#biblia', inside: '.search-pop', settle: 1200,
    prepare: `(() => { const i = document.querySelector('.ws[data-module=biblia] .search input'); i.focus(); i.value = 'amor'; i.dispatchEvent(new Event('input')); })()` },
  { name: 'Biblia: libros', url: '/control#biblia', narrowOnly: true, prepare: `document.querySelector('.crumbs button').click()`, primary: '.abar .btn.primary', content: '.col-books' },
  // «Buscar en todo»: su recuadro cabe; con un resultado preparado, la tarjeta se ve encima y la búsqueda le deja sitio
  // (con un cajón abierto, que en el celular la ocultaría).
  // closes: la capa abierta y su recuadro; tras medir, un toque fuera del recuadro debe cerrarla.
  { name: 'Buscar en todo', url: '/control', inside: '.finder', closes: ['.finder-layer', '.finder'], settle: 1100, prepare: `(() => { document.querySelector('.finder-chip').click(); const i = document.querySelector('.finder-input input'); i.value = 'luz'; i.dispatchEvent(new Event('input')); })()` },
  { name: 'Buscar en todo, con algo preparado', url: '/control#biblia', inside: '.finder', prepared: true, settle: 1400, prepare: `(() => { document.querySelector('.finder-chip').click(); const i = document.querySelector('.finder-input input'); i.value = 'luz'; i.dispatchEvent(new Event('input')); setTimeout(() => document.querySelector('.finder-row').click(), 800); })()` },
  // prefs: preferencias de este dispositivo con las que se abre la pantalla (se quitan al terminar).
  { name: 'Biblia: comparar', url: '/control#biblia', prefs: { 'biblia.comparar': true }, primary: '.abar .btn.primary', content: '.col-verses', inside: '.cmp-bar' },
  // wideOnly: solo donde hay escenario (860 px o más); ahí, el módulo en el cajón estrecho de 440 px.
  { name: 'Biblia en el cajón estrecho', url: '/control#biblia', wideOnly: true, prefs: { 'cajon.ancho': false }, primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Orden del culto', url: '/control#orden', content: '.olist', longTitles: true },
  { name: 'Orden en el cajón estrecho', url: '/control#orden', wideOnly: true, prefs: { 'cajon.ancho': false }, content: '.olist', longTitles: true },
  // El cajón reducido en su tamaño más pequeño: el más estrecho del escritorio (360 px) y, en el celular, el más bajo
  // (o, en horizontal, el más estrecho) al que se puede arrastrar. Ahí cada módulo enseña solo lo esencial.
  { name: 'Biblia en el cajón más pequeño', url: '/control#biblia', prefs: { 'cajon.ancho': false, 'cajon.medida': 300, 'cajon.completo': false, 'cajon.alto': 0.95, 'cajon.lado': 0.95 }, primary: '.abar .btn.primary', content: '.col-verses' },
  { name: 'Orden en el cajón más pequeño', url: '/control#orden', prefs: { 'cajon.ancho': false, 'cajon.medida': 300, 'cajon.completo': false, 'cajon.alto': 0.95, 'cajon.lado': 0.95 }, content: '.olist', longTitles: true },
  { name: 'Himnario en el cajón más pequeño', url: '/control#himnario', prefs: { 'cajon.ancho': false, 'cajon.medida': 300, 'cajon.completo': false, 'cajon.alto': 0.95, 'cajon.lado': 0.95 }, content: '.hymns-body', settle: 700 },
  // El Mapa del culto, la cita rápida y el enlace de YouTube solo están con el cajón completo (en el celular).
  { name: 'Orden: mapa del culto', url: '/control#orden', prefs: { 'orden.vista': 'mapa', 'cajon.completo': true }, content: '.omap' },
  // El equipo de la auditoría "no tiene" navegador para la proyección: Ajustes lleva su aviso.
  { name: 'Ajustes, con aviso', url: '/control#ajustes', content: '.settings', inside: '.ws-notice' },
  // La capa de mandos abierta: su recuadro cabe en la pantalla y trae los mandos de lo que está al aire.
  { name: 'Capa de mandos', url: '/control#orden', show: 'testcard', narrowOnly: true, inside: '.controls-pop', closes: ['.controls-layer', '.controls-pop'], controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Control del orden', url: '/orden#orden', content: '.olist', longTitles: true },
  // La función de alabanza lleva el volumen de Manna siempre a la vista: en el celular, bajo la barra de "Al aire".
  { name: 'Servicio de alabanza', url: '/alabanza#himnario', content: '.hymns-body', primary: '.hymn-bar .btn.primary', inside: { wide: '.transport-bar .tb-volume', narrow: '.story-volume.big' }, settle: 700,
    prepare: `document.querySelector('.ws[data-module=himnario] .hymn')?.click()` },
  { name: 'Orden con mandos en vivo', url: '/control#orden', show: 'testcard', controls: '.odetail .live-controls' },
  { name: 'Al aire con mandos en vivo', url: '/control#ajustes', show: 'testcard', controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Medios: imágenes', url: '/control#medios', content: '.media-body[data-panel=imagenes]', primary: '.media-bar[data-panel=imagenes] .btn.primary', inside: '.media-bar[data-panel=imagenes]', settle: 600,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=imagenes]').click(); document.querySelector('.media-body[data-panel=imagenes] .media-card .media-pick').click(); })()` },
  { name: 'Videos', url: '/control#videos', content: '.media-body[data-panel=videos]', primary: '.media-bar[data-panel=videos] .btn.primary', inside: '.media-bar[data-panel=videos]', settle: 700,
    prepare: `document.querySelector('.media-body[data-panel=videos] .media-card .media-pick').click()` },
  // Con una categoría elegida: su menú (⋯) a la vista junto a ella.
  { name: 'Videos: una categoría', url: '/control#videos', content: '.media-body[data-panel=videos]', primary: '.media-bar[data-panel=videos] .btn.primary', inside: '.video-cats .icon-btn', settle: 700,
    prepare: `(() => { [...document.querySelectorAll('.video-cats .chip')].find(c => c.textContent.startsWith('Domingo')).click(); setTimeout(() => document.querySelector('.media-body[data-panel=videos] .media-card .media-pick').click(), 150); })()` },
  { name: 'Medios: audios', url: '/control#medios', content: '.media-body[data-panel=audios]', settle: 500,
    prepare: `document.querySelector('.media-tabs [data-tab=audios]').click()` },
  // El equipo de la auditoría "no tiene" yt-dlp: Videos lleva su aviso encima, y el enlace de YouTube a la vista.
  { name: 'Videos: YouTube', url: '/control#videos', prefs: { 'cajon.completo': true }, content: '.media-body[data-panel=videos]', primary: '.media-bar[data-panel=videos] .btn.primary', inside: '.yt-add', settle: 700,
    prepare: `document.querySelector('.media-body[data-panel=videos] .media-card[data-status=ready][data-id=ejemplo-youtube] .media-pick').click()` },
  { name: 'Al aire con un video de YouTube', url: '/control#orden', show: 'youtube', controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Al aire con un video', url: '/control#orden', show: 'video', controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Orden con un video al aire', url: '/control#orden', show: 'video', controls: '.odetail .live-controls' },
  { name: 'Al aire con una imagen', url: '/control#medios', show: 'image', controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Himnario', url: '/control#himnario', content: '.hymns-body', primary: '.hymn-bar .btn.primary', inside: '.hymn-bar', settle: 700,
    prepare: `document.querySelector('.ws[data-module=himnario] .hymn')?.click()` },
  { name: 'Himnario: categorías', url: '/control#himnario', content: '.hymns-body', inside: '.hymn-group-head', settle: 700,
    prepare: `document.querySelector('.hymn-views [data-view=categories]').click(); setTimeout(() => document.querySelector('.hymn-group-head').click(), 200)` },
  { name: 'Himnario: letras sin música', url: '/control#himnario', content: '.hymns-body', primary: '.hymn-bar .btn.primary', inside: '.hymn-bar', settle: 900,
    prepare: `document.querySelector('.hymn-views [data-view=letras]').click(); setTimeout(() => document.querySelector('.ws[data-module=himnario] .hymns-body .hymn')?.click(), 200)` },
  { name: 'Himnario: búsqueda', url: '/control#himnario', content: '.hymns-body', inside: '.hymn-hit', settle: 1100,
    prepare: `(() => { document.querySelector('.hymn-views [data-view=grid]').click(); const i = document.querySelector('.ws[data-module=himnario] .search input'); i.value = 'renglon inventado'; i.dispatchEvent(new Event('input')); })()` },
  { name: 'Al aire con un himno', url: '/control#himnario', show: 'song', controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Orden con un himno al aire', url: '/control#orden', show: 'song', controls: '.odetail .live-controls' },
  // Diapositivas es una pestaña de Medios (fase 17).
  { name: 'Medios: diapositivas', url: '/control#medios', content: '.decks', inside: '.deck', settle: 500,
    prepare: `document.querySelector('.media-tabs [data-tab=diapositivas]').click()` },
  { name: 'Medios: una presentación', url: '/control#medios', content: '.deck-pages', primary: '.deck-bar .btn.primary', inside: '.deck-bar', settle: 600,
    prepare: `(() => { document.querySelector('.media-tabs [data-tab=diapositivas]').click(); document.querySelector('.decks[data-panel=diapositivas] .deck-pick').click(); })()` },
  { name: 'Al aire con una diapositiva', url: '/control#medios', show: 'slides', controls: LIVE_CONTROLS, prepare: OPEN_CONTROLS },
  { name: 'Orden con una diapositiva al aire', url: '/control#orden', show: 'slides', controls: '.odetail .live-controls' },
  // El Presentador no lleva escenario: noDock cambia ese control por la diapositiva grande y su fila de botones.
  { name: 'Presentador: elegir presentación', url: '/presentador', noDock: true, content: '.pr-choose', inside: '.pr-list .deck', settle: 600 },
  { name: 'Presentador: presentando', url: '/presentador', show: 'slides', noDock: true, primary: '.pr-main .transport .btn.primary', inside: '.pr-tools', settle: 800 }, // sin mandos de encuadre: se acerca y se mueve sobre la diapositiva (fase 14)
  // Con una página web al aire (un archivo propio): sin rejilla ni siguiente; la grande y Anterior / Siguiente / Negro a la vista (sus flechas van en la fila de botones, no en los mandos).
  { name: 'Presentador: una página web', url: '/presentador', page: 'archivo1', noDock: true, primary: '.pr-main .transport .btn.primary', inside: '.pr-tools', settle: 800 },
  { name: 'Páginas web', url: '/control#paginas', content: '.web-list', inside: '.web-item', settle: 400 },
  { name: 'Páginas web: una elegida', url: '/control#paginas', content: '.web-list', primary: '.ws[data-module=paginas] .abar .btn.primary', inside: '.ws[data-module=paginas] .abar', settle: 600,
    prepare: `document.querySelector('.ws[data-module=paginas] .web-pick').click()` },
  { name: 'Televisores', url: '/control#televisores', content: '.tvs', inside: '.tv' },
  { name: 'Televisores: control remoto', url: '/control#televisores', inside: '.modal', settle: 700,
    prepare: `[...document.querySelectorAll('.tv-actions .btn')].find((b) => b.textContent === 'Control remoto').click()` },
  { name: 'Inicio', url: '/', plain: '.role' },
  { name: 'Revisión del equipo', url: '/requisitos', plain: '.req' },
];

// ---- Lo que se mide dentro de la página ----
const MEASURE = (screen, touch, narrow) => {
  const inside = typeof screen.inside === 'object' ? (narrow ? screen.inside.narrow : screen.inside.wide) : screen.inside;
  return `(() => {
  const vw = innerWidth, vh = innerHeight;
  const box = (el) => el && el.getBoundingClientRect();
  const shown = (el) => { if (!el) return false; const r = box(el); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const inView = (el) => { if (!shown(el)) return false; const r = box(el); return r.top >= -1 && r.left >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1; };
  const q = (s) => document.querySelector(s);
  const out = {};
  out.sinDesborde = document.documentElement.scrollWidth <= vw + 1 && document.body.scrollWidth <= vw + 1;
  // Nada se desplaza de lado si no tiene nada al lado (lo vio el dueño en el Orden del celular): ningún panel con
  // desplazamiento horizontal cuyo contenido le sobre. Las tiras que se deslizan a propósito (el dock, las pestañas,
  // lo reciente, «A continuación», el Mapa del culto, las secciones de Ajustes) quedan fuera.
  const SIDEWAYS_OK = '.dockbar, .media-tabs, .video-cats, .hymn-views, .chips, .story-next, .omap-scroll, .omap, .search-scope, .recent, .crumbs, .set-nav';
  const sideways = [...document.querySelectorAll('body *')].filter((el) => {
    if (!shown(el) || el.closest(SIDEWAYS_OK) || el.closest('[hidden]')) return false;
    const x = getComputedStyle(el).overflowX;
    return (x === 'auto' || x === 'scroll') && el.scrollWidth > el.clientWidth + 1;
  }).map((el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(' ').filter(Boolean).join('.') : el.tagName.toLowerCase()) + ' +' + (el.scrollWidth - el.clientWidth) + 'px');
  out.deLado = sideways.length === 0;
  if (sideways.length) out.ladeados = [...new Set(sideways)].slice(0, 4);
  // Contraste sobre fondos cambiantes: el texto de lo que flota sobre la proyección se lee con una imagen blanca
  // detrás y con una negra. Se compone el color de cada capa (con su transparencia) y la sombra de arriba y de
  // abajo sobre los dos extremos; el desenfoque del cristal no cambia la luminosidad.
  {
    // Sin barras invertidas ni comillas invertidas: todo esto vive dentro de un texto que se evalúa en la página.
    const rgba = (c) => { if (!c || !c.startsWith('rgb')) return null; const v = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; };
    const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const narrowNow = document.body.classList.contains('narrow');
    const scrim = (y) => { if (narrowNow) return 0; if (document.body.classList.contains('drawer-open')) return 0.35; const f = y / vh; return f < 0.22 ? 0.55 * (1 - f / 0.22) : f > 0.7 ? 0.65 * ((f - 0.7) / 0.3) : 0; };
    const low = [];
    for (const el of document.querySelectorAll('.topbar *, .dockbar *, .queue *, .transport-bar *, .prep *, .drawer *, .story *')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      // Solo texto que se lee (con letras o cifras), no marcas decorativas como «·».
      if (!shown(el) || el.closest('[hidden], [disabled], .soon, .stage') || !(own.toLowerCase() !== own.toUpperCase() || /[0-9]/.test(own))) continue;
      const cs = getComputedStyle(el);
      if (Number(cs.opacity) < 0.99) continue;
      // Lo que otra capa tapa en ese momento (la cola bajo «Buscar en todo») no tiene que leerse ahí.
      const mid = box(el);
      const hit = document.elementFromPoint(mid.left + mid.width / 2, mid.top + mid.height / 2);
      if (hit && !el.contains(hit) && !hit.contains(el)) continue;
      // Lo que tiene un fondo propio opaco (un botón, la píldora «AL AIRE») no depende de lo que se proyecte.
      const layers = [];
      let solid = false;
      for (let a = el; a && a !== document.body; a = a.parentElement) { const bg = rgba(getComputedStyle(a).backgroundColor); if (bg && bg[3] > 0) layers.push(bg); if (bg && bg[3] >= 1) { solid = true; break; } }
      if (solid) continue;
      const y = box(el).top + box(el).height / 2;
      const ink = rgba(cs.color);
      if (!ink) continue;
      const size = parseFloat(cs.fontSize); const big = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      // En el escritorio, detrás está la proyección tal cual; en el celular, su reflejo atenuado (.scene-ambient, al 35 %).
      const bases = narrowNow ? [[89, 89, 89], [0, 0, 0]] : [[255, 255, 255], [0, 0, 0]];
      const worst = Math.min(...bases.map((base) => {
        let under = over([0, 0, 0, scrim(y)], base);
        for (let i = layers.length - 1; i >= 0; i -= 1) under = over(layers[i], under);
        return ratio(over(ink, under), under);
      }));
      if (worst < (big ? 3 : 4.5)) low.push('«' + el.textContent.trim().slice(0, 18) + '» (' + (el.closest('[class]')?.className || el.tagName) + ', ' + cs.color + ' sobre ' + layers.map((l) => l.join(' ')).join(' / ') + ') ' + worst.toFixed(1));
    }
    out.contraste = low.length === 0;
    if (low.length) out.flojos = [...new Set(low)].slice(0, 5);
  }
  // Para el dedo, 40 px; en la disposición del escritorio (tableta en horizontal), 36 (--tap en app.css).
  if (${JSON.stringify(touch)}) {
    const small = [...document.querySelectorAll('button, a[href], select, summary, input:not([type=range]):not([type=color]):not([type=file])')]
      .filter((el) => shown(el) && !el.disabled && !el.closest('.soon') && !el.closest('[hidden]'))
      .filter((el) => { const r = box(el); const p = el.closest('label.search'); const b = p ? box(p) : r; return Math.min(b.width, b.height) < (innerWidth >= 860 ? 35.5 : 39.5); })
      .map((el) => (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 24));
    out.dedos = small.length === 0;
    if (small.length) out.pequenos = [...new Set(small)].slice(0, 6);
  }
  if (${JSON.stringify(Boolean(screen.plain))}) return out;
  // El dock de módulos: a la vista y con sus iconos al alcance. Si no caben todos, se desliza, pero al menos cuatro se ven.
  // La función "Control del orden" (un solo módulo) no lo lleva; el Presentador, tampoco (sin escenario).
  const items = [...document.querySelectorAll('.dockbar .dock-item')];
  const bar = q('.dockbar');
  // Con una capa abierta (los mandos, una ventana) lo de debajo queda tapado a propósito: ahí solo cuenta la geometría.
  const covered = Boolean(q('.controls-layer:not([hidden])') || q('.finder-layer:not([hidden])') || q('.modal-backdrop'));
  const topmost = (el) => { if (covered) return true; const r = box(el); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(t) && el.contains(t); };
  if (!${JSON.stringify(Boolean(screen.noDock))}) {
    const seen = items.filter((b) => inView(b) && topmost(b)).length;
    const slides = bar && (bar.scrollWidth > bar.clientWidth + 1 || bar.scrollHeight > bar.clientHeight + 1);
    out.navegacion = items.length <= 1 || (inView(bar) && (seen === items.length || (slides && seen >= Math.min(4, items.length))));
  }
  if (${JSON.stringify(Boolean(screen.noDock))}) {
    out.alAire = shown(q('.pr-live')) ? inView(q('.pr-live')) && [...document.querySelectorAll('.pr-main .transport .btn')].every(inView) : true;
  } else {
    const drawer = q('.drawer');
    const dr = shown(drawer) ? box(drawer) : null;
    if (!${JSON.stringify(narrow)}) {
      // Escritorio y tableta horizontal: la barra de estado y los botones de transporte, a la vista y fuera del cajón.
      // Anterior y Siguiente abajo; «Solo fondo» y «Negro» arriba, junto al estado (fase 14).
      const buttons = [...document.querySelectorAll('.tb-main .btn, .scene-modes .mode-chip')].filter(shown);
      out.alAire = inView(q('.scene-status')) && buttons.length >= 4 && buttons.every((b) => inView(b) && topmost(b));
      // Las piezas flotantes (barra de estado, función, dock, cajón, cola, «Preparado» y transporte) no se pisan.
      const names = ['.scene-status', '.role-chip', '.dockbar', '.drawer', '.queue', '.prep', '.transport-bar'].filter((n) => shown(q(n)));
      const hits = [];
      names.forEach((a, i) => names.slice(i + 1).forEach((b) => { const x = box(q(a)), y = box(q(b)); if (x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1) hits.push(a + ' con ' + b + ' (' + Math.round(Math.min(x.right, y.right) - Math.max(x.left, y.left)) + ' × ' + Math.round(Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)) + ' px)'); }));
      out.solape = names.length >= 5 && hits.length === 0;
      if (hits.length) out.solapan = hits;
    } else {
      // Celular: el recuadro de «Historias» por encima del cajón; con el cajón a pantalla completa, el estado arriba.
      const frame = q('.story-frame');
      // Con el cajón completo, o uno reducido que tapa el recuadro, el estado se ve en la cabecera del cajón.
      const covered = dr && !(box(frame).bottom <= dr.top + 1 || box(frame).right <= dr.left + 1);
      out.alAire = dr && (drawer.classList.contains('wide') || covered) ? inView(q('.drawer .scene-mini .live-pill')) : inView(frame);
      if (shown(frame)) { const m = box(frame); out.monitorProporcion = Math.abs(m.width / m.height - 16 / 9) < 0.08; }
    }
  }
  ${screen.prepared ? `{ const f = q('.finder-layer:not([hidden]) .finder'), p = q('.prep'), a = box(f), b = box(p);
    out.buscarPreparado = shown(f) && shown(p) && (a.bottom <= b.top + 1 || a.right <= b.left + 1 || b.right <= a.left + 1) && inView(p) && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('.prep') === p; }` : ''}
  ${screen.primary ? `{ const a = q(${JSON.stringify(screen.primary)}); out.accion = inView(a) && topmost(a) && (${JSON.stringify(Boolean(screen.noDock))} || Boolean(a.closest('.drawer'))); }` : ''}
  ${screen.content ? `{ const c = [...document.querySelectorAll(${JSON.stringify(screen.content)})].find(shown); out.espacioContenido = c ? Math.round(Math.min(box(c).bottom, vh) - Math.max(box(c).top, 0)) : 0; }` : ''}
  ${screen.longTitles ? `{ const t = [...document.querySelectorAll('.orow .item-text strong')].find((e) => e.textContent.length > 60); out.tituloLargo = Boolean(t) && t.scrollHeight <= t.clientHeight + 1; }` : ''}
  ${inside ? `{ const e = q(${JSON.stringify(inside)}); const r = box(e); out.dentro = shown(e) && r.left >= -1 && r.right <= vw + 1 && r.top >= -1 && r.bottom <= vh + 1 && [...e.querySelectorAll('button')].every((b) => !shown(b) || (box(b).left >= r.left - 1 && box(b).right <= r.right + 1)); }` : ''}
  ${screen.controls ? `{ const c = [...document.querySelectorAll(${JSON.stringify(screen.controls)})].find((e) => shown(e)) || q(${JSON.stringify(screen.controls)}); const r = box(c);
    // El volumen general no va en los mandos de la capa (vive en la barra de transporte): su CSS lo oculta a propósito.
    const list = [...c.querySelectorAll('button, select')].filter((b) => !b.closest('.volume'));
    out.mandos = shown(c) && list.length > 0 && r.left >= -1 && r.right <= vw + 1 && list.every((b) => { const x = box(b); return shown(b) && x.left >= r.left - 1 && x.right <= r.right + 1; }); }` : ''}
  return out;
})()`;
};

// Espera a que la pantalla haya terminado de dibujarse (hasta 8 s), en vez de una pausa fija.
async function ready(chrome, screen) {
  const done = screen.plain ? `document.querySelector(${JSON.stringify(screen.plain)})`
    : `document.querySelector('.ws:not([hidden])') && (!document.querySelector('.ws:not([hidden]) .picker') || document.querySelector('.ws:not([hidden]) .verse')) && document.querySelector('.scene-caption')?.textContent`;
  for (let i = 0; i < 40; i += 1) {
    await sleep(200);
    if (await chrome.evaluate(`Boolean(${done})`)) break;
  }
  await sleep(350);
}

const LABELS = { buscarPreparado: 'la tarjeta «Preparado» encima de la búsqueda y sin pisarse con ella', sinDesborde: 'sin desborde lateral', navegacion: 'dock de módulos a la vista', alAire: 'lo que está al aire y sus botones a la vista', solape: 'cajón, cola, tarjeta «Preparado» y barras sin pisarse', monitorProporcion: 'recuadro de la proyección sin deformar', accion: 'acción principal a la vista y sin nada encima', tituloLargo: 'títulos largos legibles', mandos: 'mandos en vivo completos y sin salirse', dentro: 'el recuadro cabe en la pantalla', dedos: 'botones para el dedo', deLado: 'nada se desplaza de lado sin tener nada al lado', contraste: 'el texto se lee sobre una proyección blanca y sobre una negra', cierraFuera: 'la capa se cierra al tocar fuera' };
const MIN_CONTENT = 150;

// Qué revisar: las palabras que se le pasan eligen tamaños (por su nombre o «360x640») y pantallas.
const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const words = process.argv.slice(2).filter((a) => a !== 'capturas').map(fold);
const sizeName = (d) => fold(`${d.name} ${d.w}x${d.h}`);
const sizeWords = words.filter((w) => DEVICES.some((d) => sizeName(d).includes(w)));
const screenWords = words.filter((w) => SCREENS.some((s) => fold(s.name).includes(w)));
const unknown = words.filter((w) => !sizeWords.includes(w) && !screenWords.includes(w));
if (unknown.length) {
  console.error(`Ningún tamaño ni pantalla se llama así: ${unknown.join(', ')}`);
  process.exit(2);
}
const devices = sizeWords.length ? DEVICES.filter((d) => sizeWords.some((w) => sizeName(d).includes(w))) : DEVICES;
const screens = screenWords.length ? SCREENS.filter((s) => screenWords.some((w) => fold(s.name).includes(w))) : SCREENS;

let problems = 0;

// Un servidor con sus datos y un Chrome que revisa unos cuantos tamaños. Cada uno tiene lo suyo
// porque las pantallas cambian lo que está al aire y las preferencias del navegador.
async function worker(list, n) {
  const port = PORTS[n];
  const base = `http://localhost:${port}`;
  const data = path.join(tmp, `datos-${n + 1}`);
  // Un televisor de mentira, ya vinculado, para revisar su tarjeta y su control remoto.
  const fakeTv = await startFakeTv();
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'televisores.json'), JSON.stringify({
    list: [{ id: 'tele', ip: '192.168.1.50', name: 'Televisor del salón de jóvenes', model: 'QN00PRUEBA', token: fakeTv.token }],
  }));
  // Tres páginas web, sin internet: se escriben ya "agregadas" (dos direcciones, una que se deja mostrar y otra
  // que no, y un archivo HTML), con nombres largos para ver que no desbordan.
  fs.mkdirSync(path.join(data, 'paginas'), { recursive: true });
  fs.writeFileSync(path.join(data, 'paginas', 'archivo1.html'), '<!doctype html><title>Juego</title><body>Juego de la iglesia</body>');
  fs.writeFileSync(path.join(data, 'paginas.json'), JSON.stringify({ pages: [
    { id: 'enlace1', name: 'Presentación de la escuela sabática con un nombre muy largo para ver cómo se corta en el celular', source: 'url', url: 'http://localhost:9/design/ejemplo-de-una-direccion-larga/view', framable: true, added: 3 },
    { id: 'enlace2', name: 'Concurso bíblico', source: 'url', url: 'https://kahoot.it/', framable: false, added: 2 },
    { id: 'archivo1', name: 'Juego de la iglesia', source: 'file', url: null, framable: true, added: 1 },
  ] }));
  // El ejemplo se escribe antes de arrancar: el servidor lee el orden y la biblioteca al abrirse.
  const example = seedExample(data);
  const server = killOnExit(spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT, stdio: 'ignore',
    env: { ...process.env, MANNA_NAME: `manna-auditoria-${n + 1}`, MANNA_NO_OPEN: '1', MANNA_SIN_VENTANA: '1', MANNA_DATA: data, PORT: String(port), MANNA_HIMNARIO: example.hymnal, MANNA_FALTA: 'navegador,yt-dlp', MANNA_TV_PRUEBA: JSON.stringify(fakeTv.endpoints) },
  }));
  await sleep(3000);
  const chrome = await startChrome();
  chrome.acceptDialogs = true;
  const setPrefs = (prefs, remove = false) => chrome.evaluate(`for (const [k, v] of Object.entries(${JSON.stringify(prefs)})) ${remove ? "localStorage.removeItem('manna.' + k)" : "localStorage.setItem('manna.' + k, JSON.stringify(v))"}`);
  const showInOrder = (id) => chrome.evaluate(`fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'order.show',payload:{id:${JSON.stringify(id)}}})}).then((r) => r.status)`);
  try {
    await chrome.send('Page.navigate', { url: `${base}/control` });
    await sleep(2000);
    await showInOrder(example.live);

    for (const device of list) {
      const narrow = device.w < 860;
      await chrome.send('Emulation.setDeviceMetricsOverride', { width: device.w, height: device.h, deviceScaleFactor: 1, mobile: device.touch });
      await chrome.send('Emulation.setTouchEmulationEnabled', { enabled: device.touch });
      // Cada tamaño empieza sin preferencias guardadas, como un dispositivo nuevo: el cajón se abre a su
      // tamaño de partida. Sin esto, cada tamaño heredaba lo que el anterior guardó (el celular pequeño deja el
      // cajón a pantalla completa) y el resultado dependía del orden.
      await chrome.evaluate('localStorage.clear()');
      // Lo de cada tamaño se escribe de una vez al terminarlo, para que no se mezcle con el de los otros Chrome.
      const lines = [`\n${device.name} (${device.w} × ${device.h})`];
      for (const screen of screens) {
        if ((screen.narrowOnly && !narrow) || (screen.wideOnly && narrow)) continue;
        if (screen.prefs) await setPrefs(screen.prefs);
        if (screen.show) await showInOrder(example[screen.show]);
        if (screen.page) await chrome.evaluate(`fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'projection.show',payload:{kind:'web',data:{id:${JSON.stringify(screen.page)}}}})}).then((r) => r.status)`);
        // La dirección cambia en cada visita para forzar una carga limpia de la página.
        const [pathname, hash = ''] = screen.url.split('#');
        await chrome.send('Page.navigate', { url: `${base}${pathname}?t=${Date.now()}${hash ? `#${hash}` : ''}` });
        await ready(chrome, screen);
        if (screen.prepare) { await chrome.evaluate(screen.prepare); await sleep(screen.settle || 500); }
        const result = await chrome.evaluate(`JSON.stringify(${MEASURE(screen, device.touch, narrow)})`);
        const m = JSON.parse(result || '{}');
        if (screen.closes) {
          // Un toque de verdad fuera del recuadro, sobre el fondo de la capa.
          const [layer, panel] = screen.closes;
          const spot = JSON.parse(await chrome.evaluate(`JSON.stringify((() => { const l = document.querySelector(${JSON.stringify(layer)}); const p = document.querySelector(${JSON.stringify(panel)}).getBoundingClientRect(); for (let y = innerHeight - 6; y > 6; y -= 12) for (let x = 6; x < innerWidth; x += 24) { if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) continue; if (document.elementFromPoint(x, y) === l) return { x, y }; } return null; })())`));
          if (spot) for (const type of ['mousePressed', 'mouseReleased']) await chrome.send('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
          await sleep(300);
          m.cierraFuera = Boolean(spot) && await chrome.evaluate(`document.querySelector(${JSON.stringify(layer)}).hidden`);
        }
        const failures = Object.keys(LABELS).filter((k) => m[k] === false).map((k) => LABELS[k] + (k === 'dedos' ? `: ${m.pequenos.join(', ')}` : k === 'solape' && m.solapan ? `: ${m.solapan.join('; ')}` : k === 'deLado' ? `: ${m.ladeados.join(', ')}` : k === 'contraste' ? `: ${m.flojos.join('; ')}` : ''));
        if (m.espacioContenido !== undefined && m.espacioContenido < MIN_CONTENT) failures.push(`poco espacio para el contenido (${m.espacioContenido} px)`);
        problems += failures.length;
        const room = m.espacioContenido !== undefined ? ` · contenido ${m.espacioContenido} px` : '';
        lines.push(`  ${failures.length ? '✖' : '✔'} ${screen.name}${room}${failures.length ? `\n      ${failures.join('\n      ')}` : ''}`);
        if (SHOTS) {
          const png = await chrome.send('Page.captureScreenshot', { format: 'png' });
          const file = path.join(tmp, `${device.w}x${device.h} ${screen.name.replace(/[:"]/g, '')}.png`);
          fs.writeFileSync(file, Buffer.from(png.result.data, 'base64'));
        }
        if (screen.show || screen.page) await showInOrder(example.live);
        if (screen.prefs) await setPrefs(screen.prefs, true);
      }
      console.log(lines.join('\n'));
    }
  } finally {
    chrome.close();
    server.kill();
    await fakeTv.stop();
  }
}

// Los tamaños se reparten alternos (1.º, 4.º y 7.º al primer Chrome…): todos tardan lo mismo.
const groups = PORTS.map((_, n) => devices.filter((_, k) => k % PORTS.length === n)).filter((g) => g.length);
const results = await Promise.allSettled(groups.map((list, n) => worker(list, n)));
await sleep(800);
if (!SHOTS) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
const crash = results.find((r) => r.status === 'rejected');
if (crash) throw crash.reason;

if (SHOTS) console.log(`\nCapturas en: ${tmp}`);
console.log(problems ? `\n${problems} problema(s) encontrados.` : '\nSin problemas en ninguna pantalla.');
process.exit(problems ? 1 : 0);
