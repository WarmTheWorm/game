class Enemy extends Entity {
  static bucket = 'enemies';
  static glyph = 'E';

  constructor(obj, x, y) {
    super(obj, x, y);
    this.dir = 1;
    this.alive = true;
  }

  static spawn(row, col, data, obj) {
    return new this(obj, ...atlas.place(obj, col * TILE + TILE / 2, row * TILE));
  }

  reset() { this.alive = true; this.dir = 1; }

  mapCell() {
    return this.alive ? { ch: 'E', data: this.constructor.kind, x: this.x, y: this.y } : null;
  }

  draw() { if (this.alive) this.drawBody(); }

  drawBody() {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dir < 0) ctx.scale(-1, 1); // sprite's natural facing is to the right
    atlas.draw(this.obj, 0, 0, this.animFrame());
    ctx.restore();
  }

  animFrame() { return atlas.frame(this.obj); }

  debugShape() { return { stroke: '#ffe14d', skip: !this.alive }; }
}
