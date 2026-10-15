class Gem extends Pickup {
  static bucket = 'gems';
  static editor = {
    label: 'Gem',
    code: '0G',
    props: {
      score: { type: 'int', default: 5, label: 'Score' },
      pickSound: { type: 'sound', default: 'sound::gem', label: 'Sound when taken' }
    }
  };

  take() {
    this.popT = 0;
    score += this.props.score;
    stats.gems++;
    saveStats();
    checkStatAchievements();
    playSound(this.props.pickSound);
  }
}
