// Writes assetpacks/index.json and levelpacks/index.json: the packs on disk,
// for pages that can only fetch files — a static server cannot list a folder.
// The asset pack creator offers the asset packs to import, and the level
// editor the level packs to open, from these (with the packs kept in the
// browser beside them). Run by `npm run build`; run it alone after adding or
// removing a pack folder.
//
// A folder named __Like_This__ is the tools' own — __EmptyPack__ is what the
// creator's Import starts an empty pack from — and is not listed.
//
//   [{ "name": "garden", "dir": "/assetpacks/garden/", "title": "garden" }]
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const exists = path => stat(path).then(() => true, () => false);

async function index(folder, manifest) {
  const dir = join(ROOT, folder);
  const out = [];
  for (const e of (await readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (/^__.*__$/.test(e.name)) continue;
    const file = join(dir, e.name, manifest);
    if (!await exists(file)) continue;
    let title = e.name;
    try { title = JSON.parse(await readFile(file, 'utf8')).name || e.name; } catch { /* the folder's name will do */ }
    out.push({ name: e.name, dir: `/${folder}/${e.name}/`, title });
  }
  await writeFile(join(dir, 'index.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`${folder}/index.json  ${out.map(p => p.name).join(', ')}`);
}

await index('assetpacks', 'assetpack.json');
await index('levelpacks', 'levelpack.json');
