import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readImageInfo } from '../../core/images.js';

// PowerPoint convierte una presentación en imágenes, una por diapositiva. Manna no abre el
// archivo por su cuenta: se lo pide al PowerPoint del equipo principal, que es quien mejor lo
// dibuja (tipografías, gráficos, SmartArt).
//
//   Windows  PowerShell habla con PowerPoint (automatización de Office) y le pide exportar cada
//            diapositiva. La presentación se abre sin ventana; si PowerPoint ya estaba abierto
//            con otras, no se cierra.
//   Mac      osascript se lo pide por AppleScript. PowerPoint se abre a la vista un momento, y la
//            primera vez macOS pregunta si Manna puede controlarlo. PowerPoint en Mac solo puede
//            leer y escribir en sus propias carpetas sin pedir permiso archivo por archivo: se
//            trabaja en una de ellas y luego se trae el resultado.
//
// Las rutas viajan en variables de entorno (Windows) o como argumentos (Mac): nunca se pegan en
// el texto de la orden.
//
// Lo que el guion de cada sistema deja en la carpeta de salida: 1.jpg, 2.jpg… y, si puede, sus
// miniaturas m1.jpg, m2.jpg… Lo que va diciendo: "MANNA<tab>total<tab>N" y "MANNA<tab>slide<tab>i".

export const PRESENTATION_EXTENSIONS = ['.pptx', '.ppsx', '.pptm', '.ppsm', '.ppt', '.pps'];
const MARK = 'MANNA';
// Lado mayor de cada diapositiva exportada, y ancho de su miniatura.
export const SLIDE_SIDE = 2560;
export const THUMB_SIDE = 320;
const TOTAL_LIMIT_MS = 20 * 60 * 1000;

// ¿Es una presentación de PowerPoint? Se mira el principio del archivo, no su nombre: las
// modernas (.pptx) son un ZIP; las antiguas (.ppt), un documento compuesto de Office.
export function isPresentation(head) {
  if (!head || head.length < 8) return false;
  const zip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const old = head.readUInt32BE(0) === 0xd0cf11e0 && head.readUInt32BE(4) === 0xa1b11ae1;
  return zip || old;
}

// Windows. ReadOnly = sí (-1), Untitled = no (0), WithWindow = no (0): se abre sin que se vea.
// Las diapositivas ocultas no se exportan, como no saldrían en la presentación.
export const WIN_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$entrada = $env:MANNA_PPT_ENTRADA
$salida = $env:MANNA_PPT_SALIDA
$lado = [int]$env:MANNA_PPT_LADO
$mini = [int]$env:MANNA_PPT_MINIATURA
$ppt = New-Object -ComObject PowerPoint.Application
$abiertas = $ppt.Presentations.Count
$deck = $ppt.Presentations.Open($entrada, -1, 0, 0)
try {
  $w = $deck.PageSetup.SlideWidth
  $h = $deck.PageSetup.SlideHeight
  if ($w -ge $h) { $ancho = $lado; $alto = [int][math]::Round($lado * $h / $w) } else { $alto = $lado; $ancho = [int][math]::Round($lado * $w / $h) }
  $altoMini = [int][math]::Round($mini * $h / $w)
  $visibles = @($deck.Slides | Where-Object { $_.SlideShowTransition.Hidden -eq 0 })
  Write-Output ("${MARK}\`ttotal\`t" + $visibles.Count)
  $i = 0
  foreach ($slide in $visibles) {
    $i++
    $slide.Export((Join-Path $salida "$i.jpg"), 'JPG', $ancho, $alto)
    $slide.Export((Join-Path $salida "m$i.jpg"), 'JPG', $mini, $altoMini)
    Write-Output ("${MARK}\`tslide\`t" + $i)
  }
} finally {
  $deck.Close()
  if ($abiertas -eq 0 -and $ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($ppt)
}
`;

// Mac. Recibe dos argumentos: la presentación y la carpeta donde dejar las imágenes (PowerPoint
// la crea, con un archivo por diapositiva). Si PowerPoint no estaba abierto, se cierra al terminar.
export const MAC_SCRIPT = `
on run argv
  set entrada to POSIX file (item 1 of argv)
  set salida to POSIX file (item 2 of argv)
  set estabaAbierto to application "Microsoft PowerPoint" is running
  tell application "Microsoft PowerPoint"
    launch
    with timeout of 900 seconds
      open entrada
      set deck to active presentation
      set total to count of slides of deck
      save deck in salida as save as JPG
      close deck saving no
    end timeout
    if not estabaAbierto then quit
  end tell
  return "${MARK}" & tab & "total" & tab & total
end run
`;

// Carpeta propia de PowerPoint en Mac, donde puede leer y escribir sin preguntar.
export const macWorkDir = (home = os.homedir()) => path.join(home, 'Library', 'Group Containers', 'UBF8T346G9.Office', 'Manna');

// Qué se lanza en cada sistema para exportar `input` a la carpeta `dir`.
//   fake: guion de mentira para las pruebas (MANNA_POWERPOINT_PRUEBA); se ejecuta con Node.
// Devuelve { file, args, env } o null si en este sistema no se puede.
export function exportPlan(platform, { input, dir, fake = null }) {
  const env = { MANNA_PPT_ENTRADA: input, MANNA_PPT_SALIDA: dir, MANNA_PPT_LADO: String(SLIDE_SIDE), MANNA_PPT_MINIATURA: String(THUMB_SIDE) };
  if (fake) return { file: process.execPath, args: [fake], env };
  // El guion va codificado (como pide PowerShell: UTF-16 en base64), para que ni las comillas ni
  // los saltos de línea dependan de cómo arma Windows la línea de órdenes.
  if (platform === 'win32') return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WIN_SCRIPT, 'utf16le').toString('base64')], env };
  if (platform === 'darwin') return { file: 'osascript', args: ['-e', MAC_SCRIPT, input, dir], env: {} };
  return null;
}

// Lo que dice una línea del guion: { total }, { slide } o null.
export function readLine(line) {
  const [mark, what, value] = String(line).trim().split('\t');
  const n = Number(value);
  if (mark !== MARK || !Number.isInteger(n) || n < 0) return null;
  return what === 'total' ? { total: n } : what === 'slide' ? { slide: n } : null;
}

// Las imágenes que hay en una carpeta, en el orden de las diapositivas: [{ file, thumb }].
// Vale para lo que deja el guion de Windows ("3.jpg", "m3.jpg") y para lo que deja PowerPoint en
// Mac ("Slide3.jpeg", o "Diapositiva3.jpeg" con Office en español): manda el número del nombre.
export function collect(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const pages = new Map();
  const thumbs = new Map();
  for (const name of names) {
    const found = /^(.*?)(\d+)\.(jpe?g|png)$/i.exec(name);
    if (!found) continue;
    (found[1] === 'm' ? thumbs : pages).set(Number(found[2]), path.join(dir, name));
  }
  return [...pages.keys()].sort((a, b) => a - b).map((n) => ({ file: pages.get(n), thumb: thumbs.get(n) || null }));
}

// Por qué falló, dicho para quien usa Manna.
export function explain(stderr, platform = process.platform) {
  const text = String(stderr || '');
  // En Mac, PowerPoint abierto pero mudo: macOS está preguntando en pantalla si Manna puede controlarlo, o PowerPoint espera una respuesta.
  if (/-1712|Tiempo límite agotado|timed out/i.test(text)) return 'PowerPoint no respondió. Si macOS pregunta si Manna puede controlar PowerPoint, acéptalo y vuelve a subirla; si PowerPoint muestra una ventana, ciérrala. También puedes guardarla como PDF y subir el PDF.';
  if (/-1743|not authori[sz]ed to send Apple events|no tiene autorización/i.test(text)) return 'macOS no deja que Manna use PowerPoint. Permítelo en Ajustes del Sistema → Privacidad y seguridad → Automatización, o guarda la presentación como PDF y sube el PDF.';
  if (/80040154|class not registered|clase no registrada|Retrieving the COM class factory/i.test(text)) return 'PowerPoint no respondió: puede que no esté instalado del todo. Guarda la presentación como PDF y sube el PDF.';
  if (/password|contraseña/i.test(text)) return 'La presentación está protegida con contraseña. Quítasela, o guárdala como PDF y sube el PDF.';
  return `PowerPoint no pudo convertir esta presentación${platform === 'darwin' ? ' (puede que esté esperando una respuesta en su ventana)' : ''}. Guárdala como PDF (Archivo → Exportar) y sube el PDF.`;
}

// Miniatura de una imagen con lo que trae macOS (sips). true si quedó hecha.
function macThumb(from, to) {
  return new Promise((resolve) => {
    const child = spawn('sips', ['-s', 'format', 'jpeg', '-Z', String(THUMB_SIDE), from, '--out', to], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0 && fs.existsSync(to)));
  });
}

// Convierte presentaciones, de una en una, como tareas con avance.
//   run({ id, name, input, dir, onDone({ ok, pages: [{ file, thumb }], error, cancelled }) })
//   dir: carpeta (vacía) donde quedan las imágenes; el archivo de entrada no se toca.
export function createExporter(app, { platform = process.platform } = {}) {
  const queue = [];
  let running = null; // { task, job, child, cancelled }
  let closed = false;
  const fake = process.env.MANNA_POWERPOINT_PRUEBA || null;

  function launch(plan, onLine) {
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(plan.file, plan.args, { env: { ...process.env, ...plan.env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (err) { resolve({ code: -1, err: err.message }); return; }
      if (running) running.child = child;
      const limit = setTimeout(() => child.kill(), TOTAL_LIMIT_MS);
      let err = '';
      let pending = '';
      child.stdout.on('data', (chunk) => {
        const lines = (pending + chunk).split('\n');
        pending = lines.pop();
        lines.forEach(onLine);
      });
      child.stderr.on('data', (chunk) => { err = (err + chunk).slice(-3000); });
      child.on('error', (e) => { clearTimeout(limit); resolve({ code: -1, err: e.message }); });
      child.on('close', (code) => { clearTimeout(limit); onLine(pending); resolve({ code, err }); });
    });
  }

  async function next() {
    if (running || closed || !queue.length) return;
    running = queue.shift();
    const current = running;
    const { task, job } = current;
    job.update({ detail: platform === 'darwin' && !fake ? 'Abriendo PowerPoint (si macOS pregunta, permite que Manna lo controle)' : 'Abriendo PowerPoint' });
    fs.mkdirSync(task.dir, { recursive: true });

    // En Mac se trabaja dentro de la carpeta de PowerPoint y luego se trae el resultado.
    const mac = platform === 'darwin' && !fake;
    const work = mac ? path.join(macWorkDir(), task.id) : null;
    let input = task.input;
    let out = task.dir;
    let result = { code: -1, err: '' };
    try {
      if (mac) {
        fs.rmSync(work, { recursive: true, force: true });
        fs.mkdirSync(work, { recursive: true });
        input = path.join(work, `entrada${path.extname(task.input)}`);
        fs.copyFileSync(task.input, input);
        out = path.join(work, 'salida');
      }
      const plan = exportPlan(platform, { input, dir: out, fake });
      if (!plan) result = { code: -1, err: 'sistema sin PowerPoint' };
      else {
        let total = 0;
        result = await launch(plan, (line) => {
          const said = readLine(line);
          if (said?.total) total = said.total;
          if (said?.slide && total) job.update({ progress: Math.min(0.99, said.slide / total), detail: `Diapositiva ${said.slide} de ${total}` });
        });
      }
      if (mac && result.code === 0) {
        // PowerPoint deja "Slide1.jpeg"…: se traen con su número y se les hace la miniatura.
        const made = collect(out);
        for (const [i, page] of made.entries()) {
          fs.copyFileSync(page.file, path.join(task.dir, `${i + 1}.jpg`));
          await macThumb(page.file, path.join(task.dir, `m${i + 1}.jpg`));
        }
      }
    } catch (err) {
      result = { code: -1, err: err.message };
    } finally {
      if (work) fs.rmSync(work, { recursive: true, force: true });
    }

    const pages = result.code === 0 ? collect(task.dir).filter((page) => readImageInfo(page.file)) : [];
    const ok = pages.length > 0 && !current.cancelled && !closed;
    running = null;
    if (ok) job.done('Listo');
    else if (current.cancelled || closed) job.done('Cancelado');
    else job.fail(explain(result.err, platform));
    task.onDone({ ok, pages, cancelled: current.cancelled || closed, error: ok ? null : explain(result.err, platform) });
    next();
  }

  // Quita los avisos que dejaron las conversiones de esa presentación que ya terminaron.
  const forget = (id) => {
    for (const old of app.jobs.list()) if (old.owner === 'slides' && old.ref === id && old.state !== 'running') app.jobs.dismiss(old.id);
  };

  return {
    forget,
    run(task) {
      const job = app.jobs.start({ title: `Convirtiendo «${task.name}»`, detail: 'En cola', owner: 'slides', ref: task.id });
      queue.push({ task, job });
      next();
      return job;
    },
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
