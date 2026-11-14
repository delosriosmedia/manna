import dgram from 'node:dgram';
import { sameSubnet } from './network.js';

// Nombre en la red local ("manna.local") por mDNS, el mismo mecanismo que usan impresoras y
// televisores para encontrarse sin configurar nada. Así los dispositivos pueden escribir un
// nombre en vez de una IP, y el nombre sigue valiendo aunque la IP cambie.
// Sin dependencias: se construyen y leen los paquetes DNS a mano (RFC 6762).

const GROUP = '224.0.0.251';
const PORT = 5353;
const TTL = 60;                // segundos que un dispositivo recuerda la dirección
const A = 1;
const AAAA = 28;
const NSEC = 47;
const ANY = 255;
const IN = 1;
const FLUSH = 0x8000;          // "olvida lo que tenías guardado para este nombre"
const PROBE_MS = 700;
const HEALTH_MS = 400;
const MAX_SUFFIX = 5;

// ---------- Paquetes (funciones puras) ----------

export function encodeName(name) {
  const parts = name.split('.').filter(Boolean).map((label) => {
    const bytes = Buffer.from(label, 'utf8');
    return Buffer.concat([Buffer.from([bytes.length]), bytes]);
  });
  return Buffer.concat([...parts, Buffer.from([0])]);
}

// Lee un nombre, siguiendo los punteros de compresión. Devuelve { name, end } (end: dónde sigue el paquete).
export function readName(buf, offset) {
  const labels = [];
  let pos = offset;
  let end = -1;
  for (let hops = 0; hops < 64 && pos < buf.length; hops += 1) {
    const len = buf[pos];
    if (len === 0) {
      if (end < 0) end = pos + 1;
      return { name: labels.join('.').toLowerCase(), end };
    }
    if ((len & 0xc0) === 0xc0) {
      if (end < 0) end = pos + 2;
      pos = ((len & 0x3f) << 8) | buf[pos + 1];
    } else {
      labels.push(buf.toString('utf8', pos + 1, pos + 1 + len));
      pos += 1 + len;
    }
  }
  throw new Error('nombre DNS mal formado');
}

// Devuelve { id, isResponse, questions: [{ name, type }], answers: [{ name, type, address? }] } o null si no se entiende.
export function parseMessage(buf) {
  try {
    const message = { id: buf.readUInt16BE(0), isResponse: Boolean(buf[2] & 0x80), questions: [], answers: [] };
    const questions = buf.readUInt16BE(4);
    const records = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
    let pos = 12;
    for (let i = 0; i < questions; i += 1) {
      const { name, end } = readName(buf, pos);
      message.questions.push({ name, type: buf.readUInt16BE(end) });
      pos = end + 4;
    }
    for (let i = 0; i < records; i += 1) {
      const { name, end } = readName(buf, pos);
      const type = buf.readUInt16BE(end);
      const length = buf.readUInt16BE(end + 8);
      const data = end + 10;
      const record = { name, type };
      if (type === A && length === 4) record.address = [...buf.subarray(data, data + 4)].join('.');
      message.answers.push(record);
      pos = data + length;
    }
    return message;
  } catch {
    return null;
  }
}

export function buildQuery(name) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(1, 4);
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(ANY, 0);
  tail.writeUInt16BE(IN, 2);
  return Buffer.concat([header, encodeName(name), tail]);
}

// Respuesta "name está en address". ttl 0 = despedida (el nombre deja de existir).
// legacy: respuesta directa a un programa que no habla mDNS; repite la pregunta y usa su identificador.
export function buildResponse({ name, address, ttl = TTL, legacy = null }) {
  const qname = encodeName(name);
  const klass = legacy ? IN : IN | FLUSH;
  const header = Buffer.alloc(12);
  header.writeUInt16BE(legacy ? legacy.id : 0, 0);
  header.writeUInt16BE(0x8400, 2);
  header.writeUInt16BE(legacy ? 1 : 0, 4);
  header.writeUInt16BE(1, 6);
  header.writeUInt16BE(1, 10);

  const record = (type, data) => {
    const head = Buffer.alloc(10);
    head.writeUInt16BE(type, 0);
    head.writeUInt16BE(klass, 2);
    head.writeUInt32BE(legacy ? Math.min(ttl, 10) : ttl, 4);
    head.writeUInt16BE(data.length, 8);
    return Buffer.concat([qname, head, data]);
  };
  const parts = [header];
  if (legacy) {
    const question = Buffer.alloc(4);
    question.writeUInt16BE(legacy.type, 0);
    question.writeUInt16BE(IN, 2);
    parts.push(qname, question);
  }
  parts.push(record(A, Buffer.from(address.split('.').map(Number))));
  // NSEC: "este nombre solo tiene dirección IPv4". Evita que los dispositivos esperen una IPv6 que no llegará.
  parts.push(record(NSEC, Buffer.concat([qname, Buffer.from([0, 1, 0x40])])));
  return Buffer.concat(parts);
}

// ---------- Respondedor ----------

// base: nombre deseado sin ".local" (p. ej. "manna"). Si otro equipo de la red ya lo usa,
// se toma "manna-2", "manna-3"… para que dos instalaciones no se pisen.
export function createResponder({ base }) {
  let sockets = [];      // uno por red: { socket, via, address, netmask }
  let candidate = base;  // nombre que se está comprobando
  let hostname = null;   // nombre ya conseguido
  let former = null;     // el nombre de antes, que se sigue contestando tras recuperar el base (ver start)
  let conflict = false;
  const asked = new Map(); // nombre por el que se pregunta (probe, free) → direcciones de otros equipos que contestaron

  const send = (entry, packet, port = PORT, to = GROUP) => {
    try { entry.socket.send(packet, port, to, () => {}); } catch { /* red caída: se reintenta en el próximo anuncio */ }
  };

  function onMessage(entry, buf, rinfo) {
    const message = parseMessage(buf);
    if (!message) return;
    const name = `${hostname || candidate}.local`;

    if (message.isResponse) {
      const mine = sockets.map((s) => s.address);
      for (const r of message.answers.filter((a) => a.type === A && a.address)) {
        // Nuestra propia respuesta, que vuelve por la red: prueba de que esta red oye y habla (ver healthy).
        if (r.name === name) for (const s of sockets) if (s.address === r.address) s.heard = Date.now();
        if (mine.includes(r.address)) continue;
        // Otro equipo responde por el nombre que queremos, o por uno que se está preguntando.
        if (r.name === name) conflict = true;
        asked.get(r.name)?.add(r.address);
      }
      return;
    }
    if (!hostname) return; // todavía comprobando si el nombre está libre
    const question = message.questions.find((q) => (q.name === name || q.name === former) && [A, AAAA, ANY].includes(q.type));
    // Cada red contesta solo a los dispositivos de su propia red, con su propia dirección.
    if (!question || !sameSubnet(rinfo.address, entry.via, entry.netmask)) return;
    if (rinfo.port === PORT) send(entry, buildResponse({ name: question.name, address: entry.address }));
    else send(entry, buildResponse({ name: question.name, address: entry.address, legacy: { id: message.id, type: question.type } }), rinfo.port, rinfo.address);
  }

  function openSocket({ via, address, netmask }) {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const entry = { socket, via, address, netmask, heard: 0 };
      socket.on('error', () => {
        try { socket.close(); } catch { /* ya cerrado */ }
        entry.dead = true;
        resolve(null);
      });
      socket.on('message', (buf, rinfo) => onMessage(entry, buf, rinfo));
      socket.bind(PORT, () => {
        try {
          socket.addMembership(GROUP, via);
          socket.setMulticastInterface(via);
          socket.setMulticastTTL(255);
          resolve(entry);
        } catch {
          try { socket.close(); } catch { /* ya cerrado */ }
          resolve(null);
        }
      });
    });
  }

  const closeSockets = () => {
    for (const s of sockets) try { s.socket.close(); } catch { /* ya cerrado */ }
    sockets = [];
  };

  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

  async function claimName() {
    hostname = null;
    for (let n = 1; n <= MAX_SUFFIX; n += 1) {
      candidate = n === 1 ? base : `${base}-${n}`;
      conflict = false;
      // Se pregunta dos veces si alguien ya tiene el nombre; onMessage anota si otro equipo responde.
      for (const s of sockets) send(s, buildQuery(`${candidate}.local`));
      await wait(PROBE_MS / 2);
      for (const s of sockets) send(s, buildQuery(`${candidate}.local`));
      await wait(PROBE_MS / 2);
      if (!conflict) {
        hostname = candidate;
        return;
      }
    }
  }

  function announce(ttl = TTL) {
    if (!hostname) return;
    for (const s of sockets) send(s, buildResponse({ name: `${hostname}.local`, address: s.address, ttl }));
  }

  // networks: [{ via, address, netmask }]. via = dirección de la interfaz; address = la que se anuncia.
  // keep: el nombre que tenía (al recuperar el base), que se sigue contestando para no dejar colgados a los
  // dispositivos que entraron por él. Devuelve el nombre conseguido ("manna.local") o null si no se pudo.
  async function start(networks, keep = null) {
    former = keep;
    closeSockets();
    sockets = (await Promise.all(networks.map(openSocket))).filter(Boolean);
    if (!sockets.length) {
      hostname = null;
      return null;
    }
    await claimName();
    announce();
    setTimeout(announce, 1000).unref();
    return hostname ? `${hostname}.local` : null;
  }

  // Comprueba que el nombre sigue funcionando de verdad: se pregunta a sí mismo por la red y
  // espera oír su propia respuesta. Tras dormir el equipo, o si la wifi se cae y vuelve, el
  // sistema puede dejar la conexión abierta pero sorda o muda sin avisar; en ese caso devuelve
  // false y quien lo llama debe volver a ejecutar start().
  async function healthy() {
    if (!hostname || !sockets.length || sockets.some((s) => s.dead)) return false;
    const since = Date.now();
    for (const s of sockets) send(s, buildQuery(`${hostname}.local`));
    await wait(HEALTH_MS);
    return sockets.every((s) => s.heard >= since);
  }

  // Quién más contesta por el nombre, sin anunciarse ni quedárselo: las direcciones de otros equipos (las
  // del propio, como un Manna abierto en otro puerto, no cuentan). Lo usa el aviso de «otro Manna en la red».
  // También por los nombres con sufijo: quien lo encontró ocupado al arrancar quedó como «manna-2», y puede ser el
  // equipo oficial, al que un portátil se le adelantó (2026-11-14).
  async function probe(networks) {
    closeSockets();
    sockets = (await Promise.all(networks.map(openSocket))).filter(Boolean);
    hostname = null;
    candidate = base;
    const names = Array.from({ length: MAX_SUFFIX }, (_, i) => `${i ? `${base}-${i + 1}` : base}.local`);
    asked.clear();
    for (const n of names) asked.set(n, new Set());
    for (let i = 0; i < 3; i += 1) {
      for (const s of sockets) for (const n of names) send(s, buildQuery(n));
      await wait(PROBE_MS / 2);
    }
    closeSockets();
    const found = new Set(names.flatMap((n) => [...(asked.get(n) || [])]));
    asked.clear();
    return [...found];
  }

  // ¿Nadie más contesta por este nombre? Se pregunta por las redes ya abiertas, sin soltar el nombre propio.
  async function free(name) {
    asked.set(name, new Set());
    for (let i = 0; i < 2; i += 1) {
      for (const s of sockets) send(s, buildQuery(name));
      await wait(PROBE_MS / 2);
    }
    const others = asked.get(name); // un probe() a la vez lo habría borrado: entonces no se sabe, y no se da por libre
    asked.delete(name);
    return sockets.length > 0 && others?.size === 0;
  }

  async function stop() {
    announce(0);
    await wait(50);
    closeSockets();
    hostname = null;
    former = null;
  }

  return { start, stop, probe, free, healthy, announce, get name() { return hostname ? `${hostname}.local` : null; } };
}
