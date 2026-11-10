# Plan: one folder per level pack

**Goal.** A level pack is one folder in the browser. The level editor edits
its level files, the Asset Editor edits its art files, and the game, Test,
Play, Share and Download all read that same folder. There is no second copy
to build, sync or check for staleness.

## Where things are today

A level pack the editor owns is kept in up to four places:

| Part | Where | Written by |
|---|---|---|
| Name, levels, settings | localStorage `warmWormEditorLevel`, the editor's whole list as one JSON | Level editor, on every change (`persist`) |
| Art | IndexedDB `warm-worm-packs` → `assets/lp-<uid>` | Asset Editor's commit on Edit levels |
| Art while it is being edited | IndexedDB `assetpack-editor`: the working model, plus a base copy for Revert | Asset Editor, debounced to 400 ms |
| The playable/shared pack | `warm-worm-packs` → `levels/<name>`: the game page, levels and a copy of the art | `mirrorNow`, 2.5 s after a change (`levelPackFiles`) |

Code that exists only to keep these in step, and would go:
- **Level editor:** `mirrorNow`, `mirrorKey`, `artV`, `adoptArt` and `adoptLater`, `artOfStoredPack`, the `reopenOn` page reload on art change, `?for=` and `?new`, and `fresh`/`keepBase`.
- **Asset Editor:** the commit message handshake and its `editCount`/`editBase`.
- **Cleanup:** `ArtTidy`.

## Two facts that shape the design

1. **The Asset Editor's model is richer than the files the game reads.**
   - The model keeps sprites as separate frames, with parts, part colours, ids and the uncropped frame size.
   - Export packs them into an atlas, `objects.png` + `sprites.json`, cropped and scaled (`atlas.js`).
   - Reading an atlas back (`import.js`) gets close but is not lossless.
   - So the folder must also keep the Asset Editor's **source**, not only the built atlas.
2. **The level editor's in-memory level is not the level file, but it converts both ways without loss.**
   - `levelJson(i)` rewrites exits as paths and backgrounds as specs, and import reads them back.
   - Phase 0 checked that round trip (see below). Only the levels' order needs keeping on the side.

Neither is a duplicate in the bad sense, because both live in the one folder:
- One writer owns each pair: source + build.
- The build is rewritten from the source in the same save.
- Every reader sees one folder.

## The folder

```
/__idb/packs/<uid>/                 one per level pack, keyed by its id (names change)
  levelpack.json                    as today
  levels/01-<name>.json …           as today
  tiles/ objects/ sounds/ backgrounds/   the built art, as today
  .wtw/pack.json                    name, share name, private, current level, the levels' order
  .wtw/art.json                     the Asset Editor's model, with media replaced by paths
  .wtw/frames/<hash>.png            sprite frames, tile sheet source, background sources
```

- **Duplicates cost nothing.** Every file is kept once, by SHA-256, so the files `.wtw/` shares with the built art take no extra space.
- **Duplicate is cheap.** It copies a manifest, not bytes.
- **`.wtw/` stays private.** It isn't sent to friends or put in downloads. A friend gets only the playable files; a `.zip` for re-editing can include it.
- **No `index.html` in the folder.**
  - For local play, the service worker answers `/__idb/packs/<uid>/index.html` with the site's current engine (the `dist/game.html` page pointed at `levelpack.json`). An edit can never meet a stale engine page.
  - Share and Download add the engine page to what they send, so a friend's copy stands alone, as today.

## Store changes (`src/js/packstore.js`)

- **`write(kind, name, {put: [{name, data}], remove: [paths]})`**: change some files of a pack in one transaction, and bump its manifest. Today `put` replaces the whole pack.
- **`copy(kind, from, to)`**: copy a manifest. Used by Duplicate, drafts and pins.
- **Editing works on a draft (temp copy), and Save publishes it:**
  - Opening a pack for editing makes `drafts/<uid>`, a `copy` of `packs/<uid>`. It costs only file records, because the bytes are already kept.
  - Both editors autosave into the draft. Test plays the draft.
  - **Save** copies the draft over `packs/<uid>` and deletes the draft. That's instant, again only records.
  - Friends, Play and share links only ever see `packs/<uid>`, so they never get half-done work.
  - `*` means a draft exists and differs from the pack. **Revert** deletes the draft.
  - A draft isn't deleted when the tab closes. If the browser crashes, the next open offers to carry on with it.
  - This replaces the Asset Editor's second Revert copy and the "base" idea.
- **Sweep safety:**
  - `sweep` keeps any blob that some pack names, and drafts and pins are packs, so they count.
  - The share host pins what it is sending: a copy under `~pins/`, released when the friend is done, or after an hour. A save in the middle can't change or sweep what the friend is fetching.

## Phases

Each phase lands on its own, and the site keeps working after each one.

### Phase 0: groundwork (nothing visible) — done
- **Store:** added `packStore.write` (change some files in one transaction), `packStore.copy` (records only; the copy keeps the version) and `packStore.pin`. Tested in the browser.
- **Share host:** serves a friend from a pin, so one fetch is always one save.
- **Service worker:** `/__idb/packs/<id>/index.html`, when the folder has none, is the site's current `dist/game.html` pointed at the folder. Tested: a folder plays straight into level 1, with every file from the folder.
- **Level-file round trip:** built every level of five packs with `levelJson` and read them back with the import's `fromText`. Nothing is lost.
  - Only two harmless normalisations: an unset `music` comes back as missing rather than `null`, and a level with no name gets its default name ("Level 1").
  - So there is no `.wtw/levels.json`. The editor reads the level files themselves.
  - **One catch:** import finds levels by walking the flags from the first level. Level **order**, and any level no flag reaches, aren't in the files. The order goes in `.wtw/pack.json`.

### Phase 1: the level editor works in the folder

**Done.** Notes from building it:
- The editor page is open on one folder at a time (`?open=<uid>`, its draft is the art it draws with). Switching packs opens the page again, as before.
- Levels are read only once the art library has loaded. If it fails to load, the pack is neither read nor written, because reading without it drops the backgrounds and tracks its levels name.
- A journal in localStorage keeps the latest draft until the folder write lands, and it is replayed on the next opening.
- In a draft, a flag not set yet is kept as `null`, so the flags after it keep their places.
- Packs from before a `levelpack.json` listed its backgrounds get the backgrounds their levels name.
- **Follow-up, done:** one entry per level pack.
  - A draft exists only while there are unsaved changes. It's made by the first write after a save, and let go of by Save, by Revert, or by a write that matches what was saved.
  - Both editors use the draft's address, and the service worker answers it from `packs/` when there's no draft.
  - Friends fetch straight from `packs/<uid>` by its share name (`share/core.js` `folderSource`). That leaves out `.wtw/` and adds the engine page, and the send is pinned.
  - `share list` and `share del` work on the editor's level packs themselves. Old `levels/<share name>` copies are removed the next time the pack is opened.
- The Asset Editor writes its art into the draft (`putOwnedArt`). Its own working-copy database is still there; that is Phase 2.
- **One store for all level packs.** The editor's list is read from `packs/` (`.wtw/pack.json` of each folder) instead of localStorage.
  - "Also in this browser" disappears: a pack fetched from a friend is a folder like any other, editable straight away. Opening it no longer imports a copy.
- **Saving.** A level change writes `levels/NN-….json` (and the source, if needed) and `levelpack.json` on a short debounce. It also flushes on `pagehide` and `visibilitychange`, because IndexedDB is asynchronous and localStorage was not.
  - A tiny localStorage journal of the one unsaved level covers a tab that closes mid-write. It is read back on the next load, then cleared.
- **Pack actions.**
  - New: a folder from a template (garden art, or any pack's art), plus one blank level.
  - Duplicate: `copy`.
  - Delete: remove the folder and its draft.
  - Rename: change `.wtw/pack.json`; the share name stays.
- **Test, Play and Share.**
  - Test runs the live engine on the folder (`?pack=/__idb/packs/<uid>/levelpack.json&test=1`) and hands in the level on screen, as today.
  - Play opens `/__idb/packs/<uid>/index.html?play`.
  - Share links stay `get=<share name>`.
- **The mirror goes.** `mirrorNow` and everything listed above as sync code is removed, and so is the page reload when switching packs. Every pack's art is read from its own folder, so the editor can load the new art in place.

### Phase 2: the Asset Editor works in the folder
- **Opening.** It opens a folder (`?pack=<uid>`). It reads `.wtw/art.json` if present; otherwise it reads the built art, as import does today, once, for old packs.
- **Saving.** A save writes `.wtw/art.json` and its frames on the 400 ms debounce, as today. It rebuilds the atlas and manifests (`buildPackFiles`) less often: about 2 s after changes stop, and on Edit levels.
  - The atlas build is the slow part, so it is kept off every keystroke.
- **Edit levels** only waits for the pending build, then shows the level editor. That editor reads the new art from the folder in place, with no reload. The commit handshake goes.
- **Its own database goes.**
  - Undo stays in memory, as today.
  - Revert deletes the draft.
- **The standalone `/assetpack-editor/` page** becomes the same editor opened on a folder.
  - Its pack list is the level packs.
  - Importing an asset-pack `.zip` makes a new level pack with one blank level.
  - "Open in level editor" opens that folder.

### Phase 3: migration and cleanup
Runs once at the editor's first load after the update.

- **Each pack in the localStorage list becomes `packs/<uid>`:**
  - its levels from the list
  - its art from the Asset Editor's working copy if that is newer than `lp-<uid>`, otherwise from `lp-<uid>`
  - its share name from `mirror`
  - its privacy flag
- **Each `levels/<name>` the editor doesn't own** (fetched or uploaded) becomes a folder too.
- **Then the old copies go:** the `lp-*` art, the `levels/*` copies, the `assetpack-editor` database, and the localStorage list.
  - This happens only after every new folder has been read back and checked.
  - If anything fails, the old data stays and the editor runs on it, with a message.
- **Old share links keep working.** The share page looks the `get=` name up among the folders' share names. Packs fetched from friends with old engine pages keep their own page, with the service worker's `play-run` fix.
- **Remove** `ArtTidy`, `share tidy` and the `assets` line of `share store`. Update the README.

## Risks and decisions

| Risk | Handling |
|---|---|
| A friend fetches while you edit and gets a mix of two saves | The host sends from one pinned manifest, so a fetch is always one save. The version `v` changes with each save, as now. |
| IndexedDB writes are asynchronous, so a tab can close before the last edit is written | Flush on `pagehide`, plus the one-level localStorage journal |
| The atlas build is slow on big packs | Debounce it separately from the source save, and always run it before Test, Play, Share and Edit levels |
| Migration loses data | Read back and verify before deleting; old data is kept if anything fails; a downloadable backup `.zip` of everything first |
| Old browsers or old pages open in another tab write the old way during migration | The `BroadcastChannel` the share host uses announces the new format, and old pages show "reload" |

## Decisions for you

1. **Packs from friends are editable in place.** I recommend this: any level pack is yours to change. The alternative is that editing one makes a copy first, as today.
2. **Save:** editing happens in a draft, and Save publishes it (your idea; I recommend it). `*` and Revert follow the draft, so "changed since export" goes away. Download is just a way to get a file.
3. **The standalone Asset Editor page** stays, opened on a level pack, or goes and lives only under Edit assets. I recommend keeping it: it's a direct link, and the code is shared.

## Size

- Phase 0 is small.
- Phases 1 and 2 are the bulk. They touch most of `editor/index.html`'s pack code and the Asset Editor's `db.js`, `app.js`, `export.js` and `pack.js` saving paths.
- Phase 3 is medium, and most of its weight is testing the migration on real data: the localhost, c.localhost and d.localhost origins, and a backup of the github.io one.
- Phases 1–3 should go live together. Phase 1 alone works, but it would leave two models on the live site for a while.
