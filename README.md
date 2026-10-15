# Warm the Worm

A tile-based platformer, its level editor, and the packs they feed on. Plain
scripts and plain files — the only tooling is Node for the bundler and the dev
server, and PowerShell for generating artwork.

## Running it

Everything the engine draws with is fetched, and `fetch` is blocked on `file://`
URLs, so neither page can be opened by double-clicking. Both scripts serve the
project and open the right page:

```
npm run game                 # the first level pack, usually garden
npm run game -- test         # a named level pack
npm run game -- test --built # the same pack through the bundled single file
npm run editor               # the first asset pack
npm run editor -- garden     # a named asset pack
npm run creator              # the asset pack creator
```

Add `--port=N` to move off 8080, or `--no-open` to leave the browser alone.
Naming a pack that isn't there lists the ones that are.

## Building

```
npm run build                # src/ -> dist/game.html, then into every level pack
```

This folds `src/index.html` and every script it names into one file, then writes
that file into each level pack as its `index.html` with the pack's own roots
filled in. The editor fetches the same built file for a pack you download, so a
pack carries one page rather than the engine's two dozen. Rebuild after changing
anything under `src/`, or the packs will carry the old engine.

## The two kinds of pack

**An asset pack** (`assetpacks/<name>/`) is what the editor draws with: one
tile sheet, one object atlas, the backgrounds and the sound sets. Several level
packs can be built from one of these.

```
assetpack.json     the library — which backgrounds and sound sets are offered
tiles/tiles.png    the terrain sheet
objects/           objects.png + objects.json, the atlas the game spawns from
sprites/           the source strips objects/ is packed from, one json each
backgrounds/       tiling sprites a level can sit in front of
sounds/            default.json and its variations, plus clips/ and music/
```

**A level pack** (`levelpacks/<name>/`) is a campaign, laid out the same way:
`levelpack.json`, the levels it names, and a copy of just the art and audio
those levels use. It also carries `index.html` — the built game — so the folder
is a complete game that can just be served.

```
levelpack.json     the campaign: first level, tile sheet, glyph map, sound set
index.html         the built engine, written by npm run build
levels/            every level file; exits name their siblings bare
tiles/tiles.png
objects/           objects.png + objects.json
backgrounds/       only the sprites its levels sit in front of
sounds/            default.json and the music it names
```

Every path inside a pack is resolved against the file that names it, so a pack
can be moved anywhere as one piece — which is why a level reaches its
background with `../backgrounds/`, and `levelpack.json` doesn't.

## Layout

```
src/            the engine: index.html, game.js and js/ — classic scripts, no modules
editor/         the level editor
assetpack-editor/  the asset pack creator
assetpacks/     what the editor draws with
levelpacks/     campaigns the game plays
tools/          bundle.mjs, pack.mjs, serve.mjs, and gen/ for the artwork generators
dist/           build output, not checked in
old/            the project as it stood before the reorganisation
```

## Making an asset pack

`npm run creator` opens a browser app that builds a whole asset pack and hands
it back as a zip to unzip into `assetpacks/`.

- **Objects** — one per sprite the game spawns. Frames come from image files, a
  sliced strip, or the built-in pixel editor (onion skin, mirror, flood fill,
  undo). A *part* is a named run of frames, which is what `object:part` picks.
  Per object you set how many tiles wide it is drawn, its pivot, frame rate,
  collision shape, glow part and whether it shares another object's art.
- **Tiles** — load a `tiles.png` and set the four strings that label it.
- **Backgrounds** — drop in tiling sprites and give each a colour and distance.
- **Sounds** — synthesized defs edited against the engine's own sound board, so
  what you hear is what the game plays; plus imported `.wav`/`.mp3` for clips
  and looping music.
- **Import a pack…** reads an existing `assetpacks/<name>/` back in — the atlas
  is sliced into per-object frames — so a pack can be opened and changed.

On export it packs every object's frames into one `objects.png` and writes the
manifest, reproducing `tools/gen/pack-objects.ps1` exactly: the same atlas, to
the pixel. The generators in `tools/gen/` remain the way to produce the
procedural art; the creator is the way to assemble and edit a pack by hand.

## From object to game class

An object in `objects.json` is only art and a body; what it *does* comes from
the class that spawns it. Two tables join them, both keyed by the map glyph:

- **glyph → object** — `DEFAULT_GLYPH_OBJECTS` in `src/js/atlas.js`, or a level
  pack's own `objects.glyphs`, which replaces it whole. An entry may name a part
  as `object:part`.
- **glyph → class** — `SPAWN` in `src/js/spawn.js`.

A map block is two characters: a digit, then the glyph — `1E` is a moth. In
the table `n` is any digit (anything that isn't one counts as 0). Where the
digit isn't choosing between objects it is the thing's own id: the pairing
colour for `K`, `L`, `O` and `F`, the message for `M`.

| 2char | Object | Class |
|---|---|---|
| `0E` | `beetle` | `Beetle` |
| `1E` | `moth` | `Moth` |
| `2E` | `frog` | `Frog` |
| `nC` | `coin` — garden: `0C` `coin`, `1C` `coin2` | `Coin` |
| `nG` | `gem` | `Gem` |
| `nK` | `key` | `Key` |
| `nS` | `shield` | `Shield` |
| `0N` | `lantern:fulllight` | `Lantern` |
| `1N` | `lantern:biglight` | `Lantern` |
| `2N` | `lantern:smalllight` | `Lantern` |
| `nO` | `portal` | `Portal` |
| `n!` | `checkpoint` | `Checkpoint` |
| `nV` | `plant` | `Plant` |
| `0R` | `rock` | `RockSpawner`, which drops `Rock`s |
| `1R` | `rock2` | `RockSpawner`, which drops `Rock`s |
| `nL` | `door` | `Door` |
| `nF` | `flag` | `Flag` |
| `nM` | `sign` | `Sign` |
| `nW` | `cloud` | `Decoration` |
| `n>` `n<` `n^` `nv` | `platform` | `Platform` |
| `nP` | `worm` | none — her start; `game.js` draws her |

A digit past the end of a list takes its first entry, so `5E` is a beetle.
`garden`'s glyph table has no `W`, so its levels spawn no clouds.

## Generating artwork

The generators draw everything procedurally through System.Drawing, so they
need PowerShell. Each one writes into one asset pack and takes the same `-Pack`
name, defaulting to `garden`:

```
npm run gen:art              # sprites, then the atlas, then the tile sheet
npm run gen:sprites          # draws sprites/*.png + .json
npm run gen:objects          # packs sprites/ into objects/objects.png + .json
npm run gen:tiles            # the terrain sheet
npm run gen:backgrounds      # the tiling backgrounds
npm run gen:clips            # recorded one-shots, sounds/clips/
npm run gen:music            # looping tracks, sounds/music/
npm run gen:sound-sets       # soft/retro/clips variations of default.json
```

Pass a pack through npm's `--`, e.g. `npm run gen:tiles -- -Pack garden`. Run
`gen:sprites` in a fresh shell: it compiles a helper class that a second run in
the same session would silently keep the old copy of.

`tools/gen/` also holds `inspect.ps1`, `decor-demo.ps1` and `tint.ps1`, which
look at or recolour art rather than generate it.
