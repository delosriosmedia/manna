import crypto from 'node:crypto';
import { HttpError } from './router.js';
import { cleanName } from './names.js';

// Usuarios (fase 35): cada persona con su nombre, su PIN de 4 cifras (guardado como huella, nunca tal cual), las
// funciones que puede usar y si es administrador de la iglesia (ve y edita todos los órdenes, entra en Ajustes y
// gestiona los usuarios). En data/usuarios.json. La primera vez, el PIN único de antes pasa a ser el del
// administrador, para que nadie se quede fuera.
export const FUNCTIONS = ['control', 'alabanza', 'orden', 'presentador'];
export const validPin = (pin) => /^\d{4}$/.test(pin || '');
// La del administrador en la nube (fase 36): entra desde internet a gestionar los usuarios, así que no basta un PIN.
export const PASSWORD_MIN = 10;
const hash = (pin, salt) => crypto.scryptSync(pin, salt, 32).toString('hex');
const sealed = (pin) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hash(pin, salt) };
};
const key = (name) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function createUsers({ storage, legacyPin = null }) {
  const store = storage('usuarios', { list: [] });
  const list = store.data.list;
  let created = null;
  if (!list.length) {
    const pin = validPin(legacyPin) ? legacyPin : String(crypto.randomInt(0, 10000)).padStart(4, '0');
    created = { id: crypto.randomBytes(6).toString('hex'), name: 'Administrador', admin: true, functions: [...FUNCTIONS], pin: sealed(pin), added: Date.now() };
    list.push(created);
    store.save();
  }

  const find = (id) => list.find((u) => u.id === id) || null;
  const view = ({ id, name, admin, functions, password }) => ({ id, name, admin, functions: admin ? [...FUNCTIONS] : functions, password: Boolean(password) });
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
      if (!user || !validPin(pin)) return false;
      return crypto.timingSafeEqual(Buffer.from(hash(pin, user.pin.salt), 'hex'), Buffer.from(user.pin.hash, 'hex'));
    },
    checkPassword(id, password) {
      const user = find(id);
      if (!user?.admin || !user.password || typeof password !== 'string' || !password) return false;
      return crypto.timingSafeEqual(Buffer.from(hash(password, user.password.salt), 'hex'), Buffer.from(user.password.hash, 'hex'));
    },
    setPassword(id, password) {
      const user = find(id);
      if (!user) throw new HttpError(404, 'Ese usuario ya no está.');
      if (!user.admin) throw new HttpError(400, 'Solo un administrador tiene contraseña.');
      if (typeof password !== 'string' || password.length < PASSWORD_MIN) throw new HttpError(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
      user.password = sealed(password);
      store.save();
    },
    // ¿Ya hay algún administrador con contraseña? Hasta entonces sirve la clave de alta (decisión 62).
    hasPassword: () => list.some((u) => u.admin && u.password),
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
    remove(id) {
      const user = find(id);
      if (!user) throw new HttpError(404, 'Ese usuario ya no está.');
      if (user.admin && admins().length === 1) throw new HttpError(409, 'Tiene que quedar al menos un administrador.');
      list.splice(list.indexOf(user), 1);
      store.save();
    },
  };
}
