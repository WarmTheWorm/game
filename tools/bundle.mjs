// Folds the game page and every script it names into one standalone HTML file.
// That file is what a level pack ships as its index.html, so a pack carries one
// page rather than the engine's two dozen files. No list of scripts lives here:
// the page names its own, and they are read from there.
//
//   npm run build
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = join(ROOT, 'src', 'index.html');
const OUT = join(ROOT, 'dist', 'game.html');

// Where a pack writes the paths of its own copies, replacing this line. It goes
// in ahead of the engine but behind the page's own dev defaults, so a built
// pack's roots are the last word on where its art comes from.
const MARKER = '<!-- pack roots -->';
const SCRIPT_TAG = /<script src="([^"]+)"><\/script>/g;

const page = await readFile(PAGE, 'utf8');
const tags = [...page.matchAll(SCRIPT_TAG)];
if (tags.length === 0) throw new Error(`${PAGE} names no scripts — has its markup changed?`);

let out = '';
let at = 0;
let code = 0;

for (const tag of tags) {
  out += page.slice(at, tag.index);
  if (at === 0) out += `${MARKER}\n`;

  const src = tag[1];
  const path = join(ROOT, 'src', src);
  let body;
  try {
    body = await readFile(path, 'utf8');
  } catch {
    throw new Error(`${src} is named by the page but is not there`);
  }
  // the first one of these inside the code would end the block early
  if (body.includes('</script')) throw new Error(`${src} contains </script and cannot be inlined`);

  out += `<!-- ${src} -->\n<script>\n${body}\n</script>`;
  code += body.length;
  at = tag.index + tag[0].length;
}
out += page.slice(at);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, out);
console.log(
  `dist/game.html  ${tags.length} scripts inlined (${code.toLocaleString()} bytes of code), ` +
  `${Buffer.byteLength(out).toLocaleString()} bytes total`
);
