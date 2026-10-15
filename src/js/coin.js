class Coin extends Pickup {
  static bucket = 'coins';
  static editor = {
    label: 'Coin',
    glyphs: 'C',
    props: {
      score: { type: 'int', default: 1, label: 'Score' },
      pickSound: { type: 'sound', default: 'sound::coin', label: 'Sound when taken' }
    }
  };

  take() {
    this.popT = 0;
    score += this.props.score;
    stats.coins++;
    saveStats();
    checkStatAchievements();
    playSound(this.props.pickSound);
  }
}
