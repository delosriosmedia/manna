import crypto from 'node:crypto';
import { HttpError } from '../../core/router.js';
import { plainAddress } from '../../core/listener.js';

// S35 · compartir una pestaña de Chrome en el proyector. La captura la pide el control del equipo principal
// (getDisplayMedia, que Chrome solo permite en `localhost`) y el video va por WebRTC a las pantallas de proyección de
// este mismo equipo: Manna solo les pasa los mensajes para conectarse (la oferta y la respuesta, evento `signal`).
// Una a la vez y sin guardar nada: dura lo que siga abierta la página que comparte (si se corta su conexión, se la
// espera GRACE_MS). Las demás pantallas ven una tarjeta (web/modules/web/share.js).
const GRACE_MS = 20_000;
const MAX_SIGNAL = 64 * 1024;

export function setupShare(app) {
  const { store, realtime } = app;
  let current = null; // { id, key, conn }: la clave solo la sabe quien comparte; conn, su conexión
  let gone = null;
  const publish = () => store.set('web', { share: current && { id: current.id } });
  // Una conexión de este equipo, y que sea la de quien hace la petición.
  const own = (conn, ctx) => {
    const c = ctx?.isLocal && realtime.client(conn);
    return c?.local && c.ip === plainAddress(ctx.ip) ? c : null;
  };

  function stop() {
    if (!current) return;
    const { id } = current;
    current = null;
    clearTimeout(gone);
    publish();
    const { item } = store.get('projection');
    if (item?.kind === 'share' && item.source.data?.id === id) app.run('projection.clear');
  }

  app.kind('share', {
    label: 'Pestaña compartida',
    // No va al orden ni a una capa: solo existe mientras se comparte.
    describe: () => null,
    resolve: (data) => (current && data?.id === current.id ? { id: current.id, title: 'Pestaña compartida' } : null),
  });

  // conn: la conexión en tiempo real de la página que comparte. Se proyecta en el momento.
  app.action('web.share', { permission: 'projection.control' }, ({ conn } = {}, ctx) => {
    if (!own(conn, ctx)) throw new HttpError(403, 'Una pestaña solo se puede compartir desde el equipo principal.');
    stop();
    current = { id: crypto.randomBytes(5).toString('hex'), key: crypto.randomBytes(16).toString('hex'), conn };
    publish();
    app.services.projection.present({ kind: 'share', data: { id: current.id } });
    return { id: current.id, key: current.key };
  });

  app.action('web.shareStop', { permission: 'projection.control' }, () => stop());

  // Los mensajes para conectarse, cada uno en nombre de su propia conexión: quien comparte (con su clave) a una
  // pantalla de proyección de este equipo; una pantalla de proyección, a quien comparte. Sin `to`, quien comparte
  // solo dice por dónde se le avisa (al volver a conectarse).
  app.route('POST', '/api/web/share/signal', async (ctx) => {
    const { from, to, key, data } = await ctx.json();
    const me = current && own(from, ctx);
    if (!me) throw new HttpError(409, 'Ahora no se comparte ninguna pestaña.');
    if (JSON.stringify(data ?? null).length > MAX_SIGNAL) throw new HttpError(413, 'Ese mensaje es demasiado grande.');
    if (key === current.key) {
      current.conn = from;
      clearTimeout(gone);
      const screen = to && realtime.client(to);
      if (screen?.local && screen.role === 'proyeccion') realtime.tell(to, { share: current.id, from, data });
    } else if (me.role === 'proyeccion') realtime.tell(current.conn, { share: current.id, from, data });
    else throw new HttpError(403, 'Esta pantalla no puede recibir la pestaña compartida.');
    return {};
  });

  realtime.onLeave((conn) => {
    if (current?.conn !== conn) return;
    clearTimeout(gone);
    gone = setTimeout(() => {
      try { stop(); } catch (e) { console.error('No se pudo dejar de compartir la pestaña:', e.message); }
    }, GRACE_MS);
    gone.unref();
  });
  app.onClose(() => clearTimeout(gone));
}
