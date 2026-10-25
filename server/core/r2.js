import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Cloudflare R2 por su API compatible con S3 (fase 36): el himnario y las biblias de la nube. La firma (AWS SigV4) va
// hecha a mano con node:crypto, sin librerías; sus pruebas son los ejemplos oficiales de AWS (test/r2.test.js). La usan
// el guion que sube el contenido (scripts/subir-r2.mjs) y la nube, que da enlaces que caducan para escuchar un himno.

const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest();
export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
export const UNSIGNED = 'UNSIGNED-PAYLOAD';
// Como lo pide S3: todo codificado salvo A-Z, a-z, 0-9 y - _ . ~ (en la ruta, también la barra).
const encode = (text) => encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export const encodePath = (path) => path.split('/').map(encode).join('/');
const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20130524T000000Z
const queryString = (query) => Object.keys(query).sort().map((k) => `${encode(k)}=${encode(String(query[k]))}`).join('&');

// La firma de una petición: method, host, path (sin codificar, con la barra del principio), query y headers (con sus
// nombres en minúsculas; deben estar todos los que se firman). Devuelve la firma y lo que la acompaña.
function sign({ method, host, path, query, headers, payloadHash, accessKeyId, secretAccessKey, region, date }) {
  const amzDate = stamp(date);
  const scope = `${amzDate.slice(0, 8)}/${region}/s3/aws4_request`;
  const all = { host, ...headers };
  const names = Object.keys(all).map((n) => n.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([n, v]) => [n.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')]));
  const signedHeaders = names.join(';');
  const canonical = [method, encodePath(path), queryString(query), names.map((n) => `${n}:${lower[n]}\n`).join(''), signedHeaders, payloadHash].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const key = ['aws4_request'].reduce((k, part) => hmac(k, part), [amzDate.slice(0, 8), region, 's3'].reduce((k, part) => hmac(k, part), `AWS4${secretAccessKey}`));
  return { signature: hmac(key, toSign).toString('hex'), credential: `${accessKeyId}/${scope}`, signedHeaders, amzDate };
}

// Las cabeceras de una petición firmada (con Authorization). payloadHash: el sha256 del cuerpo, o UNSIGNED.
export function signedHeaders({ method = 'GET', host, path, query = {}, headers = {}, payloadHash = UNSIGNED, accessKeyId, secretAccessKey, region = 'auto', date = new Date() }) {
  const out = { ...headers, 'x-amz-date': stamp(date), 'x-amz-content-sha256': payloadHash };
  const s = sign({ method, host, path, query, headers: out, payloadHash, accessKeyId, secretAccessKey, region, date });
  return { ...out, authorization: `AWS4-HMAC-SHA256 Credential=${s.credential},SignedHeaders=${s.signedHeaders},Signature=${s.signature}` };
}

// Un enlace firmado que caduca a los `expires` segundos: quien lo tenga puede pedir ese objeto hasta entonces.
export function presignedUrl({ method = 'GET', host, path, scheme = 'https', expires = 3600, accessKeyId, secretAccessKey, region = 'auto', date = new Date() }) {
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${stamp(date).slice(0, 8)}/${region}/s3/aws4_request`,
    'X-Amz-Date': stamp(date),
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const { signature } = sign({ method, host, path, query, headers: {}, payloadHash: UNSIGNED, accessKeyId, secretAccessKey, region, date });
  return `${scheme}://${host}${encodePath(path)}?${queryString(query)}&X-Amz-Signature=${signature}`;
}

// Un depósito de R2: { accountId, accessKeyId, secretAccessKey, bucket }. Las rutas van en estilo «ruta»
// (<cuenta>.r2.cloudflarestorage.com/<depósito>/<clave>), que R2 admite siempre. endpoint: otro servidor (las pruebas
// usan uno de mentira, scripts/lib/r2-falso.mjs).
export function r2Bucket({ accountId, accessKeyId, secretAccessKey, bucket, endpoint = `https://${accountId}.r2.cloudflarestorage.com` }) {
  const { protocol, host } = new URL(endpoint);
  const scheme = protocol.slice(0, -1);
  const keys = { accessKeyId, secretAccessKey };
  const pathOf = (key = '') => `/${bucket}${key ? `/${key}` : ''}`;
  async function request(method, key, { query = {}, headers = {}, body, payloadHash = UNSIGNED } = {}) {
    const path = pathOf(key);
    const qs = queryString(query);
    const res = await fetch(`${scheme}://${host}${encodePath(path)}${qs ? `?${qs}` : ''}`, {
      method, body,
      headers: signedHeaders({ method, host, path, query, headers, payloadHash, ...keys }),
      signal: AbortSignal.timeout(body ? 10 * 60_000 : 60_000),
    });
    if (!res.ok && res.status !== 404) throw new Error(`R2 respondió ${res.status} a ${method} ${key || '/'}: ${(await res.text()).slice(0, 300)}`);
    return res;
  }
  return {
    // Todos los objetos bajo un prefijo: [{ key, size }], de mil en mil.
    async list(prefix = '') {
      const found = [];
      let token = null;
      do {
        const res = await request('GET', '', { query: { 'list-type': 2, prefix, ...(token && { 'continuation-token': token }) } });
        const xml = await res.text();
        for (const [, body] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const tag = (name) => body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '';
          found.push({ key: unescapeXml(tag('Key')), size: Number(tag('Size')) });
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unescapeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] || '') : null;
      } while (token);
      return found;
    },
    // Sube un objeto (un Buffer: R2 pide saber el tamaño de antemano), con su huella firmada.
    async put(key, body, contentType = 'application/octet-stream') {
      await request('PUT', key, { body, payloadHash: sha256(body), headers: { 'content-type': contentType } });
    },
    async get(key) {
      const res = await request('GET', key);
      return res.status === 404 ? null : Buffer.from(await res.arrayBuffer());
    },
    // Enlace que caduca (una hora) para que un navegador pida el objeto sin la clave.
    link: (key, expires = 3600) => presignedUrl({ host, scheme, path: pathOf(key), expires, ...keys }),
  };
}

// El depósito de la nube, si el hosting tiene sus claves (las mismas variables que ~/.manna-r2), o null.
export function bucketFromEnv(env = process.env) {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) return null;
  return r2Bucket({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET, ...(env.R2_ENDPOINT && { endpoint: env.R2_ENDPOINT }) });
}

// La copia de la nube en su carpeta de contenido (dir): las biblias y las letras enteras (pesan poco y hacen falta para
// leer y buscar) y, de los videos y las diapositivas del himnario, solo el nombre, en un archivo vacío: el himnario se
// arma con ellos y los sirve R2 con enlaces que caducan. Escribe solo lo que falta o cambió. Devuelve cuántos escribió.
export async function mirror(bucket, dir) {
  let got = 0;
  for (const { key, size } of await bucket.list()) {
    const parts = key.split('/');
    if (parts.some((p) => !p || p === '.' || p === '..')) continue;
    const file = path.join(dir, ...parts);
    const whole = /^(Biblias|Himnario\/letras)\//.test(key);
    if (!whole && !/^Himnario\/(videos|diapositivas)\//.test(key)) continue;
    if (fs.existsSync(file) && (!whole || fs.statSync(file).size === size)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, whole ? await bucket.get(key) : '');
    got += 1;
  }
  return got;
}

const unescapeXml = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
