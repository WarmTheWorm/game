// ---------- Carnivorous plant ----------
// Rooted to the ground, closed and harmless normally. If she's airborne
// and passes close overhead (jumping over it), it lunges straight up
// trying to catch her, then retracts and waits before it can strike again.
const PLANT_RISE_FRAMES = 16;
const PLANT_HOLD_FRAMES = 10;
const PLANT_FALL_FRAMES = 20;
const PLANT_COOLDOWN = 50;
const PLANT_MAX_HEIGHT = 100;
const PLANT_TRIGGER_RADIUS = 40;

class Plant extends Entity {
  static bucket = 'plants';
  static glyph = 'V';

  constructor(obj, x, groundY) {
    super(obj, x, groundY);
    this.groundY = groundY;
    this.state = 'idle';
    this.t = 0;
    this.height = 0;
  }

  // rooted to the floor of its cell
  static spawn(row, col, data, obj) {
    return new this(obj, col * TILE + TILE / 2, (row + 1) * TILE);
  }

  reset() { this.state = 'idle'; this.t = 0; this.height = 0; }

  update() {
    switch (this.state) {
      case 'idle':
        if (!warm.grounded && warm.y < this.groundY - 20 && Math.abs(warm.x - this.x) < PLANT_TRIGGER_RADIUS) {
          this.state = 'rising';
          this.t = 0;
        }
        break;
      case 'rising':
        this.t++;
        this.height = Math.min(PLANT_MAX_HEIGHT, (this.t / PLANT_RISE_FRAMES) * PLANT_MAX_HEIGHT);
        if (this.t >= PLANT_RISE_FRAMES) { this.state = 'holding'; this.t = 0; }
        break;
      case 'holding':
        this.t++;
        if (this.t >= PLANT_HOLD_FRAMES) { this.state = 'falling'; this.t = 0; }
        break;
      case 'falling':
        this.t++;
        this.height = Math.max(0, PLANT_MAX_HEIGHT * (1 - this.t / PLANT_FALL_FRAMES));
        if (this.t >= PLANT_FALL_FRAMES) { this.height = 0; this.state = 'cooldown'; this.t = 0; }
        break;
      case 'cooldown':
        this.t++;
        if (this.t >= PLANT_COOLDOWN) this.state = 'idle';
        break;
    }

    if (this.height <= 4) return;
    const headY = this.groundY - this.height;
    if (Math.hypot(warm.x - this.x, warm.y - headY) < R + this.r) hurtWarm(0.4);
  }

  draw() {
    const parts = atlas.def(this.obj).parts;
    if (!parts) return;
    if (this.height < 2) {
      atlas.draw(this.obj, this.x, this.groundY, parts.bud);
      return;
    }
    // the stem is a plain bar, so stretching it to reach the head is safe
    ctx.save();
    ctx.translate(this.x, this.groundY);
    ctx.scale(1, this.height / PLANT_MAX_HEIGHT);
    atlas.draw(this.obj, 0, 0, parts.stem);
    ctx.restore();
    atlas.draw(this.obj, this.x, this.groundY - this.height, parts.head);
  }
}
