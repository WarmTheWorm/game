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
//   [{ "name": "garden", "dir": "/assetpacks/garden/", "title": "garden" },
//    { "name": "mine", "dir": "/assetpacks/mine.zip", "title": "mine" }]
//
// An asset pack may be a .zip in assetpacks/ (what the creator's Export
// writes) rather than a folder; the creator's Import reads either.
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const exists = path => stat(path).then(() => true, () => false);

// The name a zipped pack gives itself in its assetpack.json, read from the
// zip's central directory; null if it has none, or isn't a zip this reads.
function zipPackName(buf) {
  try {
    let end = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
    if (end < 0) return null;
    let at = buf.readUInt32LE(end + 16);
    const hits = [];
    for (let n = buf.readUInt16LE(end + 10); n > 0; n--) {
      const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20);
      const nameLen = buf.readUInt16LE(at + 28), skip = buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
      const local = buf.readUInt32LE(at + 42), name = buf.toString('utf8', at + 46, at + 46 + nameLen);
      at += 46 + nameLen + skip;
      if (name === 'assetpack.json' || name.endsWith('/assetpack.json')) hits.push({ name, method, size, local });
    }
    const lib = hits.sort((a, b) => a.name.length - b.name.length)[0];
    if (!lib) return null;
    const start = lib.local + 30 + buf.readUInt16LE(lib.local + 26) + buf.readUInt16LE(lib.local + 28);
    const raw = buf.subarray(start, start + lib.size);
    const text = (lib.method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
    return JSON.parse(text).name || null;
  } catch { return null; }
}

async function index(folder, manifest, zips = false) {
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
  if (zips) {
    for (const e of (await readdir(dir, { withFileTypes: true })).filter(e => e.isFile() && /\.zip$/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = e.name.replace(/\.zip$/i, '');
      if (/^__.*__$/.test(name)) continue;
      out.push({ name, dir: `/${folder}/${e.name}`, title: zipPackName(await readFile(join(dir, e.name))) || name });
    }
  }
  await writeFile(join(dir, 'index.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`${folder}/index.json  ${out.map(p => p.name).join(', ')}`);
}

await index('assetpacks', 'assetpack.json', true);
await index('levelpacks', 'levelpack.json');
