// ---------- Pads, gates and goals ----------
// All four are the plain Entity drawing: an animated sprite plus its glow
// mask tinted by the id that pairs it with something else.
class Portal extends Entity {
  static bucket = 'portals';
  static glyph = 'O';
  constructor(obj, x, y, id = 0) { super(obj, x, y); this.id = id; }
  static spawn(row, col, data, obj) {
    return new this(obj, ...atlas.place(obj, col * TILE + TILE / 2, row * TILE + TILE / 2), data);
  }
}
