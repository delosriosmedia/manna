import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';

// Cliente WebSocket mínimo, sin dependencias. Manna lo usa para hablar con equipos de la red que
// se gobiernan así (un televisor). Solo mensajes de texto, que es lo que usan.
//
//   const ws = await openWebSocket('wss://192.168.1.3:8002/ruta', { insecure: true });
//   ws.on('message', (texto) => …);  ws.on('close', () => …);
//   ws.send('…');  ws.close();
//
// insecure: acepta un certificado que no se puede verificar. Los aparatos de una red local traen
// uno hecho por ellos mismos; solo se usa con direcciones de la red local.

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Arma una trama de texto. El cliente siempre enmascara lo que envía (lo exige el protocolo).
function frame(opcode, payload) {
  const mask = crypto.randomBytes(4);
  const size = payload.length;
  const head = size < 126 ? Buffer.from([0x80 | opcode, 0x80 | size])
    : size < 65536 ? Buffer.from([0x80 | opcode, 0x80 | 126, size >> 8, size & 0xff])
      : Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(size)); return b; })()]);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i % 4];
  return Buffer.concat([head, mask, masked]);
}

// Saca del búfer las tramas completas. Devuelve { frames: [{ fin, opcode, payload }], rest }.
export function readFrames(buffer) {
  const frames = [];
  let at = 0;
  while (buffer.length - at >= 2) {
    const fin = Boolean(buffer[at] & 0x80);
    const opcode = buffer[at] & 0x0f;
    const masked = Boolean(buffer[at + 1] & 0x80);
    let size = buffer[at + 1] & 0x7f;
    let head = 2;
    if (size === 126) {
      if (buffer.length - at < 4) break;
      size = buffer.readUInt16BE(at + 2);
      head = 4;
    } else if (size === 127) {
      if (buffer.length - at < 10) break;
      size = Number(buffer.readBigUInt64BE(at + 2));
      head = 10;
    }
    const total = head + (masked ? 4 : 0) + size;
    if (buffer.length - at < total) break;
    let payload = buffer.subarray(at + head + (masked ? 4 : 0), at + total);
    if (masked) {
      const mask = buffer.subarray(at + head, at + head + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    }
    frames.push({ fin, opcode, payload });
    at += total;
  }
  return { frames, rest: buffer.subarray(at) };
}

export function openWebSocket(url, { insecure = false, timeout = 8000 } = {}) {
  const target = new URL(url);
  const secure = target.protocol === 'wss:';
  const port = Number(target.port) || (secure ? 443 : 80);
  const key = crypto.randomBytes(16).toString('base64');
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');

  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host: target.hostname, port, rejectUnauthorized: !insecure })
      : net.connect({ host: target.hostname, port });
    const events = new EventEmitter();
    let buffer = Buffer.alloc(0);
    let open = false;
    let closed = false;
    let pieces = []; // un mensaje puede llegar partido en varias tramas

    const finish = (err) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      socket.destroy();
      if (open) events.emit('close');
      else reject(err || new Error('No se pudo conectar.'));
    };
    const timer = setTimeout(() => finish(new Error('El equipo no respondió a tiempo.')), timeout);

    socket.on('error', (err) => finish(err));
    socket.on('close', () => finish());
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      socket.write([
        `GET ${target.pathname}${target.search} HTTP/1.1`,
        `Host: ${target.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '', '',
      ].join('\r\n'));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!open) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const head = buffer.subarray(0, end).toString('latin1');
        if (!/^HTTP\/1\.1 101/.test(head) || !head.toLowerCase().includes(accept.toLowerCase())) {
          finish(new Error('El equipo no aceptó la conexión.'));
          return;
        }
        buffer = buffer.subarray(end + 4);
        open = true;
        clearTimeout(timer);
        resolve({
          on: (name, fn) => events.on(name, fn),
          send(text) { if (!closed) socket.write(frame(0x1, Buffer.from(String(text), 'utf8'))); },
          close() {
            if (closed) return;
            socket.write(frame(0x8, Buffer.alloc(0)));
            finish();
          },
        });
      }
      const { frames, rest } = readFrames(buffer);
      buffer = rest;
      for (const f of frames) {
        if (f.opcode === 0x8) finish();
        else if (f.opcode === 0x9) socket.write(frame(0xa, f.payload)); // latido: se responde
        else if (f.opcode === 0x1 || f.opcode === 0x0) {
          pieces.push(f.payload);
          if (f.fin) {
            const text = Buffer.concat(pieces).toString('utf8');
            pieces = [];
            // En el siguiente turno, para que quien abrió la conexión ya esté escuchando.
            setImmediate(() => events.emit('message', text));
          }
        }
      }
    });
  });
}
