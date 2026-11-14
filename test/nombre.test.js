import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponder } from '../server/modules/system/mdns.js';

// El nombre en la red con anunciadores de verdad, pero solo por la dirección de este mismo equipo (127.0.0.1), para no
// mandar nada a la red. Cada uno anuncia una dirección inventada distinta: así se ven como equipos distintos.
const BASE = `manna-prueba-nombre-${process.pid % 1000}`;
const at = (address) => [{ via: '127.0.0.1', address, netmask: '255.0.0.0' }];
const made = [];
const responder = (base = BASE) => { const r = createResponder({ base }); made.push(r); return r; };
test.after(async () => { for (const r of made) await r.stop(); });

// Donde el sistema no deja oír por 127.0.0.1 lo que se manda al grupo de mDNS, no hay cómo probarlo así.
const laptop = responder();
const heard = (await laptop.start(at('10.99.0.1'))) && (await laptop.healthy());
const skip = heard ? false : 'este sistema no entrega por 127.0.0.1 lo que se manda a mDNS';

// El 2026-11-14 un portátil con Manna se quedó con «manna.local» en la red de Nueva Vida; el equipo oficial, al
// reiniciarse, quedó como «manna-2.local» y el portátil, que buscaba al oficial solo por «manna.local», no lo veía.
test('quien busca otro Manna lo encuentra aunque haya quedado con sufijo («manna-2»)', { skip }, async () => {
  assert.equal(laptop.name, `${BASE}.local`);
  const official = responder();
  assert.equal(await official.start(at('10.99.0.2')), `${BASE}-2.local`, 'el oficial encuentra el nombre ocupado y queda con -2');
  const found = await responder().probe(at('10.99.0.3'));
  assert.deepEqual(found.sort(), ['10.99.0.1', '10.99.0.2'], 'se ven los dos: el del nombre y el que quedó con -2');
});

test('el que quedó con sufijo recupera el nombre cuando queda libre, y sigue contestando por el de antes', { skip }, async () => {
  const official = made[1];
  assert.equal(await official.free(`${BASE}.local`), false, 'mientras el portátil lo tiene, no está libre');
  await laptop.stop();
  assert.equal(await official.free(`${BASE}.local`), true, 'el portátil se apartó: está libre');
  assert.equal(await official.start(at('10.99.0.2'), `${BASE}-2.local`), `${BASE}.local`, 'lo recupera');
  assert.equal(await official.healthy(), true);
  // Los dispositivos que entraron por «-2» siguen llegando: el oficial contesta también por ese nombre.
  assert.deepEqual(await responder(`${BASE}-2`).probe(at('10.99.0.4')), ['10.99.0.2']);
});
