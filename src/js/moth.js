// flying moth: no gravity, drifts side to side within a range of its spawn
// point while bobbing up and down on a sine wave
const FLYER_SPEED = 0.9;
const FLYER_RANGE = 3 * TILE;
const FLYER_BOB_AMPLITUDE = 14;
const FLYER_BOB_SPEED = 0.05;

class Moth extends Enemy {
  static kind = 1;

  constructor(obj, x, y) {
    super(obj, x, y);
    this.type = 'flyer';
    this.baseX = x;
    this.baseY = y;
    this.t = Math.random() * 100;
  }

  // mid-cell, because it never falls onto anything
  static spawn(row, col, data, obj) {
    return new this(obj, ...atlas.place(obj, col * TILE + TILE / 2, row * TILE + TILE / 2));
  }

  update() {
    if (!this.alive) return;
    this.t++;
    this.x += this.dir * FLYER_SPEED;
    if (this.x > this.baseX + FLYER_RANGE) { this.x = this.baseX + FLYER_RANGE; this.dir = -1; }
    else if (this.x < this.baseX - FLYER_RANGE) { this.x = this.baseX - FLYER_RANGE; this.dir = 1; }
    this.y = this.baseY + Math.sin(this.t * FLYER_BOB_SPEED) * FLYER_BOB_AMPLITUDE;
  }

  // wingbeat runs on its own clock, so a swarm isn't in lockstep
  drawBody() { atlas.draw(this.obj, this.x, this.y, atlas.frameAt(this.obj, this.t * FIXED_STEP_MS / 1000)); }
}
