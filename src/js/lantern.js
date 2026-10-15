// Taking it decides how far she can see. The darkness itself lives in the
// engine, since it is drawn over the whole screen rather than by any one
// object; each lantern object says which lamp of its sprite it shows and how
// far that lamp lets her see. A reach of 0 is the full light a level already
// starts in, so that lamp puts it back.
class Lantern extends Pickup {
  static bucket = 'lanterns';
  static editor = {
    label: 'Lantern',
    code: '0N',   // 'T' and 'L' are spoken for, by the tileset and the door
    props: {
      part: { type: 'part', default: '', label: 'Lamp (part of the sprite)' },
      reach: { type: 'int', default: 0, label: 'How far she sees, in tiles (0 = full light)' },
      pickSound: { type: 'sound', default: 'sound::lantern', label: 'Sound when taken' }
    }
  };

  // Its part is a span of frames, so the flame breathes within that lamp
  // rather than running the whole sheet.
  frame() { return atlas.partFrame(this.obj, this.props.part) ?? atlas.frame(this.obj); }

  take() {
    lightReach = this.props.reach || 0;
    playSound(this.props.pickSound);
  }
}
