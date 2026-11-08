// ---------- level pack folders ----------
// A level pack is one folder in the browser's pack store (src/js/packstore.js),
// under its id, which never changes however it is renamed:
//
//   packs/<uid>/    the level pack as last saved — what Play, Share and
//                   friends see
//   drafts/<uid>/   the same folder, being edited: both editors write here,
//                   Test plays it, Save copies it over packs/<uid>, Revert
//                   copies packs/<uid> back over it
//
// Copies cost next to nothing: the store keeps a file's bytes once, so a copy
// is only its files' records. A folder holds the art as an asset pack lays it
// out (assetpack.json, tiles/, objects/, backgrounds/, sounds/), the level
// pack as the game reads it (levelpack.json, levels/), and .wtw/pack.json:
//
//   { v: 1, uid, name, order: ['levels/a.json', …], shareName, fresh? }
//
// `order` is the levels' order — the files alone only say which level a flag
// leads to. `shareName` is the name its shared copy goes by (levels/<it>/),
// kept through renames so links to it go on working. `fresh`: made, imported
// or moved here, not yet opened — the editor's first save of it tidies it as
// it reads it, and that becomes its saved state too.
const Folders = (() => {
  const PACKS = 'packs', DRAFTS = 'drafts', META = '.wtw/pack.json';
  const ART = /^(assetpack\.json$|tiles\/|objects\/|backgrounds\/|sounds\/)/;
  const LEVELS = 'levels/';

  const dir = (uid, kind = DRAFTS) => packStore.url(kind, uid);
  const textOf = async rec => rec ? (typeof rec.data === 'string' ? rec.data : await new Response(rec.data).text()) : null;

  // A path inside a folder, from one relative to another file in it.
  const join = (from, rel) => decodeURIComponent(new URL(rel, 'file:///' + from).pathname.slice(1));

  async function meta(uid, kind = DRAFTS) {
    try { return JSON.parse(await textOf(await packStore.get(kind, uid, META))); } catch { return null; }
  }

  // Every level pack here: [{ uid, name, count, shareName, saved }], made first, first.
  async function list() {
    const [saved, drafts] = await Promise.all([packStore.list(PACKS), packStore.list(DRAFTS)]);
    const uids = [...new Set([...drafts, ...saved].map(p => p.name))];
    const out = [];
    for (const uid of uids) {
      const m = await meta(uid, DRAFTS) || await meta(uid, PACKS);
      if (!m) continue;
      out.push({ uid, name: m.name || 'Level pack', count: (m.order || []).length, shareName: m.shareName || '', made: m.made || 0, saved: saved.some(p => p.name === uid) });
    }
    return out.sort((a, b) => a.made - b.made || a.name.localeCompare(b.name));
  }

  // The draft's levels, in order: [{ path, data }] (data the parsed level file).
  async function levels(uid) {
    const m = await meta(uid);
    if (!m) throw new Error('that level pack has no .wtw/pack.json');
    const out = [];
    for (const path of m.order || []) {
      const text = await textOf(await packStore.get(DRAFTS, uid, path));
      if (text == null) continue;
      try { out.push({ path, data: JSON.parse(text) }); } catch { /* not a level: left out */ }
    }
    return { meta: m, levels: out };
  }

  // Writes the draft's levels and manifest — [{ name, data }]: levelpack.json,
  // levels/…, .wtw/pack.json — and takes away level files no longer in it.
  async function writeDraft(uid, files, title) {
    const m = await packStore.manifest(DRAFTS, uid);
    const keep = new Set(files.map(f => f.name));
    const stale = m ? m.files.map(f => f.path).filter(p => p.startsWith(LEVELS) && !keep.has(p)) : [];
    await packStore.write(DRAFTS, uid, { put: files, remove: stale }, title);
  }

  // Whether the draft differs from what was last saved.
  async function dirty(uid) {
    const [d, s] = await Promise.all([packStore.manifest(DRAFTS, uid), packStore.manifest(PACKS, uid)]);
    if (!d) return false;
    return !s || d.v !== s.v;
  }

  const save = uid => packStore.copy(DRAFTS, uid, uid, { toKind: PACKS });
  const revert = uid => packStore.copy(PACKS, uid, uid, { toKind: DRAFTS });
  async function remove(uid) {
    await packStore.remove(DRAFTS, uid);
    await packStore.remove(PACKS, uid);
  }

  // What an assetpack.json would say, read from a levelpack.json, which
  // carries the same blocks (the editor writes them there). One from before
  // it listed its backgrounds gets those its levels name (`seen`: files).
  function libOf(lp, seen = []) {
    const sets = lp.soundSets || {};
    const bgs = { ...(lp.backgrounds || {}) };
    if (!Array.isArray(bgs.items) || !bgs.items.length) {
      bgs.items = [...new Set(seen)].map(file => ({ file, name: file.replace(/\.[^.]+$/, '').replace(/^bg-/, '').replace(/[-_]+/g, ' '), scroll: 0.5 }));
    }
    return {
      _comment: 'The art of a level pack, read from its levelpack.json.',
      tileset: { ...(lp.tileset || {}), texture: (lp.tileset && lp.tileset.texture) || 'tiles/tiles.png' },
      objects: { manifest: (lp.objects && lp.objects.manifest) || 'objects/objects.json' },
      backgrounds: { dir: bgs.dir || 'backgrounds/', items: bgs.items || [] },
      sounds: { dir: sets.dir || 'sounds/', default: sets.default || String(lp.sounds || 'default.json').split('/').pop(), items: sets.items || [] }
    };
  }

  // Every art file of the asset pack or level pack at `base` (a URL), read
  // over the network: [{ name, data }], with an assetpack.json.
  async function artFilesFrom(base, { backgrounds = [] } = {}) {
    base = new URL(base, location.href).href;
    if (!base.endsWith('/')) base += '/';
    const files = new Map();
    const fetchOk = async path => {
      const r = await fetch(new URL(path, base), { cache: 'no-cache' });
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r;
    };
    const add = async path => {
      if (files.has(path) || path.startsWith('..')) return;
      files.set(path, await (await fetchOk(path)).arrayBuffer());
    };
    const json = path => JSON.parse(new TextDecoder().decode(files.get(path)));
    let lib;
    const own = await fetch(new URL('assetpack.json', base), { cache: 'no-cache' }).catch(() => null);
    if (own && own.ok) { const t = await own.text(); lib = JSON.parse(t); files.set('assetpack.json', new TextEncoder().encode(t).buffer); }
    else {
      lib = libOf(await (await fetchOk('levelpack.json')).json(), backgrounds);
      files.set('assetpack.json', new TextEncoder().encode(JSON.stringify(lib, null, 2)).buffer);
    }
    await add(lib.tileset && lib.tileset.texture || 'tiles/tiles.png');
    const om = lib.objects && lib.objects.manifest || 'objects/objects.json';
    await add(om);
    const objects = json(om);
    if (objects.sprites) {
      const sp = join(om, objects.sprites);
      await add(sp);
      const sprites = json(sp);
      if (sprites.texture) await add(join(sp, sprites.texture));
    }
    const bg = lib.backgrounds || {};
    for (const b of bg.items || []) if (b && b.file) await add((bg.dir || 'backgrounds/') + b.file).catch(() => {});
    const snd = lib.sounds || {};
    const sd = snd.dir || 'sounds/';
    for (const set of [snd.default || 'default.json', ...(snd.items || []).map(e => e.file)]) {
      const path = sd + set;
      try { await add(path); } catch { continue; }
      let defs = {};
      try { defs = json(path).sounds || {}; } catch { /* no sounds in it */ }
      for (const def of Object.values(defs)) if (def && typeof def.src === 'string') await add(join(path, def.src)).catch(() => {});
    }
    return [...files].map(([name, data]) => ({ name, data }));
  }

  // The store pack a URL is the folder of, or null: /__idb/<kind>/<name>/…
  function storeAt(url) {
    const m = /^\/__idb\/([^/]+)\/([^/]+)\//.exec(new URL(url, location.href).pathname);
    return m ? { kind: decodeURIComponent(m[1]), name: decodeURIComponent(m[2]) } : null;
  }

  // A new level pack: the art of the asset pack or level pack at `artDir`,
  // and `files` (levels/…, levelpack.json — or only the order, if `meta.order`
  // names files the art's folder already holds), saved and drafted at once.
  // `keepLevels`: the files under levels/ of a level pack copied whole stay.
  async function create(uid, artDir, meta, files = [], { keepLevels = false, backgrounds = [] } = {}) {
    const from = artDir && storeAt(artDir);
    const doc = { v: 1, made: Date.now(), ...meta, uid };
    const put = [...files, { name: META, data: JSON.stringify(doc, null, 2) }];
    if (from) {
      if (!await packStore.copy(from.kind, from.name, uid, { toKind: DRAFTS, title: doc.name })) throw new Error(`${artDir} is not in the browser's packs`);
      const m = await packStore.manifest(DRAFTS, uid);
      const keep = p => ART.test(p) || (keepLevels && (p.startsWith(LEVELS) || p === 'levelpack.json'));
      const remove = m.files.map(f => f.path).filter(p => !keep(p) && !put.some(f => f.name === p));
      // a level pack's copy of its art has no assetpack.json: made from its levelpack.json
      if (!m.files.some(f => f.path === 'assetpack.json')) {
        const lp = await textOf(await packStore.get(DRAFTS, uid, 'levelpack.json'));
        if (lp) put.push({ name: 'assetpack.json', data: JSON.stringify(libOf(JSON.parse(lp), backgrounds), null, 2) });
      }
      await packStore.write(DRAFTS, uid, { put, remove }, doc.name);
    } else {
      const art = artDir ? await artFilesFrom(artDir, { backgrounds }) : [];
      await packStore.put(DRAFTS, uid, [...art, ...put], doc.name);
    }
    await save(uid);
    return uid;
  }

  // A copy of the level pack `uid` as it is being edited, under `to`, called `name`.
  async function duplicate(uid, to, name, shareName) {
    if (!await packStore.copy(DRAFTS, uid, to, { title: name })) throw new Error('that level pack is not here');
    const m = await meta(uid) || {};
    await packStore.write(DRAFTS, to, { put: [{ name: META, data: JSON.stringify({ ...m, uid: to, name, shareName, made: Date.now(), fresh: true }, null, 2) }] }, name);
    await save(to);
  }

  // Its shared copy, levels/<shareName>/: the saved folder, as a friend gets
  // it — with the game page `page` and without what only the editor reads.
  async function publish(uid, shareName, page) {
    await packStore.copy(PACKS, uid, shareName, { toKind: 'levels' });
    await packStore.write('levels', shareName, { put: page ? [{ name: 'index.html', data: page }] : [], remove: [META] });
  }

  return { PACKS, DRAFTS, META, dir, meta, list, levels, writeDraft, dirty, save, revert, remove, create, duplicate, publish, artFilesFrom, storeAt, join, libOf };
})();
