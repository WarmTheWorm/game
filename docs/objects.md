# Objects and their settings

Every map cell is three characters — digit, glyph, tint — and the first two
pick what spawns: the glyph picks the class (`SPAWN` in `src/js/spawn.js`) and,
with the digit, the object (`DEFAULT_GLYPH_OBJECTS` in `src/js/atlas.js`, or a
level pack's own `objects.glyphs`). `n` below is any digit; a character that
isn't one counts as 0.

This is the map of where every setting lives today, so they can be moved into
`objects.json` (per object) and the glyph map (per block) and out of the code.

## What every object gets

Set by `Entity`'s constructor for all of them, so not repeated below:

| Property | From |
|---|---|
| `obj` | the object's name |
| `x`, `y` | the cell, where the class's `spawn` puts it, plus the object's `offset` |
| `r` | the object's collision radius |
| `layer` | the map layer the block was on |

## Per object

**From the block** is what the spawn takes from the cell itself — it differs
from block to block of the same object, so it belongs in the glyph map, not the
object. **Settings** are fixed for the object but written in code today, with
the file they are in.

| 2char | Class::object | From the block | Settings — value and where it lives now |
|---|---|---|---|
| `0E` | `Beetle::beetle` | `{ "dir": 1 }` — starts walking right | `{ "speed": 1.1 }` `ENEMY_SPEED` game.js · `{ "gravity": 0.55, "maxFall": 12 }` `GRAVITY` `MAX_FALL` game.js · stomp, below · walk cycle at the object's `fps` |
| `1E` | `Moth::moth` | `{ "dir": 1, "baseX", "baseY" }` — the spawn point it patrols round; `t` random 0–100 so moths don't flap in step | `{ "speed": 0.9, "range": 96, "bob": 14, "bobSpeed": 0.05 }` `FLYER_*` moth.js · stomp, below |
| `2E` | `Frog::frog` | `{ "dir": 1 }` | `{ "hopVy": -8.5, "hopVx": 2.2, "pause": 40 }` `HOPPER_*` frog.js · `{ "gravity": 0.55, "maxFall": 12 }` game.js · stomp, below |
| `0C` | `Coin::coin` | — | `{ "score": 1, "stat": "coins", "pickSound": "sound::coin" }` coin.js · `{ "popFrames": 28, "popRise": 22 }` `COIN_POP_*` pickup.js |
| `1C` | `Coin::coin2` | — | the same as `coin`: nothing in the code tells them apart |
| `nG` | `Gem::gem` | — | `{ "score": 5, "stat": "gems", "pickSound": "sound::gem" }` `GEM_VALUE` pickup.js, gem.js · pop as for coins |
| `nK` | `Key::key` | `{ "id": n }` — opens door `n`; 0 opens any door | `{ "pickSound": "sound::key" }` key.js · glows in its pairing colour |
| `nS` | `Shield::shield` | — | `{ "pickSound": "sound::shieldUp", "breakSound": "sound::shieldBreak" }` shield.js, entity.js · part `worn` drawn on her |
| `0N` | `Lantern::lantern:fulllight` | `{ "id": 0 }` → part `fulllight` | `{ "reach": 0 }` — full light — `LANTERN_REACH` lantern.js · `{ "pickSound": "sound::lantern" }` |
| `1N` | `Lantern::lantern:biglight` | `{ "id": 1 }` → part `biglight` | `{ "reach": 6 }` tiles, lantern.js · `{ "pickSound": "sound::lantern" }` |
| `2N` | `Lantern::lantern:smalllight` | `{ "id": 2 }` → part `smalllight` | `{ "reach": 2 }` tiles, lantern.js · `{ "pickSound": "sound::lantern" }` |
| `nO` | `Portal::portal` | `{ "id": n }` — every portal with the same id is one ring | `{ "cooldown": 60, "sound": "sound::teleport" }` `PORTAL_COOLDOWN` game.js · glows in its pairing colour |
| `n!` | `Checkpoint::checkpoint` | `{ "activated": false }` | `{ "sound": "sound::checkpoint" }` checkpoint.js · parts `off`, `on` |
| `nV` | `Plant::plant` | `{ "groundY" }` — the floor it is rooted to | `{ "rise": 16, "hold": 10, "fall": 20, "cooldown": 50, "maxHeight": 100, "trigger": 40, "bounce": 0.4 }` `PLANT_*` plant.js · parts `bud`, `stem`, `head` |
| `0R` | `RockSpawner::rock` | `{ "timer": index × 37 mod 90 }` — staggers a row of spawners | `{ "interval": 140 }` `ROCK_INTERVAL` rock.js · each `Rock`: `fall` already in the object, else game.js gravity · spin random ±0.1 |
| `1R` | `RockSpawner::rock2` | as `0R` | as `0R`, with `rock2`'s own `fall` |
| `nL` | `Door::door` | `{ "id": n, "row", "col" }` — opened by key `n`; 0 takes any key | `{ "openSound": "sound::unlock" }` game.js · stamps its cell solid until opened |
| `nF` | `Flag::flag` | `{ "id": n }` — picks the level's exit `exits[n]`, or a round trip in `returns[n]` | — the level's finish |
| `nM` | `Sign::sign` | `{ "id": n }` — shows the level's `messages[n]` | `{ "showMs": 5000 }` `SIGN_MESSAGE_MS` game.js |
| `nW` | `Decoration::cloud` | — | — scenery only |
| `n>` | `Platform::platform` | `{ "axis": "x", "dir": 1 }` — sideways, setting off right | `{ "speed": 0.04, "refTravel": 80 }` `PLATFORM_SPEED` `PLATFORM_REF_AMPLITUDE` game.js · height `h` already in the object's box · travel runs to an `x` mark or the nearest solid cell |
| `n<` | `Platform::platform` | `{ "axis": "x", "dir": -1 }` — sideways, setting off left | as `n>` |
| `n^` | `Platform::platform` | `{ "axis": "y", "dir": -1 }` — up and down, setting off up | as `n>` |
| `nv` | `Platform::platform` | `{ "axis": "y", "dir": 1 }` — up and down, setting off down | as `n>` |
| `nP` | `Player::worm` | the start position | `{ "radius": 11, "speed": 3, "jump": -10.5, "jumps": 2, "wallPush": 4, "segments": 14, "gravity": 0.55, "maxFall": 12 }` game.js · parts `body`, `tail`, `headLeft`, `headRight` |

Shared by every `E`, in `checkEnemyCollisions` in game.js:

| Setting | Value |
|---|---|
| stomp | `{ "score": 1, "stat": "stomps", "sound": "sound::eat", "bounce": 0.55 }` |
| side hit with a shield | the enemy dies too: `{ "score": 1, "sound": "sound::shieldBreak", "knockback": 4 }` |
| side hit without one | costs a life |

## Notes

- A digit past the end of a list takes its first entry, so `2C` is `Coin::coin`
  and `5E` is `Beetle::beetle`.
- `1C` is `garden`'s: its glyph table makes `C` a list. The default table has
  only `coin`, for every digit.
- `garden`'s glyph table has no `W`, so its levels spawn no clouds.
- There is no `Player` class: `P` marks her start, and `game.js` draws the
  `worm` object itself.
- Gravity, fall speed and the stomp are shared today; moving them per object
  would let each enemy differ, with the current values as the defaults.
