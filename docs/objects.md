# Sprites, objects and classes

Three kinds of thing, each named with its kind in front when one points at
another (`sprite::coin`, `sound::coin`, `background::Rain`):

| Kind | What it is | Lives in |
|---|---|---|
| **Sprite** | art and its body: frames, parts, glow part, size, pivot, offset, collision, fps, slice | `objects/sprites.json` + `objects/objects.png` |
| **Object** | one thing a level can place: its class, its codes, its property values | `objects/objects.json` |
| **Class** | the behaviour, and the properties it reads | `src/js/*.js`, listed in `src/js/classes.js` |

The game only spawns objects. A map block's first two characters — a digit,
then a glyph — are a **code**; the object whose `code` matches is placed, as
its class, with its own property values over the class defaults. A code of
`n` and a glyph takes any digit no other object claims; for a class whose
digit is an id (a key's colour, a sign's message) that is the usual code. A
digit nothing claims falls to the glyph's first object, so `5E` is still an
enemy.

```json
"coin2": {"class":"Coin","code":"1C","props":{"sprite":"sprite::coin2","score":1,"pickSound":"sound::coin"}}
```

Objects are made on the asset pack creator's **Objects** tab: **+ New** asks
for one of the game's classes and a name, and the form below is built from
what the class declares. Sprites are made on its **Sprites** tab.

## garden's objects

| 2char | Class::object | Sprite | Set apart from the class defaults |
|---|---|---|---|
| `0E` | `Beetle::beetle` | `sprite::beetle` | |
| `1E` | `Moth::moth` | `sprite::moth` | |
| `2E` | `Frog::frog` | `sprite::frog` | |
| `0C` | `Coin::coin` | `sprite::coin` | |
| `1C` | `Coin::coin2` | `sprite::coin2` | |
| `nG` | `Gem::gem` | `sprite::gem` | |
| `nK` | `Key::key` | `sprite::key` | |
| `nS` | `Shield::shield` | `sprite::shield` | |
| `0N` | `Lantern::lanternFull` | `sprite::lantern` | `part: fulllight` |
| `1N` | `Lantern::lanternBig` | `sprite::lantern` | `part: biglight`, `reach: 6` |
| `2N` | `Lantern::lanternSmall` | `sprite::lantern` | `part: smalllight`, `reach: 2` |
| `nO` | `Portal::portal` | `sprite::portal` | |
| `n!` | `Checkpoint::checkpoint` | `sprite::checkpoint` | |
| `nV` | `Plant::plant` | `sprite::plant` | |
| `0R` | `RockSpawner::rock` | `sprite::rock` | |
| `1R` | `RockSpawner::rock2` | `sprite::rock` | `gravity: 0.22`, `maxFall: 4.5` |
| `nL` | `Door::door` | `sprite::door` | |
| `nF` | `Flag::flag` | `sprite::flag` | |
| `nM` | `Sign::sign` | `sprite::sign` | |
| `nW` | `Decoration::cloud` | `sprite::cloud` | |
| `n>` | `Platform::platform` | `sprite::platform` | |
| `n<` | `Platform::platform` | `sprite::platform` | |
| `n^` | `Platform::platform` | `sprite::platform` | |
| `nv` | `Platform::platform` | `sprite::platform` | |
| `nP` | — her start | `sprite::worm`, drawn by `game.js` | parts `body`, `tail`, `headLeft`, `headRight` |

## The classes

Each class declares this in its own `static editor` block; the asset pack
creator builds an object's form from it, and the game falls back on the
defaults for anything an object leaves out. Properties add up down the class
chain — an `Enemy`'s stomp is every enemy's. Every class has `sprite`.

### Beetle

Beetle · extends `Enemy` · glyphs `E` · stands at 50%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `stompScore` | int | `1` | Score for a stomp |
| `stompSound` | sound | `sound::eat` | Sound when stomped |
| `stompBounce` | float | `0.55` | Bounce off it, as a share of a jump |
| `speed` | float | `1.1` | Walking speed, px a frame |

### Moth

Moth · extends `Enemy` · glyphs `E` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `stompScore` | int | `1` | Score for a stomp |
| `stompSound` | sound | `sound::eat` | Sound when stomped |
| `stompBounce` | float | `0.55` | Bounce off it, as a share of a jump |
| `speed` | float | `0.9` | Flying speed, px a frame |
| `range` | float | `3` | How far it strays each way, in tiles |
| `bob` | float | `14` | Bob height, px |
| `bobSpeed` | float | `0.05` | Bob speed |

### Frog

Frog · extends `Enemy` · glyphs `E` · stands at 50%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `stompScore` | int | `1` | Score for a stomp |
| `stompSound` | sound | `sound::eat` | Sound when stomped |
| `stompBounce` | float | `0.55` | Bounce off it, as a share of a jump |
| `hopUp` | float | `8.5` | Hop strength, up |
| `hopForward` | float | `2.2` | Hop strength, forward |
| `pause` | int | `40` | Frames on the ground between hops |

### Coin

Coin · extends `Pickup` · glyphs `C` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `score` | int | `1` | Score |
| `pickSound` | sound | `sound::coin` | Sound when taken |

### Gem

Gem · extends `Pickup` · glyphs `G` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `score` | int | `5` | Score |
| `pickSound` | sound | `sound::gem` | Sound when taken |

### Key

Key · extends `Pickup` · glyphs `K` · stands at 50%, 50% of its cell · its digit is its id

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `pickSound` | sound | `sound::key` | Sound when taken |

### Shield

Shield · extends `Pickup` · glyphs `S` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `worn` | part (optional) | `worn` | Part worn on her (without one, a plain ring) |
| `pickSound` | sound | `sound::shieldUp` | Sound when taken |

### Lantern

Lantern · extends `Pickup` · glyphs `N` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `part` | part | — | Lamp (part of the sprite) |
| `reach` | int | `0` | How far she sees, in tiles (0 = full light) |
| `pickSound` | sound | `sound::lantern` | Sound when taken |

### Portal

Portal · extends `Entity` · glyphs `O` · stands at 50%, 50% of its cell · its digit is its id

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Checkpoint

Checkpoint · extends `Entity` · glyphs `!` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `off` | part | `off` | Part before she reaches it |
| `on` | part | `on` | Part once reached |
| `sound` | sound | `sound::checkpoint` | Sound when reached |

### Flag

Flag · extends `Entity` · glyphs `F` · stands at 50%, 50% of its cell · its digit is its id

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Door

Door · extends `Entity` · glyphs `L` · stands at 0%, 0% of its cell · its digit is its id

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `openSound` | sound | `sound::unlock` | Sound when opened |

### Sign

Sign · extends `Entity` · glyphs `M` · stands at 50%, 50% of its cell · its digit is its id

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Plant

Plant · extends `Entity` · glyphs `V` · stands at 50%, 100% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `reach` | int | `100` | How high it lunges, px |
| `trigger` | int | `40` | How near overhead sets it off, px |
| `rise` | int | `16` | Frames to lunge up |
| `hold` | int | `10` | Frames held at the top |
| `fall` | int | `20` | Frames to sink back |
| `cooldown` | int | `50` | Frames before it can strike again |
| `bounce` | float | `0.4` | How far a bite throws her, as a share of a jump |
| `bud` | part | `bud` | Part when resting |
| `stem` | part | `stem` | Part stretched up to the head |
| `head` | part | `head` | Part that bites |

### RockSpawner

Falling rock · extends `Entity` · glyphs `R` · stands at 50%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `interval` | int | `140` | Frames between drops |
| `gravity` | float | `0.55` | Gravity |
| `maxFall` | float | `12` | Top falling speed |

### Platform

Platform · extends `Entity` · glyphs `><^v` · stands at 0%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `speed` | float | `0.04` | Speed (over a 2.5-tile run; longer runs take longer) |

### Decoration

Decoration · extends `Entity` · glyphs `W` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

## Adding a class

1. Write it in `src/js/`, extending `Entity` (or `Pickup`, `Enemy`), with a
   `static editor = { label, glyphs, props }` block and, if it doesn't stand
   in the middle of its cell, a `static cellAnchor`. Read its settings from
   `this.props`.
2. Add its script tag to `src/index.html`, `editor/index.html` and
   `assetpack-editor/index.html`, and its name to `GAME_CLASSES` in
   `src/js/classes.js`.
3. On the asset pack creator's Objects tab, **+ New** now offers it.

Its bucket — the list the world keeps its kind in (`static bucket`) — must be
one `loadCustomLevel` in `game.js` knows about.
