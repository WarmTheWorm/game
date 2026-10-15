// ---------- Falling rocks ----------
// Hazards that drop from above at fixed x spots (mostly near the cave/
// tunnel sections) and fall under gravity until they hit the ground or
// her. A shield absorbs one and shatters it; without a shield, it costs
// a life just like an enemy. How heavily one falls is its object's own
// `fall`, so two rocks can share a sprite and still drop at different speeds.
const ROCK_INTERVAL = 140;      // frames between drops

class Rock extends Entity {
  constructor(obj, x, y) {
    super(obj, x, y);
    const fall = atlas.def(obj).fall || {};
    this.gravity = fall.gravity ?? GRAVITY;
    this.maxFall = fall.max ?? MAX_FALL;
    this.vy = 0;
    this.alive = true;
    this.spin = (Math.random() - 0.5) * 0.2;
  }

  update() {
    if (!this.alive) return;
    this.vy += this.gravity;
    if (this.vy > this.maxFall) this.vy = this.maxFall;
    this.y += this.vy;

    const col = Math.floor(this.x / TILE);
    const row = Math.floor((this.y + this.r) / TILE);
    if (row >= 0 && solidAt(col, row) && this.y + this.r >= row * TILE) {
      this.alive = false; // shattered on the ground
      return;
    }
    const rampY = rampSurfaceY(this.x, this.y);
    if (rampY !== null && this.y + this.r >= rampY) { this.alive = false; return; }
    // gone once it is past the floor of the level, not of the window: the
    // camera's height says nothing about how far there is left to fall
    if (this.y > mapHeightPx + 40) { this.alive = false; return; }

    if (!this.touches()) return;
    this.alive = false;
    hurtWarm();
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.y * this.spin); // tumbles as it falls
    atlas.draw(this.obj, 0, 0);
    ctx.restore();
  }

  debugShape() { return { stroke: '#ffe14d', skip: !this.alive }; }
}
