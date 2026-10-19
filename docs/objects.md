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
  Moth `1E`, Frog `2E`, Treasure `0C`. A class whose digit says something about
  the one placed has `n` there, for any digit: a key's id (`nK`, so `3K0` is
  key 3), a platform's direction (`n=`: `0=` right, `1=` left, `2=` up,
  `3=` down).
- the third is the **object's**: which of that class's objects it is, given
  automatically — the first coin `0C0`, the second `0C1`.

```json
"coin2": {"class":"Treasure","code":"0C1","props":{"sprite":"sprite::coin2","score":1,"pickSound":"sound::coin","tally":"coins"}}
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
| `0C0` | `Treasure::coin` | `sprite::coin` | `takeParticles: object::sparkle` |
| `0C1` | `Treasure::coin2` | `sprite::coin2` | `takeParticles: object::sparkle` |
| `0C2` | `Treasure::gem` | `sprite::gem` | `score: 5`, `pickSound: sound::gem`, `tally: gems`, `takeParticles: object::gemSparkle` |
| `nK0` | `Key::key` | `sprite::key` | |
| `0S0` | `Shield::shield` | `sprite::shield` | |
| `0N0` | `Lantern::lanternFull` | `sprite::lanternFull` | |
| `0N1` | `Lantern::lanternBig` | `sprite::lanternBig` | `radius: 6` |
| `0N2` | `Lantern::lanternSmall` | `sprite::lanternSmall` | `radius: 2` |
| `nO0` | `Portal::portal` | `sprite::portal` | |
| `0!0` | `Checkpoint::checkpoint` | `sprite::checkpoint` | |
| `0V0` | `Plant::plant` | `sprite::plant` | |
| `0R0` | `RockSpawner::rock` | `sprite::rock` | `breakParticles: object::dust` |
| `0R1` | `RockSpawner::rock2` | `sprite::rock` | `gravity: 0.22`, `maxFall: 4.5`, `breakParticles: object::dust` |
| `nL0` | `Door::door` | `sprite::door` | |
| `nF0` | `Flag::flag` | `sprite::flag` | |
| `nM0` | `Sign::sign` | `sprite::sign` | |
| `0W0` | `Decoration::cloud` | `sprite::cloud` | |
| `n=0` | `Platform::platform` | `sprite::platform` | |
| `0Z0` | `ParticleSystem::sparkle` | — (dots) | a gold burst, for coins |
| `0Z1` | `ParticleSystem::gemSparkle` | — (sparks) | a violet burst, for gems |
| `0Z2` | `ParticleSystem::dust` | — (squares) | a puff of grit, for rocks and stomps |
| `0Z3` | `ParticleSystem::fireflies` | — (dots) | streams slowly where placed |
| `0Z4` | `ParticleSystem::fountain` | — (dots) | streams a jet of water where placed |
| `0x0` | `PlatformStop::platformStop` | — (the editor marks it) | where a platform turns; never in the game |
| `0P0` | — her start | `Worm::worm`: `sprite::worm` | parts `body`, `tail`, `headRight` (head), `headLeft` (optional) |

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
| `stompParticles` | object (ParticleSystem) | — | Particles when killed (stomped, or hit with the shield on) |
| `speed` | float | `1.1` | Walking speed, px a frame |

### Moth

Moth · extends `Enemy` · code `1E` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `stompScore` | int | `1` | Score for a stomp |
| `stompSound` | sound | `sound::eat` | Sound when stomped |
| `stompBounce` | float | `0.55` | Bounce off it, as a share of a jump |
| `stompParticles` | object (ParticleSystem) | — | Particles when killed (stomped, or hit with the shield on) |
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
| `stompParticles` | object (ParticleSystem) | — | Particles when killed (stomped, or hit with the shield on) |
| `hopUp` | float | `8.5` | Hop strength, up |
| `hopForward` | float | `2.2` | Hop strength, forward |
| `pause` | int | `40` | Frames on the ground between hops |

### Treasure

Treasure · extends `Pickup` · code `0C` · stands at 50%, 50% of its cell

Coins and gems alike: objects differ by sprite, score and sound, and `tally`
says which achievement count taking one adds to. Gems were a class of their
own on `0G`; an old `G` block still reads as the pack's `gem`.

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `score` | int | `1` | Score |
| `pickSound` | sound | `sound::coin` | Sound when taken |
| `tally` | choice: coins, gems, none | `coins` | Counts toward the achievements as |
| `takeParticles` | object (ParticleSystem) | — | Particles when taken |

### Key

Key · extends `Pickup` · code `nK` · stands at 50%, 50% of its cell (its digit is its id)

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `pickSound` | sound | `sound::key` | Sound when taken |
| `takeParticles` | object (ParticleSystem) | — | Particles when taken |

### Shield

Shield · extends `Pickup` · code `0S` · stands at 50%, 50% of its cell

Two sprites: its own, lying in the level, and `worn`, drawn over her head
while the shield lasts — centred on it by its pivot, animated by its own fps.

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `worn` | sprite | — | Sprite worn over her head (without one, a plain ring) |
| `pickSound` | sound | `sound::shieldUp` | Sound when taken |
| `takeParticles` | object (ParticleSystem) | — | Particles when taken |

### Lantern

Lantern · extends `Pickup` · code `0N` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `radius` | int | `0` | Light radius, in tiles (0 = full light) |
| `pickSound` | sound | `sound::lantern` | Sound when taken |
| `takeParticles` | object (ParticleSystem) | — | Particles when taken |

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
| `breakParticles` | object (ParticleSystem) | — | Particles when a rock breaks, on the ground or on her |

### Platform

Platform · extends `Entity` · code `n=` (its digit is its direction: 0 right, 1 left, 2 up, 3 down) · stands at 0%, 0% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |
| `speed` | float | `0.04` | Speed (over a 2.5-tile run; longer runs take longer) |

### PlatformStop

PlatformStop · extends `Entity` · code `0x` · editor only

Placed in any layer on a platform's line of travel, it ends the run there as
a solid tile would. The level editor draws it as a red ⛔ marker; the game
reads it while building the platforms and never spawns or draws it. It needs
no sprite.

### ParticleSystem

ParticleSystem · extends `Entity` · code `0Z` · stands at 50%, 50% of its cell
(`js/particles.js`)

A cloud of small dots, squares, sparks or tiny sprites, each thrown out at a
speed and angle, pulled by gravity, slowed by drag, and changing size and
colour over its life. Used two ways:

- **named by another object** — a property of type `object` (a pickup's
  `takeParticles`, an enemy's `stompParticles`, a rock spawner's
  `breakParticles`) holds `object::<name>`, and the game bursts `count`
  particles where that thing went;
- **placed in a level** — it streams `rate` particles a frame from its spot
  while it is near the screen; with no rate it bursts `count` there every
  `interval` frames instead (0 shows nothing).

In the level editor's board and palette each one shows a still of itself
in the middle of a run — a burst some way through its life, a stream once it
has filled out — at its size in the game, or shrunk to fit: on the board
it may spread over the 3x3 blocks round its cell (its own cell darkened
under it), in the palette it fits its swatch. The run is seeded,
so the picture holds still, and is made again when the object's props
change.

Its sprite is optional: without one each particle is drawn as `shape`. The
asset pack creator shows it running as its preview, and gives a pack with no
particle systems the five above (`ParticleSystem.presets`), wiring its
coins, gems, rocks and enemies to them.

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite (optional) | — | Each particle wears it, sized and faded like a dot |
| `count` | int | `16` | Particles in a burst |
| `rate` | float | `0` | Particles a frame, placed in a level (0 = bursts instead) |
| `interval` | int | `60` | Frames between bursts, placed with no rate (0 = never) |
| `speed` | float | `2` | Speed, px a frame |
| `speedJitter` | float | `0.5` | Speed varies by, as a share |
| `angle` | int | `-90` | Direction, degrees (0 right, -90 up) |
| `spread` | int | `360` | Spread round it, degrees |
| `gravity` | float | `0.1` | Gravity (negative rises) |
| `drag` | float | `0.97` | Speed kept each frame (1 = no drag) |
| `life` | int | `30` | Life, frames |
| `lifeJitter` | float | `0.3` | Life varies by, as a share |
| `radius` | float | `0` | Starts anywhere within, px |
| `sizeStart` | float | `4` | Size at birth, px |
| `sizeEnd` | float | `0` | Size at death, px |
| `colorStart` | color | `#ffffff` | Colour at birth |
| `colorEnd` | color | `#ffffff` | Colour at death |
| `fade` | bool | `true` | Fades out |
| `shape` | choice: circle, square, spark | `circle` | Shape, without a sprite |
| `glow` | bool | `false` | Glows (adds light) |

### Decoration

Decoration · extends `Entity` · code `0W` · stands at 50%, 50% of its cell

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | — | Sprite |

### Worm

Worm · extends `Entity` · no code: she is the player, never placed by a block;
the game takes the pack's one Worm object at every load (`js/worm.js`). Her
head radius — what she hits the tiles with — is her sprite's collision circle
(half the longer side of a box; 11 without one).

| Property | Type | Default | What it is |
|---|---|---|---|
| `sprite` | sprite | `sprite::worm` | Sprite |
| `body` | part | `body` | Body — its frames are the shades, head to tail |
| `tail` | part | `tail` | Tail tip |
| `head` | part | `headRight` | Head, facing right |
| `headLeft` | part (optional) | `headLeft` | Head facing left (without one, the right one mirrored) |
| `segments` | int | `14` | Body parts, head to tail |
| `tailScale` | float | `0.32` | Tail size, a share of the head (1 = no taper) |
| `speed` | float | `3` | Run speed, px a frame |
| `jump` | float | `10.5` | Jump speed, px a frame |

## Adding a class

1. Write it in `src/js/`, extending `Entity` (or `Pickup`, `Enemy`), with a
   `static editor = { label, code, props }` block — `code` the two characters
   its blocks start with, a digit (or `n` if the digit is read by the class,
   with `digit` saying what it means; an id unless said) and a glyph no other
   class uses with that digit — and, if it doesn't stand in the
   middle of its cell, a `static cellAnchor`. Read its settings from
   `this.props`.
2. Add its script tag to `src/index.html`, `editor/index.html` and
   `assetpack-editor/index.html`, and its name to `GAME_CLASSES` in
   `src/js/classes.js`.
3. On the asset pack creator's Objects tab, **+ New** now offers it.

Its bucket — the list the world keeps its kind in (`static bucket`) — must be
one `loadCustomLevel` in `game.js` knows about.

### Guides: what a class shows of itself while a level is built

A class may define `static drawGuide(g, view)` to draw something beyond its
art where a level is being built or checked, never in normal play. It is
called once per placed thing, and once per palette swatch, after the art:

| `view.mode` | Called by | Drawn in |
|---|---|---|
| `board` | the level editor's board | world units; `view.r`, `view.c` its cell |
| `panel` | a level editor palette swatch | the swatch's own pixels, `view.size` square |
| `debug` | the game's collision view (▦) | world units |

`view.digit` is its block's digit, `view.name` the object placed (so a class
can read its props with `propsFor`), `view.blocks(r, c)` says whether a cell
stops things moving as the game will see it, `view.px` is screen pixels per
unit (for lines that stay thin) and `view.hasArt` whether its sprite drew
anything. A platform draws its run and the way it sets off (its run worked
out by `Platform.run`, which the game's loader uses too); a platform stop
draws its marker (`static marker`, via `Entity.drawMarker`). The editors name
no class — they only call the hook.
