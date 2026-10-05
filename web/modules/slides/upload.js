import { action, state, upload } from '../../core/api.js';
import { h, dialog, toast } from '../../core/dom.js';
import { openPdf } from './pdf.js';

// Subir una presentación. Un PDF lo convierte este navegador en imágenes y las envía una a una;
// un PowerPoint se envía entero y lo convierte el PowerPoint del equipo principal.

export const PRESENTATION_TYPES = ['.pptx', '.ppsx', '.pptm', '.ppsm', '.ppt', '.pps'];
export const DECK_ACCEPT = ['.pdf', 'application/pdf', ...PRESENTATION_TYPES].join(',');
const extensionOf = (name) => (/\.[^.]+$/.exec(name)?.[0] || '').toLowerCase();
export const isPdf = (file) => file.type === 'application/pdf' || extensionOf(file.name) === '.pdf';
export const isPresentation = (file) => PRESENTATION_TYPES.includes(extensionOf(file.name));
export const acceptsDeck = (file) => isPdf(file) || isPresentation(file);
// "Informe_tesoreria-3T (final).pdf" -> "Informe tesoreria 3T (final)"
const nameFromFile = (fileName) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Presentación';
export const hasPowerPoint = () => Boolean((state.tools?.list || []).find((t) => t.id === 'powerpoint')?.found);

const LOST = 'Las animaciones, las transiciones y los videos incrustados no se conservan: cada diapositiva queda como una imagen.';
const AS_PDF = 'Ábrela en el programa donde se hizo y guárdala como PDF: en PowerPoint, Archivo → Exportar (o Guardar como) → PDF. En Presentaciones de Google, Archivo → Descargar → PDF. En Keynote, Archivo → Exportar a → PDF.';

// Ventana para poner nombre a la presentación y subirla. onDone(id) recibe la que quedó en la biblioteca.
export function openDeckUpload(file, { onDone = () => {} } = {}) {
  if (!file) return;
  if (!acceptsDeck(file)) {
    const box = dialog('Ese archivo no es una presentación',
      h('p', {}, 'Manna admite presentaciones en PDF y de PowerPoint.'), h('p', { class: 'muted' }, AS_PDF),
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, h('button', { class: 'btn primary', onclick: () => box.close() }, 'Entendido')));
    return;
  }
  const pdf = isPdf(file);
  if (!pdf && !hasPowerPoint()) {
    const box = dialog('Hace falta el PDF de la presentación',
      h('p', {}, 'El equipo principal no tiene PowerPoint, así que Manna no puede abrir esta presentación.'), h('p', { class: 'muted' }, AS_PDF),
      h('p', { class: 'muted' }, 'Luego sube aquí el PDF.'),
      h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, h('button', { class: 'btn primary', onclick: () => box.close() }, 'Entendido')));
    return;
  }

  const name = h('input', { class: 'input', value: nameFromFile(file.name), maxLength: 80, 'aria-label': 'Nombre de la presentación' });
  const fill = h('span', { style: 'width: 0%;' });
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, fill);
  const status = h('small', { class: 'deck-up-status' }, pdf ? 'Leyendo el PDF…' : 'La convertirá el PowerPoint del equipo principal. Puede tardar un momento.');
  const send = h('button', { class: 'btn primary', disabled: pdf }, 'Subir');
  const cancel = h('button', { class: 'btn' }, 'Cancelar');
  const box = dialog('Subir una presentación',
    h('p', { class: 'muted' }, 'El nombre es el que se verá en la biblioteca y en el orden del culto.'),
    h('div', { class: 'deck-up' }, name, bar, status),
    h('p', { class: 'muted deck-up-note' }, LOST),
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, cancel, send));
  const progress = (fraction) => {
    const percent = Math.round(fraction * 100);
    fill.style.width = `${percent}%`;
    bar.setAttribute('aria-valuenow', percent);
  };
  const fail = (message) => {
    status.textContent = message;
    status.classList.add('error');
  };

  let doc = null;       // el PDF abierto
  let working = false;  // se están enviando páginas
  let stopped = false;  // la persona canceló a medias
  const close = () => {
    doc?.close();
    box.close();
  };
  cancel.onclick = () => {
    if (!working) { close(); return; }
    stopped = true;
    cancel.disabled = true;
    status.textContent = 'Cancelando…';
  };

  if (pdf) {
    openPdf(file).then((opened) => {
      doc = opened;
      status.textContent = `${doc.pages} ${doc.pages === 1 ? 'diapositiva' : 'diapositivas'} · se convierten en este dispositivo antes de enviarse`;
      send.disabled = false;
    }, (err) => fail(err.message));
  }

  async function sendPdf() {
    const title = name.value.trim() || nameFromFile(file.name);
    const { id } = await upload(`/api/slides?name=${encodeURIComponent(title)}&pages=${doc.pages}`, '');
    try {
      for (let n = 1; n <= doc.pages; n += 1) {
        if (stopped) throw Object.assign(new Error('La subida se canceló.'), { stopped: true });
        status.textContent = `Preparando la diapositiva ${n} de ${doc.pages}…`;
        const page = await doc.render(n);
        await upload(`/api/slides/${id}/pages/${n}`, page.blob, { headers: { 'Content-Type': 'image/jpeg' }, onProgress: (f) => progress((n - 1 + f * 0.9) / doc.pages) });
        // Sin miniatura se usa la propia imagen: no es motivo para dar la subida por mala.
        await upload(`/api/slides/${id}/pages/${n}?mini=1`, page.thumb, { headers: { 'Content-Type': 'image/jpeg' } }).catch(() => {});
        progress(n / doc.pages);
      }
      await action('slides.finish', { id });
      return id;
    } catch (err) {
      // Lo que llegó a medias no se queda en el equipo principal.
      await action('slides.remove', { id }).catch(() => {});
      throw err;
    }
  }

  async function sendPresentation() {
    const title = name.value.trim() || nameFromFile(file.name);
    status.textContent = 'Subiendo…';
    const deck = await upload(`/api/slides/powerpoint?name=${encodeURIComponent(title)}&ext=${encodeURIComponent(extensionOf(file.name))}`, file, { onProgress: progress });
    return deck.id;
  }

  send.onclick = async () => {
    send.disabled = true;
    name.disabled = true;
    status.classList.remove('error');
    working = true;
    try {
      const id = await (pdf ? sendPdf() : sendPresentation());
      working = false;
      close();
      toast(pdf ? 'Presentación subida.' : 'PowerPoint la está convirtiendo. Puedes seguir usando Manna mientras tanto.');
      onDone(id);
    } catch (err) {
      working = false;
      if (err.stopped) { close(); return; }
      fail(err.message);
      progress(0);
      name.disabled = false;
      cancel.disabled = false;
      send.disabled = false;
      send.textContent = 'Reintentar';
    }
  };
}
