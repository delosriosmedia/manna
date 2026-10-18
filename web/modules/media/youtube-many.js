import { action, api } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

// «Varios videos de YouTube» (fase 28): se pegan muchos enlaces, como vengan (en líneas, con comas o dentro de un
// mensaje), se revisan en una lista y los elegidos se ponen en cola: bajan de uno en uno. Lo que ya está en la
// biblioteca se reconoce por el video, aunque se le haya cambiado el nombre, y sale sin marcar.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function openYoutubeMany({ text = '', onDone }) {
  const area = h('textarea', { class: 'input review-text', rows: 6, placeholder: 'Pega aquí los enlaces de YouTube: uno por línea, separados por comas o dentro de un mensaje…', 'aria-label': 'Enlaces de YouTube' });
  area.value = text;
  const status = h('p', { class: 'muted review-status', role: 'status' });
  const find = h('button', { class: 'btn primary', onclick: () => search(area.value) }, icon('magnifying-glass', 16), 'Buscar los videos');
  const body = h('div', { class: 'review' },
    h('div', { class: 'review-start' },
      h('p', { class: 'muted' }, 'Pega los enlaces de los videos. Manna los revisa y, al confirmar, los descarga de uno en uno mientras sigues usando Manna.'),
      area, status, h('div', { class: 'row review-actions' }, find)));
  const box = dialog('Añadir videos de YouTube', body);
  box.el.querySelector('.modal').classList.add('review-box');

  async function search(content) {
    if (!content.trim()) return toast('Pega los enlaces de YouTube.', 'error');
    find.disabled = true;
    status.textContent = 'Buscando los enlaces…';
    try {
      const found = await api('/api/media/youtube/enlaces', { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: content });
      if (!found.items.length) return toast(found.skipped[0] ? `Ese enlace ${found.skipped[0].why}.` : 'No se encontró ningún enlace de un video de YouTube.', 'error');
      showList(found);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      find.disabled = false;
      status.textContent = '';
    }
  }

  function showList({ items, more, skipped }) {
    const rows = items.map((item) => {
      const check = h('input', { type: 'checkbox', checked: !item.already, disabled: Boolean(item.already), 'aria-label': `Descargar ${item.label || item.link}`, onchange: () => update() });
      const notes = [
        item.times > 1 && `aparece ${item.times} veces`,
        item.already && `ya está en la biblioteca como «${item.already.name}»`,
      ].filter(Boolean);
      const el = h('label', { class: 'review-row' }, check,
        h('span', { class: 'review-main' },
          h('strong', {}, item.label || 'Video de YouTube'),
          h('small', { class: 'review-ctx' }, `youtu.be/${item.videoId}`),
          notes.length > 0 && h('small', { class: 'muted' }, notes.join(' · '))));
      return { item, check, el };
    });
    const summary = h('p', { class: 'review-summary' });
    const add = h('button', { class: 'btn primary', onclick: guard(async () => {
      const videoIds = rows.filter((r) => r.check.checked).map((r) => r.item.videoId);
      add.disabled = true;
      let ids;
      try {
        ({ ids } = await action('media.youtubeMany', { videoIds }));
      } finally { add.disabled = false; }
      box.close();
      onDone?.(ids);
      toast(ids.length ? `Descargando ${plural(ids.length, 'video', 'videos')}, de uno en uno. Puedes seguir usando Manna mientras tanto.` : 'Esos videos ya estaban en la biblioteca.');
    }) });
    function update() {
      const n = rows.filter((r) => r.check.checked).length;
      summary.textContent = `${plural(items.length, 'video encontrado', 'videos encontrados')}; ${plural(n, 'marcado', 'marcados')}.`;
      add.replaceChildren(icon('download-simple', 16), n ? `Descargar ${plural(n, 'video', 'videos')}` : 'Descargar');
      add.disabled = !n;
    }
    const all = (on) => { for (const r of rows) if (!r.item.already) r.check.checked = on; update(); };
    body.replaceChildren(
      h('div', { class: 'review-scroll' },
        h('div', { class: 'review-top' }, summary,
          h('button', { class: 'link', onclick: () => all(true) }, 'Marcar todos'),
          h('button', { class: 'link', onclick: () => all(false) }, 'Ninguno')),
        h('div', { class: 'review-list' }, ...rows.map((r) => r.el)),
        more > 0 && h('p', { class: 'muted' }, `Hay ${plural(more, 'enlace más', 'enlaces más')}: se añaden ${items.length} cada vez. Pégalos después.`),
        skipped.length > 0 && h('p', { class: 'muted' }, `${plural(skipped.length, 'enlace no se añade', 'enlaces no se añaden')}: ${skipped.map((s) => s.why).filter((w, i, a) => a.indexOf(w) === i).join('; ')}.`)),
      h('div', { class: 'row review-actions' }, h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), add));
    update();
  }

  if (text.trim()) search(text);
  else area.focus();
}
