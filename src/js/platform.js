// A moving ledge. Its glyph is also its way of moving: '>' and '<' run
// sideways, '^' and 'v' up and down, each setting off the way it points, so
// one platform object usually takes all four codes. game.js builds them after
// the terrain, since how far one travels depends on what is around it.
class Platform extends Entity {
  static editor = {
    label: 'Platform',
    code: ['0>', '0<', '0^', '0v'],
    props: {
      speed: { type: 'float', default: 0.04, label: 'Speed (over a 2.5-tile run; longer runs take longer)' }
    }
  };

  static cellAnchor = [0, 0];   // placed by its left end, on the cell's top

  constructor(name, baseX, baseY, wTiles, axis, amplitude, speed) {
    super(name, baseX, baseY);
    this.baseX = baseX;
    this.baseY = baseY;
    this.prevX = baseX;
    this.prevY = baseY;
    this.w = wTiles * TILE;
    this.h = atlas.hit(this.obj).h;
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
