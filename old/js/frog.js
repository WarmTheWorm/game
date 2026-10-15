// hopping frog: sits on the ground, periodically leaps forward, turns
// around at a wall or ledge (checked while grounded, same as the beetle)
const HOPPER_HOP_VY = -8.5;
const HOPPER_HOP_VX = 2.2;
const HOPPER_PAUSE = 40; // frames to wait on the ground between hops

class Frog extends Enemy {
  static kind = 2;

  constructor(obj, x, y) {
    super(obj, x, y);
    this.type = 'hopper';
    this.vx = 0;
    this.vy = 0;
    this.pauseT = HOPPER_PAUSE;
    this.grounded = false;
  }

  update() {
    if (!this.alive) return;
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    this.x += this.vx;
    this.y += this.vy;

    const row = Math.floor((this.y + this.r) / TILE);
    const col = Math.floor(this.x / TILE);
    this.grounded = false;
    if (this.vy >= 0 && solidAt(col, row) && this.y + this.r >= row * TILE) {
      this.y = row * TILE - this.r;
      this.vy = 0;
      this.vx = 0;
      this.grounded = true;
    }

    if (!this.grounded) return;
    this.pauseT--;
    if (this.pauseT > 0) return;
    // check for a wall/ledge ahead before committing to the hop
    const aheadCol = Math.floor((this.x + this.dir * (this.r + TILE * 0.6)) / TILE);
    const bodyRow = Math.floor(this.y / TILE);
    const footRow = Math.floor((this.y + this.r + 2) / TILE);
    if (solidAt(aheadCol, bodyRow) || !solidAt(aheadCol, footRow)) this.dir *= -1;
    this.vy = HOPPER_HOP_VY;
    this.vx = this.dir * HOPPER_HOP_VX;
    this.pauseT = HOPPER_PAUSE;
  }

  drawBody() {
    const squash = this.grounded ? 1 : Math.max(0.7, 1 - Math.abs(this.vy) * 0.02);
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.dir < 0) ctx.scale(-1, 1);
    ctx.scale(1 / squash, squash); // stretch a little in the air, squash on the ground
    atlas.draw(this.obj, 0, 0);
    ctx.restore();
  }
}
