import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { action, subscribe } from '../core/api.js';
import { h, dialog, guard } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { whenLabel } from '../core/time.js';
import { usersBody } from '../modules/settings/usuarios.js';

// Administrar la iglesia (en la nube, fase 36): el administrador entra con su PIN y gestiona los usuarios, aunque
// el equipo de la iglesia esté apagado, y empareja el equipo oficial (fase 37). Dos pestañas, sin proyección.
const me = await ensureRole('administrar');

const usuarios = {
  id: 'usuarios',
  name: 'Usuarios',
  icon: 'user-plus',
  mount(el, ctx) {
    el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Usuarios de la iglesia')),
      h('div', { class: 'admin-users' }, h('p', {}, 'Cada persona entra con su nombre y su PIN. En la iglesia, solo usa las funciones que tenga marcadas; aquí, en la nube, todos pueden preparar el culto.'),
        ...usersBody(ctx.user)));
  },
};

// El equipo oficial de la iglesia: cuál es, si está conectado, y el código para emparejar uno (decisión 63).
const equipo = {
  id: 'equipo',
  name: 'Equipo',
  icon: 'devices',
  mount(el) {
    const info = h('p', {});
    const warn = h('p', { class: 'muted' });
    const showCode = guard(async () => {
      const { code, until } = await action('cloud.code');
      const box = dialog('Código para emparejar',
        h('p', { class: 'pair-code', 'aria-label': `Código ${code.split('').join(' ')}` }, code),
        h('p', { class: 'muted', style: 'text-align: center;' }, `Sirve una vez, hasta las ${new Date(until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`),
        h('ol', { class: 'pair-steps' },
          h('li', {}, 'En el equipo de la iglesia, abre Manna y entra en Ajustes → Nube.'),
          h('li', {}, `Escribe la dirección ${location.host} y este código.`),
          h('li', {}, 'Pulsa «Emparejar».')),
        h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 14px;' }, h('button', { class: 'btn', onclick: () => box.close() }, 'Listo')));
    });
    el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Equipo de la iglesia')),
      h('div', { class: 'admin-users' }, info, warn,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: showCode }, icon('link-simple', 16), 'Emparejar un equipo'))));
    subscribe('cloud', ({ official }) => {
      info.textContent = official
        ? `El equipo oficial es «${official.name}» (emparejado ${whenLabel(official.paired)}). ${official.online ? 'Está conectado' : `Se conectó por última vez ${whenLabel(official.lastSeen)}`}${official.version ? `, con Manna ${official.version}` : ''}.`
        : 'Aún no hay ningún equipo emparejado. El equipo oficial es el que proyecta en la iglesia: emparejado, recibe lo que se prepara aquí.';
      warn.textContent = official ? `Si emparejas otro, «${official.name}» quedará bloqueado hasta que se vuelva a emparejar.` : '';
    });
  },
};

createShell({ role: 'administrar', isLocal: me.isLocal, user: me.user, modules: [usuarios, equipo], layout: 'pestanas', createScene: () => ({}) });
