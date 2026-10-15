class Checkpoint extends Entity {
  static bucket = 'checkpoints';
  static editor = {
    label: 'Checkpoint',
    glyphs: '!',
    props: {
      off: { type: 'part', default: 'off', label: 'Part before she reaches it' },
      on: { type: 'part', default: 'on', label: 'Part once reached' },
      sound: { type: 'sound', default: 'sound::checkpoint', label: 'Sound when reached' }
    }
  };

  constructor(name, x, y) { super(name, x, y); this.activated = false; }
  reset() { this.activated = false; }
  update() {
    if (this.activated || !this.touches()) return;
    this.activated = true;
    respawnPoint = { x: this.x, y: this.y };
    playSound(this.props.sound);
  }
  draw() {
    atlas.draw(this.obj, this.x, this.y, atlas.partFrame(this.obj, this.activated ? this.props.on : this.props.off) ?? 0);
  }
}
