class Gem extends Pickup {
  static bucket = 'gems';
  static glyph = 'G';
  take() {
    this.popT = 0;
    score += GEM_VALUE;
    stats.gems++;
    saveStats();
    checkStatAchievements();
    playSound('gem');
  }
}
