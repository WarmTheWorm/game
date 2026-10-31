// The https certificate for testing on the home network — a phone, another
// computer — where a page needs https for its service worker (and so for the
// pack store and sharing). It is signed by a local test CA kept in
// ~/.warmworm-certs, outside the project so the server never hands out its
// key, and made again whenever this computer's addresses aren't all in it:
// the router hands out a new one now and then.
//
// Each browser has to trust the CA once (.certs/ca.crt — see the README);
// after that a new certificate needs nothing on any device.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, hostname, networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';

const DIR = join(homedir(), '.warmworm-certs');

// This computer's IPv4 addresses on its networks, and the loopback.
export function addresses() {
  const found = ['127.0.0.1'];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !found.includes(a.address)) found.push(a.address);
  }
  return found;
}

// openssl: on the path, or the one Git for Windows brings, wherever git is.
function opensslPaths() {
  const tries = ['openssl'];
  if (process.platform === 'win32') {
    try {
      for (const git of execFileSync('where', ['git'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)) {
        const root = join(dirname(git), '..');     // <Git>\cmd\git.exe
        tries.push(join(root, 'mingw64', 'bin', 'openssl.exe'), join(root, 'usr', 'bin', 'openssl.exe'));
      }
    } catch { /* no git on the path */ }
  }
  return tries;
}
function openssl(args) {
  for (const cmd of opensslPaths()) {
    try { return execFileSync(cmd, args, { cwd: DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  throw new Error('openssl was not found — install Git for Windows, or put openssl on the path');
}

// { key, cert } for the https server, made or remade as needed. `publicDir`
// gets a copy of the CA's certificate (never its key), for devices to fetch.
export function devCert(publicDir) {
  mkdirSync(DIR, { recursive: true });
  const ca = join(DIR, 'ca.crt'), caKey = join(DIR, 'ca.key');
  const cert = join(DIR, 'cert.pem'), key = join(DIR, 'key.pem');

  if (!existsSync(ca) || !existsSync(caKey)) {
    console.log('making a local test CA in ' + DIR);
    openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt',
      '-days', '3650', '-subj', '/CN=WarmTheWorm Local Test CA']);
  }

  const ips = addresses();
  const names = ['localhost', hostname(), hostname() + '.local'];
  let have = '';
  if (existsSync(cert) && existsSync(key)) {
    try { have = openssl(['x509', '-in', 'cert.pem', '-noout', '-ext', 'subjectAltName']); } catch { /* remake it */ }
  }
  const missing = [...ips.map(ip => `IP Address:${ip}`), ...names.map(n => `DNS:${n}`)].filter(s => !have.includes(s));
  if (missing.length) {
    console.log('making a new https certificate for ' + [...names, ...ips].join(', '));
    writeFileSync(join(DIR, 'server.ext'), [
      'basicConstraints=CA:FALSE',
      'keyUsage=digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      'subjectAltName=' + [...names.map(n => 'DNS:' + n), ...ips.map(ip => 'IP:' + ip)].join(',')
    ].join('\n') + '\n');
    openssl(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'key.pem', '-out', 'server.csr', '-subj', '/CN=WarmTheWorm dev']);
    // 800 days: phones refuse a longer-lived one
    openssl(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial',
      '-out', 'cert.pem', '-days', '800', '-sha256', '-extfile', 'server.ext']);
  }

  if (publicDir) {
    mkdirSync(publicDir, { recursive: true });
    copyFileSync(ca, join(publicDir, 'ca.crt'));
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}
