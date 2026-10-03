import { EventEmitter } from 'node:events';

// Estado compartido, dividido por módulo ("espacio"). Cada cambio se emite a todos los dispositivos.
export class Store extends EventEmitter {
  #state = {};

  register(ns, initial) {
    this.#state[ns] = initial;
  }

  get(ns) {
    return this.#state[ns];
  }

  snapshot() {
    return this.#state;
  }

  set(ns, patch) {
    this.#state[ns] = { ...this.#state[ns], ...patch };
    this.emit('change', ns, this.#state[ns]);
  }
}
