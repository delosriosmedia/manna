// El formato de Keynote desde 2013: un .zip con Index/*.iwa. Cada .iwa son mensajes protobuf comprimidos con Snappy, en un
// marco propio. Se lee sin esquema: quien lee sabe qué número de campo quiere (keynote.js).

const MAX_BYTES = 512 * 1024 * 1024;

// Snappy (el bloque, sin sus marcos): literales y copias de lo ya escrito.
export function snappy(buf) {
  let p = 0;
  let length = 0;
  for (let shift = 0; ; shift += 7) {
    if (shift > 28) throw new Error('Snappy: largo imposible.');
    const b = buf[p++];
    length += (b & 0x7f) * 2 ** shift;
    if (!(b & 0x80)) break;
  }
  if (length > MAX_BYTES) throw new Error('Snappy: demasiado grande.');
  const out = Buffer.alloc(length);
  let o = 0;
  while (p < buf.length) {
    const tag = buf[p++];
    if ((tag & 3) === 0) {
      let n = tag >> 2;
      if (n >= 60) {
        const bytes = n - 59;
        n = 0;
        for (let i = 0; i < bytes; i += 1) n += buf[p + i] * 2 ** (8 * i);
        p += bytes;
      }
      n += 1;
      if (o + n > length || p + n > buf.length) throw new Error('Snappy: cortado.');
      buf.copy(out, o, p, p + n);
      p += n;
      o += n;
    } else {
      let n;
      let offset;
      if ((tag & 3) === 1) {
        n = ((tag >> 2) & 7) + 4;
        offset = ((tag >> 5) << 8) | buf[p++];
      } else if ((tag & 3) === 2) {
        n = (tag >> 2) + 1;
        offset = buf[p] | (buf[p + 1] << 8);
        p += 2;
      } else {
        n = (tag >> 2) + 1;
        offset = buf.readUInt32LE(p);
        p += 4;
      }
      if (!offset || offset > o || o + n > length) throw new Error('Snappy: copia imposible.');
      for (let i = 0; i < n; i += 1, o += 1) out[o] = out[o - offset];
    }
  }
  return out.subarray(0, o);
}

// Un .iwa: trozos de [0, largo en 3 bytes, Snappy].
function unframe(raw) {
  const parts = [];
  for (let p = 0; p < raw.length;) {
    if (raw[p] !== 0) throw new Error('No es un .iwa.');
    const n = raw[p + 1] | (raw[p + 2] << 8) | (raw[p + 3] << 16);
    parts.push(snappy(raw.subarray(p + 4, p + 4 + n)));
    p += 4 + n;
  }
  return Buffer.concat(parts);
}

function varint(b, at) {
  let value = 0n;
  for (let shift = 0n; ; shift += 7n) {
    if (at.p >= b.length) throw new Error('Protobuf: cortado.');
    const x = b[at.p++];
    value |= BigInt(x & 0x7f) << shift;
    if (!(x & 0x80)) break;
  }
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
}

// Un mensaje: Map de campo a la lista de sus valores (un número o, si es de largo o fijo, un Buffer).
export function parse(b) {
  const out = new Map();
  const at = { p: 0 };
  const push = (field, value) => {
    if (out.has(field)) out.get(field).push(value);
    else out.set(field, [value]);
  };
  while (at.p < b.length) {
    const key = Number(varint(b, at));
    const field = key >> 3;
    const wire = key & 7;
    if (wire === 0) push(field, varint(b, at));
    else if (wire === 1 || wire === 5) {
      const n = wire === 1 ? 8 : 4;
      push(field, b.subarray(at.p, at.p + n));
      at.p += n;
    } else if (wire === 2) {
      const n = Number(varint(b, at));
      push(field, b.subarray(at.p, at.p + n));
      at.p += n;
    } else throw new Error('Protobuf: tipo desconocido.');
  }
  return out;
}

export const val = (m, field) => m?.get(field)?.[0];
export const msg = (m, field) => {
  const value = val(m, field);
  return Buffer.isBuffer(value) ? parse(value) : null;
};
export const msgs = (m, field) => (m?.get(field) || []).filter(Buffer.isBuffer).map(parse);
// Una referencia a otro objeto es un mensaje con su identificador en el campo 1.
export const ref = (m, field) => val(msg(m, field), 1);
export const refs = (m, field) => msgs(m, field).map((r) => val(r, 1));
export const float = (m, field) => {
  const value = val(m, field);
  return Buffer.isBuffer(value) && value.length === 4 ? value.readFloatLE(0) : undefined;
};
export const floats = (m, field) => (m?.get(field) || []).flatMap((v) => (Buffer.isBuffer(v) ? Array.from({ length: Math.floor(v.length / 4) }, (_, i) => v.readFloatLE(i * 4)) : []));
export const ints = (m, field) => (m?.get(field) || []).flatMap((v) => (Buffer.isBuffer(v) ? [...v] : [v]));
export const bool = (m, field) => {
  const value = val(m, field);
  return value === undefined ? undefined : Boolean(value);
};
export const text = (m, field) => {
  const value = val(m, field);
  return Buffer.isBuffer(value) ? value.toString('utf8') : undefined;
};

// Todos los objetos de la presentación: identificador -> { id, type, data }. Lo que sigue a cada cabecera son sus mensajes;
// el primero es el objeto (los demás, si los hay, solo se saltan).
export function readObjects(parts) {
  const objects = new Map();
  let total = 0;
  for (const [name, raw] of parts) {
    if (!/^Index\/.*\.iwa$/.test(name)) continue;
    const b = unframe(raw);
    total += b.length;
    if (total > MAX_BYTES) throw new Error('Keynote: demasiado grande.');
    for (let p = 0; p < b.length;) {
      const at = { p };
      const n = Number(varint(b, at));
      const info = parse(b.subarray(at.p, at.p + n));
      p = at.p + n;
      const id = val(info, 1);
      msgs(info, 2).forEach((m, i) => {
        const length = Number(val(m, 3) ?? 0);
        if (!i) objects.set(id, { id, type: val(m, 1), data: parse(b.subarray(p, p + length)) });
        p += length;
      });
    }
  }
  return objects;
}
