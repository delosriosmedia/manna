// Canal en tiempo real (Server-Sent Events): el servidor empuja cada cambio de estado
// a todos los dispositivos conectados. Las órdenes viajan aparte, por POST /api/action.
export function createRealtime({ store, router }) {
  const clients = new Set();

  store.register('conexiones', {});

  function send(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function publishCounts() {
    const counts = {};
    for (const c of clients) counts[c.role] = (counts[c.role] || 0) + 1;
    store.set('conexiones', { porRol: counts });
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
    const client = { res, role: (ctx.query.get('rol') || 'otro').slice(0, 20) };
    clients.add(client);
    send(res, 'state', store.snapshot());
    publishCounts();
    req.on('close', () => {
      clients.delete(client);
      publishCounts();
    });
  });

  const keepAlive = setInterval(() => {
    for (const c of clients) c.res.write(': ping\n\n');
  }, 20_000);
  keepAlive.unref();

  return {
    close() {
      clearInterval(keepAlive);
      for (const c of clients) c.res.end();
    },
  };
}
