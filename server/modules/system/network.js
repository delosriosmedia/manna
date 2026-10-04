import dgram from 'node:dgram';
import os from 'node:os';

// Interfaces que casi nunca son la red de la iglesia: VPN, máquinas virtuales, contenedores, Bluetooth.
const VIRTUAL = /^(utun|tun|tap|ppp|ipsec|awdl|llw|anpi|bridge|vmnet|vboxnet|docker|veth|br-|virbr|zt)|virtual|vethernet|vmware|hyper-v|bluetooth|vpn|wireguard|tailscale|zerotier/i;

function score(name, address, routeAddress) {
  const [a, b] = address.split('.').map(Number);
  const virtual = VIRTUAL.test(name);
  let points = virtual ? 0 : 50;
  // La dirección por la que el equipo sale a la red es casi siempre la buena, salvo que sea una VPN.
  if (address === routeAddress && !virtual) points += 100;
  if (a === 192 && b === 168) points += 30;
  else if (a === 10 || (a === 172 && b >= 16 && b <= 31)) points += 20;
  else if (a === 169 && b === 254) points -= 40;          // sin DHCP: rara vez sirve
  else if (a === 100 && b >= 64 && b <= 127) points -= 20; // redes de VPN (CGNAT)
  return points;
}

// Dirección que el equipo se pone a sí mismo cuando un adaptador no recibe una de la red (169.254…).
// Nadie puede entrar por ella: solo sirve si es lo único que hay (dos equipos unidos por un cable).
const isSelfAssigned = (address) => address.startsWith('169.254.');

// Interfaces IPv4 del equipo, de más a menos probable para conectar otros dispositivos.
// interfaces: lo que devuelve os.networkInterfaces(). routeAddress: ver detectRouteAddress().
export function rankInterfaces(interfaces, routeAddress = null) {
  const found = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const net of list || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      found.push({ name, address: net.address, netmask: net.netmask, virtual: VIRTUAL.test(name), points: score(name, net.address, routeAddress) });
    }
  }
  const real = found.filter((i) => !isSelfAssigned(i.address));
  return (real.length ? real : found).sort((x, y) => y.points - x.points);
}

export const rankAddresses = (interfaces, routeAddress = null) =>
  rankInterfaces(interfaces, routeAddress).map((i) => i.address);

// Dirección local que el sistema usaría para salir a la red. "Conectar" un socket UDP
// no envía nada: solo hace que el sistema elija la interfaz. Devuelve null si no hay ruta.
export function detectRouteAddress() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const done = (value) => {
      try { socket.close(); } catch { /* ya cerrado */ }
      resolve(value);
    };
    socket.on('error', () => done(null));
    socket.connect(53, '192.0.2.1', () => done(socket.address().address));
  });
}

export async function lanInterfaces() {
  return rankInterfaces(os.networkInterfaces(), await detectRouteAddress());
}

// Dirección web sin el puerto cuando es el 80, que es el que el navegador usa por defecto.
export const origin = (host, port) => `http://${host}${port === 80 ? '' : `:${port}`}`;

const toInt = (ip) => ip.split('.').reduce((n, part) => ((n << 8) | Number(part)) >>> 0, 0);

export function sameSubnet(a, b, netmask) {
  if (!netmask) return true;
  const mask = toInt(netmask);
  return ((toInt(a) & mask) >>> 0) === ((toInt(b) & mask) >>> 0);
}
