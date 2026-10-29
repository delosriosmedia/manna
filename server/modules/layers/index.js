import { HttpError } from '../../core/router.js';

// Módulo Capas (fase 31 de docs/PLAN.md): cuatro capas (tres hasta el 2026-10-29) que quedan encima de todo lo que se proyecte, también con
// «Negro» y «Solo fondo», hasta que alguien las quite. La 1 va encima de lo que está al aire, la 2 encima de la 1, la
// 3 encima de la 2 y la 4 encima de la 3. Cada una lleva un elemento de un tipo de contenido que lo admita (`layer: true` en su app.kind) y
// se dibuja en la ventana de proyección con el `draw` de ese tipo, sin fondo.
//
// Se guardan en data/capas.json y vuelven siempre al arrancar (sin el límite de 15 minutos de lo que está al aire).
// Estado `layers.slots`: [{ n, kind, data, title, label, visible, ready, uid, content }] (n de 1 a 4; vacía: { n }).
//   uid      cambia al poner un elemento y al recargarlo: la pantalla vuelve a cargarlo
//   content  lo que da el `resolve` de su tipo (null si ya no existe)
//   ready    se puede cargar ya: una página de internet solo cuando su dirección contesta (ver check)

const COUNT = 4;
const RECHECK_MS = 60_000; // con respuesta, cada minuto, por si se va internet
const CHECK_MS = 8_000;

export default function setup(app) {
  const { store } = app;
  // Sin respuesta, se vuelve a mirar cada 15 s (en las pruebas, antes).
  const RETRY_MS = Number(process.env.MANNA_CAPAS_REINTENTO_MS) || 15_000;
  const saved = app.storage('capas', { slots: [] });
  let uid = 0;
  const slots = Array.from({ length: COUNT }, (_, i) => {
    const s = saved.data.slots[i];
    return s?.kind ? { kind: s.kind, data: s.data, visible: s.visible !== false, uid: ++uid, ready: false } : null;
  });
  const timers = [];

  const kindOf = (kind) => {
    const def = app.kinds.get(kind);
    return def?.layer ? def : null;
  };
  const resolve = (slot) => {
    try { return kindOf(slot.kind)?.resolve(slot.data, null) ?? null; } catch { return null; }
  };
  const describe = (slot) => {
    try { return kindOf(slot.kind)?.describe(slot.data) ?? null; } catch { return null; }
  };

  function publish() {
    store.set('layers', {
      slots: slots.map((slot, i) => {
        if (!slot) return { n: i + 1 };
        const info = describe(slot);
        return {
          n: i + 1, kind: slot.kind, data: slot.data, title: info?.title ?? 'Ya no está', label: kindOf(slot.kind)?.label ?? '',
          visible: slot.visible, ready: slot.ready, uid: slot.uid, content: resolve(slot),
        };
      }),
    });
  }
  const commit = () => {
    saved.data.slots = slots.map((s) => (s ? { kind: s.kind, data: s.data, visible: s.visible } : null));
    saved.save();
    publish();
  };

  // Una página de internet se carga solo si su dirección contesta: si no (sin internet), la pantalla mostraría la
  // página de error de Chrome encima del culto. Mientras no conteste, la capa espera oculta y se vuelve a mirar sola.
  // Cualquier respuesta vale (también un error del sitio, que es su propia página); solo cuenta no llegar.
  async function check(i) {
    clearTimeout(timers[i]);
    const slot = slots[i];
    if (!slot) return;
    const content = resolve(slot);
    const remote = content?.url && !content.file ? content.url : null;
    let ok = true;
    if (remote) {
      try {
        const res = await fetch(remote, { redirect: 'follow', signal: AbortSignal.timeout(CHECK_MS) });
        res.body?.cancel().catch(() => {});
      } catch { ok = false; }
    }
    if (slots[i] !== slot) return; // la cambiaron mientras tanto
    if (slot.ready !== ok) {
      slot.ready = ok;
      publish();
    }
    if (remote) timers[i] = setTimeout(() => check(i).catch(() => {}), ok ? RECHECK_MS : RETRY_MS);
  }
  app.onClose(() => timers.forEach((t) => clearTimeout(t)));

  const slotIndex = (n) => {
    if (!Number.isInteger(n) || n < 1 || n > COUNT) throw new HttpError(400, 'Esa capa no existe: son de la 1 a la 4.');
    return n - 1;
  };
  const filled = (n) => {
    const i = slotIndex(n);
    if (!slots[i]) throw new HttpError(409, `La capa ${n} está vacía.`);
    return i;
  };

  store.register('layers', { slots: [] });
  publish();
  slots.forEach((s, i) => s && check(i).catch(() => {}));

  // Lo que otro módulo necesita saber: si hay algo a la vista encima de lo que está al aire (PowerPoint en vivo,
  // que va en otra ventana, la taparía).
  app.services.layers = { covering: () => slots.some((s) => s?.visible) };

  app.action('layers.set', { permission: 'projection.control' }, ({ n, kind, data } = {}) => {
    const i = slotIndex(n);
    if (typeof kind !== 'string' || !kindOf(kind)) throw new HttpError(400, 'Eso no se puede poner en una capa.');
    if (data == null || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Falta qué poner en la capa.');
    const slot = { kind, data, visible: true, uid: ++uid, ready: false };
    const content = resolve(slot);
    if (!content) throw new HttpError(404, 'Eso ya no está.');
    if (content.window) throw new HttpError(400, 'Esa página no se deja mostrar dentro de Manna (se abre en su propia ventana): no puede ir en una capa.');
    slots[i] = slot;
    commit();
    check(i).catch(() => {});
    return { n };
  });

  app.action('layers.visible', { permission: 'projection.control' }, ({ n, visible } = {}) => {
    const i = filled(n);
    slots[i].visible = Boolean(visible);
    commit();
  });

  app.action('layers.reload', { permission: 'projection.control' }, ({ n } = {}) => {
    const i = filled(n);
    slots[i] = { ...slots[i], uid: ++uid, ready: false };
    publish();
    check(i).catch(() => {});
  });

  app.action('layers.clear', { permission: 'projection.control' }, ({ n } = {}) => {
    const i = filled(n);
    clearTimeout(timers[i]);
    slots[i] = null;
    commit();
  });
}
