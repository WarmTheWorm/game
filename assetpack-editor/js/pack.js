// ---------- the pack ----------
// One model for the whole app. Everything a tab edits lives in here, and
// export.js is the only thing that knows how it turns into files.
//
//   objects[]      one per sprite the game spawns; frames are data: URLs
//   tiles          the terrain sheet plus the four strings that label it
//   backgrounds[]  tiling sprites a level can sit in front of
//   sounds.defs    id -> an engine sound def (synth, clip or looping track)
//   sounds.media   'clips/x.wav' -> bytes, for the defs that name a file

const TILE = 32;                  // what the game draws a 1-tile object at
const PART_COLORS = ['#ffb84d', '#5ec8ff', '#8be37a', '#ff7ab6', '#b48cff', '#4de0c4', '#ff9161', '#e3e35b'];

let pack = null;

function newObject(name) {
  const part = { id: uid(), name: 'all', color: PART_COLORS[0] };
  return {
    id: uid(),
    name: name || 'object',
    fw: 32, fh: 32,
    frames: [],                   // {id, src, partId}
    parts: [part],
    active: part.id,
    tiles: 1,                     // how many tiles wide it is drawn at
    pivot: [0.5, 0.5],            // where its body sits in the art, as a fraction of the frame
    offset: [0, 0],               // game pixels its body is moved off the point its kind spawns at
    fps: 0,                       // 0 = still, or animated on its own clock
    slice: 0,
    glow: '',                     // a colour its glow part is filled with, rather than its pairing's
    copy: '',
    collision: { shape: 'none' },
    fall: null
  };
}

function newPack() {
  return {
    name: 'My Pack',
    objects: [],
    tiles: {
      src: null, w: 0, h: 0,
      size: 64,
      row_0: '01234567890123      ',
      row_1: '##########////TU*o$~',
      row_C: 'SSSSSSSSSS0123 ^    ',
      row_D: 'TTTTTTTTTTTTTTTTDDDD',
      col_0: '0123456789'
    },
    backgrounds: [],              // {id, file, name, color, scroll, src}
    sounds: { defs: {}, media: {} }
  };
}

// ---------- lookups the tabs share ----------
const objByName = name => pack.objects.find(o => o.name === name);
const objById = id => pack.objects.find(o => o.id === id);
const partsOf = o => o.parts;
const framesOfPart = (o, pid) => o.frames.filter(f => f.partId === pid);
const partById = (o, id) => o.parts.find(p => p.id === id);

// An object's glow is a part of its own, marked `glow`: the frames the game
// fills with a colour and draws over the rest. It is kept last, so the strip
// is the object's frames and then its mask, and it is never an animation.
const glowPart = o => o.parts.find(p => p.glow) || null;
const bodyFrames = o => { const g = glowPart(o); return g ? o.frames.filter(f => f.partId !== g.id) : o.frames; };

function nextPartColor(o) {
  const used = o.parts.map(p => p.color);
  return PART_COLORS.find(c => !used.includes(c)) || PART_COLORS[o.parts.length % PART_COLORS.length];
}

// Frames are kept grouped by part, in part order, because the strip the game
// reads is one row and a part is a span of it.
function normalizeObject(o) {
  // one glow part at most, and it goes last
  let seen = false;
  o.parts.forEach(p => { if (p.glow) { if (seen) delete p.glow; seen = true; } });
  o.parts = [...o.parts.filter(p => !p.glow), ...o.parts.filter(p => p.glow)];
  const valid = new Set(o.parts.map(p => p.id));
  o.frames.forEach(f => { if (!valid.has(f.partId)) f.partId = o.parts[0] ? o.parts[0].id : null; });
  const order = [...o.parts.map(p => p.id), null];
  o.frames = order.flatMap(id => o.frames.filter(f => f.partId === id));
  if (!partById(o, o.active)) o.active = o.parts[0] ? o.parts[0].id : null;
}

// Where each named part lands in the finished strip. A part covering the whole
// strip is left out: naming it would say nothing the object doesn't already.
function partSpans(o) {
  normalizeObject(o);
  const spans = {};
  let at = 0;
  for (const p of o.parts) {
    if (p.glow) continue;                       // written as the mask, not a part
    const n = framesOfPart(o, p.id).length;
    if (n) spans[p.name] = n === 1 ? at : [at, at + n - 1];
    at += n;
  }
  const only = Object.keys(spans);
  if (only.length <= 1 && at === bodyFrames(o).length && only[0] === 'all') return null;
  if (!only.length) return null;
  // by name, so two packs built from the same art read the same
  const sorted = {};
  for (const k of only.sort()) sorted[k] = spans[k];
  return sorted;
}

// Where the glow sits in the finished strip, as the manifest's `mask`: a run
// after the object's own frames, or null for an object that doesn't glow.
function maskSpan(o) {
  const g = glowPart(o);
  const n = g ? framesOfPart(o, g.id).length : 0;
  if (!n) return null;
  const at = bodyFrames(o).length;
  return n === 1 ? at : [at, at + n - 1];
}

// A glow used to be an object of its own that another named as its `mask`.
// Each such object's frames become a glow part of the one it served, and the
// mask object goes once nothing else names it. Frames of another size are
// fine: every frame is drawn into its object's frame size.
function migrateGlow(p) {
  const served = new Set();
  for (const o of p.objects) {
    const name = typeof o.mask === 'string' ? o.mask : '';
    delete o.mask;
    delete o.maskWas;
    if (!name || o.copy) continue;
    const m = p.objects.find(x => x.name === name);
    if (!m || !m.frames.length || glowPart(o)) continue;
    const part = { id: uid(), name: 'glow', color: '#ffffff', glow: true };
    o.parts.push(part);
    for (const f of m.frames) o.frames.push({ id: uid(), src: f.src, partId: part.id });
    normalizeObject(o);
    served.add(name);
  }
  // only those nothing else still uses — as art for a copy, say
  const gone = [...served].filter(n => !p.objects.some(o => o.copy === n));
  p.objects = p.objects.filter(o => !gone.includes(o.name));
  return gone;
}

// ---------- persistence ----------
// Written through structuredClone rather than JSON: audio is held as bytes,
// and JSON would turn a 3.5MB track into 45MB of {"0":12,"1":255,...} and
// then fail to read it back as a Uint8Array at all. Blob URLs are runtime
// only, so nothing here holds one.
let saveTimer = 0;
let saving = null;
let saveAgain = false;

function writePack() {
  if (saving) { saveAgain = true; return saving; }
  saving = dbPut(structuredClone(pack))
    .catch(err => toast('Could not save: ' + err.message, true))
    .finally(() => {
      saving = null;
      if (saveAgain) { saveAgain = false; writePack(); }
    });
  return saving;
}

function savePack() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writePack, 400);
}
