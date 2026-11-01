// Lo que la portada de manna-iglesia.es usa de R2, sin entrar y sin copiarlo: los videos del himnario y citas de la Biblia.
// No sale nada más: el depósito guarda también letras, diapositivas y los archivos completos de las biblias.
const NOMBRE = /^\d{3} [^/]+\.mp4$/;
const ORIGEN = /^https:\/\/([a-z0-9-]+\.)*manna-iglesia\.es\//;
const CITA = /^\/biblia\/(RVR60|NTV|PDT)\/(\d{1,2})\/(\d{1,3})\/(\d{1,3})(?:-(\d{1,3}))?$/;
export const TOPE_VERSOS = 4;

// Una cita de una versión con derechos: solo desde la portada y con tope, por consulta y por visitante. Nunca un libro entero.
async function cita(request, env, [, version, libro, capitulo, primero, ultimo]) {
  const referer = request.headers.get('referer') ?? '';
  if (!ORIGEN.test(referer)) return new Response(null, { status: 403 });
  // También en los errores: sin este permiso, el navegador esconde la respuesta y la portada no sabe qué pasó.
  const permiso = { 'access-control-allow-origin': new URL(referer).origin, vary: 'origin' };
  const { success } = (await env.LIMITE?.limit({ key: request.headers.get('cf-connecting-ip') ?? 'sin-direccion' })) ?? { success: true };
  if (!success) return new Response(null, { status: 429, headers: permiso });

  const objeto = await env.CONTENIDO.get(`Portada/biblias/${version}/${libro}.json`);
  const versos = objeto && (await objeto.json())[capitulo];
  if (!versos) return new Response(null, { status: 404, headers: permiso });
  const desde = Number(primero);
  const hasta = Math.max(Number(ultimo ?? primero), desde);
  const tope = Math.min(hasta, desde + TOPE_VERSOS - 1);
  return Response.json({ versos: versos.filter(([n]) => n >= desde && n <= tope), truncado: hasta > tope }, {
    headers: { ...permiso, 'cache-control': 'private, max-age=3600' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    const ruta = new URL(request.url).pathname;
    const pedida = CITA.exec(ruta);
    if (pedida) return cita(request, env, pedida);

    // Para que otros sitios no los usen por su cuenta. No impide bajarlos a quien insista: algunos celulares no dicen
    // de dónde vienen al pedir un video, y a esos hay que atenderlos.
    const referer = request.headers.get('referer');
    if (referer && !ORIGEN.test(referer)) return new Response(null, { status: 403 });
    let nombre;
    try {
      nombre = decodeURIComponent(ruta.slice(1)).normalize('NFC');
    } catch {
      return new Response(null, { status: 400 });
    }
    if (!NOMBRE.test(nombre)) return new Response(null, { status: 404 });

    const objeto = await env.CONTENIDO.get(`Himnario/videos/${nombre}`, { range: request.headers, onlyIf: request.headers });
    if (!objeto) return new Response(null, { status: 404 });

    const cabeceras = new Headers({ 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400', 'content-type': 'video/mp4', etag: objeto.httpEtag });
    if (!('body' in objeto)) return new Response(null, { status: 304, headers: cabeceras });

    const rango = objeto.range;
    if (rango && request.headers.has('range')) {
      const desde = rango.offset ?? objeto.size - rango.suffix;
      const largo = rango.length ?? objeto.size - desde;
      cabeceras.set('content-range', `bytes ${desde}-${desde + largo - 1}/${objeto.size}`);
      cabeceras.set('content-length', String(largo));
      return new Response(request.method === 'HEAD' ? null : objeto.body, { status: 206, headers: cabeceras });
    }
    cabeceras.set('content-length', String(objeto.size));
    return new Response(request.method === 'HEAD' ? null : objeto.body, { headers: cabeceras });
  },
};
