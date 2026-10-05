// Qué le falta a un módulo para funcionar completo en este equipo principal.
//
// Un módulo declara lo que necesita en `needs`:
//   needs: [{ tools: ['yt-dlp', 'ffmpeg'], feature: 'descargar videos de YouTube' }]
// `feature` completa la frase "no se podrá…". Ningún programa que falte impide abrir un módulo:
// se avisa de qué parte no funcionará y se ayuda a instalarlo.
//
// `soon: true` marca lo que pedirá una parte del módulo que todavía no existe: la revisión del
// equipo lo cuenta, para ir preparando el equipo, pero el módulo no avisa por ello.
//
// tools: la lista que publica el servidor en el espacio "tools".
// Devuelve [{ feature, soon, tools: [programas que faltan] }], vacío si no falta nada.
export function missingFor(module, tools) {
  return (module.needs || [])
    .map((need) => ({ feature: need.feature, soon: Boolean(need.soon), tools: need.tools.map((id) => tools.find((t) => t.id === id)).filter((t) => t && !t.found) }))
    .filter((need) => need.tools.length);
}

// Los programas distintos que faltan entre varias necesidades.
export const toolsOf = (missing) => [...new Map(missing.flatMap((m) => m.tools).map((t) => [t.id, t])).values()];

// "ffmpeg", "ffmpeg y yt-dlp", "Chrome, ffmpeg y yt-dlp".
export function joinNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}
