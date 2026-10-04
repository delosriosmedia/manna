import test from 'node:test';
import assert from 'node:assert/strict';
import { origin, rankAddresses, sameSubnet } from '../server/modules/system/network.js';
import { buildQuery, buildResponse, encodeName, parseMessage, readName } from '../server/modules/system/mdns.js';
import { portCandidates } from '../server/core/app.js';
import { liveToRestore, RESTORE_WINDOW_MS } from '../server/modules/projection/live.js';

const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });

test('rankAddresses pone primero la dirección por la que el equipo sale a la red', () => {
  const interfaces = { lo0: [v4('127.0.0.1', true)], en0: [v4('192.168.0.147')], en5: [v4('10.0.0.8')] };
  assert.deepEqual(rankAddresses(interfaces, '10.0.0.8'), ['10.0.0.8', '192.168.0.147']);
  assert.deepEqual(rankAddresses(interfaces, '192.168.0.147'), ['192.168.0.147', '10.0.0.8']);
});

test('rankAddresses no elige una VPN ni una red virtual aunque sea la ruta de salida', () => {
  const interfaces = {
    utun4: [v4('10.8.0.2')],
    'vEthernet (WSL)': [v4('172.20.0.1')],
    'Wi-Fi': [v4('192.168.1.5')],
    Tailscale: [v4('100.101.102.103')],
  };
  assert.equal(rankAddresses(interfaces, '10.8.0.2')[0], '192.168.1.5');
  assert.equal(rankAddresses(interfaces, null)[0], '192.168.1.5');
});

test('rankAddresses deja al final las direcciones sin DHCP y omite IPv6 e internas', () => {
  const interfaces = {
    en0: [v4('169.254.10.20'), { family: 'IPv6', address: 'fe80::1', internal: false }],
    en1: [v4('192.168.0.9')],
    lo0: [v4('127.0.0.1', true)],
  };
  assert.deepEqual(rankAddresses(interfaces), ['192.168.0.9', '169.254.10.20']);
  assert.deepEqual(rankAddresses({ lo0: [v4('127.0.0.1', true)] }), []);
});

test('liveToRestore recupera lo proyectado solo si el reinicio es reciente', () => {
  const now = 1_000_000_000;
  const source = { kind: 'verses', data: { versionId: 'rv1909', ref: { book: 43, chapter: 3, verseStart: 16, verseEnd: 16 } }, step: null, orderId: null };
  assert.deepEqual(liveToRestore({ mode: 'black', source, at: now - 60_000 }, now), { mode: 'black', source, previous: null });
  // Los mandos en vivo (zoom, punto de la reproducción) vuelven junto con el momento en que se guardaron.
  const state = { pattern: 'barras' };
  assert.deepEqual(liveToRestore({ mode: 'live', source, state, at: now - 5000 }, now).previous, { state, at: now - 5000 });
  assert.equal(liveToRestore({ mode: 'live', source, at: now - RESTORE_WINDOW_MS - 1 }, now), null);
  assert.equal(liveToRestore({ mode: 'live', source, at: now + 5000 }, now), null);
  assert.equal(liveToRestore(null, now), null);
  assert.equal(liveToRestore({ mode: 'live', source: null, at: now }, now), null);
  assert.equal(liveToRestore({ mode: 'live', item: { versionId: 'rv1909' }, at: now }, now), null);
  assert.equal(liveToRestore({ mode: 'raro', source, at: now }, now).mode, 'live');
});

// ---- Dirección con nombre (mDNS) y puertos ----

test('los paquetes mDNS se construyen y se leen de vuelta', () => {
  const query = parseMessage(buildQuery('manna.local'));
  assert.equal(query.isResponse, false);
  assert.deepEqual(query.questions, [{ name: 'manna.local', type: 255 }]);

  const answer = parseMessage(buildResponse({ name: 'manna.local', address: '192.168.0.147' }));
  assert.equal(answer.isResponse, true);
  assert.equal(answer.id, 0);
  assert.deepEqual(answer.answers[0], { name: 'manna.local', type: 1, address: '192.168.0.147' });
  assert.equal(answer.answers[1].type, 47);

  const legacy = parseMessage(buildResponse({ name: 'manna.local', address: '10.0.0.5', legacy: { id: 77, type: 1 } }));
  assert.equal(legacy.id, 77);
  assert.deepEqual(legacy.questions, [{ name: 'manna.local', type: 1 }]);
  assert.equal(legacy.answers[0].address, '10.0.0.5');
});

test('readName sigue los punteros de compresión y no se cuelga con basura', () => {
  const name = encodeName('manna.local');
  const packet = Buffer.concat([Buffer.alloc(12), name, Buffer.from([0xc0, 12])]);
  assert.deepEqual(readName(packet, 12 + name.length), { name: 'manna.local', end: 12 + name.length + 2 });
  assert.equal(parseMessage(Buffer.from([1, 2, 3])), null);
  const loop = Buffer.concat([Buffer.alloc(4), Buffer.from([0, 1, 0, 0, 0, 0, 0, 0]), Buffer.from([0xc0, 12])]);
  assert.equal(parseMessage(loop), null);
});

test('sameSubnet y origin', () => {
  assert.equal(sameSubnet('192.168.0.20', '192.168.0.147', '255.255.255.0'), true);
  assert.equal(sameSubnet('192.168.1.20', '192.168.0.147', '255.255.255.0'), false);
  assert.equal(sameSubnet('10.1.2.3', '10.200.0.1', '255.0.0.0'), true);
  assert.equal(origin('manna.local', 80), 'http://manna.local');
  assert.equal(origin('192.168.0.147', 8000), 'http://192.168.0.147:8000');
});

test('portCandidates prefiere el 80 salvo que se fije un puerto', () => {
  assert.deepEqual(portCandidates().slice(0, 3), [80, 8000, 8001]);
  assert.deepEqual(portCandidates(8123).slice(0, 2), [8123, 8124]);
});
