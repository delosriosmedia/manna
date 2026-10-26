import { action, subscribe } from '../../core/api.js';
import { h, dialog, guard, toast } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { whenLabel } from '../../core/time.js';

// Ajustes → Nube (fase 37): emparejar este equipo con la nube de su iglesia, con la dirección y el código de 6 cifras
// que da «Administrar la iglesia» → Equipo. La clave que da la nube nunca llega a la interfaz.
const STATUS = {
  on: (c) => `Conectado${c.lastSeen ? ` (${whenLabel(c.lastSeen)})` : ''}.`,
  offline: () => 'Ahora sin conexión con la nube: Manna funciona igual y se pondrá al día al volver.',
  unknown: (c) => c.error || 'La nube no reconoce este equipo: vuelve a emparejarlo.',
  suspended: () => 'La nube de esta iglesia está suspendida en Manna Iglesia: este equipo funciona igual, sin sincronizar.',
  version: (c) => c.error,
  updating: () => 'La nube tiene una versión más nueva de Manna: este equipo se está poniendo al día y se volverá a abrir solo.',
};

export function cloudBody() {
  const status = h('p', { class: 'muted' });
  const url = h('input', { class: 'input', type: 'text', inputMode: 'url', autocomplete: 'off', placeholder: 'nv.manna-iglesia.es', 'aria-label': 'Dirección de la nube' });
  const code = h('input', { class: 'input', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6, autocomplete: 'off', placeholder: '6 números', 'aria-label': 'Código',
    oninput: () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); } });
  const pair = guard(async (confirm = false) => {
    const { conflict, church } = await action('cloud.pair', { url: url.value, code: code.value, confirm });
    if (conflict) return askReplace(conflict, () => pair(true));
    code.value = '';
    form.hidden = true;
    toast(`Este equipo es ahora el oficial de ${church}.`);
    return undefined;
  });
  const form = h('form', { class: 'cloud-form', onsubmit: (e) => { e.preventDefault(); pair(); } },
    h('label', { class: 'user-field' }, h('span', {}, 'Dirección de la nube de la iglesia'), url),
    h('label', { class: 'user-field' }, h('span', {}, 'Código de «Administrar la iglesia» → Equipo'), code),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, icon('link-simple', 16), 'Emparejar')));
  const again = h('button', { class: 'btn', onclick: () => { form.hidden = false; code.focus(); } }, 'Emparejar de nuevo');
  // Cómo tiene el himnario de la nube este equipo (decisión 64); lo que está bajando, debajo.
  const HYMNALS = [['nube', 'Desde la nube', 'Los himnos de los órdenes se bajan antes del culto; cualquier otro, al usarlo, con internet.'],
    ['completo', 'Completo en este equipo', 'Cantados, pistas, letras y diapositivas (unos 6 GB) se bajan a la carpeta de contenido, en segundo plano.']];
  const modes = HYMNALS.map(([id, label]) => h('button', { class: 'chip', dataset: { mode: id }, onclick: guard(() => action('cloud.hymnal', { mode: id })) }, label));
  const hymnalNote = h('p', { class: 'muted' });
  const hymnal = h('div', { class: 'cloud-hymnal' }, h('span', { class: 'user-field' }, h('span', {}, 'El himnario en este equipo')),
    h('div', { class: 'row', role: 'group', 'aria-label': 'El himnario en este equipo' }, ...modes), hymnalNote);

  subscribe('cloud', (c) => {
    const paired = c.status !== 'off';
    status.textContent = paired ? `Emparejado con ${c.church} (desde ${whenLabel(c.paired)}). ${(STATUS[c.status] || STATUS.offline)(c)}`
      : 'Este equipo no está emparejado. Con la nube de la iglesia se prepara el culto desde casa, aunque este equipo esté apagado.';
    status.classList.toggle('warn', ['unknown', 'version'].includes(c.status));
    if (!url.value && c.church) url.value = c.church;
    again.hidden = !paired;
    hymnal.hidden = !paired || c.status === 'replaced';
    for (const b of modes) {
      b.classList.toggle('on', b.dataset.mode === c.hymnal);
      b.setAttribute('aria-pressed', String(b.dataset.mode === c.hymnal));
    }
    const progress = c.content ? ` Bajando: ${c.content.done} de ${c.content.total} archivos${c.content.failed ? ` (${c.content.failed} no se pudieron: se reintentan más tarde)` : ''}.` : '';
    hymnalNote.textContent = (HYMNALS.find(([id]) => id === c.hymnal)?.[2] || 'Elige cómo tener aquí el himnario de la nube. Las biblias y las letras se bajan siempre.') + progress;
    if (!paired || c.status === 'unknown') form.hidden = false;
    else if (document.activeElement && !form.contains(document.activeElement)) form.hidden = true;
  });
  return [status, form, again, hymnal];
}

// Ya hay otro equipo oficial: emparejar este lo bloquea (decisión 63). Se pregunta antes.
export function askReplace(conflict, onConfirm) {
  const box = dialog('Ya hay un equipo oficial',
    h('p', {}, `«${conflict.name}» es el equipo oficial de esta iglesia${conflict.paired ? ` desde ${whenLabel(conflict.paired)}` : ''}. Si emparejas este, aquel quedará bloqueado hasta que se vuelva a emparejar.`),
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' },
      h('button', { class: 'btn', onclick: () => box.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => { box.close(); onConfirm(); } }, 'Emparejar este')));
}
