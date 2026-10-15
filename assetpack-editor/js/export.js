// ---------- writing the pack out ----------
// One zip laid out exactly as assetpacks/<name>/, so unzipping it beside the
// others is all it takes for the level editor to offer it.

function packProblems() {
  const bad = [];
  if (!slug(pack.name)) bad.push('The pack needs a name.');
  if (!pack.tiles.src) bad.push('No terrain sheet — load a tiles.png on the Tiles tab.');
  const drawn = pack.objects.filter(o => !o.copy && o.frames.length);
  if (!drawn.length) bad.push('No object has any frames yet.');
  const names = pack.objects.map(o => o.name);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) bad.push(`Two objects are both called "${dupe}".`);
  for (const o of pack.objects) {
    if (!o.copy && o.frames.length && !bodyFrames(o).length) bad.push(`${o.name} has glow frames but none of its own to glow over.`);
    if (o.copy && !pack.objects.some(x => x.name === o.copy && x.frames.length)) bad.push(`${o.name} copies "${o.copy}", which has no frames.`);
  }
  for (const [id, d] of Object.entries(pack.sounds.defs)) {
    if (d && d.src && !pack.sounds.media[d.src]) bad.push(`The sound "${id}" names ${d.src}, which is not in the pack.`);
    if (d && !d.src && d.layers && !d.layers.length) bad.push(`The sound "${id}" has no layers left, so it would make no noise.`);
  }
  return bad;
}

// What the level editor reads to know what the pack offers.
function assetpackJson() {
  const sets = { dir: 'sounds/', default: 'default.json', items: [] };
  const doc = {
    _comment: 'An asset pack: everything the level editor draws with, in one folder. Made with the asset pack creator.',
    tileset: { texture: 'tiles/tiles.png' },
    objects: { manifest: 'objects/objects.json' },
    backgrounds: {
      dir: 'backgrounds/',
      items: pack.backgrounds.map(b => ({ file: b.file, name: b.name, color: b.color, scroll: num(b.scroll, 3) }))
    },
    sounds: sets
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

function soundsJson() {
  const doc = {
    _comment: 'Every noise the game can make, by id. A def is either a list of layers or a recorded file. A layer is an oscillator (wave, sweep, gain, attack, decay, delay) or a burst of noise (noise: gain, decay, and from/to for the lowpass that closes over it). A recorded file names src, with loop true for a track. `shake` is how long the phone buzzes with it.',
    sounds: pack.sounds.defs
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

// The manifest is written by hand rather than stringified so an object stays
// on one line: it is meant to be read beside the sheet.
function objectsJson(manifest) {
  const lines = ['{', '  "texture": "objects.png",', '  "objects": {'];
  const names = Object.keys(manifest.objects);
  names.forEach((name, i) => {
    lines.push(`    ${JSON.stringify(name)}: ${JSON.stringify(manifest.objects[name])}${i < names.length - 1 ? ',' : ''}`);
  });
  lines.push('  }', '}', '');
  return lines.join('\n');
}

// Every path the zip will hold, in the order it is written. Media keys are
// relative to the sound manifest, which is what sits in sounds/.
function packFiles() {
  return [
    'assetpack.json',
    'tiles/tiles.png',
    'objects/objects.json',
    'objects/objects.png',
    ...pack.backgrounds.map(b => 'backgrounds/' + b.file),
    'sounds/default.json',
    ...Object.keys(pack.sounds.media).map(p => 'sounds/' + p)
  ];
}

// Every file of the finished pack, as the zip and the level editor both get it.
async function buildPackFiles() {
  const { sheet, manifest } = await packObjects();
  const files = [
    { name: 'assetpack.json', data: assetpackJson() },
    { name: 'tiles/tiles.png', data: dataUrlBytes(pack.tiles.src) },
    { name: 'objects/objects.json', data: objectsJson(manifest) },
    { name: 'objects/objects.png', data: canvasBytes(sheet) },
    { name: 'sounds/default.json', data: soundsJson() }
  ];
  for (const b of pack.backgrounds) files.push({ name: 'backgrounds/' + b.file, data: dataUrlBytes(b.src) });
  for (const [path, m] of Object.entries(pack.sounds.media)) files.push({ name: 'sounds/' + path, data: m.bytes });
  return files;
}

async function exportPack() {
  const problems = packProblems();
  if (problems.length) { toast(problems[0], true); return; }

  toast('Packing…');
  const files = await buildPackFiles();
  download(zipBlob(files), slug(pack.name) + '.zip');
  toast(`${files.length} files — unzip into assetpacks/`);
}

// The pack as it stands, in the level editor, without a download: the dev
// server holds it in memory under /__live/ and the editor reads that like any
// pack folder. Nothing is written to assetpacks/, so a pack of the same name
// there is left alone. One tab is kept for it, and each click reloads it.
async function openInLevelEditor() {
  const problems = packProblems();
  if (problems.length) { toast(problems[0], true); return; }
  // opened before anything is awaited, or the browser takes it for a popup
  const tab = window.open('', 'wtw-level-editor');
  toast('Packing…');
  try {
    const files = await buildPackFiles();
    const base = `/__live/${slug(pack.name)}/`;
    const send = (path, init) => fetch(path, init).then(r => {
      if (!r.ok) throw new Error(r.status === 404 || r.status === 405 ? 'no dev server' : `${path}: ${r.status}`);
    });
    await send(base, { method: 'DELETE' });
    for (const f of files) await send(base + f.name, { method: 'PUT', body: f.data });
    const url = `/editor/index.html?assets=${encodeURIComponent(base)}`;
    if (tab) { tab.location.href = url; tab.focus(); } else window.open(url, 'wtw-level-editor');
    toast('Opened in the level editor');
  } catch (err) {
    if (tab) tab.close();
    toast(location.protocol === 'file:' || /dev server|Failed to fetch/.test(err.message)
      ? 'This needs the dev server — run npm run creator'
      : err.message, true);
  }
}

function renderPackTab() {
  const drawn = pack.objects.filter(o => !o.copy && o.frames.length).length;
  const copies = pack.objects.filter(o => o.copy).length;
  const kinds = Object.values(pack.sounds.defs);
  const problems = packProblems();

  $('#packSummary').innerHTML = `
    <div class="insp">
      <div class="ctl"><span>Objects</span><output>${drawn} drawn${copies ? ` · ${copies} sharing art` : ''}</output></div>
      <div class="ctl"><span>Terrain sheet</span><output>${pack.tiles.src ? 'loaded' : 'missing'}</output></div>
      <div class="ctl"><span>Backgrounds</span><output>${pack.backgrounds.length}</output></div>
      <div class="ctl"><span>Sounds</span><output>${kinds.filter(d => defKind(d) === 'synth').length} synth · ${kinds.filter(d => defKind(d) === 'clip').length} clips · ${kinds.filter(d => defKind(d) === 'track').length} tracks</output></div>
    </div>
    ${problems.length
      ? `<p class="hint" style="color:var(--pink)">Not ready yet:</p><ul class="hint">${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
      : '<p class="hint" style="color:var(--mint)">Ready to download.</p>'}`;

  $('#packTree').textContent = [`${slug(pack.name) || 'pack'}/`, ...packFiles().map(f => '  ' + f)].join('\n');
}
