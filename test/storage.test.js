import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStorage } from '../server/core/storage.js';

// Un archivo de data/ dañado por un corte de luz se cargaba con los valores por defecto y el primer guardado lo pisaba:
// se perdían los órdenes o los usuarios sin ningún aviso (auditoría integral, S1-E).
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'manna-storage-'));

test('un archivo dañado no se pisa: se aparta y se usa la copia anterior', () => {
  const dir = folder();
  try {
    fs.writeFileSync(path.join(dir, 'orden.json'), '{"orders": [{"id": "a"'); // cortado a medias
    fs.writeFileSync(path.join(dir, 'orden.json.anterior'), JSON.stringify({ orders: [{ id: 'a' }] }));
    const saved = createStorage(dir)('orden', { orders: [] });
    assert.deepEqual(saved.data.orders, [{ id: 'a' }], 'vuelve la copia anterior');
    const apart = fs.readdirSync(dir).filter((f) => f.startsWith('orden.dañado-'));
    assert.equal(apart.length, 1, 'el dañado queda aparte, sin borrar');
    assert.equal(fs.readFileSync(path.join(dir, apart[0]), 'utf8'), '{"orders": [{"id": "a"');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('un archivo vacío sin copia: valores por defecto, y el vacío queda aparte', () => {
  const dir = folder();
  try {
    fs.writeFileSync(path.join(dir, 'usuarios.json'), '');
    const saved = createStorage(dir)('usuarios', { list: [] });
    assert.deepEqual(saved.data, { list: [] });
    assert.equal(fs.readdirSync(dir).filter((f) => f.startsWith('usuarios.dañado-')).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('al guardar queda la versión anterior; si Windows no deja guardar un momento, se reintenta', async () => {
  const dir = folder();
  const rename = fs.renameSync;
  try {
    const saved = createStorage(dir)('textos', { list: [] });
    saved.data.list = ['uno'];
    saved.flush(); saved.save(); saved.flush(); // el primero
    saved.data.list = ['uno', 'dos'];
    saved.save();
    saved.flush();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'textos.json'), 'utf8')).list, ['uno', 'dos']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'textos.json.anterior'), 'utf8')).list, ['uno'], 'la de antes, guardada');
    let refusals = 1;
    fs.renameSync = (from, to) => {
      if (refusals > 0 && String(from).endsWith('textos.json.tmp')) { refusals -= 1; throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); }
      return rename(from, to);
    };
    saved.data.list = ['tres'];
    saved.save();
    saved.flush();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'textos.json'), 'utf8')).list, ['uno', 'dos'], 'el primer intento no pudo');
    for (let i = 0; i < 40 && JSON.parse(fs.readFileSync(path.join(dir, 'textos.json'), 'utf8')).list[0] !== 'tres'; i += 1) await sleep(100);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'textos.json'), 'utf8')).list, ['tres'], 'se reintentó solo');
  } finally {
    fs.renameSync = rename;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
