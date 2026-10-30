import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { action, subscribe } from '../core/api.js';
import { h, dialog, guard, toast } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { whenLabel } from '../core/time.js';

// El superadministrador de Manna Iglesia (fase 39, decisión 64): las iglesias, lo que puede usar cada una, el espacio
// del plan y sus copias en Google Drive (fase 38). Entra con su contraseña. Tres pestañas, sin proyección. Lo que
// cambia lo guarda cada iglesia en su nube (server/modules/church); este sitio solo se lo pide (server/modules/super).
const me = await ensureRole('superadmin');
const GB = 1024 ** 3;
const gb = (bytes) => `${(bytes / GB).toFixed(bytes < 10 * GB ? 1 : 0).replace('.', ',')} GB`;
// Los módulos que se pueden apagar (los de server/modules/church) y lo que lleva cada función (web/modules/registry.js).
const NAMES = { orden: 'Orden', biblia: 'Biblia', himnario: 'Himnario', medios: 'Medios', textos: 'Textos', tiempo: 'Tiempo', paginas: 'Páginas web', capas: 'Capas' };
const SWITCHABLE = ['biblia', 'himnario', 'medios', 'textos', 'tiempo', 'paginas', 'capas'];
const FUNCTIONS = [
  ['control', 'Control total', ['orden', 'biblia', 'himnario', 'medios', 'textos', 'tiempo', 'paginas', 'capas']],
  ['alabanza', 'Alabanza', ['himnario', 'medios', 'orden', 'biblia']],
  ['preparacion', 'Preparar el culto', ['orden', 'biblia', 'himnario', 'medios', 'textos']],
];
let data = { plan: { total: 0, margin: 0.15 }, churches: [] };
const spaceLeft = (except) => Math.max(0, Math.floor(data.plan.total * (1 - data.plan.margin))
  - data.churches.filter((c) => c.host !== except).reduce((sum, c) => sum + (c.settings?.space || 0), 0));
const buttons = (box, ...rest) => h('div', { class: 'row', style: 'justify-content: flex-end; flex-wrap: wrap; margin-top: 14px;' },
  h('button', { class: 'btn', type: 'button', onclick: () => box().close() }, 'Cancelar'), ...rest);

function summary(c) {
  if (c.ok === null) return 'Sin consultar todavía.';
  if (!c.ok) return c.error;
  const { settings: s, metrics: m } = c;
  const official = m.official ? `equipo principal «${m.official.name}», ${m.official.online ? 'conectado' : `apagado (${whenLabel(m.official.lastSeen)})`}` : 'sin equipo principal';
  return [`Manna ${c.version}`, official, `${m.users} usuarios`, `${m.orders} de ${s.limit} órdenes`, `${gb(m.used)} usados${s.uploads ? ` de ${gb(s.space)}` : ''}`,
    m.lastUse && `último uso ${whenLabel(m.lastUse)}`].filter(Boolean).join(' · ');
}

// ---- Una iglesia: lo que puede usar ----
function editChurch(c) {
  const s = c.settings;
  const check = (label, on, id) => h('label', { class: 'super-check', dataset: { id } }, h('input', { type: 'checkbox', checked: on }), h('span', {}, label));
  const active = check('Activa (suspendida, su nube no deja entrar; su equipo sigue funcionando)', s.active);
  const modules = SWITCHABLE.map((id) => check(NAMES[id], !s.off.includes(id), id));
  const uploads = check('Su gente sube fotos, videos y presentaciones desde casa', s.uploads);
  const space = h('input', { class: 'input', type: 'number', min: 0, step: 0.5, value: Math.round((s.space / GB) * 10) / 10, 'aria-label': 'Espacio en GB' });
  const limit = h('input', { class: 'input', type: 'number', min: 1, max: 500, value: s.limit ?? 20, 'aria-label': 'Máximo de órdenes' });
  // El orden de los módulos de cada función: subir y bajar. El primero es el que se abre primero.
  const layout = Object.fromEntries(FUNCTIONS.map(([role, , ids]) => [role, [...(s.layout[role] || []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(s.layout[role] || []).includes(id))]]));
  const lists = FUNCTIONS.map(([role, name]) => {
    const list = h('ol', { class: 'super-order', dataset: { role } });
    const draw = () => list.replaceChildren(...layout[role].map((id, i) => h('li', {}, h('span', {}, NAMES[id]),
      h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Subir ${NAMES[id]} en ${name}`, disabled: i === 0, onclick: () => { layout[role].splice(i - 1, 0, layout[role].splice(i, 1)[0]); draw(); } }, icon('arrow-up', 15)),
      h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Bajar ${NAMES[id]} en ${name}`, disabled: i === layout[role].length - 1, onclick: () => { layout[role].splice(i + 1, 0, layout[role].splice(i, 1)[0]); draw(); } }, icon('arrow-down', 15)))));
    draw();
    return h('div', { class: 'super-function' }, h('strong', {}, name), list);
  });
  const save = guard(async () => {
    await action('super.set', { host: c.host, settings: {
      active: active.querySelector('input').checked,
      off: modules.filter((m) => !m.querySelector('input').checked).map((m) => m.dataset.id),
      uploads: uploads.querySelector('input').checked, space: Math.round(Number(space.value) * GB), limit: Math.round(Number(limit.value)), layout,
    } });
    box.close();
    toast(`Guardado en ${c.host}.`);
  });
  const access = guard(async () => {
    const { clave } = await action('super.access', { host: c.host });
    const shown = dialog('Recuperar el acceso',
      h('p', {}, `Con esta clave de alta, el administrador de ${c.host} vuelve a entrar en «Administrar la iglesia» y elige otra vez su nombre y su PIN. Sirve una vez, durante una semana.`),
      h('p', { class: 'pair-code' }, clave),
      h('div', { class: 'row', style: 'justify-content: flex-end;' }, h('button', { class: 'btn', onclick: () => shown.close() }, 'Listo')));
  });
  const remove = guard(async () => {
    await action('super.remove', { host: c.host });
    box.close();
    toast(`${c.host} ya no está en el panel (su sitio sigue igual).`);
  });
  const box = dialog(c.host, h('div', { class: 'super-edit' },
    active,
    h('h3', {}, 'Módulos que puede usar'), h('div', { class: 'super-modules' }, ...modules),
    h('p', { class: 'muted' }, 'Su administrador reparte entre sus usuarios solo lo que esté encendido. El Orden no se apaga.'),
    h('h3', {}, 'Archivos y espacio'), uploads,
    h('label', { class: 'user-field' }, h('span', {}, `Espacio en GB (${data.plan.total ? `quedan ${gb(spaceLeft(c.host))} del plan para repartir` : 'escribe el espacio del plan en «Espacio» para repartirlo'})`), space),
    h('label', { class: 'user-field' }, h('span', {}, 'Máximo de órdenes'), limit),
    h('h3', {}, 'Orden de los módulos'), h('p', { class: 'muted' }, 'En cada función, el primero es el que se abre primero.'), h('div', { class: 'super-functions' }, ...lists),
    h('div', { class: 'row', style: 'flex-wrap: wrap;' },
      h('button', { class: 'btn', type: 'button', onclick: access }, icon('key', 16), 'Recuperar el acceso'),
      h('button', { class: 'btn danger', type: 'button', onclick: remove }, icon('trash', 16), 'Quitar del panel'))),
  buttons(() => box, h('button', { class: 'btn primary', onclick: save }, 'Guardar')));
}

function addChurch() {
  const host = h('input', { class: 'input', type: 'text', inputMode: 'url', autocomplete: 'off', placeholder: 'nv.manna-iglesia.es', 'aria-label': 'Dirección de la iglesia' });
  const save = guard(async () => {
    await action('super.add', { host: host.value });
    box.close();
    toast('Iglesia añadida.');
  });
  const box = dialog('Añadir iglesia',
    h('p', {}, 'Su sitio tiene que existir ya, con la clave del superadministrador en sus variables (MANNA_CLAVE_SUPER).'),
    h('label', { class: 'user-field' }, h('span', {}, 'Dirección'), host),
    buttons(() => box, h('button', { class: 'btn primary', onclick: save }, 'Añadir')));
  host.focus();
}

const iglesias = {
  id: 'iglesias',
  name: 'Iglesias',
  icon: 'house',
  mount(el) {
    const list = h('div', { class: 'super-list' });
    el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Iglesias'),
      h('button', { class: 'btn', onclick: guard(() => action('super.refresh')) }, icon('arrow-clockwise', 16), 'Actualizar'),
      h('button', { class: 'btn primary', onclick: addChurch }, icon('plus', 16), 'Añadir iglesia')), list);
    subscribe('super', (s) => {
      data = s;
      list.replaceChildren(...(s.churches.length ? s.churches.map((c) => h('button', { class: 'super-row', dataset: { host: c.host }, disabled: !c.ok, onclick: () => editChurch(c) },
        h('span', { class: 'item-text' }, h('strong', {}, c.host), h('small', {}, summary(c))),
        c.ok && h('span', { class: `tag${c.settings.active ? '' : ' off'}` }, c.settings.active ? 'Activa' : 'Suspendida')))
        : [h('p', { class: 'muted' }, 'Aún no hay iglesias. Añade la dirección de cada una: su sitio ya creado en Hostinger.')]));
    });
    action('super.refresh').catch(() => {});
  },
};

const espacio = {
  id: 'espacio',
  name: 'Espacio',
  icon: 'stack',
  mount(el) {
    const total = h('input', { class: 'input', type: 'number', min: 0, step: 1, 'aria-label': 'Espacio del plan en GB' });
    const margin = h('input', { class: 'input', type: 'number', min: 0, max: 90, step: 5, 'aria-label': 'Margen sin repartir, en %' });
    const numbers = h('div', { class: 'super-space' });
    const rows = h('div', { class: 'super-list' });
    const save = guard(async () => {
      await action('super.plan', { total: Math.round(Number(total.value) * GB), margin: Number(margin.value) / 100 });
      toast('Espacio del plan guardado.');
    });
    el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Espacio del plan')),
      h('div', { class: 'admin-users' },
        h('p', {}, 'El espacio del plan de Hostinger (lo dice su panel) se reparte entre las iglesias, dejando un margen. No se puede dar a una iglesia más de lo que queda libre.'),
        h('div', { class: 'super-plan' },
          h('label', { class: 'user-field' }, h('span', {}, 'Espacio del plan, en GB'), total),
          h('label', { class: 'user-field' }, h('span', {}, 'Margen sin repartir, en %'), margin),
          h('button', { class: 'btn primary', onclick: save }, 'Guardar')),
        numbers, rows));
    subscribe('super', (s) => {
      data = s;
      if (document.activeElement !== total) total.value = Math.round(s.plan.total / GB);
      if (document.activeElement !== margin) margin.value = Math.round(s.plan.margin * 100);
      const shareable = Math.floor(s.plan.total * (1 - s.plan.margin));
      const given = s.churches.reduce((sum, c) => sum + (c.settings?.space || 0), 0);
      const used = s.churches.reduce((sum, c) => sum + (c.metrics?.used || 0), 0);
      numbers.replaceChildren(...[['Para repartir', gb(shareable)], ['Repartido', gb(given)], ['Libre para repartir', gb(Math.max(0, shareable - given))], ['Usado de verdad', gb(used)]]
        .map(([label, value]) => h('div', {}, h('small', {}, label), h('strong', {}, value))));
      rows.replaceChildren(...s.churches.filter((c) => c.ok).map((c) => h('div', { class: 'super-row' },
        h('span', { class: 'item-text' }, h('strong', {}, c.host), h('small', {}, `${gb(c.metrics.used)} usados de ${gb(c.settings.space)} asignados`)),
        h('span', { class: 'super-bar', style: `--used: ${Math.min(100, (c.metrics.used / Math.max(1, c.settings.space)) * 100)}%` }))));
    });
  },
};

// ---- Copias en Google Drive (fase 38) ----
const dayName = (file) => new Date(`${file.name.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

// Volver a una copia pregunta dos veces: se pierde lo que la iglesia cambió desde entonces.
function restore(host, file, list) {
  const day = dayName(file);
  const second = () => {
    const box = dialog('¿Seguro?',
      h('p', {}, `Se perderá lo que ${host} haya cambiado desde el ${day}. Lo de ahora queda guardado en la copia de hoy, por si hay que deshacerlo.`),
      buttons(() => box, h('button', { class: 'btn danger', onclick: guard(async () => {
        await action('super.restore', { host, id: file.id });
        box.close();
        list.close();
        toast(`${host} volvió a la copia del ${day}.`);
      }) }, 'Volver a la copia')));
  };
  const box = dialog('Volver a una copia',
    h('p', {}, `${host} quedará como estaba el ${day}: usuarios, órdenes, textos, favoritos y ajustes. Su equipo de la iglesia se pone igual al sincronizarse.`),
    buttons(() => box, h('button', { class: 'btn danger', onclick: () => { box.close(); second(); } }, 'Continuar')));
}
function showCopies(host) {
  const rows = h('div', { class: 'super-list' }, h('p', { class: 'muted' }, 'Buscando las copias…'));
  const box = dialog(`Copias de ${host}`, rows, buttons(() => box));
  guard(async () => {
    const files = await action('super.backups', { host });
    rows.replaceChildren(...(files.length ? files.map((f) => h('div', { class: 'super-row' },
      h('span', { class: 'item-text' }, h('strong', {}, dayName(f)), h('small', {}, `${Math.max(1, Math.round(f.size / 1024))} KB`)),
      h('button', { class: 'btn', onclick: () => restore(host, f, box) }, 'Volver a esta copia')))
      : [h('p', { class: 'muted' }, 'Aún no hay copias de esta iglesia.')]));
  })();
}

const copias = {
  id: 'copias',
  name: 'Copias',
  icon: 'clock-counter-clockwise',
  mount(el) {
    const body = h('div', { class: 'admin-users super-copies' });
    const now = h('button', { class: 'btn primary', hidden: true, onclick: guard(async () => {
      await action('super.backup');
      toast('Copias hechas.');
    }) }, icon('download-simple', 16), 'Hacer una copia ahora');
    el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Copias en Google Drive'), now), body);
    // Al volver de Google, lo que pasó.
    const came = new URLSearchParams(location.search).get('drive');
    if (came) {
      toast({ conectado: 'Google Drive quedó conectado.', cancelado: 'Google Drive no se conectó.' }[came] || 'Google no dio acceso. Vuelve a intentarlo.', came === 'conectado' ? 'info' : 'error');
      history.replaceState(null, '', `${location.pathname}${location.hash}`);
    }
    subscribe('super', (s) => {
      data = s;
      const d = s.drive;
      now.hidden = !d.connected;
      body.replaceChildren(
        h('p', {}, 'Cada noche se guarda una copia de cada iglesia (usuarios, órdenes, textos, favoritos y ajustes) en la carpeta «Manna Iglesia» de Google Drive. Se quedan las de los últimos 30 días y una por mes durante un año.'),
        d.ready ? h('div', { class: 'super-row' },
          h('span', { class: 'item-text' }, h('strong', {}, d.connected ? 'Google Drive conectado' : 'Google Drive sin conectar'),
            h('small', {}, d.connected ? `Desde ${whenLabel(d.since)}${d.night ? ` · última copia nocturna: ${d.night}` : ''}` : 'Se conecta una vez, con la cuenta donde se guardarán las copias.')),
          h('a', { class: `btn${d.connected ? '' : ' primary'}`, href: '/api/super/drive/conectar' }, d.connected ? 'Conectar otra cuenta' : 'Conectar Google Drive'))
          : h('p', { class: 'muted' }, 'Falta la aplicación de Google en las variables de este sitio (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).'),
        d.connected ? h('div', { class: 'super-list' }, ...s.churches.map((c) => {
          const last = d.last[c.host];
          return h('div', { class: 'super-row', dataset: { host: c.host } },
            h('span', { class: 'item-text' }, h('strong', {}, c.host),
              h('small', {}, !last ? 'Sin copias todavía.' : last.ok ? `Última copia: ${whenLabel(last.at)}` : `La última falló: ${last.error}`)),
            h('button', { class: 'btn', onclick: () => showCopies(c.host) }, 'Copias…'));
        })) : '');
    });
  },
};

createShell({ role: 'superadmin', isLocal: me.isLocal, user: me.user, modules: [iglesias, espacio, copias], layout: 'pestanas', createScene: () => ({}) });
