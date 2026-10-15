// A gate, not a tile — it stamps its own cell solid and clears it when opened.
class Door extends Entity {
  static bucket = 'lockedDoorSpots';
  constructor(obj, row, col, id = 0) {
    super(obj, col * TILE, row * TILE);
    this.row = row;
    this.col = col;
    this.id = id;
    this.open = false;
  }
  static spawn(row, col, data, obj) { return new this(obj, row, col, data); }
  reset() { this.open = false; }
  draw() { if (!this.open) super.draw(); }
  mapCell() {
    return this.open ? null
      : { ch: 'L', data: this.id, x: this.col * TILE + TILE / 2, y: this.row * TILE + TILE / 2 };
  }
  debugShape() { return null; }   // its cell is already solid in the terrain view
}
