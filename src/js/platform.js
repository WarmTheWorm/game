class Platform extends Entity {
  constructor(obj, baseX, baseY, wTiles, axis, amplitude, speed) {
    super(obj, baseX, baseY);
    this.baseX = baseX;
    this.baseY = baseY;
    this.prevX = baseX;
    this.prevY = baseY;
    this.w = wTiles * TILE;
    this.h = atlas.hit(obj).h;
    this.axis = axis;
    this.amplitude = amplitude;
    this.speed = speed;
    this.phase = Math.random() * Math.PI * 2;
    this.t0 = platformTimer;   // so phase is measured from this platform's own birth
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    const t = (platformTimer - this.t0) * this.speed + this.phase;
    if (this.axis === 'x') this.x = this.baseX + Math.sin(t) * this.amplitude;
    else this.y = this.baseY + Math.sin(t) * this.amplitude;
  }

  // Solid only from the top — she can stand on and ride it, but it doesn't
  // block her from the sides or below.
  carry() {
    const left = this.x, right = this.x + this.w, top = this.y;
    if (warm.vy >= 0 &&
        warm.x + R > left && warm.x - R < right &&
        warm.y + R >= top - 2 && warm.y + R <= top + 16) {
      warm.x += (this.x - this.prevX); // carry her along as it moves
      warm.y = top - R;
      warm.vy = 0;
      warm.grounded = true;
    }
  }

  draw() { atlas.draw(this.obj, this.x, this.y, atlas.frame(this.obj), this.w); }

  mapCell() {
    return { ch: this.axis === 'x' ? '>' : 'v', data: 0, x: this.baseX, y: this.baseY };
  }

  // stood on rather than touched, so it reads like terrain
  debugShape() { return { stroke: '#7dff9b', fill: 'rgba(120,255,150,0.45)', box: true }; }
}
