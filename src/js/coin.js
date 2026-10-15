class Coin extends Pickup {
  static bucket = 'coins';
  static glyph = 'C';
  take() {
    this.popT = 0;
    score++;
    stats.coins++;
    saveStats();
    checkStatAchievements();
    playSound('coin');
  }
}
