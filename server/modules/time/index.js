import crypto from 'node:crypto';
import { HttpError } from '../../core/router.js';
import { applyClock } from '../../core/playback.js';
import { adjustClock, cleanData, cleanTimer, clockText, newClock } from './clock.js';

// Módulo Tiempo (fase 32 de docs/PLAN.md): la hora, cronómetros y temporizadores, para proyectar o para poner en una
// capa. La hora no se guarda (es la del equipo principal); los cronómetros y temporizadores sí, en data/tiempo.json:
// { id, type: 'timer' | 'stopwatch', title, seconds, sound, clock, added, updated }. Cada uno lleva su reloj en el
// servidor (core/playback.js): corre aunque no esté a la vista, sigue contando si Manna se reinicia, y todas las
// pantallas ven el mismo segundo. Lo que se ve (estilo, tamaño, sitio) va en el data del tipo `clock` (clock.js).

const MAX_TIMERS = 100;

export default function setup(app) {
  const { store } = app;
  const saved = app.storage('tiempo', { timers: [] });
  const timers = () => saved.data.timers;
  const find = (id) => {
    const timer = timers().find((t) => t.id === id);
    if (!timer) throw new HttpError(404, 'Ese reloj ya no está.');
    return timer;
  };
  const publish = () => store.set('time', { timers: [...timers()].sort((a, b) => a.added - b.added) });
  store.register('time', { timers: [] });
  publish();
  const commit = () => {
    saved.save();
    publish();
    // Lo que se ve de uno que está al aire o en una capa (su nombre) cambia con él.
    app.services.projection?.refresh();
    app.services.layers?.refresh();
  };

  // Crea uno (sin id) o cambia el que se diga. Cambiar lo que dura un temporizador lo deja otra vez en su principio.
  app.action('time.save', { permission: 'time.edit' }, ({ id, type, title, seconds, sound } = {}) => {
    if (id) {
      const timer = find(id);
      const clean = cleanTimer({ type: timer.type, title, seconds, sound });
      const longer = clean.seconds !== timer.seconds;
      Object.assign(timer, clean, { updated: Date.now() });
      if (longer) timer.clock = newClock(timer, Date.now());
      commit();
      return { id };
    }
    if (timers().length >= MAX_TIMERS) throw new HttpError(409, `Ya hay ${MAX_TIMERS} relojes guardados. Elimina alguno que no uses.`);
    const now = Date.now();
    const timer = { id: crypto.randomBytes(5).toString('hex'), ...cleanTimer({ type, title, seconds, sound }), added: now, updated: now };
    timer.clock = newClock(timer, now);
    timers().push(timer);
    commit();
    return { id: timer.id };
  });

  app.action('time.remove', { permission: 'time.edit' }, ({ id } = {}) => {
    find(id);
    saved.data.timers = timers().filter((t) => t.id !== id);
    commit();
  });

  // Empezar, parar, volver al principio y sumar o restar minutos: lo pueden hacer todas las funciones que proyectan.
  const control = (change) => ({ id, minutes } = {}) => {
    const timer = find(id);
    timer.clock = change(timer.clock, Date.now(), minutes);
    saved.save();
    publish();
  };
  app.action('time.start', { permission: 'projection.control' }, control((clock, now) => applyClock(clock, { playing: true }, now)));
  app.action('time.pause', { permission: 'projection.control' }, control((clock, now) => applyClock(clock, { playing: false }, now)));
  app.action('time.reset', { permission: 'projection.control' }, control((clock, now) => applyClock(clock, { restart: true, playing: false }, now)));
  app.action('time.adjust', { permission: 'projection.control' }, control((clock, now, minutes) => adjustClock(clock, minutes, now)));

  // ---- Tipo de contenido ----
  // data = { type: 'hora', style, size, place, look, format } o { id, style, size, place, look }. Un solo paso. La
  // cuenta no va en lo que se proyecta: cada pantalla la lee del espacio `time`, así que empezar o parar no reenvía nada.
  const describe = (data) => {
    const clean = cleanData(data);
    if (clean.type === 'hora') return { clean, title: 'Hora', subtitle: 'Reloj' };
    const timer = timers().find((t) => t.id === clean.id);
    if (!timer) return null;
    return { clean, timer, title: timer.title, subtitle: timer.type === 'timer' ? `Temporizador · ${clockText(timer.seconds)}` : 'Cronómetro' };
  };
  app.kind('clock', {
    label: 'Tiempo',
    layer: true,
    describe(data) {
      const found = describe(data);
      return found && { title: found.title, subtitle: found.subtitle, steps: 1, data: found.clean };
    },
    resolve(data) {
      const found = describe(data);
      return found && { ...found.clean, type: found.timer?.type ?? 'hora', title: found.title };
    },
  });

  // Un temporizador que se proyecta desde el orden del culto empieza solo si está en su principio (decisión 51).
  let shown = 0;
  store.on('change', (ns) => {
    if (ns !== 'projection') return;
    const item = store.get('projection').item;
    if (!item || item.uid === shown) return;
    shown = item.uid;
    const timer = item.kind === 'clock' && item.source?.orderId && timers().find((t) => t.id === item.id);
    if (!timer || timer.clock.playing || timer.clock.position > 0) return;
    timer.clock = applyClock(timer.clock, { playing: true }, Date.now());
    saved.save();
    publish();
  });
}
