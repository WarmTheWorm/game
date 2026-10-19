// ---------- copy and paste in the left lists ----------
// With the pointer over a tab's list (or a click just made in it), Ctrl+C
// copies the object, sprite or sound picked there and Ctrl+V adds a copy of it
// under the next free name — coin → coin2 — and picks it. The copy is held
// here, not on the system clipboard, so it outlives Import: copy from one
// pack, import another, paste. Anywhere else on the tab the keys keep their
// own meaning: frames on the Sprites tab, layers on the Sounds tab.
let listClip = null;        // { kind: 'object' | 'sprite' | 'sound', name, data }

const LIST_KINDS = {
  gameobjects: { list: '#goList', kind: 'object' },
  objects: { list: '#objList', kind: 'sprite' },
  sounds: { list: '#sndList', kind: 'sound' }
};

// The next free name from `base`, by `taken`: coin → coin2, coin2 → coin3.
function nextName(base, taken) {
  const stem = base.replace(/\d+$/, '') || base;
  if (!taken(base)) return base;
  let n = 2, name;
  do name = stem + n++; while (taken(name));
  return name;
}

function copyListItem(kind) {
  if (kind === 'object') {
    const o = currentObj;
    if (!o) { toast('Pick an object first', true); return; }
    listClip = { kind, name: o.name, data: structuredClone({ cls: o.cls, props: o.props }) };
  } else if (kind === 'sprite') {
    const s = current;
    if (!s) { toast('Pick a sprite first', true); return; }
    // each frame as its pixels are now, which may be newer than its src
    const frames = s.frames.map(f => ({ partId: f.partId, src: frameCanvas(s, f).toDataURL() }));
    const { frames: _, ...rest } = s;
    listClip = { kind, name: s.name, data: { ...structuredClone(rest), frames } };
  } else {
    const d = sndSel && pack.sounds.defs[sndSel];
    if (!d) { toast('Pick a sound first', true); return; }
    listClip = { kind, name: sndSel, data: structuredClone(d) };
  }
  toast(`Copied ${kind}::${listClip.name} — Ctrl+V over the list adds a copy`);
}

async function pasteListItem(kind) {
  if (!listClip) { toast(`Copy ${kind === 'object' ? 'an object' : 'a ' + kind} first — Ctrl+C over the list`, true); return; }
  if (listClip.kind !== kind) {
    toast(`The copy is a ${listClip.kind} (${listClip.name}) — paste it on the ${listClip.kind === 'object' ? 'Objects' : listClip.kind === 'sprite' ? 'Sprites' : 'Sounds'} tab`, true);
    return;
  }
  const c = structuredClone(listClip.data);
  let name;
  if (kind === 'object') {
    const C = gameClass(c.cls);
    if (C && C.editor.player && pack.objects.some(o => o.cls === c.cls)) { toast('A pack has one worm — this one already has her', true); return; }
    name = nextName(listClip.name, n => !!objectByName(n));
    markUndo();
    const o = { id: uid(), name, cls: c.cls, code: [], props: c.props };
    fillProps(o);
    setVariant(o, freeVariant(o.cls, o));
    const at = pack.objects.indexOf(currentObj);
    pack.objects.splice(at >= 0 ? at + 1 : pack.objects.length, 0, o);
    currentObj = o;
    renderGameObjects();
  } else if (kind === 'sprite') {
    name = nextName(listClip.name, n => !!spriteByName(n));
    markUndo();
    const s = { ...c, id: uid(), name, frames: c.frames.map(f => ({ id: uid(), src: f.src, partId: f.partId })) };
    await Promise.all(s.frames.map(f => attachFrame(s, f)));
    const at = pack.sprites.indexOf(current);
    pack.sprites.splice(at >= 0 ? at + 1 : pack.sprites.length, 0, s);
    current = s;
    renderObjects();
  } else {
    name = freeId(listClip.name.replace(/\d+$/, '') || listClip.name);
    markUndo();
    pack.sounds.defs[name] = c;
    sndSel = name;
    laySel = 0;
    useSounds();
    renderSounds();
  }
  savePack();
  toast(`Pasted ${kind}::${name}, a copy of ${listClip.name}`);
}

// in capture, ahead of the tabs' own Ctrl+C/V, which only see the keys when
// the pointer is elsewhere
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
  if ($('#paint').open || $('#ask').open || (e.target.matches && e.target.matches('input,select,textarea'))) return;
  const page = $('.page.on');
  const at = page && LIST_KINDS[page.dataset.page];
  if (!at) return;
  const list = $(at.list);
  if (!list.matches(':hover') && !list.contains(document.activeElement)) return;
  // by the key's place, so it works whatever the keyboard's language
  const key = e.code || 'Key' + (e.key || '').toUpperCase();
  if (key !== 'KeyC' && key !== 'KeyV') return;
  e.preventDefault();               // no browser copy or paste event follows
  e.stopImmediatePropagation();
  if (key === 'KeyC') copyListItem(at.kind); else pasteListItem(at.kind);
}, true);
