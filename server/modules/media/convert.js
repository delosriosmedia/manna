import fs from 'node:fs';
import { encodersFor, ffmpegArgs, readProbe, readProgress } from './clips.js';

// Lo que Medios le pide a ffmpeg: mirar qué hay dentro de un archivo, sacarle una imagen y
// convertirlo. Las conversiones van de una en una, en segundo plano, como tareas con su avance
// (app.jobs): nada de esto hace esperar a quien pulsó el botón.
//
// Sin ffmpeg en el equipo, probe() devuelve undefined y nada más se puede hacer: el módulo
// sigue funcionando con los archivos que el navegador reproduce tal cual.
export function createConverter(app) {
  const { tools } = app;
  const queue = [];       // { task, job }
  let running = null;     // { task, job, child }
  let encoders = null;
  let closed = false;

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
    const tries = task.plan.video === 'encode' ? await candidates() : ['libx264'];
    let last = '';
    for (const encoder of tries) {
      if (running?.cancelled || closed) break;
      const args = ffmpegArgs(task.plan, { input: task.input, output: partial, kind: task.kind, encoder, width: task.width || 0 });
      const result = await run('ffmpeg', args, {
        onChild: (child) => { running.child = child; },
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
    return { ok: false, cancelled: Boolean(running?.cancelled) || closed, error: last };
  }

  async function next() {
    if (running || closed || !queue.length) return;
    running = queue.shift();
    const { task, job } = running;
    job.update({ detail: task.plan.video === 'encode' || task.kind === 'audio' ? 'Convirtiendo' : 'Cambiando el formato' });
    const result = await work(running);
    running = null;
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
        running.child?.kill();
      }
    },
    busy: (id) => running?.task.id === id || queue.some((entry) => entry.task.id === id),
    close() {
      closed = true;
      running?.child?.kill();
    },
  };
}
