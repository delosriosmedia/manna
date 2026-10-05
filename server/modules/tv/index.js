import crypto from 'node:crypto';
import net from 'node:net';
import { HttpError } from '../../core/router.js';
import { createSamsung, KEYS, TvError } from './samsung.js';
import { discover } from './discover.js';

// Módulo Televisores: usa un televisor de la red como pantalla de proyección a través de su
// navegador, sin cables y sin ocupar la segunda pantalla del equipo principal (que es del proyector).
// Manna le abre el navegador y le hace de control remoto. Por ahora, televisores Samsung.

const MAX_TEXT = 300;
const MAX_MOVE = 400;
const FULLSCREEN_WINDOW_MS = 120_000; // tras pedir la proyección, cuánto se espera a que el televisor llegue
const REJECTED_WINDOW_MS = 600_000;

// Solo direcciones de una red local: Manna no se conecta a nada de fuera.
export function isLocalAddress(ip) {
  if (!net.isIPv4(String(ip))) return false;
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

// De las direcciones de Manna, la que está en la misma red que el televisor.
export function addressFor(ip, addresses) {
  const prefix = ip.split('.').slice(0, 3).join('.');
  return addresses.find((url) => new URL(url).hostname.startsWith(`${prefix}.`)) || addresses[0] || null;
}

// Qué se sabe de las llegadas del televisor a Manna: 'rejected' si cortó el saludo de la conexión
// segura (no aceptó el certificado), 'https' o 'http' si entró, o null si nunca llegó.
export function describeArrival(arrival, now = Date.now()) {
  if (!arrival) return null;
  if (arrival.errorAt && arrival.errorAt >= arrival.at && now - arrival.errorAt < REJECTED_WINDOW_MS) return 'rejected';
  return arrival.secure ? 'https' : 'http';
}

export default function setup(app) {
  const { store } = app;
  const saved = app.storage('televisores', { list: [] });
  const live = new Map(); // id -> { driver, on, browser, pairing, error, askedAt }
  // Solo para pruebas: a dónde se conecta en lugar del televisor ({ rest, ws }) y qué direcciones
  // "aparecen" al buscar en la red ({ found }), para no salir a la red de verdad.
  const endpoints = process.env.MANNA_TV_PRUEBA ? JSON.parse(process.env.MANNA_TV_PRUEBA) : null;

  store.register('tv', { list: [], found: null, searching: false });

  function entry(tv) {
    if (!live.has(tv.id)) {
      live.set(tv.id, {
        driver: createSamsung({
          ip: tv.ip, token: tv.token || null, endpoints,
          onToken(token) {
            tv.token = token;
            saved.save();
          },
        }),
        on: null, browser: null, pairing: false, error: null, askedAt: 0,
      });
    }
    return live.get(tv.id);
  }

  // Lo que ven los dispositivos. La clave del televisor no sale del servidor.
  function publish(extra = {}) {
    store.set('tv', {
      ...extra,
      list: saved.data.list.map((tv) => {
        const state = entry(tv);
        return {
          id: tv.id, ip: tv.ip, name: tv.name, model: tv.model,
          paired: state.driver.paired, pairing: state.pairing, error: state.error,
          on: state.on, browser: state.browser,
          showing: app.realtime.has('proyeccion', tv.ip),
          arrival: describeArrival(app.arrivals.get(tv.ip)),
        };
      }),
    });
  }

  const find = (id) => {
    const tv = saved.data.list.find((t) => t.id === id);
    if (!tv) throw new HttpError(404, 'Ese televisor ya no está en la lista.');
    return tv;
  };

  // Los fallos del televisor se dicen en claro: casi siempre es que está apagado o falta el permiso.
  async function command(id, fn) {
    const tv = find(id);
    const state = entry(tv);
    try {
      return await fn(state.driver, tv, state);
    } catch (err) {
      if (!(err instanceof TvError)) throw err;
      if (err.code === 'unauthorized') throw new HttpError(403, 'El televisor no dio permiso. Pulsa «Vincular» y acepta el aviso en su pantalla.');
      throw new HttpError(502, 'El televisor no responde. Comprueba que esté encendido y en la misma red.');
    }
  }

  async function check(tv) {
    const state = entry(tv);
    const info = await state.driver.info();
    state.on = info ? info.on : false;
    state.browser = info?.on ? await state.driver.browser() : null;
    if (info && (info.name !== tv.name || info.model !== tv.model)) {
      Object.assign(tv, { name: info.name, model: info.model });
      saved.save();
    }
  }

  async function refresh() {
    await Promise.all(saved.data.list.map((tv) => check(tv).catch(() => {})));
    publish();
  }

  function pair(tv) {
    const state = entry(tv);
    if (state.pairing) return;
    Object.assign(state, { pairing: true, error: null });
    publish();
    state.driver.pair()
      .then(() => { state.error = null; }, (err) => {
        state.error = err?.code === 'unauthorized' ? 'El televisor no dio permiso.'
          : err?.code === 'timeout' ? 'Nadie aceptó el aviso en el televisor.'
          : 'No se pudo conectar con el televisor.';
      })
      .finally(() => {
        state.pairing = false;
        publish();
      });
  }

  // La dirección de la proyección tal como debe escribirse en ese televisor.
  function projectionUrl(tv) {
    const address = addressFor(tv.ip, store.get('system').addresses || []);
    if (!address) throw new HttpError(409, 'Este equipo no está conectado a ninguna red.');
    return `${address}/proyeccion`;
  }

  // Cuando el televisor llega a la proyección después de habérsela pedido, se le pulsa "OK":
  // la página responde poniéndose a pantalla completa (ver web/roles/proyeccion.js).
  const wasShowing = new Set();
  function watchArrivals() {
    for (const tv of saved.data.list) {
      const showing = app.realtime.has('proyeccion', tv.ip);
      const state = entry(tv);
      if (showing && !wasShowing.has(tv.id) && Date.now() - state.askedAt < FULLSCREEN_WINDOW_MS && state.driver.paired) {
        state.askedAt = 0;
        const timer = setTimeout(() => state.driver.key('ok').catch(() => {}), 2500);
        timer.unref?.();
      }
      if (showing) wasShowing.add(tv.id);
      else wasShowing.delete(tv.id);
    }
  }

  let pending = null;
  const publishSoon = () => {
    pending ||= setTimeout(() => {
      pending = null;
      watchArrivals();
      publish();
    }, 300);
    pending.unref?.();
  };
  store.on('change', (ns) => { if (ns === 'conexiones' && saved.data.list.length) publishSoon(); });
  store.on('arrival', (ip) => { if (saved.data.list.some((tv) => tv.ip === ip)) publishSoon(); });

  app.action('tv.refresh', { permission: 'tv.control' }, () => refresh());

  app.action('tv.search', { permission: 'tv.control' }, async () => {
    if (store.get('tv').searching) return;
    store.set('tv', { searching: true });
    try {
      const known = new Set(saved.data.list.map((tv) => tv.ip));
      // En pruebas no se sale a la red: lo "encontrado" lo dice la propia prueba.
      const addresses = endpoints ? endpoints.found || [] : await discover();
      const candidates = addresses.filter((ip) => isLocalAddress(ip) && !known.has(ip));
      const found = (await Promise.all(candidates.map(async (ip) => {
        const info = await createSamsung({ ip, endpoints }).info();
        return info && { ip, name: info.name, model: info.model };
      }))).filter(Boolean);
      store.set('tv', { found, searching: false });
    } catch (err) {
      store.set('tv', { found: [], searching: false });
      throw err;
    }
  });

  app.action('tv.add', { permission: 'tv.control' }, async ({ ip }) => {
    const address = String(ip || '').trim();
    if (!isLocalAddress(address)) throw new HttpError(400, 'Escribe la dirección del televisor en la red, por ejemplo 192.168.1.20.');
    if (saved.data.list.some((tv) => tv.ip === address)) throw new HttpError(409, 'Ese televisor ya está en la lista.');
    const info = await createSamsung({ ip: address, endpoints }).info();
    if (!info) throw new HttpError(404, 'En esa dirección no responde un televisor Samsung. Comprueba que esté encendido y en la misma red.');
    const tv = { id: crypto.randomBytes(6).toString('hex'), ip: address, name: info.name, model: info.model, token: null };
    saved.data.list.push(tv);
    saved.save();
    entry(tv).on = info.on;
    publish({ found: (store.get('tv').found || []).filter((f) => f.ip !== address) });
    pair(tv);
    return { id: tv.id };
  });

  app.action('tv.pair', { permission: 'tv.control' }, ({ id }) => pair(find(id)));

  app.action('tv.remove', { permission: 'tv.control' }, ({ id }) => {
    const tv = find(id);
    live.get(tv.id)?.driver.close();
    live.delete(tv.id);
    saved.data.list = saved.data.list.filter((t) => t.id !== tv.id);
    saved.save();
    publish();
  });

  // Abre el navegador del televisor. Si su página de inicio es la proyección de Manna, con esto basta.
  app.action('tv.open', { permission: 'tv.control' }, ({ id }) => command(id, async (driver, tv, state) => {
    await driver.openBrowser();
    state.askedAt = Date.now();
    await check(tv).catch(() => {});
    publish();
  }));

  // Quita el navegador de la pantalla del televisor (al terminar la reunión).
  app.action('tv.close', { permission: 'tv.control' }, ({ id }) => command(id, async (driver, tv, state) => {
    await driver.closeBrowser();
    state.askedAt = 0;
    await check(tv).catch(() => {});
    publish();
  }));

  // Escribe la dirección de la proyección en el campo que el televisor tenga abierto.
  app.action('tv.address', { permission: 'tv.control' }, ({ id }) => command(id, async (driver, tv, state) => {
    const url = projectionUrl(tv);
    await driver.text(url, { done: true });
    state.askedAt = Date.now();
    return { url };
  }));

  app.action('tv.text', { permission: 'tv.control' }, ({ id, text }) => command(id, (driver) => {
    const value = String(text ?? '').slice(0, MAX_TEXT);
    if (!value) throw new HttpError(400, 'No hay nada que escribir.');
    return driver.text(value);
  }));

  app.action('tv.key', { permission: 'tv.control' }, ({ id, key }) => command(id, (driver) => {
    if (!Object.hasOwn(KEYS, String(key))) throw new HttpError(400, 'Tecla desconocida.');
    return driver.key(key);
  }));

  app.action('tv.move', { permission: 'tv.control' }, ({ id, dx, dy }) => command(id, (driver) => {
    const clamp = (n) => Math.max(-MAX_MOVE, Math.min(MAX_MOVE, Math.round(Number(n) || 0)));
    return driver.move(clamp(dx), clamp(dy));
  }));

  app.action('tv.click', { permission: 'tv.control' }, ({ id }) => command(id, (driver) => driver.click()));

  app.route('GET', '/api/tv/:id/address', (ctx) => {
    ctx.require('tv.control');
    return { url: projectionUrl(find(ctx.params.id)) };
  });

  // El estado de cada televisor se consulta cuando alguien abre su pantalla (tv.refresh), no al
  // arrancar: con el módulo en pausa, Manna no sale a buscar ningún televisor por su cuenta.
  app.onClose(() => {
    clearTimeout(pending);
    for (const state of live.values()) state.driver.close();
  });

  publish();
}
