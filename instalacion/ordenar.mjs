// Deja la instalación de Manna en una sola carpeta a la vista, con solo esto (decisión del dueño, 2026-10-17):
//
//   Manna/
//     Instalar Manna en Windows      (en Windows, un acceso directo con su icono: lo crea el instalador)
//     Instalar Manna en Mac.command
//     Contenido/    lo de la iglesia: nunca se mueve ni se pisa, solo se le añade lo que falte
//     Programa/     el programa (programa/), sus datos (datos/) y dónde está cada cosa (carpetas.json)
//
// La carpeta es la que ya tiene el Contenido (en una instalación nueva, Documentos/Manna). Si se sincroniza
// con OneDrive o iCloud, Programa va a la carpeta oculta de siempre: sus datos cambian a cada rato y pueden
// pesar gigas. Lo que encuentra de antes lo mueve, sin borrar nada: los datos, a Programa/datos; los archivos
// de una copia vieja del programa que hubiera en la carpeta, a Programa/antiguo/<fecha>.
//
// Lo usan los dos instaladores, con el Manna que acaban de bajar (así el mismo código ordena en Windows y en Mac):
//   node ordenar.mjs --origen <Manna recién bajado> --oculta <carpeta oculta> --documentos <Documentos>
//                    [--aqui <carpeta del instalador que se abrió>] [--lanzador <carpeta del programa a la que
//                    apunta el icono Manna>] [--nube 0|1]
// La última línea que escribe es { programa, contenido, raiz, nube, antiguo, avisos } o { error }, en JSON.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WIN = process.platform === 'win32';
const WINDOWS = 'Instalar Manna en Windows.bat';
const MAC = 'Instalar Manna en Mac.command';
const exists = (p) => Boolean(p) && fs.existsSync(p);
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};
const inside = (dir, parent) => {
  const rel = path.relative(parent, dir);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ¿La carpeta se sincroniza con la nube? OneDrive en Windows; en Mac, iCloud Drive o «Escritorio y Documentos» en iCloud.
export function synced(dir, { home = os.homedir(), env = process.env } = {}) {
  if (WIN) return [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].some((d) => d && inside(dir, d)) || /[\\/]OneDrive( - [^\\/]+)?([\\/]|$)/i.test(dir);
  const icloud = path.join(home, 'Library', 'Mobile Documents');
  if (inside(dir, icloud)) return true;
  return exists(path.join(icloud, 'com~apple~CloudDocs', 'Documents')) && ['Documents', 'Desktop'].some((d) => inside(dir, path.join(home, d)));
}

// Qué hay instalado y dónde va cada cosa. No cambia nada.
export function plan({ origen, oculta, documentos, aqui = null, lanzador = null, nube = null, home, env }) {
  let antes = null;   // carpeta con programa/ y carpetas.json
  let antigua = null; // instalación a la antigua: la carpeta entera del proyecto, con su data/ y su Contenido/
  // La pista de dónde quedó la última vez (por si se borró el icono): ver arrange().
  const last = readJson(path.join(oculta, 'donde.json'))?.programa;
  // Primero, la carpeta desde la que se abrió el instalador, si es la de Manna: la carpeta ordenada (con
  // Programa), el programa de una (el acceso directo de Windows abre el de Programa/programa) o una copia que
  // se actualizaba a mano (con su Contenido). Así sirve aunque el icono Manna no exista o apunte a otro sitio.
  if (aqui && exists(path.join(aqui, 'Programa', 'carpetas.json'))) antes = path.join(aqui, 'Programa');
  else if (aqui && exists(path.join(path.dirname(aqui), 'carpetas.json')) && exists(path.join(aqui, 'server', 'index.js'))) antes = path.dirname(aqui);
  else if (aqui && (exists(path.join(aqui, 'Contenido')) || exists(path.join(aqui, 'server', 'index.js')))) antigua = aqui;
  else if (lanzador && exists(path.join(path.dirname(lanzador), 'carpetas.json'))) antes = path.dirname(lanzador);
  else if (lanzador && exists(path.join(lanzador, 'server', 'index.js'))) antigua = lanzador;
  else if (last && exists(path.join(last, 'carpetas.json'))) antes = last;
  else if (exists(path.join(oculta, 'carpetas.json'))) antes = oculta;
  else if (exists(path.join(documentos, 'Manna', 'Programa', 'carpetas.json'))) antes = path.join(documentos, 'Manna', 'Programa');
  const saved = (antes && readJson(path.join(antes, 'carpetas.json'))) || {};
  const datos = saved.datos || (antigua ? path.join(antigua, 'data') : null);
  const contenido = saved.contenido || (antigua ? path.join(antigua, 'Contenido') : path.join(documentos, 'Manna', 'Contenido'));
  const raiz = path.dirname(contenido);
  const enNube = nube == null ? synced(raiz, { home, env }) : nube;
  const programa = enNube ? oculta : path.join(raiz, 'Programa');
  return { origen, antes, antigua, datos, contenido, raiz, nube: enNube, base: programa };
}

// Cierra el Manna que esté abierto con esos datos, como su botón «Apagar» (desde este equipo no pide PIN).
// Solo el que contesta con el mismo id: nunca otro Manna del equipo. Si no contesta, mover los datos falla y se avisa.
async function closeManna(datos) {
  const settings = datos && readJson(path.join(datos, 'ajustes.json'));
  if (!settings?.id) return;
  const ping = (base) => fetch(`${base}/api/ping`, { signal: AbortSignal.timeout(800) }).then((r) => r.json()).catch(() => null);
  const ports = [...new Set([settings.port, 80, ...Array.from({ length: 11 }, (_, i) => 8000 + i)].filter(Boolean))];
  for (const port of ports) {
    const base = `http://127.0.0.1:${port}`;
    if ((await ping(base))?.id !== settings.id) continue;
    const json = { 'Content-Type': 'application/json' };
    try {
      const login = await fetch(`${base}/api/session`, { method: 'POST', headers: json, body: JSON.stringify({ role: 'control' }), signal: AbortSignal.timeout(3000) });
      const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
      await fetch(`${base}/api/action`, { method: 'POST', headers: { ...json, cookie }, body: JSON.stringify({ type: 'system.shutdown' }), signal: AbortSignal.timeout(3000) });
    } catch { /* ya se estaba cerrando */ }
    for (let i = 0; i < 40 && await ping(base); i += 1) await sleep(250);
    await sleep(500); // que suelte sus archivos
    return;
  }
}

// Mueve una carpeta. Entre discos distintos no se puede: se copia y la de antes se queda donde estaba.
function move(from, to, avisos) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
    avisos.push(`Se copió ${from} a ${to}. La copia de antes sigue en su sitio: cuando compruebes que todo funciona, puedes borrarla.`);
  }
}

// Deja `to` igual que `from`: copia encima y quita lo que ya no viene (es solo el programa).
function mirror(from, to) {
  fs.cpSync(from, to, { recursive: true, force: true });
  const prune = (a, b) => {
    for (const entry of fs.readdirSync(b, { withFileTypes: true })) {
      const there = path.join(a, entry.name);
      const here = path.join(b, entry.name);
      if (!fs.existsSync(there)) fs.rmSync(here, { recursive: true, force: true });
      else if (entry.isDirectory()) prune(there, here);
    }
  };
  prune(from, to);
}

export async function arrange(options) {
  const p = plan(options);
  const avisos = [];
  const programa = path.join(p.base, 'programa');
  const datos = path.join(p.base, 'datos');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  let antiguo = null;
  const keep = (from) => {
    antiguo ||= path.join(p.base, 'antiguo', stamp);
    move(from, path.join(antiguo, path.basename(from)), avisos);
  };

  // 1. Los datos, a su sitio. Va primero: si Manna sigue abierto y no los suelta, no se ha cambiado nada.
  await closeManna(p.datos);
  if (p.datos && exists(p.datos) && path.resolve(p.datos) !== path.resolve(datos)) {
    if (exists(datos)) throw new Error(`Ya hay datos de Manna en ${datos} y otros en ${p.datos}. No se mezclan: deja solo una de las dos carpetas y vuelve a abrir este archivo.`);
    try {
      move(p.datos, datos, avisos);
    } catch (err) {
      if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {
        throw new Error('Manna sigue abierto y no deja mover sus datos. Ciérralo con el botón «Apagar» del control (o, si no responde, cierra «Node.js» en el Administrador de tareas o en el Monitor de Actividad) y vuelve a abrir este archivo.');
      }
      throw err;
    }
  }
  fs.mkdirSync(datos, { recursive: true });

  // 2. El programa, entero y al día; y dónde está cada cosa.
  fs.mkdirSync(programa, { recursive: true });
  mirror(p.origen, programa);
  fs.writeFileSync(path.join(p.base, 'carpetas.json'), JSON.stringify({ datos, contenido: p.contenido }, null, 2));

  // 3. Al contenido solo se le añade lo que falte (las instrucciones y la Reina-Valera 1909).
  fs.mkdirSync(p.contenido, { recursive: true });
  fs.cpSync(path.join(p.origen, 'Contenido'), p.contenido, { recursive: true, force: false, errorOnExist: false });

  // 4. Lo de antes que ya no se usa: el programa de la carpeta oculta, y una copia vieja del programa en la carpeta.
  // La carpeta oculta de un instalador anterior que apuntaba a estos mismos datos ya no sirve.
  const hidden = readJson(path.join(options.oculta, 'carpetas.json'));
  if (!p.antes && p.datos && hidden && path.resolve(hidden.datos || '') === path.resolve(p.datos) && path.resolve(options.oculta) !== path.resolve(p.base)) p.antes = options.oculta;
  if (p.antes && path.resolve(p.antes) !== path.resolve(p.base)) {
    fs.rmSync(path.join(p.antes, 'carpetas.json'), { force: true });
    try {
      fs.rmSync(path.join(p.antes, 'programa'), { recursive: true, force: true });
      if (path.resolve(p.antes) !== path.resolve(options.oculta)) fs.rmdirSync(p.antes);
    } catch { /* algo la usa todavía, o no está vacía: se queda */ }
  }
  // Para la próxima vez, aunque se borre el icono: dónde quedó.
  if (path.resolve(p.base) !== path.resolve(options.oculta)) {
    fs.mkdirSync(options.oculta, { recursive: true });
    fs.writeFileSync(path.join(options.oculta, 'donde.json'), JSON.stringify({ programa: p.base }, null, 2));
  }
  // Solo si en la carpeta hay de verdad una copia del programa: así no se toca nada que se llame igual por casualidad.
  if (exists(path.join(p.raiz, 'server', 'index.js'))) {
    for (const name of fs.readdirSync(p.origen)) {
      if (name === 'Contenido' || name === MAC || name === WINDOWS) continue;
      if (exists(path.join(p.raiz, name))) keep(path.join(p.raiz, name));
    }
  }

  // 5. Los instaladores, al día, en la carpeta. En Windows el de Windows es un acceso directo con su icono
  // (un .bat no puede tenerlo): lo crea el instalador, y el archivo suelto que hubiera se guarda en antiguo.
  for (const name of WIN ? [MAC] : [MAC, WINDOWS]) fs.copyFileSync(path.join(p.origen, name), path.join(p.raiz, name));
  if (!WIN) fs.chmodSync(path.join(p.raiz, MAC), 0o755);
  if (WIN && exists(path.join(p.raiz, WINDOWS))) keep(path.join(p.raiz, WINDOWS));

  return { programa, contenido: p.contenido, raiz: p.raiz, nube: p.nube, antiguo, avisos };
}

// En JSON solo con letras ASCII (lo demás, como \u00f1): así lo lee bien PowerShell en cualquier consola.
const ascii = (value) => JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// Ejecutado por un instalador (no importado por las pruebas). Por el nombre: la ruta puede llegar escrita de otra
// forma (en Mac, /var y /private/var; en Windows, nombres cortos) y no coincidir con la del módulo.
if (path.basename(process.argv[1] || '') === 'ordenar.mjs') {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  try {
    const result = await arrange({
      origen: args.origen, oculta: args.oculta, documentos: args.documentos, aqui: args.aqui || null, lanzador: args.lanzador || null,
      nube: args.nube == null ? null : args.nube === '1',
    });
    console.log(ascii(result));
  } catch (err) {
    console.log(ascii({ error: err.message }));
    process.exitCode = 1;
  }
}
