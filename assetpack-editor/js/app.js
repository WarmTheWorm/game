// ---------- the shell ----------
// Tabs, boot and the few things that cut across every panel.

function showTab(name) {
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

$('#packName').addEventListener('input', e => { pack.name = e.target.value; savePack(); });
$('#exportBtn').onclick = () => exportPack().catch(err => toast(err.message, true));
$('#levelBtn').onclick = () => openInLevelEditor();

$('#resetBtn').onclick = async () => {
  if (!await ask('Start over?', [{ type: 'note', label: 'This throws away the pack open here. It cannot be undone.' }], 'Throw it away')) return;
  await dbClear();
  pack = newPack();
  current = null;
  currentObj = null;
  sndSel = null;
  fcan.clear();
  await boot(true);
  toast('Started over');
};

// The packs the dev server has in assetpacks/, or null when it can't say.
async function knownPacks() {
  try {
    const res = await fetch('/__assetpacks');
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

$('#importBtn').onclick = async () => {
  const OTHER = 'Other folder…';
  const list = await knownPacks();
  const got = await ask('Read an existing pack', list && list.length ? [
    { key: 'pick', label: 'Asset pack', type: 'select', options: [...list.map(p => p.name), OTHER], value: list[0].name },
    { key: 'dir', label: `Folder, for ${OTHER}`, value: '' },
    { type: 'note', label: 'Everything open here is replaced by what is read.' }
  ] : [
    { key: 'dir', label: 'Asset pack — its name, or its folder', value: 'garden' },
    { type: 'note', label: 'Everything open here is replaced by what is read.' }
  ], 'Read it');
  if (!got) return;
  const dir = got.pick && got.pick !== OTHER ? list.find(p => p.name === got.pick).dir : got.dir;
  if (!dir || !dir.trim()) { toast('Say which folder to read', true); return; }
  toast('Reading…');
  try {
    pack = await importPack(dir);
    current = null;
    currentObj = null;
    sndSel = Object.keys(pack.sounds.defs)[0] || null;
    await boot(true);
    savePack();
    toast(`Read ${pack.sprites.length} sprites and ${pack.objects.length} objects`);
  } catch (err) {
    toast('Could not read that pack: ' + err.message, true);
  }
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
    try { saved = await dbGet(); } catch { /* a first run has nothing stored */ }
    pack = saved && (saved.sprites || saved.objects) ? saved : newPack();
    sndSel = Object.keys(pack.sounds.defs)[0] || null;
  }
  // packs from before sprites and objects were apart, or before glows were
  // parts, are brought up to date; objects take any property their class has
  // gained since they were saved
  const split = migrateSplit(pack);
  const folded = split ? [] : migrateGlow(pack);
  // both run: an old pack may need its codes made, then brought up to date
  const lamps = migrateLanterns(pack);
  const wormMade = migrateWorm(pack);
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

boot().catch(err => toast('Could not start: ' + err.message, true));
