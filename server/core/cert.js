import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';

// Certificado propio para atender también por https.
//
// Hay navegadores (los de muchos televisores) que convierten cualquier dirección en https y no
// abren una página que solo se ofrezca por http. Como Manna vive en la red local y no tiene un
// nombre público, ninguna autoridad puede darle un certificado: se hace uno a sí mismo. El
// navegador avisa una vez de que no lo conoce y deja continuar.
//
// Node no trae cómo crear certificados, así que se arma aquí, pieza a pieza, en el formato que
// todos entienden (X.509 en DER) y se firma con la clave recién creada.

const DAYS = 825;            // más de esto, algunos sistemas lo rechazan aunque se acepte a mano
const RENEW_BEFORE_DAYS = 30;
const DAY_MS = 86_400_000;

// ---- Piezas del formato (DER): etiqueta, largo y contenido ----

function size(n) {
  if (n < 0x80) return Buffer.from([n]);
  if (n < 0x100) return Buffer.from([0x81, n]);
  return Buffer.from([0x82, n >> 8, n & 0xff]);
}
const tlv = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), size(body.length), body]);
};
const seq = (...parts) => tlv(0x30, ...parts);
const set = (...parts) => tlv(0x31, ...parts);
const octets = (buffer) => tlv(0x04, buffer);
const bits = (buffer, unused = 0) => tlv(0x03, Buffer.from([unused]), buffer);
// Un entero positivo lleva un cero delante si su primer bit está encendido.
const int = (buffer) => tlv(0x02, buffer[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buffer]) : buffer);

function oid(text) {
  const [first, second, ...rest] = text.split('.').map(Number);
  const bytes = [first * 40 + second];
  for (let n of rest) {
    const group = [n & 0x7f];
    while ((n >>>= 7)) group.unshift((n & 0x7f) | 0x80);
    bytes.push(...group);
  }
  return tlv(0x06, Buffer.from(bytes));
}

function time(ms) {
  const d = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  const rest = `${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}Z`;
  const year = d.getUTCFullYear();
  // Hasta 2049 el año va con dos cifras; después, con cuatro.
  return year < 2050 ? tlv(0x17, Buffer.from(two(year % 100) + rest)) : tlv(0x18, Buffer.from(String(year) + rest));
}

const name = (commonName) => seq(set(seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from(commonName, 'utf8')))));
const extension = (id, critical, value) => seq(...[oid(id), critical && tlv(0x01, Buffer.from([0xff])), octets(value)].filter(Boolean));

const pem = (label, der) => `-----BEGIN ${label}-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;

// ---- El certificado ----

// names: nombres por los que se entra ("localhost", "manna.local"). ips: direcciones IPv4.
// Devuelve { key, cert } en PEM, listos para https.createServer().
export function buildCertificate({ publicKey, privateKey, names = [], ips = [], days = DAYS, now = Date.now() }) {
  const algorithm = seq(oid('1.2.840.113549.1.1.11'), tlv(0x05)); // RSA con SHA-256
  const serial = crypto.randomBytes(16);
  serial[0] = (serial[0] & 0x7f) | 0x40; // positivo y sin ceros delante
  const who = name('Manna');
  const alternatives = seq(
    ...names.map((n) => tlv(0x82, Buffer.from(n, 'latin1'))),
    ...ips.filter((ip) => net.isIPv4(ip)).map((ip) => tlv(0x87, Buffer.from(ip.split('.').map(Number)))),
  );
  const body = seq(
    tlv(0xa0, int(Buffer.from([2]))), // versión 3
    int(serial),
    algorithm,
    who,                              // quien lo emite…
    seq(time(now - DAY_MS), time(now + days * DAY_MS)), // un día de margen por relojes atrasados
    who,                              // …es el mismo que lo usa: firmado por sí mismo
    publicKey.export({ type: 'spki', format: 'der' }),
    tlv(0xa3, seq(
      extension('2.5.29.19', true, seq(tlv(0x01, Buffer.from([0xff])))),        // puede instalarse como autoridad de confianza
      extension('2.5.29.15', true, bits(Buffer.from([0xa4]), 2)),               // firmar, cifrar claves, firmar certificados
      extension('2.5.29.37', false, seq(oid('1.3.6.1.5.5.7.3.1'))),             // identifica a un servidor web
      extension('2.5.29.17', false, alternatives),
    )),
  );
  const signature = crypto.sign('sha256', body, privateKey);
  return {
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    cert: pem('CERTIFICATE', seq(body, algorithm, bits(signature))),
  };
}

export async function createCertificate(options = {}) {
  const pair = await promisify(crypto.generateKeyPair)('rsa', { modulusLength: 2048 });
  return buildCertificate({ ...pair, ...options });
}

// Lee el certificado guardado en dir o crea uno. Una vez creado no se cambia aunque cambie la
// dirección del equipo: quien ya lo aceptó en su navegador tendría que aceptarlo otra vez.
// Solo se rehace si falta, si está dañado o si le queda menos de un mes.
export async function loadCertificate(dir, { names = [], ips = [], now = Date.now() } = {}) {
  const keyFile = path.join(dir, 'manna.key');
  const certFile = path.join(dir, 'manna.crt');
  try {
    const key = fs.readFileSync(keyFile, 'utf8');
    const cert = fs.readFileSync(certFile, 'utf8');
    const parsed = new crypto.X509Certificate(cert);
    const fits = parsed.checkPrivateKey(crypto.createPrivateKey(key));
    if (fits && Date.parse(parsed.validTo) - now > RENEW_BEFORE_DAYS * DAY_MS) return { key, cert, created: false };
  } catch { /* no hay, o no se puede leer: se hace uno nuevo */ }

  const made = await createCertificate({ names, ips, now });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyFile, made.key, { mode: 0o600 });
  fs.writeFileSync(certFile, made.cert);
  return { ...made, created: true };
}
