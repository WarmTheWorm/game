class Shield extends Pickup {
  static bucket = 'shieldPickups';
  static glyph = 'S';
  take() {
    hasShield = true;
    playSound('shieldUp');
  }
}
