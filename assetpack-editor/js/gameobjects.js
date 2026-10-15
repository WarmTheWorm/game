// ---------- objects ----------
// What a level places: one of the game's classes, the 2-char codes a map
// block names it by, and a value for each property the class reads. The class
// list and each form come from the game itself — GAME_CLASSES in
// src/js/classes.js, and each class's `editor` block — so a class added to the
// game shows up here with its own form and nothing in this file changes.

let currentObj = null;

const classLabel = C => `${C.editor.label || C.name} — ${C.name} (${C.codes.join(' ')})`;

function renderGameObjects() {
  renderGoList();
  renderGoForm();
}

function renderGoList() {
  const clash = new Set(clashingCodes().flatMap(([, names]) => names));
  $('#goList').innerHTML = pack.objects.map(o => {
    const bad = clash.has(o.name) || objectProblems(o).length;
    return `<button class="item ${o === currentObj ? 'on' : ''}" data-goid="${o.id}">
      <b>${spriteIcon(refName(o.props.sprite))}${esc(o.name)}</b><small class="${bad ? 'warn' : ''}">${esc(o.cls)}</small>
    </button>`;
  }).join('') || '<p class="empty">No objects yet.</p>';
  paintIcons($('#goList'));
}

// ---------- the form ----------
// The code is not chosen: the class fixes its first two characters and the
// object is given the first third character its class has free, so this only
// says what a map block writes and why.
function codeLine(o, C) {
  const v = variantOf(o);
  const siblings = pack.objects.filter(x => x.cls === o.cls);
  const codes = o.code.map(c => `<code class="bigcode">${esc(c)}</code>`).join(' ');
  if (!C) return codes;
  const id = C.takesId
    ? ` In a level its first character is the ${C.editor.label.toLowerCase()}'s ${esc(C.digitMeaning)}: ${esc(C.codes[0].replace('n', '3') + v)} gives 3.`
    : '';
  const which = siblings.length > 1
    ? ` The last character, ${esc(v)}, is which of the pack's ${siblings.length} ${esc(o.cls)} objects this is.`
    : ` The last character, ${esc(v)}, tells it apart from any other ${esc(o.cls)} the pack gets.`;
  return `${codes}<span class="hint">${esc(C.codes.join(' '))} is ${esc(C.name)}'s.${which}${id}</span>`;
}

// One field per property, by its declared type.
function propField(o, k, d) {
  const v = o.props[k];
  const head = `<div class="row"><span>${esc(d.label || k)}</span><code class="pk">${esc(k)}</code></div>`;
  const hint = [d.default !== undefined && d.default !== '' ? `default ${String(d.default)}` : '', d.optional ? 'optional' : '']
    .filter(Boolean).map(t => `<span class="hint">${esc(t)}</span>`).join('');
  const options = (list, prefix) => {
    const vals = list.map(n => prefix + n);
    if (v && !vals.includes(v)) vals.unshift(v);            // keep what it says, even if it's gone
    return ['', ...vals].map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${x ? esc(x) + (list.includes(refName(x)) ? '' : ' — missing') : '—'}</option>`).join('');
  };
  let input;
  switch (d.type) {
    case 'int': input = `<input type="number" step="1" data-prop="${k}" value="${esc(v)}">`; break;
    case 'float': input = `<input type="number" step="any" data-prop="${k}" value="${esc(v)}">`; break;
    case 'bool': input = `<label class="toggle"><input type="checkbox" data-prop="${k}" ${v ? 'checked' : ''}> ${esc(d.label || k)}</label>`; break;
    case 'color': input = `<input type="color" data-prop="${k}" value="${esc(v || '#ffffff')}">`; break;
    case 'choice': input = `<select data-prop="${k}">${(d.options || []).map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`; break;
    case 'sound':
      input = `<div class="row gap"><select data-prop="${k}">${options(Object.keys(pack.sounds.defs), 'sound::')}</select>
        <button class="btn sm" data-play="${k}" title="Play it" aria-label="Play">▶</button>
        <button type="button" class="btn sm" data-newsound="${k}" title="Make a new sound for this object, starting from this one">+ New</button></div>`;
      break;
    case 'sprite': {
      // a picker of its own rather than a <select>, which can't show the icons
      const cur = refName(v);
      const missing = v && !spriteByName(cur) ? ' — missing' : '';
      return `<div class="ctl">${head}<div class="sprrow"><div class="sprpick">
        <button type="button" class="sprbtn" data-sprbtn="${k}" aria-haspopup="listbox">${spriteIcon(cur)}<span class="nm">${esc(cur || '—')}${missing}</span><span class="caret">▾</span></button>
      </div><button type="button" class="btn sm" data-newsprite="${k}" title="Make a new sprite for this object and draw it">+ New</button></div>${hint}</div>`;
    }
    case 'background': input = `<select data-prop="${k}">${options(pack.backgrounds.map(b => b.name), 'background::')}</select>`; break;
    case 'part': {
      const s = spriteByName(refName(o.props.sprite));
      input = `<select data-prop="${k}">${options(s ? s.parts.filter(p => !p.glow).map(p => p.name) : [], '')}</select>`;
      break;
    }
    default: input = `<input data-prop="${k}" value="${esc(v ?? '')}">`;
  }
  return `<label class="ctl">${head}${input}${hint}</label>`;
}

function renderGoForm() {
  const o = currentObj;
  const box = $('#goForm');
  if (!o) {
    $('#goTitle').textContent = 'Object';
    box.innerHTML = '<p class="empty">Pick an object, or make one.</p>';
    drawGoPreview();
    return;
  }
  const C = gameClass(o.cls);
  const defs = classDefs(o.cls);
  const problems = objectProblems(o);
  const clash = clashingCodes().filter(([, names]) => names.includes(o.name));
  $('#goTitle').textContent = `${o.cls}::${o.name}`;
  box.innerHTML = `
    <div class="insp">
      <label class="ctl"><span>Name</span><input data-g="name" value="${esc(o.name)}" spellcheck="false"></label>
      <label class="ctl"><span>Class</span><select data-g="cls">
        ${C ? '' : `<option selected>${esc(o.cls)} — not in the game</option>`}
        ${GAME_CLASSES.map(K => `<option value="${K.name}" ${K.name === o.cls ? 'selected' : ''}>${esc(classLabel(K))}</option>`).join('')}
      </select></label>
      <div class="ctl" style="grid-column:1/-1"><span>${o.code.length > 1 ? 'Codes' : 'Code'} — what a map block writes to place it</span>
        <div class="codes">${codeLine(o, C)}</div>
      </div>
    </div>
    <h3 class="subh">${esc(o.cls)} properties</h3>
    <div class="insp">${Object.entries(defs).map(([k, d]) => propField(o, k, d)).join('')}</div>
    ${problems.length || clash.length ? `<ul class="hint probs">${[
      ...problems, ...clash.map(([code, names]) => `${code} is also ${names.filter(n => n !== o.name).join(', ')}'s code.`)
    ].map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    <div class="row gap" style="margin-top:12px"><button class="btn sm danger" data-g="delete">Delete this object</button></div>`;
  paintIcons(box);
  drawGoPreview();
}

// The sprite it wears, as the game would show it: the part a property picks
// if it has one (a plant's bud), its first frame otherwise.
function drawGoPreview() {
  const cv = $('#goPv');
  const o = currentObj;
  const s = o && spriteByName(refName(o.props.sprite));
  const C = o && gameClass(o.cls);
  if (!s || !s.frames.length) {
    cv.width = cv.height = 1;
    $('#goAbout').textContent = o ? 'No sprite to show yet — pick one below.' : '';
    return;
  }
  const partProp = Object.entries(classDefs(o.cls)).find(([, d]) => d.type === 'part');
  const part = partProp && s.parts.find(p => p.name === o.props[partProp[0]]);
  const frame = (part && framesOfPart(s, part.id)[0]) || bodyFrames(s)[0] || s.frames[0];
  const z = Math.max(1, Math.min(8, Math.floor(200 / Math.max(s.fw, s.fh))));
  cv.width = s.fw * z;
  cv.height = s.fh * z;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(frameCanvas(s, frame), 0, 0, cv.width, cv.height);
  const base = C && Object.getPrototypeOf(C);
  $('#goAbout').textContent = C
    ? `${s.name}${part ? ' · ' + part.name : ''} · ${C.name}${base && base !== Entity ? ' is a ' + base.name : ''} · stands at ${C.cellAnchor.map(n => n * 100 + '%').join(', ')} of its cell`
    : s.name;
}

// ---------- editing ----------
$('#goList').addEventListener('click', e => {
  const b = e.target.closest('[data-goid]');
  if (!b) return;
  currentObj = pack.objects.find(o => o.id === b.dataset.goid) || null;
  renderGameObjects();
});

// Names are keys in objects.json, so they keep to letters, digits, _ and -.
const objName = s => String(s).trim().replace(/[^A-Za-z0-9_-]+/g, '');

function setProp(o, k, v) {
  const d = classDefs(o.cls)[k] || {};
  markUndo();
  o.props[k] = v;
  // a new sprite has other parts to choose from, and its own icon
  if (d.type === 'sprite') renderGoForm(); else drawGoPreview();
  renderGoList();
  savePack();
}

$('#goForm').addEventListener('input', e => {
  const o = currentObj;
  if (!o) return;
  const k = e.target.dataset.prop;
  if (k) {
    const d = classDefs(o.cls)[k] || {};
    let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (d.type === 'int') { v = parseInt(v, 10); if (!Number.isFinite(v)) return; }
    if (d.type === 'float') { v = parseFloat(v); if (!Number.isFinite(v)) return; }
    setProp(o, k, v);
    return;
  }
  if (e.target.dataset.g === 'name') {
    markUndo();
    o.name = objName(e.target.value) || o.name;
    $('#goTitle').textContent = `${o.cls}::${o.name}`;
    renderGoList();
    savePack();
  }
});

$('#goForm').addEventListener('change', e => {
  const o = currentObj;
  if (!o) return;
  if (e.target.dataset.g === 'name') { e.target.value = o.name; return; }
  if (e.target.dataset.g === 'cls') {
    markUndo();
    o.cls = e.target.value;
    fillProps(o);                                   // what still applies is kept
    setVariant(o, freeVariant(o.cls, o));           // and the new class's code
    renderGameObjects();
    savePack();
  }
});

// A new sprite for this object, named after it — coin3's is sprite::coin3, a
// second sprite property's coin3Worn — worn at once and opened on the Sprites
// tab to be drawn. One undo takes the lot back.
function newSpriteFor(o, k) {
  const base = k === 'sprite' ? o.name : o.name + k[0].toUpperCase() + k.slice(1);
  let name = base, n = 2;
  while (spriteByName(name)) name = base + n++;
  markUndo();
  const s = newSprite(name);
  pack.sprites.push(s);
  o.props[k] = 'sprite::' + name;
  current = s;
  showTab('objects');
  renderObjects();
  renderGoList();
  savePack();
  toast(`Made sprite::${name} for ${o.name} — add its frames`);
}

// A new sound for this object, named after it and what the property is for —
// coin2's pickSound is coin2Pick, a beetle's stompSound beetleStomp. It starts
// as a copy of the sound the property had, so it is a variant to tweak rather
// than a blank beep, and opens on the Sounds tab. One undo takes it back.
function newSoundFor(o, k) {
  const what = k === 'sound' ? '' : k.replace(/Sound$/, '');
  const base = o.name + (what ? what[0].toUpperCase() + what.slice(1) : '');
  const id = freeId(base);
  const from = refName(o.props[k]);
  const was = pack.sounds.defs[from];
  markUndo();
  pack.sounds.defs[id] = was ? structuredClone(was) : { layers: [newOsc(988)], shake: 20 };
  o.props[k] = 'sound::' + id;
  sndSel = id;
  laySel = 0;
  useSounds();
  showTab('sounds');
  renderGoForm();
  savePack();
  toast(was ? `Made sound::${id}, a copy of sound::${from} to change` : `Made sound::${id}`);
}

// The sprite picker's list: every sprite with its icon, the current one marked.
function closeSpritePicker() { $$('.sprlist').forEach(l => l.remove()); }

function openSpritePicker(btn) {
  const o = currentObj;
  const k = btn.dataset.sprbtn;
  const cur = refName(o.props[k]);
  closeSpritePicker();
  const list = document.createElement('div');
  list.className = 'sprlist';
  list.setAttribute('role', 'listbox');
  list.innerHTML = pack.sprites.map(s => `
    <button type="button" role="option" class="spropt ${s.name === cur ? 'on' : ''}" data-sprset="${k}" data-v="sprite::${esc(s.name)}"
      aria-selected="${s.name === cur}">${spriteIcon(s.name)}<span>${esc(s.name)}</span></button>`).join('')
    || '<p class="empty">No sprites yet — make one on the Sprites tab.</p>';
  btn.parentElement.appendChild(list);
  paintIcons(list);
  const focus = list.querySelector('.on') || list.querySelector('button');
  if (focus) focus.focus();
}

document.addEventListener('click', e => { if (!e.target.closest('.sprpick')) closeSpritePicker(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSpritePicker(); });

$('#goForm').addEventListener('click', e => {
  const o = currentObj;
  if (!o) return;
  const sb = e.target.closest('[data-sprbtn]');
  if (sb) {
    if ($('.sprlist')) closeSpritePicker(); else openSpritePicker(sb);
    return;
  }
  const opt = e.target.closest('[data-sprset]');
  if (opt) { closeSpritePicker(); setProp(o, opt.dataset.sprset, opt.dataset.v); return; }
  const ns = e.target.closest('[data-newsprite]');
  if (ns) { newSpriteFor(o, ns.dataset.newsprite); return; }
  const nd = e.target.closest('[data-newsound]');
  if (nd) { newSoundFor(o, nd.dataset.newsound); return; }
  const play = e.target.closest('[data-play]');
  if (play) { sound.play(o.props[play.dataset.play]); return; }
  const g = e.target.dataset.g;
  if (g === 'delete') {
    markUndo();
    const at = pack.objects.indexOf(o);
    pack.objects.splice(at, 1);
    currentObj = pack.objects[at] || pack.objects[at - 1] || null;
    renderGameObjects();
    savePack();
    toast('Object deleted — Ctrl+Z brings it back');
  }
});

// A new object starts from a class, then a name; its sprite is the one of the
// same name if there is one, and its code its class's, with the first third
// character the class has free.
$('#goAdd').onclick = async () => {
  if (!GAME_CLASSES.length) { toast('The game offers no classes', true); return; }
  const labels = GAME_CLASSES.map(classLabel);
  const got = await ask('New object', [
    { key: 'cls', label: 'Class — what it does in the game', type: 'select', options: labels, value: labels[0] },
    { key: 'name', label: 'Name', value: '' },
    { type: 'note', label: 'Its code comes from the class, and its properties too; set them once it is made.' }
  ], 'Make it');
  if (!got) return;
  const C = GAME_CLASSES[labels.indexOf(got.cls)];
  let name = objName(got.name) || C.name.toLowerCase();
  const base = name;
  let n = 2;
  while (objectByName(name)) name = base + n++;
  const sprite = spriteByName(name) || spriteByName(C.name.toLowerCase()) || pack.sprites[0];
  markUndo();
  const o = newGameObject(name, C.name, sprite && sprite.name);
  pack.objects.push(o);
  currentObj = o;
  showTab('gameobjects');
  renderGameObjects();
  savePack();
};
