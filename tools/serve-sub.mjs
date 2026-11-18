// Serves the project under a folder, as GitHub Pages does
// (warmtheworm.github.io/game/): http://localhost:5190/game/ — to check the
// site runs from a folder (src/js/root.js) before it is published.
//   node tools/serve-sub.mjs [--port=5190] [--base=/game/]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, dflt) => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1] || dflt;
const PORT = +arg('port', 5190);
const BASE = arg('base', '/game/');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.zip': 'application/zip', '.md': 'text/plain; charset=utf-8' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(`only ${BASE} is served here`); return; }
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname.slice(BASE.length))));
  if (!path.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(path)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      path = join(path, 'index.html');
    }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}${BASE}`));
