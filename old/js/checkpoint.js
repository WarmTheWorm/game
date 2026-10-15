class Checkpoint extends Entity {
  static bucket = 'checkpoints';
  static glyph = '!';
  constructor(obj, x, y) { super(obj, x, y); this.activated = false; }
  reset() { this.activated = false; }
  update() {
    if (this.activated || !this.touches()) return;
    this.activated = true;
    respawnPoint = { x: this.x, y: this.y };
    playSound('checkpoint');
  }
  draw() {
    const parts = atlas.def(this.obj).parts;
    atlas.draw(this.obj, this.x, this.y, this.activated ? parts.on : parts.off);
  }
}
