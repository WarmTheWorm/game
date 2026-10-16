// ---------- reading an existing pack back in ----------
// The reverse of export: the atlas is sliced back into per-object frames so a
// pack already in assetpacks/ can be opened, changed and written out again.
// Everything the manifest states is in drawn units, so the maths here is the
// packer's run backwards.

// Whatever was typed, as the path the page reads it by: a bare name is a pack
// in assetpacks/, and a path on disk — D:\\...\\assetpacks\\garden — or one
// without its leading slash is taken from its assetpacks/ on.
function packDir(typed) {
  let d = String(typed).trim().replace(/\\/g, '/');
  const at = d.toLowerCase().lastIndexOf('assetpacks/');
  if (at >= 0) d = '/' + d.slice(at);
  else if (!d.includes('/')) d = '/assetpacks/' + d;
  else if (!/^(\/|https?:)/.test(d)) d = '/' + d;
  return d.endsWith('/') ? d : d + '/';
}

async function importPack(dir) {
  const base = packDir(dir);
  const reach = async url => {
    try { return await fetch(url); }
    catch { throw new Error("the page can't reach the dev server — start it with npm run creator"); }
  };
  const get = async (path, what) => {
    const res = await reach(base + path);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return what === 'json' ? res.json() : res.arrayBuffer();
  };

  // say what is wrong with a folder that isn't an asset pack, not just that a
  // file wasn't there
  const libRes = await reach(base + 'assetpack.json');
  if (!libRes.ok) {
    const level = await reach(base + 'levelpack.json');
    throw new Error(level.ok
      ? `${base} is a level pack — read an asset pack, one of the folders in assetpacks/`
      : `there is no asset pack at ${base}`);
  }
  const lib = await libRes.json();
  const next = newPack();
  next.name = base.replace(/\/$/, '').split('/').pop() || 'Imported';

  // tiles
  const ts = lib.tileset || {};
  const sheetPath = ts.texture || 'tiles/tiles.png';
  if (ts.size > 0) next.tiles.size = +ts.size;
  for (const k of ['row_0', 'row_1', 'row_C', 'row_D']) if (typeof ts[k] === 'string') next.tiles[k] = ts[k];
  try {
    const bytes = new Uint8Array(await get(sheetPath));
    next.tiles.src = await blobDataUrl(new Blob([bytes], { type: 'image/png' }));
  } catch { /* a pack without a sheet still opens */ }

  // objects, and the sprites they wear. A pack from before the two were apart
  // has one manifest of art-and-behaviour, which comes in as sprites with no
  // objects; migrateSplit makes the objects once it is open.
  const manPath = (lib.objects && lib.objects.manifest) || 'objects/objects.json';
  const manDir = manPath.slice(0, manPath.lastIndexOf('/') + 1);
  const objMan = await get(manPath, 'json');
  const split = !!objMan.sprites;
  const man = split ? await get(manDir + objMan.sprites, 'json') : objMan;
  const artDefs = split ? man.sprites : man.objects;
  const artDir = split ? (manDir + objMan.sprites).slice(0, (manDir + objMan.sprites).lastIndexOf('/') + 1) : manDir;
  const sheetImg = await loadImg(URL.createObjectURL(
    new Blob([new Uint8Array(await get(artDir + man.texture))], { type: 'image/png' })));
  const into = split ? next.sprites : (next.objects = []);
  if (!split) delete next.sprites;

  if (split) {
    for (const [name, def] of Object.entries(objMan.objects)) {
      const code = Array.isArray(def.code) ? [...def.code] : def.code ? [def.code] : [];
      next.objects.push({ id: uid(), name, cls: def.class, code, props: { ...(def.props || {}) } });
    }
  }

  // a copy is any old object landing on a rect another already claimed
  const byRect = new Map();
  for (const [name, def] of Object.entries(artDefs)) {
    const key = `${def.frame.x},${def.frame.y},${def.frame.w},${def.frame.h}`;
    if (!byRect.has(key)) byRect.set(key, name);
  }

  for (const [name, def] of Object.entries(artDefs)) {
    const o = newSprite(name);
    const { x, y, w, h } = def.frame;
    const scale = def.scale === undefined ? 1 : def.scale;
    o.fw = w;
    o.fh = h;
    o.tiles = (w * scale) / TILE;
    o.fps = def.fps || 0;
    if (def.slice) o.slice = def.slice / scale;
    // an old manifest names a mask object, which migrateGlow folds in once
    // everything is read; a new one has the mask in this object's own strip
    if (typeof def.mask === 'string') o.mask = def.mask;
    const mask = typeof def.mask === 'number' ? [def.mask, def.mask] : Array.isArray(def.mask) ? def.mask : null;
    if (def.glow) o.glow = def.glow;

    // anchor = (pivot * frame - art) * scale, and the art is already cropped.
    // A pivot may fall outside the frame — a door hangs half a pixel left of
    // its cell — so this is not clamped.
    const shift = def.collision && def.collision.shape === 'box' ? def.collision.w / 2 : 0;
    o.pivot = [(def.anchor[0] + shift) / (scale * w), def.anchor[1] / (scale * h)];

    if (def.collision) {
      const c = def.collision;
      o.collision = c.shape === 'circle' ? { shape: 'circle', r: c.r }
        : c.shape === 'box' ? { shape: 'box', w: c.w, h: c.h }
        : { shape: 'tile' };
    }
    if (def.offset) o.offset = [...def.offset];
    if (def.fall) o.fall = { ...def.fall };

    const owner = byRect.get(`${x},${y},${w},${h}`);
    if (!split && owner !== name) { o.copy = owner; into.push(o); continue; }

    // parts become the frame grouping; whatever they leave out is one run
    const spans = def.parts ? Object.entries(def.parts)
      .map(([pname, s]) => ({ name: pname, from: Array.isArray(s) ? s[0] : s, to: Array.isArray(s) ? s[1] : s }))
      .sort((a, b) => a.from - b.from) : [];
    o.parts = spans.length
      ? spans.map((s, i) => ({ id: uid(), name: s.name, color: PART_COLORS[i % PART_COLORS.length] }))
      : [{ id: uid(), name: 'all', color: PART_COLORS[0] }];
    o.active = o.parts[0].id;

    // the glow, when it is in this strip, is its own part after the rest
    const glow = mask && { id: uid(), name: 'glow', color: '#ffffff', glow: true };
    if (glow) o.parts.push(glow);
    const partAt = i => {
      if (glow && i >= mask[0]) return glow.id;
      const hit = spans.findIndex(s => i >= s.from && i <= s.to);
      return o.parts[hit < 0 ? 0 : hit].id;
    };
    const count = glow ? Math.max(def.frames, mask[1] + 1) : def.frames;
    for (let i = 0; i < count; i++) {
      const c = blankCanvas(w, h);
      c.getContext('2d').drawImage(sheetImg, x + i * w, y, w, h, 0, 0, w, h);
      const f = { id: uid(), src: c.toDataURL(), partId: spans.length || glow ? partAt(i) : o.parts[0].id };
      fcan.set(f.id, c);
      o.frames.push(f);
    }
    normalizeObject(o);
    into.push(o);
  }

  // backgrounds
  const art = lib.backgrounds || {};
  const bgDir = art.dir || 'backgrounds/';
  for (const item of (art.items || [])) {
    try {
      const bytes = new Uint8Array(await get(bgDir + item.file));
      next.backgrounds.push({
        id: uid(), file: item.file, name: item.name || item.file,
        color: item.color || '#140c1c', scroll: item.scroll === undefined ? 0.3 : item.scroll,
        src: await blobDataUrl(new Blob([bytes], { type: 'image/png' }))
      });
    } catch { /* a listed background that isn't there is simply skipped */ }
  }

  // sounds: the default set, plus every file its defs name
  const sets = lib.sounds || {};
  const sndDir = sets.dir || 'sounds/';
  const manifest = await get(sndDir + (sets.default || 'default.json'), 'json');
  next.sounds.defs = JSON.parse(JSON.stringify(manifest.sounds || {}));
  for (const def of Object.values(next.sounds.defs)) {
    if (!def || !def.src || next.sounds.media[def.src]) continue;
    try {
      next.sounds.media[def.src] = { bytes: new Uint8Array(await get(sndDir + def.src)) };
    } catch { /* a def naming a missing file keeps its path and is flagged on export */ }
  }

  return next;
}

const blobDataUrl = blob => new Promise(ok => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.readAsDataURL(blob);
});
