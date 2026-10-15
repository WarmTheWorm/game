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
    atlas.draw(this.obj, this.x, this.y, atlas.partFrame(this.obj, this.activated ? 'on' : 'off') ?? 0);
  }
}
