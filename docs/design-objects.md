# Design: sprites, objects and classes

*Built. [objects.md](objects.md) is the reference for it as it stands.*

Today one entry in `objects.json` is three things at once — the art, what the
game does with it, and (through two hard-coded tables) which map block makes
it. This splits them, so the game only spawns objects and reads everything
about them from data, and a new kind of thing is one class in the code.

## Three kinds of thing

| Kind | What it is | Lives in | Named |
|---|---|---|---|
| **Sprite** | art and its body: frames, parts, glow part, size, pivot, offset, collision, fps, slice | `objects/sprites.json` + `objects/objects.png` | `sprite::coin` |
| **Object** | one thing a level can place: its class, its 2-char code, its property values | `objects/objects.json` | `object::coin2` |
| **Class** | the behaviour, in the game's code, and the list of properties it reads | `src/js/*.js` | `Coin` |

Anything one element names another by is written with the other's kind in
front: `sprite::coin`, `sound::coin`, `background::Rain`, `object::key`. Class
names stay bare (`Coin`) — they are code, not data.

A sprite is used by objects; two objects may share one. `rock` and `rock2` are
then two objects on `sprite::rock` with different `gravity`, and the old
"Same art as" copies go away.

## A class declares itself

Each class carries one static block the editor reads; the game reads the same
block for defaults:

```js
class Coin extends Pickup {
  static editor = {
    label: 'Coin',
    glyphs: 'C',                       // the second char of its codes
    props: {
      score:     { type: 'int',   default: 1,             label: 'Score' },
      pickSound: { type: 'sound', default: 'sound::coin', label: 'Sound when picked' }
    }
  };
  take() { score += this.props.score; playSound(this.props.pickSound); ... }
}
```

- Every class has a `sprite` property (type `sprite`) without declaring it.
- Properties are inherited: `Enemy` declares the stomp (`stompScore`,
  `stompSound`, `stompBounce`) and `Beetle` adds `speed`.
- Types: `int`, `float`, `bool`, `text`, `color`, `sound`, `sprite`, `part`
  (a part of the object's sprite), `background`, and `choice` with a list.
- `src/js/classes.js` lists every class the game offers — the one place a new
  class is added. The editor loads the same files and reads that list.

The constants spread through the code today (`GEM_VALUE`, `ENEMY_SPEED`,
`FLYER_*`, `HOPPER_*`, `PLANT_*`, `LANTERN_REACH`, `ROCK_INTERVAL`,
`PLATFORM_SPEED`, the stomp in `game.js`) become these defaults, with the
same values, so nothing plays differently until a value is changed.

## An object

```json
"coin2": { "class": "Coin", "code": "1C", "props": { "sprite": "sprite::coin2", "score": 10, "pickSound": "sound::coin" } },
"lanternBig": { "class": "Lantern", "code": "1N", "props": { "sprite": "sprite::lantern", "part": "biglight", "reach": 6 } },
"platform": { "class": "Platform", "code": ["0>", "0<", "0^", "0v"], "props": { "sprite": "sprite::platform", "speed": 0.04 } }
```

- **`code`** is the 2 chars a map block uses: a digit, then one of the class's
  glyphs. The glyph map is built from these, so the per-pack `glyphs` tables
  and `DEFAULT_GLYPH_OBJECTS` go. A class whose glyph also says something —
  a platform's `>` `<` `^` `v` is its axis and first direction — takes a list.
- Where the digit is an id rather than a variant (a key's colour, a sign's
  message), the object's code says `n`: `"code": "nK"`, meaning any digit,
  passed to the class as its id.
- Only values that differ from the class default need writing; the editor
  writes them all, so a pack reads on its own.

## The game

1. A block's 2 chars find its object through the codes.
2. The object's `class` finds the class in `classes.js`.
3. The class spawns it with `this.props` — the class defaults with the
   object's values over them — and draws `this.props.sprite`.

`SPAWN`, the glyph tables and the per-class constants are gone from the code.
`P` (her start) and the worm (`sprite::worm`, drawn by `game.js`) stay as they
are: she is not placed by a code.

## The asset editor

- **Sprites** tab — today's Objects tab: frames, parts, glow, size, pivot,
  collision. No behaviour.
- **Objects** tab — new. **+ New object** asks for a class from the game's
  list, then a name; the form below is built from the class's `props` — a
  number field for `int`, a sound picker for `sound`, a sprite picker with a
  thumbnail for `sprite`, the sprite's parts for `part`. Its code is a digit
  and one of the class's glyphs, and a code two objects share is flagged.
- Packs already in the browser and on disk convert once on load: each old
  entry becomes a sprite, and an object is made for each block code that
  named it, with today's constants as its values.

## The level editor

Its palette is built from the pack's objects, not from a fixed glyph list, so
a new object or class shows up there without touching the editor.

## Files that change

- `src/js/`: every class (props instead of constants), `atlas.js` (sprites +
  objects, codes), new `classes.js`, `spawn.js` removed, `game.js` (spawn,
  stomp, platforms read props).
- `assetpacks/*/objects/`, `levelpacks/*/objects/`: `sprites.json` and a new
  `objects.json`; `levelpack.json` loses `glyphs`.
- `assetpack-editor/`: the Sprites and Objects tabs, export and import.
- `editor/index.html`: the palette.
- `tools/gen/pack-objects.ps1`: writes `sprites.json`; `objects.json` is
  authored in the editor and kept as it is.
- `docs/objects.md`: rewritten from the classes.
