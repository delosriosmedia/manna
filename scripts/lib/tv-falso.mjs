import crypto from 'node:crypto';
import http from 'node:http';
import { readFrames } from '../../server/core/ws.js';

// Un televisor Samsung de mentira para las pruebas: responde como el de verdad a lo que Manna
// le pide (datos, abrir y cerrar el navegador, mando a distancia) y apunta lo que recibe.
//
//   const tv = await startFakeTv();
//   MANNA_TV_PRUEBA = JSON.stringify(tv.endpoints)   -> Manna habla con él en vez de con un televisor
//   tv.received   órdenes del mando recibidas (los "params" de cada una)
//   tv.browser    { running, visible }
//   tv.accept     false: nadie acepta el aviso (solo entra quien ya trae la clave)

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const BROWSER = '3202010022079';

function frame(text) {
  const payload = Buffer.from(text, 'utf8');
  const head = payload.length < 126 ? Buffer.from([0x81, payload.length]) : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
  return Buffer.concat([head, payload]);
}

export async function startFakeTv({ token = '87654321', name = 'Tele &quot;de prueba&quot;', model = 'QN00PRUEBA' } = {}) {
  const sockets = new Set();
  const tv = { token, accept: true, on: true, received: [], browser: { running: false, visible: false }, connections: 0 };

  const server = http.createServer((req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/api/v2/') {
      json(200, { device: { name, modelName: model, PowerState: tv.on ? 'on' : 'standby', TokenAuthSupport: 'true' }, name });
      return;
    }
    if (req.url === `/api/v2/applications/${BROWSER}`) {
      if (req.method === 'POST') tv.browser = { running: true, visible: true };
      if (req.method === 'DELETE') tv.browser = { running: true, visible: false };
      json(200, req.method === 'GET' ? { id: BROWSER, name: 'Browser', ...tv.browser } : true);
      return;
    }
    json(404, { status: 404, message: 'Not found error.' });
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://tv');
    const key = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\n\r\n`);
    sockets.add(socket);
    tv.connections += 1;
    tv.lastName = Buffer.from(url.searchParams.get('name') || '', 'base64').toString('utf8');
    const allowed = url.searchParams.get('token') === tv.token || tv.accept;
    socket.write(frame(JSON.stringify(allowed ? { event: 'ms.channel.connect', data: { token: tv.token } } : { event: 'ms.channel.unauthorized' })));
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const { frames, rest } = readFrames(buffer);
      buffer = rest;
      for (const f of frames) {
        if (f.opcode === 0x1) tv.received.push(JSON.parse(f.payload.toString('utf8')).params);
        if (f.opcode === 0x8) socket.end();
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return Object.assign(tv, {
    endpoints: { rest: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}` },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  });
}
