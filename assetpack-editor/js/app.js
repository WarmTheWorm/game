// ---------- the shell ----------
// Tabs, boot and the few things that cut across every panel.

// The tab last shown is remembered in this browser, so a refresh comes back
// to it.
const TAB_KEY = 'assetEditorTab';

function showTab(name) {
  try { localStorage.setItem(TAB_KEY, name); } catch { /* private mode: the first tab, then */ }
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $$('.page').forEach(p => p.classList.toggle('on', p.dataset.page === name));
  if (name === 'gameobjects') renderGameObjects();
  if (name === 'tiles') renderTiles();
  if (name === 'backgrounds') renderBackgrounds();
  if (name === 'sounds') renderSounds();
  if (name === 'pack') renderPackTab();
}
$('#tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (t) showTab(t.dataset.tab);
});

$('#packName').addEventListener('input', e => { pack.name = e.target.value; savePack(); renderPackPicker(); });
$('#exportBtn').onclick = async () => {
  try {
    if (!await exportPack()) return;
    // what is on disk now matches it: no * until it changes again
    pack.dirty = false;
    pack.exported = true;
    clearTimeout(saveTimer);
    if (!storageLocked) { writePack(); await keepBase(); }
    renderPackPicker();
  } catch (err) { toast(err.message, true); }
};
$('#levelBtn').onclick = () => openInLevelEditor();

// ---------- the packs in this browser ----------
// Each pack is kept here (js/db.js); the picker opens one, a * marking those
// changed since they were last exported. New, Import and Delete add and take
// away; Export writes the open one out as <name>.zip.

// The options are only written when they differ: writing them closes the
// list if it is open, and the picker is drawn again after every save.
function setOptions(sel, html) {
  if (sel.dataset.html === html) return;
  sel.dataset.html = html;
  sel.innerHTML = html;
}

// The picker, from the index, with the open pack's own name and state, which
// may be ahead of what has been written.
async function renderPackPicker() {
  const sel = $('#packPick');
  if (!sel || !pack) return;
  let list = [];
  try { list = await dbList(); } catch { /* just the open one, then */ }
  if (noPack) {
    setOptions(sel, '<option>— no packs —</option>');
    refreshTabWarnings();
    return;
  }
  if (!list.some(x => x.id === pack.id)) list = [...list, { id: pack.id }];
  list = list.map(x => x.id === pack.id ? { ...x, name: pack.name, dirty: pack.dirty } : x)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  setOptions(sel, list.map(x => `<option value="${esc(x.id)}" ${x.id === pack.id ? 'selected' : ''}>${esc(x.name || 'untitled')}${x.dirty ? ' *' : ''}</option>`).join(''));
  sel.title = `${list.length} pack${list.length === 1 ? '' : 's'} in this browser — * changed since last exported`;
  refreshTabWarnings();
  // A pack with nothing unexported (no *) is only taken out of the browser —
  // all of it is in a file somewhere — so it says Remove and goes at once. One
  // with a * has work in it that is nowhere else: it says Delete, in red, and
  // asks first.
  $('#revertBtn').disabled = !(pack.dirty && pack.hasBase);
  const del = $('#deleteBtn');
  del.textContent = pack.dirty ? 'Delete' : 'Remove';
  del.classList.toggle('warn', !!pack.dirty);
  del.title = pack.dirty
    ? `Delete ${pack.name} — it has changes never exported from this browser`
    : `Remove ${pack.name} from this browser — nothing in it is lost, it was all exported or imported`;
}

// With no pack in the browser there is nothing to show or change: the tabs
// go, every control but Import is off, and Import is all there is to do. The
// pack held meanwhile is a blank stand-in, never saved (storageLocked).
let noPack = false;
const PACK_CONTROLS = ['#packPick', '#packName', '#exportBtn', '#revertBtn', '#deleteBtn', '#levelBtn', '#undoBtn', '#redoBtn'];

function setNoPack(on) {
  noPack = on;
  document.body.classList.toggle('no-pack', on);
  for (const sel of PACK_CONTROLS) $(sel).disabled = on;
  if (!on) refreshHistory();       // undo and redo say for themselves
}

function enterNoPack() {
  clearTimeout(saveTimer);
  pack = newPack();
  storageLocked = true;
  forgetOpenPack();
  setNoPack(true);
  renderPackPicker();
}

$('#noPackImport').onclick = () => $('#importBtn').click();

// The pack as it is now is the one Revert goes back to: it has just been
// exported, or imported (its * gone).
async function keepBase() {
  const base = structuredClone(pack);
  base.dirty = false;
  delete base.hasBase;
  try { await dbSaveBase(pack.id, base); pack.hasBase = true; await writePack(); }
  catch (err) { toast('Could not keep a copy to revert to: ' + err.message, true); }
}

// Back to how the pack was when it was last exported or imported, all that
// was changed since let go of — asked first, since it cannot be undone.
$('#revertBtn').onclick = async () => {
  if (!pack.dirty || !pack.hasBase) return;
  const got = await ask(`Revert ${pack.name}?`, [
    { type: 'note', label: `${pack.name} goes back to how it was when it was last ${pack.exported ? 'exported' : 'imported'}. Everything changed since is lost, and Undo can't bring it back.` }
  ], 'Revert');
  if (!got) return;
  let base = null;
  try { base = await dbLoadBase(pack.id); } catch (err) { toast('Could not read it: ' + err.message, true); return; }
  if (!base) { toast('There is no copy of it to go back to', true); pack.hasBase = false; renderPackPicker(); return; }
  clearTimeout(saveTimer);
  while (saving) await saving;
  const name = pack.name;
  base.hasBase = true;
  await showPack(base, { clean: true, keep: true });
  toast(`${name} is back as it was`);
};

// Everything that belongs to the pack that was open is let go of.
function forgetOpenPack() {
  if (typeof navForget === 'function') navForget();
  current = null;
  currentObj = null;
  sndSel = null;
  fcan.clear();
  resetHistory();
}

// `next` becomes the open pack: written, remembered as open, shown.
async function showPack(next, { clean = false, keep = false } = {}) {
  pack = next;
  forgetOpenPack();
  storageLocked = false;
  setNoPack(false);
  sndSel = Object.keys(pack.sounds.defs)[0] || null;
  await boot(true);
  // read straight from a file, it matches that file, whatever boot tidied
  if (clean) pack.dirty = false;
  clearTimeout(saveTimer);
  await writePack();
  if (clean && !keep) await keepBase();
  await dbSetOpen(pack.id).catch(() => {});
  renderPackPicker();
}

async function openPack(id) {
  if (pack && id === pack.id) return;
  await flushPack();
  let next = null;
  try { next = await dbLoad(id); } catch (err) { toast('Could not read that pack: ' + err.message, true); }
  if (!next) { toast('That pack is not in this browser any more', true); renderPackPicker(); return; }
  await showPack(next);
  toast(`Opened ${pack.name}`);
}

$('#packPick').addEventListener('change', e => openPack(e.target.value));

// A name no pack here has yet: garden -> garden 2.
async function freePackName(base) {
  const names = new Set((await dbList().catch(() => [])).map(x => x.name));
  if (pack && !noPack) names.add(pack.name);     // not the stand-in held while there is none
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// Remove (no *) takes the pack out at once; Delete (a *) asks first, since
// what was never exported goes with it. The copy Open in level editor saved
// is left either way.
$('#deleteBtn').onclick = async () => {
  const name = pack.name, id = pack.id, unsaved = !!pack.dirty;
  if (unsaved) {
    const got = await ask(`Delete ${name}?`, [
      { type: 'note', label: pack.exported || pack.origin
        ? `${name} has changes that were never exported from this browser. They are lost for good.`
        : `${name} was never exported from this browser. All of it is lost for good.` }
    ], 'Delete it');
    if (!got) return;
  }
  clearTimeout(saveTimer);
  while (saving) await saving;
  try { await dbDelete(id); } catch (err) { toast(`Could not ${unsaved ? 'delete' : 'remove'} it: ` + err.message, true); return; }
  // the most recently changed of what is left — or, with none left, nothing
  // but Import
  const left = (await dbList().catch(() => [])).sort((a, b) => b.updated - a.updated);
  const next = left.length ? await dbLoad(left[0].id).catch(() => null) : null;
  if (next) await showPack(next);
  else enterNoPack();
  toast(unsaved ? `Deleted ${name}` : `Removed ${name} from this browser`);
};

// What Import's empty pack starts from: a zipped pack on disk, as small as a
// pack can be. Its __name__ keeps it out of assetpacks/index.json.
const EMPTY_PACK = '/assetpacks/__EmptyPack__.zip';

// The packs there are to read, as assetpacks/index.json lists them: a
// folder, or a .zip ("dir": "/assetpacks/mine.zip") — not the copies Open in
// level editor keeps in this browser, which are only ever a pack already
// here, packed. Then the level packs, for the art each carries: on disk, as
// levelpacks/index.json lists them, and the ones the level editor saved in
// this browser. Each is { name, dir, label }.
async function packFolders() {
  const out = [];
  const where = dir => String(dir).replace(/^\//, '').replace(/\/$/, '');
  try {
    const res = await fetch('/assetpacks/index.json', { cache: 'no-store' });
    if (res.ok) for (const p of await res.json()) out.push({ name: p.name, dir: p.dir, label: `${p.title || p.name} — ${where(p.dir)}` });
  } catch { /* no folder list; the path can still be typed */ }
  try {
    const res = await fetch('/levelpacks/index.json', { cache: 'no-store' });
    if (res.ok) for (const p of await res.json()) out.push({ name: p.name, dir: p.dir, label: `The art of level pack ${p.title || p.name} — ${where(p.dir)}` });
  } catch { /* none on disk */ }
  try {
    if (await Promise.race([packStore.ready(), new Promise(ok => setTimeout(() => ok(false), 1500))])) {
      for (const p of await packStore.list('levels')) out.push({ name: p.name, dir: packStore.url('levels', p.name), label: `The art of level pack ${p.title || p.name} — saved in this browser` });
    }
  } catch { /* none kept here */ }
  return out;
}

const isZipPath = dir => /\.zip$/i.test(String(dir).trim());

// A .zip the page can fetch, opened as a pack's files (readZip).
async function fetchZip(url) {
  let res;
  try { res = await fetch(url, { cache: 'no-store' }); }
  catch { throw new Error(`the page can't reach ${url}`); }
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return readZip(await res.arrayBuffer());
}

// Import is how a pack is added: from a .zip (what Export writes), from a
// folder in assetpacks/ (garden is the basic one), as a copy of the pack
// open, or empty. A pack read in of a name already here can replace it, or
// both be kept. The one open now is kept as it is.
$('#importBtn').onclick = async () => {
  const ZIP = 'A .zip file on this computer…', COPY = `A copy of ${pack.name} (the pack open)`,
    EMPTY = 'An empty pack', OTHER = 'Another folder or .zip…';
  const list = await packFolders();
  const got = await ask('Add a pack', [
    { key: 'pick', label: 'From', type: 'select', options: [ZIP, ...list.map(p => p.label), ...(noPack ? [] : [COPY]), EMPTY, OTHER], value: ZIP },
    { key: 'dir', label: `Folder or .zip, for ${OTHER}`, value: '' },
    { type: 'note', label: 'It is added to the packs in this browser; the one open now is kept.' }
  ], 'Add it');
  if (!got) return;

  // a copy, or the empty pack: a pack of its own, never exported
  if (got.pick === COPY || got.pick === EMPTY) {
    const was = pack.name;
    let next;
    if (got.pick === COPY) next = structuredClone(pack);
    else {
      // the empty pack is a zip on disk — a tile sheet and the worm, the
      // least a level can be built with — or, if it can't be read, nothing
      try { next = await importPack(await fetchZip(EMPTY_PACK)); }
      catch (err) { next = newPack(); toast('Could not read ' + EMPTY_PACK + ' — starting from nothing: ' + err.message, true); }
    }
    await flushPack();
    Object.assign(next, { id: uid(), dirty: true, origin: '', exported: false, hasBase: false });
    next.name = await freePackName(got.pick === COPY ? `${was} copy` : 'My Pack');
    await showPack(next);
    toast(got.pick === COPY ? `Made ${next.name}, a copy of ${was}` : `Made ${next.name}, empty`);
    return;
  }

  let source, fallbackName = null, origin = '';
  if (got.pick === ZIP) {
    const [file] = await pickFiles('.zip,application/zip', false);
    if (!file) return;
    toast('Reading…');
    try { source = await readZip(await file.arrayBuffer()); }
    catch (err) { toast('Could not read that zip: ' + err.message, true); return; }
    // garden (7).zip, as a browser names a later download, is garden
    fallbackName = file.name.replace(/\.zip$/i, '').replace(/\s*\(\d+\)$/, '').trim();
    origin = file.name;
  } else {
    source = got.pick === OTHER ? got.dir : (list.find(p => p.label === got.pick) || {}).dir;
    if (!source || !String(source).trim()) { toast('Say which folder to read', true); return; }
    toast('Reading…');
    if (isZipPath(source)) {
      // a zip on the server, read like one picked from this computer
      const url = packDir(source).replace(/\/$/, '');
      origin = url;
      fallbackName = url.split('/').pop().replace(/\.zip$/i, '');
      try { source = await fetchZip(url); }
      catch (err) { toast('Could not read that zip: ' + err.message, true); return; }
    } else origin = packDir(source);
  }
  let next;
  try { next = await importPack(source); }
  catch (err) { toast('Could not read that pack: ' + err.message, true); return; }
  if (fallbackName && (next.name === 'Imported' || !next.name)) next.name = fallbackName;
  next.origin = origin;

  // the same name here already: replace it, or keep both
  const same = (await dbList().catch(() => [])).find(x => x.name === next.name);
  if (same) {
    const REPLACE = `Replace the ${next.name} here`, BOTH = 'Keep both';
    const how = await ask(`There is a ${next.name} in this browser already`, [
      { key: 'how', label: 'Do what', type: 'select', options: [REPLACE, BOTH], value: REPLACE },
      ...(same.dirty ? [{ type: 'note', label: `The ${next.name} here has changes that were never exported.` }] : [])
    ], 'Import');
    if (!how) return;
    if (how.how === REPLACE) next.id = same.id;
    else next.name = await freePackName(next.name);
  }
  await flushPack();
  await showPack(next, { clean: true });
  toast(`Imported ${pack.name}: ${pack.sprites.length} sprites, ${pack.objects.length} objects`);
};

// Frames are kept as data: URLs so the model stays cloneable; the canvases
// they draw through are rebuilt here.
async function warmFrames() {
  for (const o of pack.sprites) {
    for (const f of o.frames) {
      if (!fcan.has(f.id)) await attachFrame(o, f);
    }
  }
}

// A record written by an earlier version stored its audio through JSON, which
// turned every Uint8Array into a numbered object and lost it. Those entries
// can't be recovered, so they are dropped rather than exported as empty files.
function warmMedia() {
  const lost = [];
  for (const [path, m] of Object.entries(pack.sounds.media)) {
    delete m.url;                                   // blob URLs are runtime only
    if (m.bytes instanceof Uint8Array && m.bytes.length) continue;
    if (m.bytes instanceof ArrayBuffer && m.bytes.byteLength) { m.bytes = new Uint8Array(m.bytes); continue; }
    delete pack.sounds.media[path];
    mediaUrls.delete(path);
    lost.push(path);
  }
  if (lost.length) toast(`${lost.length} audio files could not be read back — add them again`, true);
}

async function boot(already) {
  if (!already) {
    let saved = null;
    // a first run reads back nothing; a read that fails is not a first run,
    // and the pack it could not read is left alone
    try {
      await dbMigrate();
      // the one open last, or the latest changed
      const list = await dbList(), open = await dbOpenId();
      const pick = list.find(x => x.id === open) || [...list].sort((a, b) => b.updated - a.updated)[0];
      if (pick) saved = await dbLoad(pick.id);
    } catch (err) {
      storageLocked = true;
      toast('Could not read the packs saved here — nothing will be saved until you Import a pack or make a New one', true);
    }
    pack = saved && (saved.sprites || saved.objects) ? saved : newPack();
    if (!pack.id) pack.id = uid();
    sndSel = Object.keys(pack.sounds.defs)[0] || null;
    // none kept here: only Import, until one is
    if (!saved && !storageLocked) { storageLocked = true; setNoPack(true); }
    renderPackPicker();
  }
  // packs from before sprites and objects were apart, or before glows were
  // parts, are brought up to date; objects take any property their class has
  // gained since they were saved
  const split = migrateSplit(pack);
  const folded = split ? [] : migrateGlow(pack);
  // both run: an old pack may need its codes made, then brought up to date
  const lamps = migrateLanterns(pack);
  const wormMade = migrateWorm(pack);
  const treasured = migrateTreasure(pack);
  const shields = migrateShieldWorn(pack);
  const stopMade = migratePlatformStop(pack);
  const sparked = migrateParticles(pack);
  const tilesCut = await migrateTileSheet(pack);
  const madeCodes = migrateCodes(pack);
  const recoded = recodeObjects(pack) > 0 || madeCodes;
  for (const o of pack.objects) fillProps(o);
  if (!pack.sprites.includes(current)) current = pack.sprites[0] || null;
  if (!pack.objects.includes(currentObj)) currentObj = pack.objects[0] || null;
  $('#packName').value = pack.name;
  warmMedia();
  await warmFrames();
  useSounds();
  renderObjects();
  renderGameObjects();
  renderTiles();
  renderBackgrounds();
  renderSounds();
  renderPackTab();
  if (sparked) {
    savePack();
    toast('Added particle systems — sparkles for coins and gems, dust for rocks and stomps; see the Objects tab');
  }
  if (stopMade) {
    savePack();
    toast('Added a platform stop — place it in the level editor where a platform should turn');
  }
  if (shields) {
    savePack();
    toast('A shield wears two sprites now — its own, and the one she wears, which was its worn part');
  }
  if (treasured) {
    savePack();
    toast('Coins and gems are one class now, Treasure — a gem is a Treasure that counts as a gem');
  }
  if (wormMade) {
    savePack();
    toast('The worm is an object now — her sprite, parts and moves are on the Objects tab');
  }
  if (tilesCut) {
    savePack();
    toast("The terrain sheet has no labels any more — each row's collision is the button beside it");
  }
  if (lamps) {
    savePack();
    toast(`Each lantern wears its own sprite now — ${lamps} cut from the one they shared`);
  }
  if (recoded && !split) {
    savePack();
    toast('Codes belong to the classes now — each object keeps its own third character');
  }
  if (split) {
    savePack();
    toast(`Sprites and objects are apart now — ${pack.sprites.length} sprites, ${pack.objects.length} objects`);
  } else if (folded.length) {
    savePack();
    toast(`Glows are parts now — ${folded.join(', ')} moved into the sprites they lit`);
  }
}

// ?open=<an asset pack's folder> — the level editor's Edit asset pack — opens
// that pack: the one here it was imported from, or, for the copy Open in
// level editor keeps in the browser (/__idb/assets/<name>/), the pack here of
// that name; otherwise it is imported, as Import would.
async function openFromLink(dir) {
  const want = packDir(dir);
  const list = await dbList().catch(() => []);
  const kept = /^\/__idb\/assets\/([^/]+)\/$/.exec(want);
  let hit = kept ? list.find(x => slug(x.name) === decodeURIComponent(kept[1])) : null;
  if (!hit) {
    for (const x of list) {
      const origin = x.origin !== undefined ? x.origin : ((await dbLoad(x.id).catch(() => null)) || {}).origin;
      if (origin === want) { hit = x; break; }
    }
  }
  if (hit) {
    if (!pack || hit.id !== pack.id || noPack) {
      if (noPack) await showPack(await dbLoad(hit.id)); else await openPack(hit.id);
    }
    toast(`Opened ${hit.name} — the asset pack the level editor builds with`);
    return;
  }
  toast('Reading…');
  let next;
  try { next = await importPack(want); }
  catch (err) { toast('Could not read that asset pack: ' + err.message, true); return; }
  next.origin = want;
  if (list.some(x => x.name === next.name)) next.name = await freePackName(next.name);
  if (!noPack) await flushPack();
  await showPack(next, { clean: true });
  toast(`Imported ${pack.name} from ${want} — the asset pack the level editor builds with`);
}

boot()
  .then(async () => {
    let tab = null;
    try { tab = localStorage.getItem(TAB_KEY); } catch { /* none kept */ }
    if (tab && $(`.tab[data-tab="${tab}"]`)) showTab(tab);
    const q = new URLSearchParams(location.search);
    const open = q.get('open');
    if (open) {
      q.delete('open');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
      await openFromLink(open);
    }
  })
  .catch(err => toast('Could not start: ' + err.message, true));
