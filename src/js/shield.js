// A shield's sprite may carry a part to wear: how it looks on her once taken,
// drawn over her head in place of the plain ring. Lying on the ground it shows
// its other frames, so the worn look never turns up in its loop.
class Shield extends Pickup {
  static bucket = 'shieldPickups';
  static editor = {
    label: 'Shield',
    glyphs: 'S',
    props: {
      worn: { type: 'part', default: 'worn', optional: true, label: 'Part worn on her (without one, a plain ring)' },
      pickSound: { type: 'sound', default: 'sound::shieldUp', label: 'Sound when taken' }
    }
  };

  frame() {
    const parts = atlas.def(this.obj).parts;
    const worn = this.props.worn;
    if (!parts || parts[worn] === undefined) return atlas.frame(this.obj);
    const own = Object.keys(parts).find(p => p !== worn);
    return own ? atlas.partFrame(this.obj, own) : 0;
  }

  take() {
    hasShield = true;
    shieldWorn = { sprite: this.obj, part: this.props.worn };   // what drawWorm puts on her
    playSound(this.props.pickSound);
  }
}
