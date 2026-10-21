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

### With any static server

`tools/serve.mjs` is only a convenience: the three tools are static pages and
run under any static server started in the project's root — live-server,
http-server, `python -m http.server` — on `localhost` (or https). Open them by
URL and pass the packs as parameters:

```
/src/index.html?pack=/levelpacks/garden/levelpack.json&assets=/assetpacks/garden/   the game
/editor/index.html?assets=/assetpacks/garden/                                     the level editor
/editor/index.html?assets=/assetpacks/garden/&pack=/levelpacks/test/levelpack.json   ... with a level pack open
/assetpack-editor/                                                                 the asset pack creator
```

The tools hand packs to each other through the browser: a shared IndexedDB
store (`src/js/packstore.js`), whose packs the service worker in `sw.js`
serves under `/__idb/<kind>/<name>/` exactly as if they were folders. So
every tool reads a pack the same way, from a URL, whether it is on disk or
kept in the browser:

- the creator's **Open in level editor** saves the pack it is editing as
  `/__idb/assets/<name>/` and opens the editor on it; its **Import** offers the
  packs saved in the browser and those in `assetpacks/`;
- the level editor's **Save in browser** keeps the open pack as
  `/__idb/levels/<name>/` and links to the game playing it
  (`/src/index.html?pack=/__idb/levels/<name>/levelpack.json&assets=...`); its
  **Open a pack…** reads one back, from the browser or from `levelpacks/`;
- the game plays whatever `?pack=` and `?assets=` name.

A static server cannot list folders, so the packs on disk are listed in
`assetpacks/index.json` and `levelpacks/index.json`, which `npm run build`
(or `npm run index-packs` alone) writes. Each origin — host and port — has a
store of its own.

## Building

```
npm run build                # src/ -> dist/game.html, then into every level pack,
                             # then assetpacks/ and levelpacks/index.json
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
tools/          bundle.mjs, pack.mjs, index-packs.mjs, serve.mjs, and gen/ for the artwork generators
dist/           build output, not checked in
old/            the project as it stood before the reorganisation
```

## Making an asset pack

`npm run creator` opens a browser app that builds a whole asset pack and hands
it back as a zip to unzip into `assetpacks/`.

- **Sprites** — the art. Frames come from image files, a sliced strip, or the
  built-in pixel editor (onion skin, mirror, flood fill, copy and paste, undo).
  A *part* is a named run of frames. Per sprite you set its size on the tile
  grid, where its body sits in it, frame rate, collision shape and glow part.
- **Objects** — what a level places. **+ New** asks for one of the game's
  classes; the form is built from the properties that class declares (scores,
  sounds, speeds, which sprite and part it wears). Its code — what a map block
  writes to place it — is the class's two characters and a third given to it.
- **Tiles** — load a `tiles.png` and set the four strings that label it.
- **Backgrounds** — drop in tiling sprites and give each a colour and distance.
- **Sounds** — synthesized defs edited against the engine's own sound board, so
  what you hear is what the game plays; plus imported `.wav`/`.mp3` for clips
  and looping music.
- **Packs in the browser** — every pack is kept in the browser (IndexedDB),
  and the **pack** picker at the top opens one; a `*` after a name means it
  has changed since it was last exported. **+ New** makes an empty pack,
  **Import…** adds one — from a `.zip`, or from an `assetpacks/<name>/` folder,
  its atlas sliced back into per-object frames — offering to replace a pack of
  the same name or keep both, and **⬇ Export .zip** downloads the open one
  as `<name>.zip`. **Remove** takes a pack that also lives elsewhere —
  imported from a file or folder, or exported — out of the browser; a pack
  that was only ever here says **Delete** instead. Either can also take the
  copy the level editor reads, if you say so.

On export it packs every object's frames into one `objects.png` and writes the
manifest, reproducing `tools/gen/pack-objects.ps1` exactly: the same atlas, to
the pixel. The generators in `tools/gen/` remain the way to produce the
procedural art; the creator is the way to assemble and edit a pack by hand.

## From object to game class

The game only spawns objects. A map block's three characters are an object's
code: the first two are its class's (Beetle `0E`, Coin `0C`), the third which
of that class's objects it is (`0C0` the first coin, `0C1` the second). The
object in `objects/objects.json` with that code is placed as its class, with
its own property values over the class's defaults, wearing the sprite its
`sprite` property names from `objects/sprites.json`. Each class declares its
code and properties in a `static editor` block, and
`src/js/classes.js` lists every class the game offers — which is also the
list the asset pack creator's **+ New** shows.

[docs/objects.md](docs/objects.md) has garden's objects as `Class::object`,
every class's properties with their defaults, and how to add a class.

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
