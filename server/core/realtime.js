// Canal en tiempo real (Server-Sent Events): el servidor empuja cada cambio de estado
// a todos los dispositivos conectados. Las órdenes viajan aparte, por POST /api/action.
// Eventos: 'hello' (quién es esta conexión), 'state' (todo, al conectar), 'patch' (un espacio que
// cambió) y 'ping' (latido).
// El latido lleva la hora del servidor: con ella cada pantalla ajusta su reloj y la
// reproducción va a la par en todas (ver web/core/playback.js).
const PING_MS = 10_000;

export function createRealtime({ store, router }) {
  const clients = new Set();
  let serial = 0;

  store.register('conexiones', {});

  function send(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Una sola pantalla suena, para que no haya eco ni desfases, y siempre es del equipo principal:
  // así el sonido sale por el dispositivo de audio que ese equipo tenga elegido. La primera
  // pantalla de proyección abierta en él (la del proyector); si no hay ninguna, su página de
  // control. Si se cierra, pasa a la siguiente. Cada conexión sabe quién es por el evento
  // 'hello' y se compara con `sonido`.
  // Una pestaña corriente no puede sonar hasta que alguien la toca (regla del navegador; la
  // ventana del proyector sí puede): la que lo descubre lo dice (POST /api/events/sound) y se
  // elige a otra. Sin ninguna que pueda, `sonido` es null y los controles lo avisan.
  const soundClient = () => {
    const local = [...clients].filter((c) => c.local && c.able);
    return (local.find((c) => c.role === 'proyeccion') || local.find((c) => c.role === 'control' || c.role === 'orden'))?.id || null;
  };

  function publishCounts() {
    const counts = {};
    for (const c of clients) counts[c.role] = (counts[c.role] || 0) + 1;
    store.set('conexiones', { porRol: counts, sonido: soundClient() });
  }

  store.on('change', (ns, state) => {
    for (const c of clients) send(c.res, 'patch', { ns, state });
  });

  router.route('GET', '/api/events', (ctx) => {
    const { req, res } = ctx;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 1500\n\n');
    serial += 1;
    const client = { res, id: `c${serial}`, able: true, local: ctx.isLocal, role: (ctx.query.get('rol') || 'otro').slice(0, 20), ip: String(ctx.ip || '').replace(/^::ffff:/, '') };
    clients.add(client);
    send(res, 'hello', { id: client.id, local: client.local });
    send(res, 'state', store.snapshot());
    send(res, 'ping', { t: Date.now() });
    publishCounts();
    req.on('close', () => {
      clients.delete(client);
      publishCounts();
    });
  });

  // Una pantalla dice si puede sonar o no. Solo vale para su propia conexión.
  router.route('POST', '/api/events/sound', async (ctx) => {
    const { id, able } = await ctx.json();
    const ip = String(ctx.ip || '').replace(/^::ffff:/, '');
    const client = [...clients].find((c) => c.id === id && c.ip === ip);
    if (client && client.able !== Boolean(able)) {
      client.able = Boolean(able);
      publishCounts();
    }
    return { sonido: soundClient() };
  });

  // Latido: permite al cliente detectar una conexión que sigue abierta pero ya no recibe nada
  // (wifi caída, router reiniciado). Si deja de llegar, el cliente reconecta. Ver web/core/api.js.
  const keepAlive = setInterval(() => {
    for (const c of clients) send(c.res, 'ping', { t: Date.now() });
  }, PING_MS);
  keepAlive.unref();

  return {
    // ¿Hay algún dispositivo con esa dirección conectado con esa función? Lo usa quien necesita
    // saber si un equipo concreto (un televisor) ya está mostrando la proyección.
    has: (role, ip) => [...clients].some((c) => c.role === role && c.ip === ip),
    close() {
      clearInterval(keepAlive);
      for (const c of clients) c.res.end();
    },
  };
}
