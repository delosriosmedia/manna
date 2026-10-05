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
// `parts: ['youtube']` dice en qué partes del módulo (sus pestañas) hace falta: el módulo avisa
// solo ahí, y no molesta en las demás. El módulo cuenta en cuál está con ctx.setPart(id).
//
// tools: la lista que publica el servidor en el espacio "tools".
// part: la parte del módulo que está abierta; sin ella se cuentan todas (así lo hace la revisión del equipo).
// Devuelve [{ feature, soon, tools: [programas que faltan] }], vacío si no falta nada.
export function missingFor(module, tools, part = null) {
  return (module.needs || [])
    .filter((need) => !part || !need.parts || need.parts.includes(part))
    .map((need) => ({ feature: need.feature, soon: Boolean(need.soon), tools: need.tools.map((id) => tools.find((t) => t.id === id)).filter((t) => t && !t.found) }))
    .filter((need) => need.tools.length);
}

// Los programas distintos que faltan entre varias necesidades.
export const toolsOf = (missing) => [...new Map(missing.flatMap((m) => m.tools).map((t) => [t.id, t])).values()];

// "ffmpeg", "ffmpeg y yt-dlp", "Chrome, ffmpeg y yt-dlp".
export function joinNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}
