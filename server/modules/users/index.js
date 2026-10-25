import { HttpError } from '../../core/router.js';

// Usuarios (fase 35): el administrador de la iglesia los crea, cambia y quita en Ajustes → Usuarios. Las cuentas y la
// comprobación del PIN son del núcleo (core/users.js, core/sessions.js); aquí, sus órdenes y el estado `users`, la lista
// sin PIN (los nombres ya se ven al entrar).
export default function setup(app) {
  const { store, sessions } = app;
  const { users } = sessions;
  store.register('users', { list: [] });
  const publish = () => store.set('users', { list: users.list() });
  publish();

  // El primer administrador en la nube, con la clave de alta (decisión 62; la comprueba core/sessions.js).
  app.route('POST', '/api/session/alta', async (ctx) => {
    const opened = sessions.alta(ctx, await ctx.json());
    publish();
    return opened;
  });

  app.action('users.create', { permission: 'users.manage' }, ({ name, pin, functions, admin } = {}) => {
    const user = users.create({ name, pin: String(pin ?? ''), functions, admin });
    publish();
    return { id: user.id };
  });
  app.action('users.update', { permission: 'users.manage' }, ({ id, name, functions, admin } = {}) => {
    users.update(id, { name, functions, admin });
    publish();
  });
  // Cambiar el PIN de alguien cierra sus sesiones (menos la de quien lo cambia): vuelve a entrar con el nuevo.
  app.action('users.setPin', { permission: 'users.manage' }, ({ id, pin } = {}, ctx) => {
    users.setPin(id, String(pin ?? ''));
    sessions.closeUser(id, ctx?.session?.id);
  });
  // La contraseña de un administrador, para entrar en /administrar desde la nube (fase 36). Cierra sus otras sesiones.
  app.action('users.setPassword', { permission: 'users.manage' }, ({ id, password } = {}, ctx) => {
    users.setPassword(id, password);
    sessions.closeUser(id, ctx?.session?.id);
    publish();
  });
  app.action('users.remove', { permission: 'users.manage' }, ({ id } = {}, ctx) => {
    if (id && id === ctx?.session?.user?.id) throw new HttpError(409, 'No puedes quitarte a ti mismo: pídeselo a otro administrador.');
    users.remove(id);
    sessions.closeUser(id);
    // Sus órdenes pasan a quien lo quita (o al primer administrador), para que no queden sin dueño (S52).
    app.services.order?.reassign(id, ctx?.session?.user?.id || users.firstAdmin().id);
    publish();
  });
}
