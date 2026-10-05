import fs from 'node:fs';
import os from 'node:os';
import { attemptsFor, encodersFor, ffmpegArgs, readProbe, readProgress } from './clips.js';

// Lo que Medios le pide a ffmpeg: mirar qué hay dentro de un archivo, sacarle una imagen y
// convertirlo. Las conversiones van de una en una, en segundo plano, como tareas con su avance
// (app.jobs): nada de esto hace esperar a quien pulsó el botón.
//
// Sin ffmpeg en el equipo, probe() devuelve undefined y nada más se puede hacer: el módulo
// sigue funcionando con los archivos que el navegador reproduce tal cual.
//
// Una conversión nunca debe estorbar a lo que está sonando en pantalla: corre con prioridad baja
// y, mientras algo se reproduce (hold(true)), se detiene. En macOS y Linux el proceso se congela
// y luego sigue por donde iba; Windows no deja congelarlo, así que ahí se corta y se vuelve a
// empezar después (pause: 'restart').
export function createConverter(app, { pause = process.platform === 'win32' ? 'restart' : 'freeze', delay = 0 } = {}) {
  const { tools } = app;
  const queue = [];       // { task, job }
  let running = null;     // { task, job, child, cancelled, interrupted }
  let encoders = null;
  let closed = false;
  let held = false;

  // Ejecuta ffmpeg o ffprobe y junta lo que escriben. onOut recibe la salida según llega.
  function run(binary, args, { onOut, onChild } = {}) {
    return new Promise((resolve) => {
      let child;
      try { child = tools.spawn('ffmpeg', args, { binary }); } catch (err) { resolve({ code: -1, out: '', err: err.message }); return; }
      onChild?.(child);
      let out = '';
      let err = '';
      child.stdout.on('data', (chunk) => { if (onOut) onOut(chunk.toString()); else out += chunk; });
      child.stderr.on('data', (chunk) => { err = (err + chunk).slice(-2000); });
      child.on('error', (e) => resolve({ code: -1, out, err: e.message }));
      child.on('close', (code) => resolve({ code, out, err }));
    });
  }

  // Qué hay dentro del archivo (ver readProbe). null: no es ni video ni audio.
  // undefined: no se pudo mirar porque falta ffmpeg.
  async function probe(file) {
    if (!tools.has('ffmpeg')) return undefined;
    const result = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
    return result.code === 0 ? readProbe(result.out) : null;
  }

  // Guarda una imagen del video (a los `at` segundos) como JPG pequeño. true si quedó hecha.
  async function poster(input, output, at = 1) {
    if (!tools.has('ffmpeg')) return false;
    const result = await run('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-ss', String(Math.max(0, at)), '-i', input,
      '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', output]);
    return result.code === 0 && fs.existsSync(output);
  }

  async function candidates() {
    if (!encoders) encoders = encodersFor(process.platform, (await run('ffmpeg', ['-hide_banner', '-encoders'])).out);
    return encoders;
  }

  async function work({ task, job }) {
    const partial = `${task.output}.parcial`;
    // Solo al recodificar la imagen hay varios codificadores que probar: el chip de video puede
    // estar en la lista de ffmpeg y aun así no funcionar en este equipo.
    const tries = task.plan.video === 'encode' ? attemptsFor(await candidates()) : [{ encoder: 'libx264', hwaccel: false }];
    let last = '';
    for (const { encoder, hwaccel } of tries) {
      if (running?.cancelled || running?.interrupted || closed) break;
      const args = ffmpegArgs(task.plan, { input: task.input, output: partial, kind: task.kind, encoder, hwaccel, width: task.width || 0 });
      const result = await run('ffmpeg', args, {
        onChild(child) {
          running.child = child;
          // Que el equipo atienda primero a todo lo demás (el navegador que proyecta, sobre todo).
          try { os.setPriority(child.pid, os.constants.priority.PRIORITY_LOW); } catch { /* el sistema no deja: sigue con la normal */ }
          if (held) freeze();
        },
        onOut: (text) => {
          const at = readProgress(text);
          if (at != null && task.duration) job.update({ progress: at / task.duration });
        },
      });
      if (result.code === 0 && !running?.cancelled) {
        fs.renameSync(partial, task.output);
        return { ok: true };
      }
      last = result.err.trim().split('\n').pop() || '';
    }
    fs.rmSync(partial, { force: true });
    return { ok: false, cancelled: Boolean(running?.cancelled) || closed, interrupted: Boolean(running?.interrupted), error: last };
  }

  const label = (task) => (task.plan.video === 'encode' || task.kind === 'audio' ? 'Convirtiendo' : 'Cambiando el formato');
  const WAITING = 'En pausa mientras se reproduce';
  function freeze() {
    if (!running?.child || running.frozen) return;
    if (pause === 'freeze') {
      try { running.child.kill('SIGSTOP'); running.frozen = true; } catch { /* no se pudo: sigue a su ritmo */ }
    } else {
      running.interrupted = true;
      running.child.kill();
    }
    running.job.update({ detail: WAITING });
  }
  function thaw() {
    if (!running?.frozen) return;
    try { running.child.kill('SIGCONT'); } catch { /* ya terminó */ }
    running.frozen = false;
    running.job.update({ detail: label(running.task) });
  }

  async function next() {
    if (running || closed || held || !queue.length) return;
    running = queue.shift();
    const { task, job } = running;
    if (delay) await new Promise((resolve) => { setTimeout(resolve, delay); });
    job.update({ detail: label(task) });
    const current = running;
    const result = held && !current.cancelled ? { ok: false, interrupted: true } : await work(current);
    running = null;
    // Se cortó para ceder el paso: vuelve a la cola, la primera, y empezará de nuevo.
    if (result.interrupted && !result.cancelled && !closed) {
      job.update({ progress: 0, detail: WAITING });
      queue.unshift(current);
      Object.assign(current, { child: null, interrupted: false, frozen: false });
      next();
      return;
    }
    if (result.ok) job.done('Listo');
    else if (result.cancelled) job.done('Cancelado');
    else job.fail('No se pudo convertir este archivo.');
    task.onDone(result);
    next();
  }

  return {
    probe,
    poster,
    // task: { id, name, input, output, kind, plan, duration, width, onDone({ ok, cancelled, error }) }
    enqueue(task) {
      const job = app.jobs.start({ title: `Preparando «${task.name}»`, detail: 'En cola', owner: 'media', ref: task.id });
      queue.push({ task, job });
      next();
    },
    // Deja de convertir ese elemento (porque se eliminó).
    cancel(id) {
      const waiting = queue.findIndex((entry) => entry.task.id === id);
      if (waiting >= 0) queue.splice(waiting, 1)[0].job.done('Cancelado');
      if (running?.task.id === id) {
        running.cancelled = true;
        if (running.frozen) { try { running.child.kill('SIGCONT'); } catch { /* ya terminó */ } }
        running.child?.kill();
      }
    },
    busy: (id) => running?.task.id === id || queue.some((entry) => entry.task.id === id),
    // Cede el paso (true) mientras algo se reproduce en pantalla, y sigue (false) cuando deja de hacerlo.
    hold(value) {
      if (held === Boolean(value)) return;
      held = Boolean(value);
      // Lo que espera su turno también dice por qué espera.
      for (const entry of queue) entry.job.update({ detail: held ? WAITING : 'En cola' });
      if (held) {
        if (running && !running.child) running.job.update({ detail: WAITING });
        freeze();
      } else {
        thaw();
        next();
      }
    },
    close() {
      closed = true;
      // Un proceso congelado no atiende la orden de terminar: primero se descongela.
      if (running?.frozen) { try { running.child.kill('SIGCONT'); } catch { /* ya terminó */ } }
      running?.child?.kill();
    },
  };
}
