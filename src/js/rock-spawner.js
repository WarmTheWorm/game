// The ledge a rock drops from. It isn't drawn — the hazard is the rock.
class RockSpawner extends Entity {
  static bucket = 'rockSpawners';
  static glyph = 'R';

  constructor(obj, x, y, phase) {
    super(obj, x, y);
    this.interval = ROCK_INTERVAL;
    this.timer = phase;
  }

  static spawn(row, col, data, obj, index) {
    // staggered so a row of them doesn't drop in unison
    return new this(obj, ...atlas.place(obj, col * TILE + TILE / 2, row * TILE), index * 37 % 90);
  }

  update() {
    this.timer--;
    if (this.timer > 0) return;
    this.timer = this.interval;
    rocks.push(new Rock(this.obj, this.x, this.y));
  }

  reset() { this.timer = this.interval; }

  draw() {}
  debugShape() { return null; }
}
