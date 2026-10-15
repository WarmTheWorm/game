class Key extends Pickup {
  static bucket = 'keyPickups';
  static glyph = 'K';
  constructor(obj, x, y, id = 0) { super(obj, x, y); this.id = id; }
  static spawn(row, col, data, obj) {
    return new this(obj, ...atlas.place(obj, col * TILE + TILE / 2, row * TILE + TILE / 2), data);
  }
  take() {
    keysHeld.push(this.id || 0);
    playSound('key');
  }
}
