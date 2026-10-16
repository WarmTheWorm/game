// Serves the project over http and opens either the game or the editor on a
// chosen pack. The engine fetches everything it draws with, and fetch is
// blocked on file:// URLs, so neither page can simply be double-clicked.
//
//   node tools/serve.mjs game    [level-pack] [--assets=name] [--built] [--port=N] [--no-open]
//   node tools/serve.mjs editor  [asset-pack]                            [--port=N] [--no-open]
//   node tools/serve.mjs creator                                         [--port=N] [--no-open]
//
// The asset pack creator can also hand the pack it is editing straight to the
// level editor: it PUTs the pack's files under /__live/<name>/, which is
// served like any pack folder. They are held in memory only, so nothing under
// assetpacks/ is ever written, and they last until the server stops.
// /__assetpacks lists the packs in assetpacks/, for the creator's import.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEVEL_PACKS = join(ROOT, 'levelpacks');
const ASSET_PACKS = join(ROOT, 'assetpacks');

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
  '.ogg': 'audio/ogg'
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

if (mode !== 'game' && mode !== 'editor' && mode !== 'creator') {
  die('first argument must be "game", "editor" or "creator" — try: npm run game -- garden');
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
} else if (mode === 'editor') {
  page = `/editor/index.html?assets=${encodeURIComponent(`/assetpacks/${assetPack}/`)}`;
} else {
  const levelPack = await pickPack(LEVEL_PACKS, 'level pack', names[0]);
  const entry = flag('built') ? '/dist/game.html' : '/src/index.html';
  page = `${entry}?pack=${encodeURIComponent(`/levelpacks/${levelPack}/levelpack.json`)}`
    + `&assets=${encodeURIComponent(`/assetpacks/${assetPack}/`)}`;
}

// ---------- packs handed over live ----------
const LIVE = '/__live/';
const LIVE_LIMIT = 64 * 1024 * 1024;   // per file; a pack's biggest is a music track
const live = new Map();                 // url path -> bytes

// Only this machine may hand a pack over, even though the server answers the
// network: a phone testing the game can read packs, not replace them.
const fromHere = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

function serveLive(req, res, path) {
  if (req.method === 'PUT' || req.method === 'DELETE') {
    if (!fromHere(req)) { res.writeHead(403).end('only from this machine'); return; }
    if (req.method === 'DELETE') {
      // a whole pack at once, so a file the pack no longer has stops being served
      for (const key of [...live.keys()]) if (key.startsWith(path)) live.delete(key);
      res.writeHead(204).end();
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > LIVE_LIMIT) { res.writeHead(413).end('too big'); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { live.set(path, Buffer.concat(chunks)); res.writeHead(204).end(); });
    return;
  }
  const body = live.get(path);
  if (!body) { res.writeHead(404).end(`not found: ${path}`); return; }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

// ---------- what packs there are ----------
// The asset pack creator's import offers these rather than asking for a path:
// every folder in assetpacks/ with an assetpack.json, as the path to read it by.
async function listAssetPacks(res) {
  const out = [];
  for (const name of await packs(ASSET_PACKS)) {
    if (await stat(join(ASSET_PACKS, name, 'assetpack.json')).then(() => true, () => false)) out.push({ name, dir: `/assetpacks/${name}/` });
  }
  res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(out));
}

// ---------- the server ----------
const BASE = resolve(ROOT);

function serve(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const livePath = decodeURIComponent(url.pathname);
  if (livePath.startsWith(LIVE)) { serveLive(req, res, livePath); return; }
  if (livePath === '/__assetpacks') { listAssetPacks(res).catch(() => res.writeHead(500).end()); return; }
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
const server = createServer(serve);

// A port left busy by the last run should not stop this one.
server.on('error', err => {
  if (err.code !== 'EADDRINUSE' || server.tries > 10) die(err.message);
  server.tries = (server.tries || 0) + 1;
  server.listen(wanted + server.tries);
});

server.listen(wanted, () => {
  const url = `http://localhost:${server.address().port}${page}`;
  console.log(`serving ${relative(process.cwd(), ROOT) || '.'}${sep}`);
  console.log(url);
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
