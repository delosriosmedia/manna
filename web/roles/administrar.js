import { ensureRole } from '../core/session.js';
import { createShell } from '../core/shell.js';
import { h } from '../core/dom.js';
import { usersBody } from '../modules/settings/usuarios.js';

// Administrar la iglesia (en la nube, fase 36): el administrador entra con su contraseña y gestiona los usuarios, aunque
// el equipo de la iglesia esté apagado. Una sola pantalla, sin proyección.
const me = await ensureRole('administrar');

const usuarios = {
  id: 'usuarios',
  name: 'Usuarios',
  icon: 'user-plus',
  mount(el, ctx) {
    el.replaceChildren(h('div', { class: 'ws-head' }, h('h1', {}, 'Usuarios de la iglesia')),
      h('div', { class: 'admin-users' }, h('p', {}, 'Cada persona entra con su nombre y su PIN. En la iglesia, solo usa las funciones que tenga marcadas; aquí, en la nube, todos pueden preparar el culto.'),
        ...usersBody(ctx.user, { passwords: true })));
  },
};

createShell({ role: 'administrar', isLocal: me.isLocal, user: me.user, modules: [usuarios], layout: 'pestanas', createScene: () => ({}) });
