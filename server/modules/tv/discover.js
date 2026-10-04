import dgram from 'node:dgram';
import os from 'node:os';

// Busca en la red los equipos que se anuncian como pantallas (SSDP, lo mismo que usa un celular
// para encontrar un televisor al "enviar a pantalla"). Devuelve sus direcciones; quien llama
// comprueba después cuáles son de una marca que Manna sabe gobernar.
const GROUP = '239.255.255.250';
const PORT = 1900;
const TARGETS = ['urn:dial-multiscreen-org:service:dial:1', 'urn:samsung.com:device:RemoteControlReceiver:1'];

const question = (target) => Buffer.from(
  `M-SEARCH * HTTP/1.1\r\nHOST: ${GROUP}:${PORT}\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ${target}\r\n\r\n`);

export function discover({ wait = 2500 } = {}) {
  const own = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n?.family === 'IPv4' && !n.internal).map((n) => n.address);
  const found = new Set();
  const sockets = [];

  // Una pregunta por cada red del equipo (wifi y cable pueden ser redes distintas).
  for (const address of own) {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sockets.push(socket);
    socket.on('error', () => {});
    socket.on('message', (_message, from) => { if (!own.includes(from.address)) found.add(from.address); });
    socket.bind(0, address, () => {
      for (const target of TARGETS) {
        // Dos veces: es UDP y una pregunta se puede perder.
        socket.send(question(target), PORT, GROUP, () => {});
        setTimeout(() => { try { socket.send(question(target), PORT, GROUP, () => {}); } catch { /* ya cerrado */ } }, 400);
      }
    });
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      for (const socket of sockets) { try { socket.close(); } catch { /* ya cerrado */ } }
      resolve([...found]);
    }, wait);
  });
}
