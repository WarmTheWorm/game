// Its code takes any digit, which is its id: the door it opens and the
// colour it glows. 0 is the master key.
class Key extends Pickup {
  static bucket = 'keyPickups';
  static editor = {
    label: 'Key',
    glyphs: 'K',
    props: {
      pickSound: { type: 'sound', default: 'sound::key', label: 'Sound when taken' }
    }
  };

  static takesId = true;
  take() {
    keysHeld.push(this.id || 0);
    playSound(this.props.pickSound);
  }
}
