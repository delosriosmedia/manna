import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { networkName } from '../../core/app.js';
import { codeSignature } from '../../core/build.js';
import { lanInterfaces, origin } from './network.js';
import { createResponder } from './mdns.js';

const REFRESH_MS = 10_000;
const CODE_CHECK_MS = 20_000;

// Módulo de sistema: funciones (roles), sesiones, PIN y cómo se llega a este equipo desde la red.
export default function setup(app) {
  const { store, sessions, settings } = app;

  // addresses: direcciones numéricas, la primera es la recomendada (la que lleva el QR).
  // nameUrl: dirección con nombre ("http://manna.local"), o null si no se pudo anunciar.
  // La versión se lee de package.json: es el único sitio donde se cambia.
  const { version } = JSON.parse(fs.readFileSync(path.join(app.rootDir, 'package.json'), 'utf8'));
  // altPort: segundo puerto en el que Manna también atiende (para televisores), o null.
  // secure: Manna atiende también por https en esos mismos puertos. securePort: el puerto propio
  // de https (443), al que llega un navegador que convierte la dirección por su cuenta, o null.
  // build: huella del código con el que arrancó. stale: el código del disco ya es otro (Manna se
  // actualizó estando abierto) y hay que reiniciarlo para que interfaz y servidor vuelvan a coincidir.
  store.register('system', { name: 'Manna', version, build: app.build, stale: false, addresses: [], port: null, altPort: null, secure: false, securePort: null, hostname: null, nameUrl: null });

  const responder = createResponder({ base: networkName() });
  let announced = null;
  let busy = false;
  let failures = 0; // comprobaciones fallidas seguidas

  async function refresh() {
    if (busy || !app.port) return;
    busy = true;
    try {
      const interfaces = await lanInterfaces();
      // El nombre se anuncia en las redes reales. Si el servidor escucha en una sola dirección
      // (MANNA_HOST), es esa la que se anuncia.
      const real = interfaces.filter((i) => !i.virtual);
      const networks = (real.length ? real : interfaces).map((i) => ({ via: i.address, address: process.env.MANNA_HOST || i.address, netmask: i.netmask }));
      const signature = networks.map((n) => `${n.via}>${n.address}`).join();
      // Se vuelve a anunciar el nombre si cambió la IP (router reiniciado, otra red)
      // o si dejó de funcionar sin avisar (equipo que durmió, wifi que se cayó y volvió).
      // Si la comprobación falla tres veces seguidas incluso recién rehecho, es que este sistema
      // no permite hacerla; se deja de comprobar para no reiniciar el nombre sin parar.
      const broken = failures < 3 && !(await responder.healthy());
      failures = broken ? failures + 1 : 0;
      if (signature !== announced || broken) {
        announced = signature;
        await responder.start(networks);
      }

      const hostname = responder.name;
      const next = {
        addresses: interfaces.map((i) => origin(i.address, app.port)),
        port: app.port,
        altPort: app.altPort,
        secure: app.secure,
        securePort: app.securePort,
        hostname,
        nameUrl: hostname ? origin(hostname, app.port) : null,
      };
      const current = store.get('system');
      if (Object.keys(next).some((k) => String(next[k]) !== String(current[k]))) store.set('system', next);
    } finally {
      busy = false;
    }
  }
  app.services.network = { refresh };

  // ¿Sigue siendo este el código que hay en disco? Se mira cada poco; al notar el cambio se avisa
  // una vez y se deja de mirar. Hacen falta dos lecturas seguidas distintas a la de arranque,
  // para no avisar a mitad de una copia de archivos.
  let changes = 0;
  let codeTimer = null;
  function checkCode() {
    const now = codeSignature(app.rootDir);
    changes = now && now !== app.build ? changes + 1 : 0;
    if (changes < 2) return;
    clearInterval(codeTimer);
    console.log('El código de Manna cambió en disco: hace falta reiniciarlo.');
    store.set('system', { stale: true });
  }

  let timer = null;
  store.on('listening', () => {
    timer = setInterval(refresh, REFRESH_MS);
    timer.unref();
    codeTimer = setInterval(checkCode, Number(process.env.MANNA_REVISAR_CODIGO_MS) || CODE_CHECK_MS);
    codeTimer.unref();
  });
  app.onClose(async () => {
    clearInterval(timer);
    clearInterval(codeTimer);
    await responder.stop();
  });

  const publicRoles = () => sessions.roles.map(({ id, name, description, path, requiresPin }) => ({ id, name, description, path, requiresPin }));

  app.route('GET', '/api/session', (ctx) => ({
    role: ctx.session?.role || null,
    isLocal: ctx.isLocal,
    roles: publicRoles(),
    serverId: settings.data.id,
    version,
    nameUrl: store.get('system').nameUrl,
  }));

  app.route('POST', '/api/session', async (ctx) => sessions.open(ctx, await ctx.json()));

  // "Guion" pasó a llamarse "Orden del culto": los marcadores antiguos siguen llegando.
  app.route('GET', '/guion', (ctx) => {
    ctx.res.writeHead(302, { Location: '/orden' });
    ctx.res.end();
  });

  // Lo consulta una página abierta por la dirección numérica para saber si este dispositivo
  // puede usar la dirección con nombre (ver web/core/upgrade.js). Por eso admite otros orígenes.
  app.route('GET', '/api/ping', (ctx) => {
    ctx.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    ctx.res.end(JSON.stringify({ app: 'manna', id: settings.data.id, version, build: app.build }));
  });

  // El PIN solo se puede ver desde el propio equipo servidor.
  app.route('GET', '/api/system/pin', (ctx) => {
    if (!ctx.isLocal) throw new HttpError(403, 'El PIN solo se muestra en el equipo principal.');
    return { pin: sessions.pin };
  });

  app.action('system.setPin', { permission: 'system.admin' }, ({ pin }) => {
    sessions.setPin(String(pin ?? ''));
  });

  // Botón "Reiniciar Manna": cierra y vuelve a abrir con el código que haya en disco. Es lo que
  // termina una actualización hecha con Manna abierto. Solo desde el propio equipo principal.
  app.action('system.restart', { permission: 'system.admin' }, (_payload, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Manna solo se puede reiniciar desde el equipo principal.');
    if (!app.restart) throw new HttpError(409, 'Esta copia de Manna no se puede reiniciar sola. Apágala y vuelve a abrirla.');
    setTimeout(() => app.restart(), 300);
  });

  // Botón "Apagar Manna" del control. Solo desde el propio equipo principal.
  app.action('system.shutdown', { permission: 'system.admin' }, (_payload, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Manna solo se puede apagar desde el equipo principal.');
    // Se espera un instante para que la respuesta llegue al navegador antes de cerrar.
    setTimeout(() => app.shutdown?.(), 300);
  });
}
