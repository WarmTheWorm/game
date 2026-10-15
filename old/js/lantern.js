// Taking it decides how far she can see. The reach and the darkness itself
// live in the engine, since they are drawn over the whole screen rather than
// by any one object.
//
// Each lamp is a named part of the one sheet, and the level's glyph map says
// which info digit picks which — so the reach is keyed by the part rather
// than by the digit, and a pack can deal the three out however it likes.
// 'fulllight' is the full light a level already starts in, so that lamp puts
// it back.
const LANTERN_REACH = { fulllight: 0, smalllight: 2, biglight: 6 };
const LANTERN_DEFAULT_PART = 'fulllight';

class Lantern extends Pickup {
  static bucket = 'lanterns';
  static glyph = 'N';   // 'T' and 'L' are spoken for, by the tileset and the door

  constructor(obj, x, y, id = 0) { super(obj, x, y); this.id = id; }

  static spawn(row, col, data, obj) {
    return new this(obj, col * TILE + TILE / 2, row * TILE + TILE / 2, data);
  }

  part() { return atlas.partFor(Lantern.glyph, this.id) || LANTERN_DEFAULT_PART; }

  // Its part is a span of frames, so the flame breathes within that lamp
  // rather than running the whole sheet.
  frame() {
    const span = atlas.partSpan(this.obj, this.part());
    if (!span) return atlas.frame(this.obj);
    const [first, last] = span;
    const fps = atlas.def(this.obj).fps;
    return first + (fps ? Math.floor(atlas.clock * fps) % (last - first + 1) : 0);
  }

  take() {
    lightReach = LANTERN_REACH[this.part()] || 0;
    playSound('lantern');
  }
}
