// ---------- Entities ----------
// Everything a level spawns is one of these. A class says how its kind moves,
// draws and reacts; the glyph map at SPAWN says which class a map character
// makes. So a new kind of thing is a class and one entry in that map, not
// another branch in the loader, the update loop and the draw loop.
//
// The base is enough on its own for anything that just sits there: it draws
// its object's current animation frame, tinted by its pairing id if it has
// one and its sprite carries a glow mask.
class Entity {
  constructor(obj, x, y) {
    this.obj = obj;
    this.x = x;
    this.y = y;
    this.r = atlas.radius(obj);
    this.layer = LAYER_MAIN;   // overwritten at spawn; anything made mid-play is middle
  }

  // Cell centre. Kinds that stand on the floor or hang from it override this.
  // `index` is how many of this kind the level has already spawned.
  static spawn(row, col, data, obj, index) {
    return new this(obj, col * TILE + TILE / 2, row * TILE + TILE / 2);
  }

  update() {}

  draw() {
    const frame = atlas.frame(this.obj);
    atlas.draw(this.obj, this.x, this.y, frame);
    atlas.drawMask(this.obj, this.id, this.x, this.y, frame);
  }

  // back to how the level spawned it, for a restart without a reload
  reset() {}

  // How this would be written in a block map, for the debug export. null if
  // it isn't something a map spells out, like a rock already in flight.
  mapCell() {
    const ch = this.constructor.glyph;
    return ch ? { ch, data: this.id || 0, x: this.x, y: this.y } : null;
  }

  touches(reach = R) {
    return Math.hypot(warm.x - this.x, warm.y - this.y) < reach + this.r;
  }

  // A trigger is a ring in the collision view; things that are stood on or
  // stomped override this.
  debugShape() { return { stroke: '#c08cff' }; }
}

// Costs a life unless the shield takes it. Everything damaging shares this,
// so what an enemy, a rock and a plant do to her can't drift apart.
function hurtWarm(bounce = 0) {
  if (!hasShield) { loseLife(); return; }
  hasShield = false;
  updateHud();
  playSound('shieldBreak');
  if (bounce) warm.vy = JUMP_V * bounce;
}
