import { EventEmitter } from 'node:events';

// Estado compartido, dividido por módulo ("espacio"). Cada cambio se emite a todos los dispositivos.
// Un espacio con `view` no es igual para todos (los órdenes de cada persona, fase 35): view(estado, sesión) dice lo que
// recibe cada sesión, en el tiempo real y en GET /api/state.
export class Store extends EventEmitter {
  #state = {};
  #views = new Map();

  register(ns, initial, { view } = {}) {
    this.#state[ns] = initial;
    if (view) this.#views.set(ns, view);
  }

  personal(ns) {
    return this.#views.has(ns);
  }

  view(ns, session) {
    const view = this.#views.get(ns);
    return view ? view(this.#state[ns], session) : this.#state[ns];
  }

  snapshotFor(session) {
    return Object.fromEntries(Object.keys(this.#state).map((ns) => [ns, this.view(ns, session)]));
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
