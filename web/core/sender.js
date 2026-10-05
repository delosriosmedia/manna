// Envío de órdenes que llegan a montones (arrastrar un deslizador, un encuadre): se juntan y se
// mandan de una en una, con un mínimo entre envíos, para no encolar en el servidor órdenes viejas.
//
//   const sender = createSender((patch) => action('…', patch));
//   sender.push({ zoom: 2 });      lo que se va pidiendo se funde con lo que aún no salió
//   sender.busy                    hay algo saliendo o por salir: lo que llegue del servidor es más viejo
//   onIdle()                       ya salió todo: es el momento de volver a pintar lo que dice el servidor
//                                  (lo que llegó mientras tanto se dejó pasar)
export function createSender(send, { every = 70, onIdle = () => {} } = {}) {
  let queued = null;
  let sending = false;
  let last = 0;

  async function flush() {
    if (sending || !queued) return;
    const wait = every - (Date.now() - last);
    if (wait > 0) { setTimeout(flush, wait); return; }
    sending = true;
    const patch = queued;
    queued = null;
    last = Date.now();
    try { await send(patch); } finally { sending = false; }
    if (queued) flush();
    else onIdle();
  }

  return {
    // replace: lo nuevo sustituye a lo pendiente en vez de fundirse (un "reinicio" anula lo anterior).
    push(patch, { replace = false } = {}) {
      queued = replace ? patch : { ...queued, ...patch };
      flush();
    },
    get busy() { return sending || Boolean(queued); },
  };
}
