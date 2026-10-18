import { action, api, state } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { prefs } from '../../core/prefs.js';
import { documentText } from '../../core/documentos.js';

// «Citas de un texto o documento» (fase 27, decisión 47): se pega un texto o se elige un Word, un PDF o un texto; el
// servidor encuentra las citas (server/modules/bible/citas.js) y aquí se revisan antes de añadirlas al orden, todas de
// una vez (order.addMany). Salen marcadas las seguras y las que confirma el texto copiado; las dudosas, sin marcar,
// con su propuesta y el motivo. Nada entra sin pasar por esta lista.
const ACCEPT = '.docx,.pdf,.txt,.doc,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
const MANY = 40; // con más citas, la lista va por páginas, y cada página se marca de una vez
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const sameRef = (a, b) => a.book === b.book && a.chapter === b.chapter && a.verseStart === b.verseStart && a.verseEnd === b.verseEnd;

export function openCitas({ text = '' } = {}) {
  const area = h('textarea', { class: 'input review-text', rows: 6, placeholder: 'Pega aquí el bosquejo, el sermón o una lista de citas…', 'aria-label': 'Texto con citas' });
  area.value = text;
  const picker = h('input', { type: 'file', accept: ACCEPT, hidden: true, onchange: () => { const file = picker.files[0]; picker.value = ''; if (file) fromFile(file); } });
  const status = h('p', { class: 'muted review-status', role: 'status' });
  const find = h('button', { class: 'btn primary', onclick: () => search(area.value, 'Citas') }, icon('magnifying-glass', 16), 'Buscar las citas');
  const start = h('div', { class: 'review-start' },
    h('p', { class: 'muted' }, 'Pega un texto o elige un documento (Word, PDF o texto). Manna busca las citas bíblicas y te las muestra para revisarlas antes de añadirlas.'),
    area, status,
    h('div', { class: 'row review-actions' },
      h('button', { class: 'btn', onclick: () => picker.click() }, icon('upload-simple', 16), 'Elegir documento'), picker, find));
  const body = h('div', { class: 'review' }, start);
  const box = dialog('Citas de un texto o documento', body);
  box.el.querySelector('.modal').classList.add('review-box');
  const busy = (on, message = '') => {
    find.disabled = on;
    status.textContent = message;
  };
  if (text.trim()) search(text, 'Citas');
  else area.focus();

  async function fromFile(file) {
    busy(true, `Leyendo «${file.name}»…`);
    try {
      const content = await documentText(file);
      await search(content, file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      busy(false);
      toast(err.message, 'error');
    }
  }

  async function search(content, name) {
    if (!content.trim()) return toast('Pega un texto o elige un documento.', 'error');
    busy(true, 'Buscando las citas…');
    try {
      const found = await api('/api/bible/citas', { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: content, timeout: 120_000 });
      busy(false);
      if (!found.items.length) return toast('No se encontró ninguna cita en ese texto.', 'error');
      showList(found, name);
    } catch (err) {
      busy(false);
      toast(err.message, 'error');
    }
  }

  // ---- La lista para revisar ----
  function showList({ items, dropped, pages }, name) {
    const inOrder = (state.order?.items || []).filter((i) => i.kind === 'verses').map((i) => i.data.ref);
    const rows = items.map((item) => {
      const already = item.choices[0].order.every((r) => inOrder.some((o) => sameRef(o, r)));
      const check = h('input', { type: 'checkbox', checked: (item.confidence === 'segura' || item.checked) && !already, 'aria-label': `Añadir ${item.choices[0].label}`, onchange: () => update() });
      const pick = item.choices.length > 1
        ? h('select', { class: 'input citas-choice', 'aria-label': 'Cuál', onchange: () => { check.checked = true; update(); } },
          ...item.choices.map((c, k) => h('option', { value: k }, k ? `o ${c.label}` : c.label)))
        : h('strong', {}, item.choices[0].label);
      const notes = [
        item.times > 1 && `aparece ${item.times} veces`,
        already && 'ya está en el orden',
        item.checked && 'el texto copiado coincide',
        item.version && `dice ${item.version}${item.versionId ? '' : ' (no está instalada)'}`,
        pages > 1 && `página ${item.page}`,
      ].filter(Boolean);
      const el = h('label', { class: `review-row${item.confidence === 'revisar' ? ' doubt' : ''}` }, check,
        h('span', { class: 'review-main' }, pick,
          item.reasons.length > 0 && h('small', { class: 'review-why' }, icon('warning', 13), item.reasons.join(' · ')),
          h('small', { class: 'review-ctx' }, item.context.before, h('mark', {}, item.context.match), item.context.after),
          notes.length > 0 && h('small', { class: 'muted' }, notes.join(' · '))));
      return { item, check, pick, el };
    });

    // Documento largo: por páginas, y cada página se marca o desmarca de una vez.
    const groups = [];
    if (items.length > MANY && pages > 1) {
      for (const row of rows) {
        let g = groups.at(-1);
        if (!g || g.page !== row.item.page) {
          g = { page: row.item.page, rows: [] };
          g.check = h('input', { type: 'checkbox', 'aria-label': `Página ${g.page}`, onchange: () => { for (const r of g.rows) r.check.checked = g.check.checked; update(); } });
          g.count = h('span', {});
          g.el = h('div', { class: 'citas-group' }, h('label', { class: 'citas-page' }, g.check, h('strong', {}, `Página ${g.page}`), g.count));
          groups.push(g);
        }
        g.rows.push(row);
        g.el.append(row.el);
      }
    }

    // Adónde van: una sección nueva con el nombre del documento, una que ya existe o el final del orden; y en qué versión.
    const sections = (state.order?.items || []).filter((i) => i.kind === 'section');
    const where = h('select', { class: 'input', 'aria-label': 'Dónde', onchange: () => { title.hidden = where.value !== 'new'; } },
      h('option', { value: 'new' }, 'En una sección nueva'),
      ...sections.map((s) => h('option', { value: s.id }, `Al final de «${s.title}»`)),
      h('option', { value: 'end' }, 'Al final del orden'));
    const title = h('input', { class: 'input', value: name, maxLength: 60, 'aria-label': 'Nombre de la sección' });
    const versions = state.bible?.versions || [];
    const chosen = prefs.get('version');
    const version = h('select', { class: 'input', 'aria-label': 'Versión' },
      ...versions.map((v) => h('option', { value: v.id, selected: v.id === chosen }, v.name)));
    const summary = h('p', { class: 'review-summary' });
    const add = h('button', { class: 'btn primary', onclick: guard(async () => {
      const picked = rows.filter((r) => r.check.checked);
      const list = picked.flatMap((r) => {
        const choice = r.item.choices[r.pick.value ? Number(r.pick.value) : 0];
        const versionId = r.item.versionId || version.value;
        return choice.order.map((ref) => ({ kind: 'verses', data: { versionId, ref } }));
      });
      const section = where.value === 'new' ? { title: title.value.trim() || name } : where.value === 'end' ? null : { id: where.value };
      add.disabled = true;
      try {
        await action('order.addMany', { items: list, section });
      } finally { add.disabled = false; }
      box.close();
      toast(`Añadidas al orden: ${plural(picked.length, 'cita', 'citas')}.`);
    }) });

    function update() {
      const n = rows.filter((r) => r.check.checked).length;
      summary.textContent = `${plural(items.length, 'cita encontrada', 'citas encontradas')}; ${plural(n, 'marcada', 'marcadas')}.`;
      add.replaceChildren(icon('plus', 16), n ? `Añadir ${n} al orden` : 'Añadir al orden');
      add.disabled = !n;
      for (const g of groups) {
        const on = g.rows.filter((r) => r.check.checked).length;
        g.check.checked = on === g.rows.length;
        g.check.indeterminate = on > 0 && on < g.rows.length;
        g.count.textContent = ` · ${on} de ${g.rows.length}`;
      }
    }

    const all = (on) => { for (const r of rows) r.check.checked = on; update(); };
    // La lista se desplaza; dónde, la versión y «Añadir» quedan siempre a la vista.
    body.replaceChildren(
      h('div', { class: 'review-scroll' },
        h('div', { class: 'review-top' }, summary,
          h('button', { class: 'link', onclick: () => all(true) }, 'Marcar todas'),
          h('button', { class: 'link', onclick: () => all(false) }, 'Ninguna')),
        h('div', { class: 'review-list' }, ...(groups.length ? groups.map((g) => g.el) : rows.map((r) => r.el))),
        dropped.length > 0 && h('details', { class: 'review-dropped' },
          h('summary', {}, `${plural(dropped.length, 'descartada', 'descartadas')}: no parecen citas`),
          ...dropped.map((d) => h('p', { class: 'muted' }, h('small', { class: 'review-ctx' }, d.context.before, h('mark', {}, d.context.match), d.context.after), ` · ${d.why}`)))),
      h('div', { class: 'citas-where' },
        h('div', { class: 'field' }, h('div', { class: 'label' }, 'Dónde'), where, title),
        h('div', { class: 'field' }, h('div', { class: 'label' }, 'Versión'), version)),
      h('div', { class: 'row review-actions' }, h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'), add));
    update();
  }
}
