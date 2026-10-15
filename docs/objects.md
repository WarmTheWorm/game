# Sprites, objects and classes

Three kinds of thing, each named with its kind in front when one points at
another (`sprite::coin`, `sound::coin`, `background::Rain`):

| Kind | What it is | Lives in |
|---|---|---|
| **Sprite** | art and its body: frames, parts, glow part, size, pivot, offset, collision, fps, slice | `objects/sprites.json` + `objects/objects.png` |
| **Object** | one thing a level can place: its class, its code, its property values | `objects/objects.json` |
| **Class** | the behaviour, and the properties it reads | `src/js/*.js`, listed in `src/js/classes.js` |

The game only spawns objects. A map block is three characters, and they are
its object's **code**:

- the first two are the **class's**, fixed by the class itself — Beetle `0E`,
  Moth `1E`, Frog `2E`, Coin `0C`. A class whose digit is an id (a key's
  colour, a sign's message) has `n` there, for any digit: `nK`.
- the third is the **object's**: which of that class's objects it is, given
  automatically — the first coin `0C0`, the second `0C1`.

```json
"coin2": {"class":"Coin","code":"0C1","props":{"sprite":"sprite::coin2","score":1,"pickSound":"sound::coin"}}
```

The object is placed as its class, with its own property values over the
class defaults. A block that matches no object exactly still places something
of its glyph — the class its digit names, variant 0 — so `5E` is a beetle.

Objects are made on the asset pack creator's **Objects** tab: **+ New** asks
for one of the game's classes and a name; the code follows from the class,
and the form below is built from what the class declares. Sprites are made on
its **Sprites** tab.

## garden's objects

| Code | Class::object | Sprite | Set apart from the class defaults |
|---|---|---|---|
| `0E0` | `Beetle::beetle` | `sprite::beetle` | |
| `1E0` | `Moth::moth` | `sprite::moth` | |
| `2E0` | `Frog::frog` | `sprite::frog` | |
| `0C0` | `Coin::coin` | `sprite::coin` | |
| `0C1` | `Coin::coin2` | `sprite::coin2` | |
| `0G0` | `Gem::gem` | `sprite::gem` | |
| `nK0` | `Key::key` | `sprite::key` | |
| `0S0` | `Shield::shield` | `sprite::shield` | |
| `0N0` | `Lantern::lanternFull` | `sprite::lantern` | `part: fulllight` |
| `0N1` | `Lantern::lanternBig` | `sprite::lantern` | `part: biglight`, `reach: 6` |
| `0N2` | `Lantern::lanternSmall` | `sprite::lantern` | `part: smalllight`, `reach: 2` |
| `nO0` | `Portal::portal` | `sprite::portal` | |
| `0!0` | `Checkpoint::checkpoint` | `sprite::checkpoint` | |
| `0V0` | `Plant::plant` | `sprite::plant` | |
| `0R0` | `RockSpawner::rock` | `sprite::rock` | |
| `0R1` | `RockSpawner::rock2` | `sprite::rock` | `gravity: 0.22`, `maxFall: 4.5` |
| `nL0` | `Door::door` | `sprite::door` | |
| `nF0` | `Flag::flag` | `sprite::flag` | |
| `nM0` | `Sign::sign` | `sprite::sign` | |
| `0W0` | `Decoration::cloud` | `sprite::cloud` | |
| `0>0` `0<0` `0^0` `0v0` | `Platform::platform` | `sprite::platform` | |
| `0P0` | — her start | `sprite::worm`, drawn by `game.js` | parts `body`, `tail`, `headLeft`, `headRight` |

## The classes

Each class declares this in its own `static editor` block; the asset pack
creator builds an object's form from it, and the game falls back on the
defaults for anything an object leaves out. Properties add up down the class
chain — an `Enemy`'s stomp is every enemy's. Every class has `sprite`.

### Beetle

Beetle · extends `Enemy` · code `0E` · stands at 50%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `stompScore` | int | `1` | Score for a stomp |
| `stompSound` | sound | `sound::eat` | Sound when stomped |
| `stompBounce` | float | `0.55` | Bounce off it, as a share of a jump |
| `speed` | float | `1.1` | Walking speed, px a frame |

### Moth

Moth · extends `Enemy` · code `1E` · stands at 50%, 50% of its cell

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

Frog · extends `Enemy` · code `2E` · stands at 50%, 0% of its cell

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

Coin · extends `Pickup` · code `0C` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `score` | int | `1` | Score |
| `pickSound` | sound | `sound::coin` | Sound when taken |

### Gem

Gem · extends `Pickup` · code `0G` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `score` | int | `5` | Score |
| `pickSound` | sound | `sound::gem` | Sound when taken |

### Key

Key · extends `Pickup` · code `nK` · stands at 50%, 50% of its cell (its digit is its id)

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `pickSound` | sound | `sound::key` | Sound when taken |

### Shield

Shield · extends `Pickup` · code `0S` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `worn` | part (optional) | `worn` | Part worn on her (without one, a plain ring) |
| `pickSound` | sound | `sound::shieldUp` | Sound when taken |

### Lantern

Lantern · extends `Pickup` · code `0N` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `part` | part | — | Lamp (part of the sprite) |
| `reach` | int | `0` | How far she sees, in tiles (0 = full light) |
| `pickSound` | sound | `sound::lantern` | Sound when taken |

### Portal

Portal · extends `Entity` · code `nO` · stands at 50%, 50% of its cell (its digit is its id)

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Checkpoint

Checkpoint · extends `Entity` · code `0!` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `off` | part | `off` | Part before she reaches it |
| `on` | part | `on` | Part once reached |
| `sound` | sound | `sound::checkpoint` | Sound when reached |

### Flag

Flag · extends `Entity` · code `nF` · stands at 50%, 50% of its cell (its digit is its id)

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Door

Door · extends `Entity` · code `nL` · stands at 0%, 0% of its cell (its digit is its id)

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `openSound` | sound | `sound::unlock` | Sound when opened |

### Sign

Sign · extends `Entity` · code `nM` · stands at 50%, 50% of its cell (its digit is its id)

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Plant

Plant · extends `Entity` · code `0V` · stands at 50%, 100% of its cell

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

Falling rock · extends `Entity` · code `0R` · stands at 50%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `interval` | int | `140` | Frames between drops |
| `gravity` | float | `0.55` | Gravity |
| `maxFall` | float | `12` | Top falling speed |

### Platform

Platform · extends `Entity` · code `0> 0< 0^ 0v` · stands at 0%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `speed` | float | `0.04` | Speed (over a 2.5-tile run; longer runs take longer) |

### Decoration

Decoration · extends `Entity` · code `0W` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

## Adding a class

1. Write it in `src/js/`, extending `Entity` (or `Pickup`, `Enemy`), with a
   `static editor = { label, code, props }` block — `code` the two characters
   its blocks start with, a digit (or `n` if the digit is the thing's id) and a
   glyph no other class uses with that digit — and, if it doesn't stand in the
   middle of its cell, a `static cellAnchor`. Read its settings from
   `this.props`.
2. Add its script tag to `src/index.html`, `editor/index.html` and
   `assetpack-editor/index.html`, and its name to `GAME_CLASSES` in
   `src/js/classes.js`.
3. On the asset pack creator's Objects tab, **+ New** now offers it.

Its bucket — the list the world keeps its kind in (`static bucket`) — must be
one `loadCustomLevel` in `game.js` knows about.
