import fs from 'node:fs';
import path from 'node:path';

// Cuánto ocupa lo que Manna guarda en el equipo principal (Ajustes, «Espacio en disco»). Solo lo que se sube o se
// descarga desde la app: lo de la carpeta Contenido (himnario, biblias, medios) es de la iglesia y no cuenta.
// Cada grupo, las carpetas de data/ que lo forman (relativas a data/media o a data/).
export const DISK_GROUPS = [
  { id: 'youtube', label: 'Videos de YouTube', media: ['youtube'] },
  { id: 'clips', label: 'Videos y audios subidos', media: ['videos', 'audios'] },
  { id: 'copies', label: 'Copias para celulares, imágenes de los videos y subtítulos', media: ['convertidos', 'miniaturas', 'subtitulos', 'vista-previa'] },
  { id: 'images', label: 'Imágenes', media: ['imagenes'] },
  { id: 'slides', label: 'Presentaciones', media: ['diapositivas'], data: ['presentaciones'] },
  { id: 'pages', label: 'Páginas web (archivos)', data: ['paginas'] },
];

// Lo que ocupa una carpeta, con todo lo que tiene dentro. 0 si no existe.
export function folderBytes(dir) {
  let total = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += folderBytes(full);
    else try { total += fs.statSync(full).size; } catch { /* se borró mientras se contaba */ }
  }
  return total;
}

// { groups: [{ id, label, bytes }], total, free, size }: free y size, del disco donde está data/ (null si no se sabe).
export function diskUsage({ dataDir, uploadsDir }) {
  const groups = DISK_GROUPS.map((g) => ({
    id: g.id, label: g.label,
    bytes: [...(g.media || []).map((d) => path.join(uploadsDir, d)), ...(g.data || []).map((d) => path.join(dataDir, d))].reduce((sum, dir) => sum + folderBytes(dir), 0),
  }));
  let free = null;
  let size = null;
  try {
    const s = fs.statfsSync(dataDir);
    free = s.bavail * s.bsize;
    size = s.blocks * s.bsize;
  } catch { /* sistema que no lo dice */ }
  return { groups, total: groups.reduce((sum, g) => sum + g.bytes, 0), free, size };
}
