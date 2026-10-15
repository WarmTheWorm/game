// Stamps every level pack with the built game as its index.html, so a pack
// folder is a game that can just be served rather than a pile of data needing
// the engine from somewhere else. Run by `npm run build`, after the bundler.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKS = join(ROOT, 'levelpacks');
const GAME = join(ROOT, 'dist', 'game.html');
const MARKER = '<!-- pack roots -->';

// Where a pack keeps its own copies. The same layout the editor's download
// writes, so a pack from either place is read the same way.
const ROOTS = [
  '<script>',
  "  window.PACK_URL = 'levelpack.json';",
  "  window.OBJECTS_URL = 'objects/objects.json';",
  "  window.SOUNDS_URL = 'sounds/default.json';",
  "  window.TILES_URL = 'tiles/tiles.png';",
  '</script>'
].join('\n');

const page = await readFile(GAME, 'utf8');
if (!page.includes(MARKER)) throw new Error(`dist/game.html has no "${MARKER}" line — re-run the bundler`);

const packs = (await readdir(PACKS, { withFileTypes: true })).filter(e => e.isDirectory());
if (!packs.length) throw new Error('no level packs in levelpacks/');

for (const pack of packs) {
  await writeFile(join(PACKS, pack.name, 'index.html'), page.replace(MARKER, ROOTS));
  console.log(`levelpacks/${pack.name}/index.html`);
}
