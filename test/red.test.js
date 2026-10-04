import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { createCertificate, loadCertificate } from '../server/core/cert.js';
import { createListener, plainAddress } from '../server/core/listener.js';
import { openWebSocket, readFrames } from '../server/core/ws.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-red-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 }));

const DAY = 86_400_000;

// ---- Certificado propio ----

const made = await createCertificate({ names: ['localhost', 'manna.local'], ips: ['127.0.0.1', '192.168.1.14'] });

test('el certificado propio es válido para los nombres y direcciones de Manna', () => {
  const cert = new crypto.X509Certificate(made.cert);
  assert.match(cert.subject, /CN=Manna/);
  assert.equal(cert.issuer, cert.subject);
  assert.equal(cert.checkHost('manna.local'), 'manna.local');
  assert.equal(cert.checkHost('otro.local'), undefined);
  assert.equal(cert.checkIP('192.168.1.14'), '192.168.1.14');
  assert.equal(cert.checkIP('10.0.0.1'), undefined);
  assert.equal(cert.verify(cert.publicKey), true);
  assert.equal(cert.checkPrivateKey(crypto.createPrivateKey(made.key)), true);
  assert.equal(cert.ca, true);
  const days = (Date.parse(cert.validTo) - Date.now()) / DAY;
  assert.ok(days > 800 && days < 830, `vence en ${days} días`);
  assert.ok(Date.parse(cert.validFrom) < Date.now());
});

test('el certificado se guarda y se conserva; solo se rehace si falta, se daña o va a vencer', async () => {
  const dir = path.join(tmp, 'certificado');
  const first = await loadCertificate(dir, { names: ['localhost'], ips: ['127.0.0.1'] });
  assert.equal(first.created, true);
  const again = await loadCertificate(dir, { names: ['localhost'], ips: ['10.0.0.9'] });
  assert.equal(again.created, false);
  assert.equal(again.cert, first.cert, 'cambiar de dirección no cambia el certificado');

  const later = await loadCertificate(dir, { names: ['localhost'], now: Date.now() + 810 * DAY });
  assert.equal(later.created, true, 'a un mes de vencer se hace otro');

  fs.writeFileSync(path.join(dir, 'manna.crt'), 'esto no es un certificado');
  assert.equal((await loadCertificate(dir, { names: ['localhost'] })).created, true);
});

// ---- Un puerto para http y https ----

const get = (lib, options) => new Promise((resolve, reject) => {
  lib.get({ host: '127.0.0.1', agent: false, ...options }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  }).on('error', reject);
});

test('el mismo puerto atiende http y https, y avisa de cómo llega cada visitante', async () => {
  const arrivals = [];
  const listener = createListener((req, res) => res.end(`hola por ${req.socket.encrypted ? 'https' : 'http'}`), made, { onArrival: (a) => arrivals.push(a) });
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  try {
    assert.deepEqual(await get(http, { port, path: '/' }), { status: 200, body: 'hola por http' });
    // Quien confía en el certificado lo acepta sin excepciones: nombre, fechas y firma están bien.
    assert.deepEqual(await get(https, { port, path: '/', ca: made.cert }), { status: 200, body: 'hola por https' });
    // Quien no lo conoce corta el saludo, como un navegador antes de que la persona elija "continuar".
    await assert.rejects(get(https, { port, path: '/' }), /self.signed|certificate/i);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(arrivals.filter((a) => !a.error).map((a) => a.secure), [false, true, true]);
    assert.equal(arrivals.every((a) => a.ip === '127.0.0.1'), true);
    assert.equal(arrivals.some((a) => a.secure && a.error), true, 'el saludo cortado queda anotado');
  } finally {
    await new Promise((resolve) => listener.close(resolve));
  }
});

test('sin certificado es un servidor http corriente', async () => {
  const listener = createListener((req, res) => res.end('hola'), null);
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal((await get(http, { port: listener.address().port, path: '/' })).body, 'hola');
  } finally {
    listener.closeAllConnections?.();
    await new Promise((resolve) => listener.close(resolve));
  }
});

test('plainAddress quita el envoltorio de las direcciones', () => {
  assert.equal(plainAddress('::ffff:192.168.1.3'), '192.168.1.3');
  assert.equal(plainAddress('192.168.1.3'), '192.168.1.3');
  assert.equal(plainAddress(undefined), '');
});

// ---- Cliente WebSocket ----

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const serverFrame = (opcode, payload, fin = true) => Buffer.concat([Buffer.from([(fin ? 0x80 : 0) | opcode, payload.length]), payload]);

// Un servidor WebSocket mínimo: apunta lo que recibe y deja enviar tramas a mano.
async function wsServer({ accept = true } = {}) {
  const got = [];
  let peer = null;
  const server = http.createServer();
  server.on('upgrade', (req, socket) => {
    peer = socket;
    const key = accept ? crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64') : 'otra-cosa';
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\n\r\n`);
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const { frames, rest } = readFrames(buffer);
      buffer = rest;
      got.push(...frames.map((f) => ({ opcode: f.opcode, text: f.payload.toString('utf8') })));
    });
    socket.on('error', () => {});
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    got, url: `ws://127.0.0.1:${server.address().port}/canal?a=1`,
    write: (buffer) => peer.write(buffer),
    async stop() {
      peer?.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
const until = async (check) => {
  for (let i = 0; i < 100 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
};

test('el cliente WebSocket conversa: envía enmascarado, recibe partido y contesta al latido', async () => {
  const server = await wsServer();
  const ws = await openWebSocket(server.url);
  const messages = [];
  let closed = false;
  ws.on('message', (text) => messages.push(text));
  ws.on('close', () => { closed = true; });
  try {
    ws.send('hola, televisor: ñ');
    server.write(serverFrame(0x1, Buffer.from('uno')));
    // Un mensaje repartido en dos tramas.
    server.write(serverFrame(0x1, Buffer.from('dos y '), false));
    server.write(serverFrame(0x0, Buffer.from('tres')));
    server.write(serverFrame(0x9, Buffer.from('latido')));
    await until(() => messages.length === 2 && server.got.length === 2);
    assert.deepEqual(messages, ['uno', 'dos y tres']);
    assert.deepEqual(server.got, [{ opcode: 0x1, text: 'hola, televisor: ñ' }, { opcode: 0xa, text: 'latido' }]);
    server.write(serverFrame(0x8, Buffer.alloc(0)));
    await until(() => closed);
    assert.equal(closed, true);
  } finally {
    ws.close();
    await server.stop();
  }
});

test('el cliente WebSocket rechaza a quien no responde como debe', async () => {
  const server = await wsServer({ accept: false });
  try {
    await assert.rejects(openWebSocket(server.url), /no aceptó/);
  } finally {
    await server.stop();
  }
  await assert.rejects(openWebSocket('ws://127.0.0.1:9/', { timeout: 1500 }));
});

test('readFrames entiende tramas largas y espera a las incompletas', () => {
  const long = Buffer.alloc(300, 0x61);
  const frame = Buffer.concat([Buffer.from([0x81, 126, 300 >> 8, 300 & 0xff]), long]);
  const whole = readFrames(frame);
  assert.equal(whole.frames.length, 1);
  assert.equal(whole.frames[0].payload.length, 300);
  assert.equal(whole.rest.length, 0);
  const partial = readFrames(frame.subarray(0, 100));
  assert.equal(partial.frames.length, 0);
  assert.equal(partial.rest.length, 100);
});
