import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/router.js';
import { networkName, portCandidates } from '../../core/app.js';
import { codeSignature } from '../../core/build.js';
import { lanInterfaces, origin } from './network.js';
import { createResponder } from './mdns.js';
import { diskUsage } from './disk.js';
import { watchVersions } from './versions.js';
import { contentState, looksLikeContent, openFolder, pickFolder, useContent } from './contenido.js';

const REFRESH_MS = 10_000;
const CODE_CHECK_MS = 20_000;
const RIVAL_MS = 15_000;

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
  // blocked: otro Manna ya funciona en este equipo o en esta red (fase 21): { where, version, here } o null.
  // update: hay una versión nueva en GitHub ({ version }) o null (versions.js).
  store.register('system', { name: 'Manna', version, build: app.build, stale: false, addresses: [], port: null, altPort: null, secure: false, securePort: null, hostname: null, nameUrl: null, blocked: null, update: null, content: contentState(app) });
  app.onContent(() => store.set('system', { content: contentState(app) }));
  // En la nube, la versión la decide el despliegue (decisión 58), y no hay red local donde anunciarse.
  if (!app.cloud) watchVersions(app, version);

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
      // Con otro Manna en la red, este no se anuncia: los dispositivos irían a dos sitios.
      const broken = !app.blocked && failures < 3 && !(await responder.healthy());
      failures = broken ? failures + 1 : 0;
      if (!app.blocked && (signature !== announced || broken)) {
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
  // ¿Hay otro Manna con el mismo nombre (MANNA_NAME) en este equipo (contesta en sus puertos) o en otro de la
  // red (contesta por «manna.local»)? Se confirma pidiéndole /api/ping. Devuelve { where, version, here } o
  // null. Uno con estos mismos datos (el mismo id) no es otro: es este, y lo atiende server/app.js.
  async function rival() {
    const name = networkName();
    const pingAt = async (host, port) => {
      try {
        const ping = await (await fetch(`http://${host}:${port}/api/ping`, { signal: AbortSignal.timeout(700) })).json();
        // Los de antes de la 1.28 no dicen su nombre: son los de nombre «manna». Una nube (fase 36) no es rival.
        return ping.app === 'manna' && !ping.cloud && ping.id !== settings.data.id && (ping.name || 'manna') === name ? { port, version: ping.version || '' } : null;
      } catch {
        return null;
      }
    };
    const ports = portCandidates(Number(process.env.PORT) || settings.data.port);
    const here = (await Promise.all(ports.map((port) => pingAt('127.0.0.1', port)))).find(Boolean);
    if (here) return { here: true, where: origin('localhost', here.port), version: here.version };
    const interfaces = (await lanInterfaces()).filter((i) => !i.virtual);
    const others = await responder.probe(interfaces.map((i) => ({ via: i.address, address: i.address, netmask: i.netmask })));
    for (const address of others) {
      const found = (await Promise.all(ports.map((port) => pingAt(address, port)))).find(Boolean);
      if (found) return { here: false, where: origin(address, found.port), version: found.version };
    }
    return null;
  }
  // Bloqueado, se vuelve a mirar cada poco; en cuanto el otro se apaga, Manna se reinicia y arranca como siempre.
  // Una sola vez a la vez (el reloj y «Volver a comprobar» podrían coincidir y pisarse los sondeos). Para darlo por
  // libre hacen falta dos miradas seguidas sin rival, separadas un rato al azar: por wifi se pierden consultas, y dos
  // bloqueados que vean a la vez que el otro se apagó no arrancan juntos.
  let checking = null;
  const publishBlocked = (found) => {
    app.blocked = found;
    if (JSON.stringify(store.get('system').blocked) !== JSON.stringify(found)) store.set('system', { blocked: found });
  };
  function recheck() {
    // Sustituido por otro equipo oficial (fase 37): no hay nada que mirar, solo volver a emparejarlo.
    if (app.blocked?.replaced) return { blocked: true };
    checking ||= (async () => {
      let found = await rival();
      if (!found) {
        await new Promise((resolve) => { setTimeout(resolve, 1000 + Math.random() * 2000); });
        found = await rival();
      }
      if (found) {
        publishBlocked(found);
        return { blocked: true };
      }
      console.log('El otro Manna ya no está: este se pone en marcha.');
      // Tras contestar: el reinicio corta las peticiones abiertas. La copia nueva abre el control (esta pestaña puede
      // quedarse en un puerto que ya no se usa).
      setTimeout(() => app.restart({ open: true }), 200);
      return { blocked: false };
    })().finally(() => { checking = null; });
    return checking;
  }
  app.services.network = { refresh, rival, publishBlocked };
  app.action('system.recheck', { permission: null }, () => (app.blocked ? recheck() : null));

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
    if (app.blocked) setInterval(recheck, RIVAL_MS).unref();
    if (!app.cloud) {
      timer = setInterval(refresh, REFRESH_MS);
      timer.unref();
    }
    codeTimer = setInterval(checkCode, Number(process.env.MANNA_REVISAR_CODIGO_MS) || CODE_CHECK_MS);
    codeTimer.unref();
  });
  app.onClose(async () => {
    clearInterval(timer);
    clearInterval(codeTimer);
    await responder.stop();
  });

  // Desde internet todas piden PIN (core/sessions.js).
  const publicRoles = (internet) => sessions.roles.map(({ id, name, description, path, requiresPin }) => ({ id, name, description, path, requiresPin: requiresPin || internet }));

  app.route('GET', '/api/session', (ctx) => ({
    role: ctx.session?.role || null,
    // Quién entró y, para entrar, la lista de nombres con lo que puede usar cada uno (fase 35: siempre de una lista).
    user: ctx.session?.user ? { id: ctx.session.user.id, name: ctx.session.user.name, admin: ctx.session.user.admin } : null,
    users: sessions.users.list().map(({ id, name, functions, admin }) => ({ id, name, functions, admin })),
    isLocal: ctx.isLocal,
    // En la nube, mientras falte el primer administrador: /administrar pide la clave de alta (decisión 62).
    alta: sessions.altaPending(),
    internet: ctx.internet,
    roles: publicRoles(ctx.internet),
    serverId: settings.data.id,
    version,
    nameUrl: store.get('system').nameUrl,
    // Lo que el superadministrador dejó a esta iglesia (fase 39): los módulos apagados, su orden y si está suspendida.
    church: app.services.church?.view() || null,
  }));

  app.route('POST', '/api/session', async (ctx) => {
    if (app.suspended) throw new HttpError(409, app.refusal());
    return sessions.open(ctx, await ctx.json());
  });

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
    ctx.res.end(JSON.stringify({ app: 'manna', id: settings.data.id, version, build: app.build, name: networkName(), ...(app.cloud && { cloud: true }) }));
  });

  // Botón "Reiniciar Manna": cierra y vuelve a abrir con el código que haya en disco. Es lo que
  // termina una actualización hecha con Manna abierto. Solo desde el propio equipo principal.
  app.action('system.restart', { permission: 'system.admin' }, (_payload, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Manna solo se puede reiniciar desde el equipo principal.');
    if (!app.restart) throw new HttpError(409, 'Esta copia de Manna no se puede reiniciar sola. Apágala y vuelve a abrirla.');
    setTimeout(() => app.restart(), 300);
  });

  // ---- Espacio en disco (Ajustes) ----
  // Cuánto ocupa lo subido o descargado desde la app. Se calcula al pedirlo: recorrer las carpetas lleva un momento.
  app.route('GET', '/api/system/disk', (ctx) => {
    ctx.require('system.admin');
    return diskUsage(app);
  });
  // Borrar lo subido o descargado, una categoría a la vez (decisión 36; por categoría desde la 1.31): YouTube, videos
  // y audios, imágenes, presentaciones o páginas web hechas con un archivo. También lo que esté en el orden del culto,
  // que los pierde. Cada cosa con la orden de borrar de su módulo. Nunca toca la carpeta Contenido (lo que viene de
  // ella lleva source 'folder') ni las imágenes de fondo de Ajustes. Las copias para celulares, miniaturas y
  // subtítulos no se borran solas: sin ellas los videos dejarían de verse; se van con su video.
  const subido = (lists) => {
    const media = store.get('media') || {};
    return lists.flatMap((list) => (media[list] || []).filter((m) => m.source !== 'folder').map((m) => ['media.remove', m.id]));
  };
  const CLEAN = {
    youtube: () => subido(['youtube']),
    clips: () => subido(['videos', 'audios']),
    images: () => subido(['images']),
    slides: () => (store.get('slides')?.decks || []).map((d) => ['slides.remove', d.id]),
    pages: () => (store.get('web')?.pages || []).filter((p) => p.source === 'file').map((p) => ['web.remove', p.id]),
  };
  app.action('system.clean', { permission: 'system.admin' }, (payload) => {
    const group = payload?.group;
    if (!Object.hasOwn(CLEAN, String(group))) throw new HttpError(400, 'Elige qué borrar: YouTube, videos y audios, imágenes, presentaciones o páginas web.');
    const before = diskUsage(app).total;
    const removals = CLEAN[group]();
    let failed = 0;
    for (const [type, id] of removals) {
      try { app.run(type, { id }); } catch (err) { failed += 1; console.error(`Limpiar: no se pudo borrar ${id} (${type}): ${err.message}`); }
    }
    app.services.order?.prune();
    // Lo que estaba al aire y ya no existe deja la pantalla en el fondo.
    const item = store.get('projection')?.item;
    if (item && !app.kinds.get(item.kind)?.resolve(item.source.data, item.source.step)) app.run('projection.clear');
    return { removed: removals.length - failed, failed, freed: Math.max(0, before - diskUsage(app).total) };
  });

  // Botón "Apagar Manna" del control. Solo desde el propio equipo principal.
  // La carpeta de contenido (fase 29), solo desde el equipo principal: elegirla en la ventana del sistema, usarla y
  // abrirla. Si la elegida no lo parece pero tiene una «Contenido» dentro, se propone esa; si no, se pregunta antes.
  const local = (ctx, what) => { if (!ctx?.isLocal) throw new HttpError(403, `${what} solo se puede desde el equipo principal.`); };
  app.action('system.contentPick', { permission: 'system.admin' }, async (_payload, ctx) => {
    local(ctx, 'Elegir la carpeta de contenido');
    let dir = await pickFolder(app.contentDir);
    if (!dir) return { dir: null };
    if (!looksLikeContent(dir) && looksLikeContent(path.join(dir, 'Contenido'))) dir = path.join(dir, 'Contenido');
    return { dir, looks: looksLikeContent(dir) };
  });
  app.action('system.contentSet', { permission: 'system.admin' }, ({ dir } = {}, ctx) => {
    local(ctx, 'Cambiar la carpeta de contenido');
    useContent(app, dir);
    return contentState(app);
  });
  app.action('system.contentOpen', { permission: 'system.admin' }, (_payload, ctx) => {
    local(ctx, 'Abrir la carpeta de contenido');
    if (!contentState(app).exists) throw new HttpError(404, 'No se encuentra la carpeta de contenido.');
    openFolder(app.contentDir);
  });

  app.action('system.shutdown', { permission: 'system.admin' }, (_payload, ctx) => {
    if (!ctx?.isLocal) throw new HttpError(403, 'Manna solo se puede apagar desde el equipo principal.');
    // Se espera un instante para que la respuesta llegue al navegador antes de cerrar.
    setTimeout(() => app.shutdown?.(), 300);
  });
}
