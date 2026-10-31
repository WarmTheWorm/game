// Serves the project over http and opens either the game or the editor on a
// chosen pack. The engine fetches everything it draws with, and fetch is
// blocked on file:// URLs, so neither page can simply be double-clicked.
//
//   node tools/serve.mjs game    [level-pack] [--assets=name] [--built] [--port=N] [--no-open]
//   node tools/serve.mjs editor  [asset-pack]                            [--port=N] [--no-open]
//   node tools/serve.mjs creator                                         [--port=N] [--no-open]
//   node tools/serve.mjs share                                           [--port=N] [--no-open]
//
// --https serves it over https (tools/devcert.mjs makes the certificate), for
// a phone or another computer on the home network: a page there needs https
// for the service worker the pack store and sharing run on. Plain http is
// enough on this computer, where localhost counts as secure. `npm run https`
// is the share page that way, on port 8443.
//
// It is a plain static server: the tools need nothing from it that any other
// static server (live-server, http-server) wouldn't give. Packs the tools
// hand each other live in the browser's IndexedDB, served under /__idb/ by
// the service worker in sw.js; the packs on disk are listed in
// assetpacks/index.json and levelpacks/index.json (npm run build).
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addresses, devCert } from './devcert.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEVEL_PACKS = join(ROOT, 'levelpacks');
// pack folders: assetpacks/ itself holds the zipped ones, which only the
// creator reads
const ASSET_PACKS = join(ROOT, 'assetpacks', 'old');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.crt': 'application/x-x509-ca-cert'
};

// ---------- what was asked for ----------
const argv = process.argv.slice(2);
const mode = argv[0];
const flags = argv.filter(a => a.startsWith('--'));
const names = argv.slice(1).filter(a => !a.startsWith('--'));
const flag = name => flags.find(f => f === `--${name}` || f.startsWith(`--${name}=`));
const flagValue = (name, fallback) => {
  const found = flag(name);
  return found && found.includes('=') ? found.slice(found.indexOf('=') + 1) : fallback;
};

if (!['game', 'editor', 'creator', 'share'].includes(mode)) {
  die('first argument must be "game", "editor", "creator" or "share" — try: npm run game -- garden');
}

// A pack is a folder, so the list of them is the folder listing; naming one
// that is not there should say which ones are, rather than 404 in the browser.
async function packs(dir) {
  const found = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return found.filter(e => e.isDirectory()).map(e => e.name).sort();
}

async function pickPack(dir, kind, asked) {
  const available = await packs(dir);
  if (!available.length) die(`no ${kind} in ${relative(ROOT, dir)}/`);
  if (!asked) return available.includes('garden') ? 'garden' : available[0];
  if (!available.includes(asked)) die(`no ${kind} called "${asked}" — there is: ${available.join(', ')}`);
  return asked;
}

const assetPack = await pickPack(ASSET_PACKS, 'asset pack', mode === 'editor' ? names[0] : flagValue('assets'));
let page;
if (mode === 'creator') {
  page = '/assetpack-editor/index.html';
} else if (mode === 'share') {
  page = '/share/?list';
} else if (mode === 'editor') {
  page = `/editor/index.html?assets=${encodeURIComponent(`/assetpacks/old/${assetPack}/`)}`;
} else {
  const levelPack = await pickPack(LEVEL_PACKS, 'level pack', names[0]);
  const entry = flag('built') ? '/dist/game.html' : '/src/index.html';
  page = `${entry}?pack=${encodeURIComponent(`/levelpacks/${levelPack}/levelpack.json`)}`
    + `&assets=${encodeURIComponent(`/assetpacks/old/${assetPack}/`)}`;
}

// ---------- the server ----------
const BASE = resolve(ROOT);

function serve(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = resolve(BASE, '.' + decodeURIComponent(url.pathname));
  // only ever below the project: a crafted path must not reach the rest of the disk
  if (path !== BASE && !path.startsWith(BASE + sep)) {
    res.writeHead(403).end('outside the project');
    return;
  }
  stat(path)
    .then(info => {
      const file = info.isDirectory() ? join(path, 'index.html') : path;
      return stat(file).then(() => file);
    })
    .then(file => {
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      createReadStream(file).pipe(res);
    })
    .catch(() => res.writeHead(404).end(`not found: ${url.pathname}`));
}

const wanted = Number(flagValue('port', 8080));
const https = !!flag('https');
// .certs/ (git-ignored) gets the CA's certificate, for devices to install
const server = https ? createHttpsServer(devCert(join(ROOT, '.certs')), serve) : createServer(serve);

// A port left busy by the last run should not stop this one.
server.on('error', err => {
  if (err.code !== 'EADDRINUSE' || server.tries > 10) die(err.message);
  server.tries = (server.tries || 0) + 1;
  server.listen(wanted + server.tries);
});

server.listen(wanted, () => {
  const port = server.address().port, scheme = https ? 'https' : 'http';
  const url = `${scheme}://localhost:${port}${page}`;
  console.log(`serving ${relative(process.cwd(), ROOT) || '.'}${sep}`);
  console.log(url);
  // the same on the home network — open to it either way, as any address is
  for (const ip of addresses().slice(1)) console.log(`${scheme}://${ip}:${port}${page}`);
  if (https) console.log(`each device trusts the test CA once: ${scheme}://<address>:${port}/.certs/ca.crt (see the README)`);
  console.log('ctrl-c to stop');
  if (!flag('no-open')) open(url);
});

function open(url) {
  const [cmd, args] = process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

function die(message) {
  console.error(message);
  process.exit(1);
}
