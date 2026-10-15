// Which glyph spawns what. An array picks by the block's info digit, which is
// how one 'E' covers three kinds of enemy. Platforms aren't here because they
// can only be sized once the terrain around them is known, and 'P' marks her
// start rather than spawning anything.
const SPAWN = {
  E: [Beetle, Moth, Frog],
  C: Coin, G: Gem, K: Key, S: Shield, N: Lantern,
  O: Portal, '!': Checkpoint, V: Plant, R: RockSpawner,
  L: Door, F: Flag, M: Sign, W: Decoration
};

const spawnClass = (ch, data) => {
  const named = SPAWN[ch];
  return Array.isArray(named) ? (named[data] || named[0]) : named;
};
