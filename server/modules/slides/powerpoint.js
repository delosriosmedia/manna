import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readImageInfo } from '../../core/images.js';
import { convertWithDeckCraft } from './deckcraft.js';

// PowerPoint convierte una presentación en imágenes, una por diapositiva. Manna no abre el
// archivo por su cuenta: se lo pide al PowerPoint del equipo principal, que es quien mejor lo
// dibuja (tipografías, gráficos, SmartArt).
//
//   Windows  PowerShell habla con PowerPoint (automatización de Office) y le pide exportar cada
//            diapositiva. La presentación se abre sin ventana; si PowerPoint ya estaba abierto
//            con otras, no se cierra.
//   Mac      osascript se lo pide por AppleScript. PowerPoint se abre a la vista un momento, y la
//            primera vez macOS pregunta si Manna puede controlarlo. Ahí PowerPoint no exporta
//            imágenes cuando se le pide así (responde que sí y no escribe nada: probado el
//            2026-10-10 con la 16.113), pero sí un PDF: lo guarda y sus páginas las convierte en
//            imágenes macOS (PDFKit). PowerPoint solo guarda donde se le ha dado permiso, y lo pide
//            en una ventana suya ("Conceder acceso al archivo"): el PDF va siempre a la misma
//            carpeta de Manna para que lo pida una sola vez. Su carpeta propia ya no sirve: macOS
//            no deja que otro programa entre en ella.
//
// Las rutas viajan en variables de entorno (Windows) o como argumentos (Mac): nunca se pegan en
// el texto de la orden.
//
// Lo que queda en la carpeta de salida: 1.jpg, 2.jpg… y, si se puede, sus miniaturas m1.jpg,
// m2.jpg… Lo que va diciendo cada guion: "MANNA<tab>total<tab>N" y "MANNA<tab>slide<tab>i".

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

// Mac. Recibe dos argumentos: la presentación y la carpeta donde dejar "salida.pdf". PowerPoint
// responde antes de haberlo guardado (y si le falta permiso sobre la carpeta, mientras lo pide):
// se espera a que el archivo aparezca. Si PowerPoint no estaba abierto, se cierra al terminar.
export const MAC_NO_ACCESS = 'MANNA_SIN_PERMISO';
export const MAC_SCRIPT = `
on run argv
  set entrada to POSIX file (item 1 of argv)
  set salida to (item 2 of argv) & "/salida.pdf"
  set estabaAbierto to application "Microsoft PowerPoint" is running
  tell application "Microsoft PowerPoint"
    launch
    with timeout of 900 seconds
      open entrada
      set deck to active presentation
      set total to count of slides of deck
      save deck in (POSIX file salida) as save as PDF
    end timeout
  end tell
  set hecho to false
  repeat 300 times
    try
      do shell script "test -s " & quoted form of salida
      set hecho to true
      exit repeat
    end try
    delay 1
  end repeat
  try
    tell application "Microsoft PowerPoint"
      close deck saving no
      if not estabaAbierto then quit
    end tell
  end try
  if not hecho then error "${MAC_NO_ACCESS}"
  return "${MARK}" & tab & "total" & tab & total
end run
`;

// Mac. Las páginas de un PDF, en imágenes (JavaScript de macOS, con PDFKit). Recibe el PDF, la
// carpeta de salida, el lado mayor de cada imagen y el de su miniatura.
export const MAC_PAGES_SCRIPT = `
ObjC.import('AppKit');
ObjC.import('Quartz');
function run(argv) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]));
  const out = $.NSFileHandle.fileHandleWithStandardOutput;
  const draw = (page, side, file) => {
    const size = page.boundsForBox($.kPDFDisplayBoxMediaBox).size;
    const k = side / Math.max(size.width, size.height);
    const image = page.thumbnailOfSizeForBox($.NSMakeSize(Math.round(size.width * k), Math.round(size.height * k)), $.kPDFDisplayBoxMediaBox);
    const jpg = $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation).representationUsingTypeProperties($.NSBitmapImageFileTypeJPEG, $({ NSImageCompressionFactor: 0.9 }));
    jpg.writeToFileAtomically(argv[1] + '/' + file, true);
  };
  for (let i = 0; i < doc.pageCount; i++) {
    draw(doc.pageAtIndex(i), Number(argv[2]), (i + 1) + '.jpg');
    draw(doc.pageAtIndex(i), Number(argv[3]), 'm' + (i + 1) + '.jpg');
    out.writeData($('${MARK}\\tslide\\t' + (i + 1) + '\\n').dataUsingEncoding($.NSUTF8StringEncoding));
  }
}
`;

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
// Manda el número del nombre ("3.jpg", y su miniatura "m3.jpg").
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
  if (text.includes(MAC_NO_ACCESS)) return 'PowerPoint necesita permiso para guardar en la carpeta de Manna. En su aviso «Conceder acceso al archivo» pulsa «Seleccionar…» y luego «Conceder acceso», y vuelve a subirla. También puedes guardarla como PDF y subir el PDF.';
  // En Mac, PowerPoint abierto pero mudo: macOS está preguntando en pantalla si Manna puede controlarlo, o PowerPoint espera una respuesta.
  if (/-1712|Tiempo límite agotado|timed out/i.test(text)) return 'PowerPoint no respondió. Si macOS pregunta si Manna puede controlar PowerPoint, acéptalo y vuelve a subirla; si PowerPoint muestra una ventana, ciérrala. También puedes guardarla como PDF y subir el PDF.';
  if (/-1743|not authori[sz]ed to send Apple events|no tiene autorización/i.test(text)) return 'macOS no deja que Manna use PowerPoint. Permítelo en Ajustes del Sistema → Privacidad y seguridad → Automatización, o guarda la presentación como PDF y sube el PDF.';
  if (/80040154|class not registered|clase no registrada|Retrieving the COM class factory/i.test(text)) return 'PowerPoint no respondió: puede que no esté instalado del todo. Guarda la presentación como PDF y sube el PDF.';
  if (/password|contraseña/i.test(text)) return 'La presentación está protegida con contraseña. Quítasela, o guárdala como PDF y sube el PDF.';
  return `PowerPoint no pudo convertir esta presentación${platform === 'darwin' ? ' (puede que esté esperando una respuesta en su ventana)' : ''}. Guárdala como PDF (Archivo → Exportar) y sube el PDF.`;
}

// ---- PowerPoint en vivo (solo Windows) ----
// La presentación la pasa el propio PowerPoint a pantalla completa en la pantalla de proyección, sobre la
// ventana de Manna: con sus videos, animaciones y transiciones. Mientras tanto queda abierto un PowerShell con
// la presentación (su ventana del editor, minimizada), que recibe órdenes de una línea por la entrada estándar
// ("orden<tab>valor<tab>n.º") y contesta por la salida ("MANNA<tab>qué<tab>valor<tab>n.º"):
//   ir n        la diapositiva n de las visibles (empieza el pase si no estaba)   → diapositiva n
//   siguiente   lo que sigue: una animación o la diapositiva siguiente           → diapositiva n, o fin
//   anterior                                                                      → diapositiva n, o inicio
//   parar       termina el pase; la presentación sigue abierta para volver pronto  → parado
//   punto x y   el punto rojo de «Señalar» encima del pase, en fracciones de la diapositiva (sin valor, se quita) → punto
// Sin órdenes, mira cada medio segundo dónde va, para seguir lo que se haga en el propio equipo, y lo dice sin
// n.º: diapositiva n (cambió), fin (alguien pasó de la última; se vuelve a ella tal como quedó) o parado (alguien
// cerró el pase).
// Al abrir dice "listo <visibles>"; cuando se le cierra la entrada, cierra la presentación (y PowerPoint, si no
// estaba abierto antes). Las diapositivas ocultas no cuentan, igual que al convertir.
// La ventana del pase se coloca con user32 en la primera pantalla que no es la principal (la misma regla que
// display.js), en píxeles de este mismo proceso: así no importa la escala de cada pantalla.
// La entrada se lee con un StreamReader propio: el lector de [Console]::In espera sin soltar aunque se le pida
// en segundo plano, y no dejaría mirar el pase entre orden y orden.
export const LIVE_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace Manna -Name Ventana -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int w, int h, uint flags);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
'@
try { if (-not [Manna.Ventana]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][Manna.Ventana]::SetProcessDPIAware() } } catch { [void][Manna.Ventana]::SetProcessDPIAware() }
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Windows.Forms;
// El punto rojo de «Señalar», encima del pase: una ventana transparente que no recibe clics ni se queda con el
// foco (si alguien hiciera clic en ella, PowerPoint saldría del pase). X e Y, en fracciones de la diapositiva.
public class MannaPunto : Form {
  public float X = -1, Y = -1;
  public Rectangle Diapositiva;
  public MannaPunto() {
    FormBorderStyle = FormBorderStyle.None;
    ShowInTaskbar = false;
    TopMost = true;
    StartPosition = FormStartPosition.Manual;
    BackColor = Color.Magenta;
    TransparencyKey = Color.Magenta;
    DoubleBuffered = true;
    AutoScaleMode = AutoScaleMode.None;
  }
  protected override CreateParams CreateParams {
    get { CreateParams p = base.CreateParams; p.ExStyle |= 0x80000 | 0x20 | 0x8000000 | 0x80; return p; }
  }
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override void OnPaint(PaintEventArgs e) {
    if (X < 0) return;
    int r = Math.Max(10, Diapositiva.Height / 40);
    int cx = Diapositiva.X + (int)(X * Diapositiva.Width);
    int cy = Diapositiva.Y + (int)(Y * Diapositiva.Height);
    using (SolidBrush borde = new SolidBrush(Color.White)) e.Graphics.FillEllipse(borde, cx - r - 3, cy - r - 3, 2 * r + 6, 2 * r + 6);
    using (SolidBrush rojo = new SolidBrush(Color.FromArgb(235, 40, 50))) e.Graphics.FillEllipse(rojo, cx - r, cy - r, 2 * r, 2 * r);
  }
}
'@
$punto = New-Object MannaPunto
function Decir($que, $valor, $n) { [Console]::Out.WriteLine("${MARK}\`t$que\`t$valor\`t$n"); [Console]::Out.Flush() }
$ppt = New-Object -ComObject PowerPoint.Application
$abiertas = $ppt.Presentations.Count
$deck = $null
$pase = $null
$ultima = 0
# Dónde va el pase: n (de las visibles), -1 si pasó de la última, 0 si no hay pase.
function Donde {
  if ($null -eq $script:pase) { return 0 }
  try {
    $vista = $script:pase.View
    if ($vista.State -eq 5) { return -1 }
    return [array]::IndexOf($visibles, [int]$vista.Slide.SlideIndex) + 1
  } catch { return 0 }
}
function Empezar {
  $pantalla = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
  if ($null -eq $pantalla) { throw 'No hay una segunda pantalla.' }
  $ajustes = $deck.SlideShowSettings
  $ajustes.ShowType = 1
  try { $ajustes.ShowPresenterView = 0 } catch {}
  $script:pase = $ajustes.Run()
  $b = $pantalla.Bounds
  $ventana = [IntPtr]::Zero
  try { $ventana = [IntPtr][long]$script:pase.HWND } catch {}
  if ($ventana -eq [IntPtr]::Zero) { $ventana = [Manna.Ventana]::FindWindow('screenClass', $null) }
  [void][Manna.Ventana]::SetWindowPos($ventana, [IntPtr](-1), $b.X, $b.Y, $b.Width, $b.Height, 0x40)
  [void][Manna.Ventana]::SetForegroundWindow($ventana)
  # La capa del punto, del tamaño de la pantalla y encima del pase; la diapositiva, entera dentro de ella.
  $sw = $deck.PageSetup.SlideWidth
  $sh = $deck.PageSetup.SlideHeight
  $k = [math]::Min($b.Width / $sw, $b.Height / $sh)
  $w = [int]($sw * $k)
  $h = [int]($sh * $k)
  $script:punto.Diapositiva = New-Object System.Drawing.Rectangle -ArgumentList ([int](($b.Width - $w) / 2)), ([int](($b.Height - $h) / 2)), $w, $h
  $script:punto.X = -1
  $script:punto.Bounds = $b
  $script:punto.Show()
  [void][Manna.Ventana]::SetWindowPos($script:punto.Handle, [IntPtr](-1), $b.X, $b.Y, $b.Width, $b.Height, 0x50)
}
# Tras pasar de la última, el pase queda en negro: se vuelve a ella tal como quedó (o se empieza de nuevo en ella).
function Volver {
  try { $script:pase.View.GotoSlide($visibles[-1], 0) } catch {
    try { $script:pase.View.Exit() } catch {}
    Empezar
    $script:pase.View.GotoSlide($visibles[-1])
  }
}
function Atender($linea) {
  $partes = $linea.Split("\`t")
  $orden = $partes[0]
  $n = $partes[2]
  try {
    if ($orden -eq 'punto') {
      $xy = "$($partes[1])".Split(' ')
      if ($xy.Count -eq 2) { $script:punto.X = [float]$xy[0]; $script:punto.Y = [float]$xy[1] } else { $script:punto.X = -1 }
      # Un clic o un cambio de diapositiva sube el pase por encima: la capa vuelve arriba, sin moverse ni activarse.
      [void][Manna.Ventana]::SetWindowPos($script:punto.Handle, [IntPtr](-1), 0, 0, 0, 0, 0x13)
      $script:punto.Invalidate()
      $script:punto.Update()
      Decir 'punto' '' $n
      return
    }
    $p = Donde
    if ($orden -eq 'parar') {
      $script:punto.Hide()
      if ($p -ne 0) { $script:pase.View.Exit() }
      $script:pase = $null
      $script:ultima = 0
      Decir 'parado' '' $n
      return
    }
    if ($p -eq -1) { Volver; $p = $visibles.Count }
    if ($orden -eq 'ir') {
      $destino = [int]$partes[1]
      if ($p -eq 0) { Empezar }
      if ((Donde) -ne $destino) { $script:pase.View.GotoSlide($visibles[$destino - 1]) }
    } elseif ($p -le 0) {
      Decir 'parado' '' $n
      return
    } else {
      $vista = $script:pase.View
      if ($orden -eq 'siguiente') {
        if ($p -eq $visibles.Count -and $vista.GetClickIndex() -ge $vista.GetClickCount()) { Decir 'fin' '' $n; return }
        $vista.Next()
      } elseif ($orden -eq 'anterior') {
        if ($p -eq 1 -and $vista.GetClickIndex() -le 0) { Decir 'inicio' '' $n; return }
        $vista.Previous()
      }
    }
    $p = Donde
    if ($p -eq -1) { Volver; $p = $visibles.Count }
    $script:ultima = $p
    Decir 'diapositiva' $p $n
  } catch {
    Decir 'error' ($_.Exception.Message -replace '\\s+', ' ') $n
  }
}
function Mirar {
  if ($null -eq $script:pase) { return }
  $p = Donde
  if ($p -eq 0) { $script:pase = $null; $script:ultima = 0; $script:punto.Hide(); Decir 'parado' '' ''; return }
  if ($p -eq -1) { Volver; $script:ultima = $visibles.Count; Decir 'fin' '' ''; return }
  if ($p -ne $script:ultima) { $script:ultima = $p; Decir 'diapositiva' $p '' }
}
try {
  # Con su ventana (sin ella PowerPoint puede negarse a empezar el pase), pero minimizada.
  $deck = $ppt.Presentations.Open($env:MANNA_PPT_ENTRADA, -1, 0, -1)
  try { $deck.Windows.Item(1).WindowState = 2 } catch {}
  $visibles = [int[]]@($deck.Slides | Where-Object { $_.SlideShowTransition.Hidden -eq 0 } | ForEach-Object { $_.SlideIndex })
  Decir 'listo' $visibles.Count ''
  $lector = New-Object System.IO.StreamReader ([Console]::OpenStandardInput())
  $leyendo = $lector.ReadLineAsync()
  # Cada décima de segundo atiende la capa del punto (una ventana necesita que alguien atienda sus mensajes) y
  # cada medio segundo mira por dónde va el pase.
  $vueltas = 0
  while ($true) {
    if ($leyendo.Wait(100)) {
      $linea = $leyendo.Result
      if ($null -eq $linea) { break }
      Atender $linea.TrimEnd("\`r", "\`n")
      $leyendo = $lector.ReadLineAsync()
    }
    # También con órdenes seguidas (el punto se mueve muchas veces por segundo).
    [System.Windows.Forms.Application]::DoEvents()
    $vueltas++
    if ($vueltas % 5 -eq 0) { try { Mirar } catch {} }
  }
} finally {
  try { $punto.Close() } catch {}
  try { if ((Donde) -ne 0) { $pase.View.Exit() } } catch {}
  if ($null -ne $deck) { try { $deck.Close() } catch {} }
  if ($abiertas -eq 0 -and $ppt.Presentations.Count -eq 0) { $ppt.Quit() }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($ppt)
}
`;

// Dónde se puede pasar en vivo: Windows con PowerPoint, o el PowerPoint de mentira de las pruebas.
export const liveSupported = (platform = process.platform) => platform === 'win32' || Boolean(process.env.MANNA_POWERPOINT_PRUEBA);

export function livePlan(platform, { input, fake = null }) {
  const env = { MANNA_PPT_ENTRADA: input };
  if (fake) return { file: process.execPath, args: [fake], env: { ...env, MANNA_PPT_MODO: 'vivo' } };
  if (platform === 'win32') return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(LIVE_SCRIPT, 'utf16le').toString('base64')], env };
  return null;
}

// Una línea del pase: { what, value, n } o null.
export function readLiveLine(line) {
  const [mark, what, value = '', n = ''] = String(line).trim().split('\t');
  return mark === MARK && what ? { what, value: Number(value) || 0, text: value, n } : null;
}

const OPEN_LIMIT_MS = 90_000; // abrir una presentación con videos puede tardar
const REPLY_LIMIT_MS = 10_000; // empezar el pase, lo que más tarda una orden

// Abre una presentación para pasarla en vivo. Devuelve null si en este sistema no se puede, o
//   { send(orden, valor) → Promise<{ what, value }>, close() }
// `send` contesta { what: 'cerrado' } si el PowerShell ya no está y { what: 'sinrespuesta' } si no contestó a
// tiempo (entonces se le da por colgado: una ventana de PowerPoint pidiendo algo lo deja así para siempre).
// onEvent({ what, value }): lo que dice sin que se le pregunte, y { what: 'cerrado', error } al terminar.
export function openLive({ input, onEvent, platform = process.platform }) {
  const plan = livePlan(platform, { input, fake: process.env.MANNA_POWERPOINT_PRUEBA || null });
  if (!plan) return null;
  let child;
  try {
    child = spawn(plan.file, plan.args, { env: { ...process.env, ...plan.env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    setTimeout(() => onEvent({ what: 'cerrado', error: err.message }));
    return { send: async () => ({ what: 'cerrado' }), close() {} };
  }
  const waiting = new Map();
  let count = 0;
  let err = '';
  let pending = '';
  let gone = false;
  let opened;
  const ready = new Promise((resolve) => { opened = resolve; });
  const openTimer = setTimeout(() => { if (!gone) { err += 'PowerPoint no abrió la presentación a tiempo.'; child.kill(); } }, OPEN_LIMIT_MS);
  child.stdout.on('data', (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    for (const line of lines) {
      const said = readLiveLine(line);
      if (!said) continue;
      if (said.what === 'listo') { clearTimeout(openTimer); opened(true); } else if (said.n && waiting.has(said.n)) waiting.get(said.n)(said);
      else onEvent(said);
    }
  });
  child.stderr.on('data', (chunk) => { err = (err + chunk).slice(-3000); });
  child.stdin.on('error', () => {}); // escribir a un PowerShell que acaba de cerrarse
  const end = (error) => {
    if (gone) return;
    gone = true;
    clearTimeout(openTimer);
    opened(false);
    for (const answer of waiting.values()) answer({ what: 'cerrado' });
    onEvent({ what: 'cerrado', error: error || err.trim() });
  };
  child.on('error', (e) => end(e.message));
  child.on('close', () => end());

  return {
    async send(order, value = '') {
      if (!(await ready) || gone) return { what: 'cerrado' };
      const n = String((count += 1));
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(n);
          err += `PowerPoint no contestó a «${order}».`;
          child.kill();
          resolve({ what: 'sinrespuesta' });
        }, REPLY_LIMIT_MS);
        waiting.set(n, (said) => { clearTimeout(timer); waiting.delete(n); resolve(said); });
        child.stdin.write(`${order}\t${value}\t${n}\n`);
      });
    },
    // Se le cierra la entrada para que termine el pase y cierre la presentación; si no lo hace a tiempo, se corta.
    close() {
      if (gone) return;
      child.stdin.end();
      setTimeout(() => { if (!gone) child.kill(); }, 8000).unref();
    },
  };
}

// Convierte presentaciones, de una en una, como tareas con avance.
//   run({ id, name, input, dir, onDone({ ok, pages: [{ file, thumb }], error, cancelled }) })
//   dir: carpeta (vacía) donde quedan las imágenes; el archivo de entrada no se toca.
export function createExporter(app, { platform = process.platform } = {}) {
  const queue = [];
  let running = null; // { task, job, child, cancelled }
  let closed = false;
  const fake = process.env.MANNA_POWERPOINT_PRUEBA || null;
  // Siempre la misma carpeta: PowerPoint (en Mac) recuerda el permiso que se le dio sobre ella.
  const work = path.join(app.dataDir, 'powerpoint');

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

  // Cómo termina una conversión, la haga quien la haga: las imágenes a la presentación, o el motivo del fallo.
  function finish(current, pages, err, who, explained) {
    const { task, job } = current;
    const ok = pages.length > 0 && !current.cancelled && !closed;
    running = null;
    if (ok) job.done('Listo');
    else if (current.cancelled || closed) job.done('Cancelado');
    else {
      // El motivo tal cual, al registro: lo que se le dice a la persona no lo lleva.
      console.error(`${who} no pudo convertir «${task.name}»: ${String(err).trim()}`);
      job.fail(explained);
    }
    task.onDone({ ok, pages, cancelled: current.cancelled || closed, error: ok ? null : explained });
    next();
  }

  async function next() {
    if (running || closed || !queue.length) return;
    running = queue.shift();
    const current = running;
    const { task, job } = current;
    // Con DeckCraft instalado, convierte él (fase 33): sin ventanas ni permisos, igual en Windows y en Mac.
    if (app.tools.has('deckcraft')) {
      job.update({ detail: 'Convirtiendo con DeckCraft' });
      fs.mkdirSync(task.dir, { recursive: true });
      const done = await convertWithDeckCraft(app, {
        input: task.input, dir: task.dir, sides: { slide: SLIDE_SIDE, thumb: THUMB_SIDE },
        onProgress: (n, total) => job.update({ progress: Math.min(0.99, n / total) }),
        onChild: (child) => { current.child = child; },
      });
      const pages = done.ok ? done.pages.filter((page) => readImageInfo(page.file)) : [];
      finish(current, pages, done.err, 'DeckCraft', /ocultas/.test(done.err) ? done.err : 'DeckCraft no pudo convertir esta presentación. Guárdala como PDF (en PowerPoint, Archivo → Exportar) y sube el PDF.');
      return;
    }
    const mac = platform === 'darwin' && !fake;
    job.update({ detail: mac ? 'Abriendo PowerPoint (si pide acceso a una carpeta, pulsa «Seleccionar…» y «Conceder acceso»)' : 'Abriendo PowerPoint' });
    fs.mkdirSync(task.dir, { recursive: true });

    // En Mac, PowerPoint deja un PDF en la carpeta de trabajo y macOS saca de él las imágenes.
    const pdf = mac ? path.join(work, 'salida.pdf') : null;
    let result = { code: -1, err: '' };
    try {
      if (mac) {
        fs.mkdirSync(work, { recursive: true });
        fs.rmSync(pdf, { force: true });
      }
      const plan = exportPlan(platform, { input: task.input, dir: mac ? work : task.dir, fake });
      if (!plan) result = { code: -1, err: 'sistema sin PowerPoint' };
      else {
        let total = 0;
        const onLine = (line) => {
          const said = readLine(line);
          if (said?.total) total = said.total;
          if (said?.slide && total) job.update({ progress: Math.min(0.99, said.slide / total), detail: `Diapositiva ${said.slide} de ${total}` });
        };
        result = await launch(plan, onLine);
        if (mac && result.code === 0 && !current.cancelled) {
          result = await launch({ file: 'osascript', args: ['-l', 'JavaScript', '-e', MAC_PAGES_SCRIPT, pdf, task.dir, String(SLIDE_SIDE), String(THUMB_SIDE)], env: {} }, onLine);
        }
      }
    } catch (err) {
      result = { code: -1, err: err.message };
    } finally {
      if (pdf) fs.rmSync(pdf, { force: true });
    }

    const pages = result.code === 0 ? collect(task.dir).filter((page) => readImageInfo(page.file)) : [];
    finish(current, pages, result.err, 'PowerPoint', explain(result.err, platform));
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
