import crypto from 'node:crypto';
import { HttpError } from './router.js';
import { cleanName } from './names.js';

// Usuarios (fase 35): cada persona con su nombre, su PIN de 4 cifras (guardado como huella, nunca tal cual), las
// funciones que puede usar y si es administrador de la iglesia (ve y edita todos los órdenes, entra en Ajustes y
// gestiona los usuarios). En data/usuarios.json. La primera vez, el PIN único de antes pasa a ser el del
// administrador, para que nadie se quede fuera.
export const FUNCTIONS = ['control', 'alabanza', 'presentador', 'orador-sencillo'];
export const validPin = (pin) => /^\d{4}$/.test(pin || '');
const hash = (pin, salt) => crypto.scryptSync(pin, salt, 32).toString('hex');
// Un PIN o una contraseña, guardado como huella con su sal; y si un texto es el guardado.
export const sealed = (pin) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hash(pin, salt) };
};
export const matches = (text, seal) => Boolean(seal) && typeof text === 'string' && crypto.timingSafeEqual(Buffer.from(hash(text, seal.salt), 'hex'), Buffer.from(seal.hash, 'hex'));
const key = (name) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Una ficha que llega de fuera (la nube o un equipo): solo lo que debe tener, y con la forma que debe tener.
const hex = (text, n) => typeof text === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(text);
function validRecord(r) {
  const name = cleanName(r?.name);
  if (!r || !hex(r.id, 12) || !name || !hex(r.pin?.salt, 32) || !hex(r.pin?.hash, 64)) return null;
  const admin = r.admin === true;
  const functions = admin ? [...FUNCTIONS] : FUNCTIONS.filter((f) => Array.isArray(r.functions) && r.functions.includes(f));
  return { id: r.id, name, admin, functions, pin: { salt: r.pin.salt, hash: r.pin.hash }, added: Number(r.added) || Date.now() };
}

export function createUsers({ storage, legacyPin = null }) {
  const store = storage('usuarios', { list: [] });
  const list = store.data.list;
  // Control del orden se quitó (decisión 69): quien solo la tenía queda sin función hasta que el administrador le dé otra.
  for (const u of list) u.functions = (u.functions || []).filter((f) => FUNCTIONS.includes(f));
  let created = null;
  if (!list.length) {
    const pin = validPin(legacyPin) ? legacyPin : String(crypto.randomInt(0, 10000)).padStart(4, '0');
    created = { id: crypto.randomBytes(6).toString('hex'), name: 'Administrador', admin: true, functions: [...FUNCTIONS], pin: sealed(pin), added: Date.now() };
    list.push(created);
    store.save();
  }
  // Hasta la 1.48, el administrador de la nube entraba con contraseña; desde la 1.49, con su PIN (decisión 64). Haberla
  // puesto cuenta como haber usado la clave de alta.
  if (list.some((u) => u.password)) {
    store.data.claimed ??= Date.now();
    for (const u of list) delete u.password;
    store.save();
  }

  const find = (id) => list.find((u) => u.id === id) || null;
  const view = ({ id, name, admin, functions }) => ({ id, name, admin, functions: admin ? [...FUNCTIONS] : functions });
  const cleanFunctions = (value) => {
    const chosen = Array.isArray(value) ? FUNCTIONS.filter((f) => value.includes(f)) : [];
    if (!chosen.length) throw new HttpError(400, 'Elige al menos una función para ese usuario.');
    return chosen;
  };
  const cleanUserName = (name, except = null) => {
    const clean = cleanName(name);
    if (!clean) throw new HttpError(400, 'Escribe el nombre del usuario.');
    if (list.some((u) => u.id !== except && key(u.name) === key(clean))) throw new HttpError(409, `Ya hay un usuario que se llama «${clean}».`);
    return clean;
  };
  const admins = () => list.filter((u) => u.admin);

  return {
    // El administrador que se creó al pasar del PIN único a los usuarios (para darle las sesiones de antes).
    created,
    list: () => list.map(view),
    get: (id) => (find(id) ? view(find(id)) : null),
    // El primero de los administradores: el que es el equipo principal, que entra sin PIN.
    firstAdmin: () => view(admins()[0]),
    check(id, pin) {
      const user = find(id);
      return Boolean(user) && validPin(pin) && matches(pin, user.pin);
    },
    // ¿Ya se usó la clave de alta (decisión 62)? Hasta entonces sirve.
    claimed: () => Boolean(store.data.claimed),
    claim() {
      store.data.claimed = Date.now();
      store.save();
    },
    create({ name, pin, functions, admin = false }) {
      if (!validPin(pin)) throw new HttpError(400, 'El PIN debe tener 4 números.');
      const user = { id: crypto.randomBytes(6).toString('hex'), name: cleanUserName(name), admin: admin === true, functions: admin === true ? [...FUNCTIONS] : cleanFunctions(functions), pin: sealed(pin), added: Date.now() };
      list.push(user);
      store.save();
      return view(user);
    },
    update(id, { name, functions, admin }) {
      const user = find(id);
      if (!user) throw new HttpError(404, 'Ese usuario ya no está.');
      if (admin === false && user.admin && admins().length === 1) throw new HttpError(409, 'Tiene que quedar al menos un administrador.');
      if (name !== undefined) user.name = cleanUserName(name, id);
      if (admin !== undefined) user.admin = admin === true;
      if (functions !== undefined || admin !== undefined) user.functions = user.admin ? [...FUNCTIONS] : cleanFunctions(functions ?? user.functions);
      store.save();
      return view(user);
    },
    setPin(id, pin) {
      const user = find(id);
      if (!user) throw new HttpError(404, 'Ese usuario ya no está.');
      if (!validPin(pin)) throw new HttpError(400, 'El PIN debe tener 4 números.');
      user.pin = sealed(pin);
      store.save();
    },
    // La sincronización con la nube (fase 37, parte 3). records: las fichas enteras, con la huella del PIN.
    records: () => list.map((user) => structuredClone(user)),
    // Junta los de un equipo que se empareja: el que ya está con ese nombre se queda (la nube manda); los demás entran
    // tal cual. Devuelve { idDelEquipo: idDeLaNube } de los que eran la misma persona con otro identificador.
    merge(records) {
      const same = {};
      for (const r of records.map(validRecord).filter(Boolean)) {
        const found = list.find((u) => key(u.name) === key(r.name));
        if (found) {
          if (found.id !== r.id) same[r.id] = found.id;
          continue;
        }
        if (list.some((u) => u.id === r.id)) r.id = crypto.randomBytes(6).toString('hex');
        list.push(r);
      }
      store.save();
      return same;
    },
    // La copia del equipo: la lista entera de la nube (con al menos un administrador). Devuelve los que ya no están.
    replace(records) {
      const next = records.map(validRecord).filter(Boolean);
      if (!next.some((u) => u.admin)) throw new HttpError(409, 'La lista de la nube no trae ningún administrador.');
      const gone = list.filter((u) => !next.some((n) => n.id === u.id)).map((u) => u.id);
      list.splice(0, list.length, ...next);
      store.save();
      return gone;
    },
    remove(id) {
      const user = find(id);
      if (!user) throw new HttpError(404, 'Ese usuario ya no está.');
      if (user.admin && admins().length === 1) throw new HttpError(409, 'Tiene que quedar al menos un administrador.');
      list.splice(list.indexOf(user), 1);
      store.save();
    },
  };
}
