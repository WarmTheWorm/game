// ---------- the shell ----------
// Tabs, boot and the few things that cut across every panel.

function showTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $$('.page').forEach(p => p.classList.toggle('on', p.dataset.page === name));
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
  sndSel = null;
  fcan.clear();
  await boot(true);
  toast('Started over');
};

$('#importBtn').onclick = async () => {
  const got = await ask('Read an existing pack', [
    { key: 'dir', label: 'Folder, as this page can reach it', value: '/assetpacks/garden/' },
    { type: 'note', label: 'Everything open here is replaced by what is read.' }
  ], 'Read it');
  if (!got || !got.dir) return;
  toast('Reading…');
  try {
    pack = await importPack(got.dir);
    current = pack.objects[0] || null;
    sndSel = Object.keys(pack.sounds.defs)[0] || null;
    await boot(true);
    savePack();
    toast(`Read ${pack.objects.length} objects`);
  } catch (err) {
    toast('Could not read that pack: ' + err.message, true);
  }
};

// Frames are kept as data: URLs so the model stays cloneable; the canvases
// they draw through are rebuilt here.
async function warmFrames() {
  for (const o of pack.objects) {
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
    pack = saved && saved.objects ? saved : newPack();
    current = pack.objects[0] || null;
    sndSel = Object.keys(pack.sounds.defs)[0] || null;
  }
  // packs from before glows were parts carry them as objects of their own
  const folded = migrateGlow(pack);
  if (!pack.objects.includes(current)) current = pack.objects[0] || null;
  $('#packName').value = pack.name;
  warmMedia();
  await warmFrames();
  useSounds();
  renderObjects();
  renderTiles();
  renderBackgrounds();
  renderSounds();
  renderPackTab();
  if (folded.length) {
    savePack();
    toast(`Glows are parts now — ${folded.join(', ')} moved into the objects they lit`);
  }
}

boot().catch(err => toast('Could not start: ' + err.message, true));
