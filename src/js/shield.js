// A shield's art may carry a part called "worn": how it looks on her once
// taken, drawn round her head in place of the plain ring. Lying on the ground
// it shows its other frames, so the worn look never turns up in its loop.
const SHIELD_WORN_PART = 'worn';

class Shield extends Pickup {
  static bucket = 'shieldPickups';
  static glyph = 'S';

  frame() {
    const parts = atlas.def(this.obj).parts;
    if (!parts || parts[SHIELD_WORN_PART] === undefined) return atlas.frame(this.obj);
    const own = Object.keys(parts).find(p => p !== SHIELD_WORN_PART);
    return own ? atlas.partFrame(this.obj, own) : 0;
  }

  take() {
    hasShield = true;
    shieldObj = this.obj;          // which art she wears, for drawWorm
    playSound('shieldUp');
  }
}
