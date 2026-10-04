import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

// Un mismo puerto que atiende http y https.
//
// Quien llega por https empieza siempre con el mismo byte (0x16, el saludo TLS); quien llega por
// http empieza con una letra ("GET …"). Se mira ese primer byte sin consumirlo y se entrega la
// conexión al servidor que corresponde. Así cualquier dirección de Manna funciona de las dos
// formas, que es lo que necesitan los navegadores que convierten todo en https (televisores).
//
//   const listener = createListener(handler, { key, cert }, { onArrival });
//   listener.listen(puerto, host, alEstarListo);  listener.once('error', …);  listener.close();
//
// Sin certificado (secure null) es un servidor http corriente.
// onArrival({ ip, secure, error }) avisa de cada llegada; con `error` cuando el visitante cortó el
// saludo https (lo que hace un navegador que no acepta el certificado). Sirve para explicar por
// qué un equipo no entra.

const TLS_HANDSHAKE = 0x16;
const FIRST_BYTE_MS = 30_000;

export const plainAddress = (address) => String(address || '').replace(/^::ffff:/, '');

export function createListener(handler, secure, { onArrival = () => {} } = {}) {
  const plain = http.createServer(handler);
  if (!secure) {
    plain.on('connection', (socket) => onArrival({ ip: plainAddress(socket.remoteAddress), secure: false }));
    return plain;
  }

  const safe = https.createServer({ key: secure.key, cert: secure.cert }, handler);
  // Un saludo https que no llega a completarse: el visitante lo cortó (no aceptó el certificado).
  // Se reconoce porque la conexión se cierra antes de que el servidor la dé por establecida.
  const greeting = new Set();
  const id = (socket) => `${socket.remoteAddress}:${socket.remotePort}`;
  safe.on('secureConnection', (socket) => greeting.delete(id(socket)));
  safe.on('tlsClientError', () => {});

  const front = net.createServer((socket) => {
    socket.on('error', () => {});
    // Quien abre la conexión y no dice nada no se queda ocupando sitio.
    socket.setTimeout(FIRST_BYTE_MS, () => socket.destroy());
    socket.once('readable', () => {
      const first = socket.read(1);
      if (!first) return;
      socket.setTimeout(0);
      socket.unshift(first);
      const isSecure = first[0] === TLS_HANDSHAKE;
      const ip = plainAddress(socket.remoteAddress);
      onArrival({ ip, secure: isSecure });
      if (isSecure) {
        const key = id(socket);
        greeting.add(key);
        socket.once('close', () => { if (greeting.delete(key)) onArrival({ ip, secure: true, error: 'saludo' }); });
      }
      (isSecure ? safe : plain).emit('connection', socket);
    });
  });

  const close = front.close.bind(front);
  front.close = (done) => {
    close(done);
    // Las conexiones ya entregadas las llevan los dos servidores de dentro.
    plain.closeAllConnections?.();
    safe.closeAllConnections?.();
    return front;
  };
  return front;
}
