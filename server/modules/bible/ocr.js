import { execFile } from 'node:child_process';
import { HttpError } from '../../core/router.js';

// Leer el texto de una imagen (OCR) en el equipo principal, con lo que trae el propio sistema: en Mac, el
// reconocimiento de texto de Apple (Vision, el de «Texto en vivo»); en Windows, el de Windows (Windows.Media.Ocr).
// Sin programas de terceros. Lo usan las citas de un documento: un PDF que es solo imágenes (hecho desde una web, o
// escaneado) llega página a página como imagen (fase 27, 1.33.1).
//
// Los dos guiones son fijos y reciben la ruta de la imagen como argumento (Mac) o por el entorno (Windows); devuelven
// una línea de texto por línea leída, en UTF-8.

// Mac: JavaScript de macOS con Vision. Precisión alta, en español (y en inglés, por si una cita lo está).
export const MAC_OCR_SCRIPT = `
ObjC.import('AppKit');
ObjC.import('Vision');
function run(argv) {
  const image = $.NSImage.alloc.initWithContentsOfFile(argv[0]);
  if (!image || image.isNil()) throw new Error('No se pudo abrir la imagen.');
  const picture = $.NSBitmapImageRep.imageRepWithData(image.TIFFRepresentation).CGImage;
  const request = $.VNRecognizeTextRequest.alloc.init;
  request.recognitionLevel = 0;
  request.usesLanguageCorrection = true;
  request.recognitionLanguages = $(['es-ES', 'en-US']);
  const handler = $.VNImageRequestHandler.alloc.initWithCGImageOptions(picture, $.NSDictionary.dictionary);
  handler.performRequestsError($([request]), null);
  const lines = [];
  const results = request.results;
  for (let i = 0; i < results.count; i += 1) lines.push(results.objectAtIndex(i).topCandidates(1).objectAtIndex(0).string.js);
  return lines.join('\\n');
}
`;

// Windows: PowerShell con el OCR de Windows (Windows 10 y 11). En español si el idioma está instalado; si no, con los
// idiomas del usuario. Sin ninguno, dice MANNA-SIN-OCR.
export const WIN_OCR_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Foundation.IAsyncOperation\`1, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.RandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1
function Wait-Op($operation, [Type]$type) { $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation)); [void]$task.Wait(-1); $task.Result }
$spanish = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Where-Object { $_.LanguageTag -like 'es*' } | Select-Object -First 1
$engine = if ($spanish) { [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($spanish) } else { [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { Write-Output 'MANNA-SIN-OCR'; exit 3 }
$file = Wait-Op ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:MANNA_OCR_IMAGEN)) ([Windows.Storage.StorageFile])
$stream = Wait-Op ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Wait-Op ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Wait-Op ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$result = Wait-Op ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
foreach ($line in $result.Lines) { Write-Output $line.Text }
$stream.Dispose()
`;

// Qué se lanza en este sistema, o null si no se sabe leer imágenes en él.
export function ocrPlan(image, platform = process.platform) {
  if (platform === 'darwin') return { file: 'osascript', args: ['-l', 'JavaScript', '-e', MAC_OCR_SCRIPT, image], env: {} };
  if (platform === 'win32') return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WIN_OCR_SCRIPT, 'utf16le').toString('base64')], env: { MANNA_OCR_IMAGEN: image } };
  return null;
}

// El texto de una imagen. De una en una: varias a la vez cargarían el equipo principal durante el culto.
let line = Promise.resolve();
export function readImageText(image) {
  const plan = ocrPlan(image);
  if (!plan) return Promise.reject(new HttpError(501, 'Este equipo no puede leer el texto de las imágenes: hace falta un Mac o un Windows.'));
  const job = line.then(() => new Promise((resolve, reject) => {
    execFile(plan.file, plan.args, { env: { ...process.env, ...plan.env }, windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (stdout.includes('MANNA-SIN-OCR')) return reject(new HttpError(409, 'Windows no tiene instalado un idioma con lectura de texto. Instala el español en Configuración → Hora e idioma → Idioma, y vuelve a intentarlo.'));
      if (err) {
        console.error(`No se pudo leer el texto de una imagen: ${String(stderr || err.message).trim().slice(0, 500)}`);
        return reject(new HttpError(500, 'No se pudo leer el texto de esa página.'));
      }
      resolve(stdout.replace(/\r/g, '').trim());
    });
  }));
  line = job.catch(() => {});
  return job;
}
