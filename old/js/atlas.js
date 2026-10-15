// ---------- Object atlas ----------
// Every object the game draws or collides with is described in a manifest
// like assets/objects.json: where its frames sit in the shared sheet, how
// fast they run, where its own position lands inside a frame, and what it
// collides as. Nothing about an object's size or anchoring lives in code.
// A level names the manifest it wants and which of its objects each map
// glyph spawns, so both are data.
// A page may say where its root manifest is before loading this, which is how
// a downloaded pack points the game at its own copy.
const ROOT_OBJECTS_URL = window.OBJECTS_URL || 'assets/objects.json';

// What a pairing id looks like. A key, a door and the portal pair all wear
// their id as a colour, filled into the object's glow mask below; index 0 is
// the wildcard and is left unglowing.
const KEY_COLORS = ['#ffffff', '#ff5a5a', '#ffa23a', '#ffd93a', '#5fe86b',
                    '#4fc9e8', '#6a8cff', '#b06aff', '#ff6ad5', '#9a7b5a'];

// Which object each map glyph spawns. An array picks by the block's info
// digit, which is how one 'E' covers three kinds of enemy. An entry may also
// name a part of that object as 'object:part', which is how one 'N' covers the
// three lamps that share a sheet — so which digit gets which lamp is the
// level's business rather than the lantern's. A level may replace this
// wholesale, so the same map text can wear a different cast.
const DEFAULT_GLYPH_OBJECTS = {
  E: ['beetle', 'moth', 'frog'],
  C: 'coin', G: 'gem', K: 'key', S: 'shield',
  N: ['lantern:fulllight', 'lantern:biglight', 'lantern:smalllight'],
  O: 'portal', '!': 'checkpoint', V: 'plant', R: ['rock', 'rock2'],
  L: 'door', F: 'flag', M: 'sign', W: 'cloud',
  '>': 'platform', '<': 'platform', '^': 'platform', v: 'platform',
};

class ObjectAtlas {
  constructor() {
    this.defs = {};
    this.sheet = new Image();
    this.glyphs = DEFAULT_GLYPH_OBJECTS;
    this.root = null;
    // Seconds of elapsed play, so sprites animate at their own frame rate
    // however often the game steps or the display refreshes.
    this.clock = 0;
    this.manifests = new Map();   // one entry per file, however many levels name it
    this.tints = new Map();       // one recolour of the sheet per pairing id
  }

  async loadManifest(url, base) {
    const href = new URL(url, base || location.href).href;
    if (this.manifests.has(href)) return this.manifests.get(href);
    const res = await fetch(href);
    if (!res.ok) throw new Error(`${href}: HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.objects) throw new Error(`${href}: no objects`);
    const sheet = new Image();
    sheet.src = new URL(data.texture, href).href;
    await new Promise((ok, fail) => {
      if (sheet.complete && sheet.naturalWidth) return ok();
      sheet.addEventListener('load', ok, { once: true });
      sheet.addEventListener('error', () => fail(new Error(`${sheet.src}: failed to load`)), { once: true });
    });
    const entry = { defs: data.objects, sheet };
    this.manifests.set(href, entry);
    return entry;
  }

  // The editor keeps its own copy of the manifest, so where "root" lives is
  // the caller's business.
  async loadRoot(url = ROOT_OBJECTS_URL) {
    this.root = await this.loadManifest(url);
    this.use(this.root);
  }

  use(entry, glyphs) {
    this.defs = entry.defs;
    this.sheet = entry.sheet;
    this.glyphs = glyphs || DEFAULT_GLYPH_OBJECTS;
  }

  def(name) { return this.defs[name] || {}; }
  hit(name) { return this.def(name).collision || {}; }
  radius(name) { return this.hit(name).r || 0; }

  // What a glyph names at that info digit, 'object' or 'object:part'.
  entryFor(ch, data = 0) {
    const named = this.glyphs[ch];
    return Array.isArray(named) ? (named[data] || named[0]) : named;
  }

  objectFor(ch, data = 0) {
    const entry = this.entryFor(ch, data);
    if (!entry) return entry;
    const cut = entry.indexOf(':');
    return cut < 0 ? entry : entry.slice(0, cut);
  }

  // The part of that object the glyph asked for, or null for the whole thing.
  // What a part means is the entity's own business — for a lantern it is both
  // the frames it shows and how far it lets her see.
  partFor(ch, data = 0) {
    const entry = this.entryFor(ch, data);
    const cut = entry ? entry.indexOf(':') : -1;
    return cut < 0 ? null : entry.slice(cut + 1);
  }

  // Where a named part sits on the sheet: a [first, last] span, a single
  // frame, or null if this object hasn't got one by that name.
  partSpan(name, part) {
    const span = part && this.def(name).parts && this.def(name).parts[part];
    if (span === undefined || span === null) return null;
    return Array.isArray(span) ? span : [span, span];
  }

  // Which frame an object is showing right now. Objects with no `fps` are
  // either still or animated on their own clock.
  frame(name) { return this.frameAt(name, this.clock); }

  frameAt(name, seconds) {
    const d = this.def(name);
    return d.fps ? Math.floor(seconds * d.fps) % d.frames : 0;
  }

  // Drawn size of one frame, in world pixels. A def's `scale` is how many
  // world pixels one sheet pixel covers: the sheet keeps the art at the
  // resolution it was drawn at, which is finer than the size it is shown at,
  // so everything else in a def — anchor, collision, slice — stays in world
  // pixels and only the blit knows the difference. A manifest packed before
  // this says nothing, and 1 is what it meant.
  size(name) {
    const d = this.def(name);
    if (!d.frame) return [0, 0];
    const s = d.scale || 1;
    return [d.frame.w * s, d.frame.h * s];
  }

  // Blits one frame. (x,y) is the object's own position and the anchor says
  // where that lands inside the frame. Frames are cropped to their artwork, so
  // this is a straight copy unless the object spans more than the collision
  // box its art was made for — then the middle stretches between caps of
  // `slice` width, which keep their shape.
  draw(name, x, y, frame = 0, ownWidth = 0, sheet = this.sheet) {
    const d = this.def(name);
    if (!d.frame) return;
    const f = d.frame;
    const s = d.scale || 1;
    const fw = f.w * s, fh = f.h * s;
    const sx = f.x + (frame % d.frames) * f.w;
    const dx = x - d.anchor[0], dy = y - d.anchor[1];
    const w = ownWidth ? ownWidth + fw - d.collision.w : fw;
    if (w === fw) {
      ctx.drawImage(sheet, sx, f.y, f.w, f.h, dx, dy, fw, fh);
      return;
    }
    const c = d.slice, cs = c / s;   // cap width, drawn and on the sheet
    ctx.drawImage(sheet, sx, f.y, cs, f.h, dx, dy, c, fh);
    ctx.drawImage(sheet, sx + cs, f.y, f.w - cs * 2, f.h, dx + c, dy, w - c * 2, fh);
    ctx.drawImage(sheet, sx + f.w - cs, f.y, cs, f.h, dx + w - c, dy, c, fh);
  }

  // The glow mask over an object, filled with its pairing colour — or with the
  // object's own `glow` if it has one, which is what a thing that glows for
  // its own sake uses, pairing or not. One recolour of the whole sheet per
  // colour serves every mask on it.
  drawMask(name, id, x, y, frame = 0, ownWidth = 0) {
    const d = this.def(name);
    if (!d.mask) return;
    const hex = d.glow || (id ? KEY_COLORS[id] || KEY_COLORS[0] : null);
    if (!hex) return;
    const tinted = this.recoloured(hex, this.sheet.src + '#' + hex);
    this.draw(d.mask, x, y, frame, ownWidth, tinted);
  }

  // Recolours the sheet, keeping its shading. Cached per key, which must be
  // unique per source — a canvas has no src to fall back on.
  recoloured(hex, key) {
    let tinted = this.tints.get(key);
    if (!tinted) {
      const img = this.sheet;
      if (img instanceof Image && (!img.complete || !img.naturalWidth)) return img; // still loading
      tinted = document.createElement('canvas');
      tinted.width = img.width;
      tinted.height = img.height;
      const g = tinted.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = 1;
      g.fillStyle = hex;
      g.fillRect(0, 0, tinted.width, tinted.height);
      this.tints.set(key, tinted);
    }
    return tinted;
  }
}

const atlas = new ObjectAtlas();
