// ---------- the terrain sheet ----------
// The sheet itself is art; what makes it readable is the four strings that
// label it. Those are the same ones a level pack carries, so what is set here
// is what the game reads.

const TILE_FIELDS = [
  ['row_0', 'Row ids', "First character of each row's name — the '1' in a 1#1 block."],
  ['row_1', 'Row glyphs', "Second character — the '#'. One per row of the sheet."],
  ['row_C', 'Row collision', "S solid, ^ top half only, 0-3 a ramp, space passes through."],
  ['row_D', 'Row draw mode', 'T crops the tile to its cell, D lets decoration spill into the margin.'],
  ['col_0', 'Column names', 'The third character of a block — which tint column it comes from.']
];

// Where things sit on the sheet, as src/js/tileset.js reads it: every cell is
// the tile plus a margin of an eighth of a tile each side, and one cell of
// labels runs down the left and across the top. Only the tile is ever drawn.
function sheetGeom(size, w, h) {
  const cell = size * 1.25, inset = size / 8;
  return {
    size, cell,
    cols: Math.max(0, Math.floor((w - cell) / cell)),
    rows: Math.max(0, Math.floor((h - cell) / cell)),
    at: (r, c) => ({ x: cell + c * cell + inset, y: cell + r * cell + inset })
  };
}

// What a map block calls the tile at (row, column), e.g. 1#1.
const tileName = (r, c) => {
  const t = pack.tiles, ch = s => (s && s !== ' ' ? s : '·');
  return ch(t.row_0[r]) + ch(t.row_1[r]) + (c === undefined ? '' : ch(t.col_0[c]));
};

let tilesImg = null;               // the sheet as last drawn, for the hover box
let tilesHot = null;               // {r, c} under the pointer

function drawSheet() {
  const cv = $('#tilesCv');
  if (!tilesImg) { cv.width = cv.height = 1; return; }
  const w = tilesImg.naturalWidth || tilesImg.width, h = tilesImg.naturalHeight || tilesImg.height;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.drawImage(tilesImg, 0, 0);
  if (tilesHot) {
    const G = sheetGeom(pack.tiles.size, w, h), p = G.at(tilesHot.r, tilesHot.c);
    g.strokeStyle = '#ffb547';
    g.lineWidth = Math.max(2, G.size / 24);
    g.strokeRect(p.x, p.y, G.size, G.size);
  }
}

function renderTiles() {
  const t = pack.tiles;
  const cv = $('#tilesCv');
  cv.classList.toggle('pickable', !!t.src);
  if (t.src) {
    loadImg(t.src).then(img => {
      tilesImg = img;
      drawSheet();
      const G = sheetGeom(t.size, img.naturalWidth, img.naturalHeight);
      $('#tilesDims').textContent = `${img.naturalWidth}×${img.naturalHeight} · tile ${t.size}px · ${G.rows} rows × ${G.cols} columns`;
    }).catch(() => { $('#tilesDims').textContent = 'That sheet could not be read'; });
  } else {
    tilesImg = null;
    drawSheet();
    $('#tilesDims').textContent = 'No sheet loaded — load one, or start a new one to draw.';
  }

  $('#tilesProps').innerHTML = `
    <label class="ctl"><div class="row"><span>Tile size</span><output>${t.size}px</output></div>
      <input type="range" data-t="size" min="8" max="128" step="8" value="${t.size}"></label>
    ${TILE_FIELDS.map(([k, label, hint]) => `
      <label class="ctl" style="grid-column:1/-1">
        <div class="row"><span>${label}</span><output class="mono">${t[k].length} long</output></div>
        <input class="mono" data-t="${k}" value="${esc(t[k])}" spellcheck="false">
        <span class="hint">${hint}</span>
      </label>`).join('')}`;
}

$('#tilesProps').addEventListener('input', e => {
  const k = e.target.dataset.t;
  if (!k) return;
  markUndo();
  pack.tiles[k] = k === 'size' ? +e.target.value : e.target.value;
  const out = e.target.parentElement.querySelector('output');
  if (out) out.textContent = k === 'size' ? pack.tiles.size + 'px' : pack.tiles[k].length + ' long';
  savePack();
});

$('#tilesLoad').onclick = async () => {
  const [file] = await pickFiles('image/png,image/*');
  if (!file) return;
  const src = await pngURL(file);
  markUndo();
  pack.tiles.src = src;
  renderTiles();
  savePack();
  toast('Sheet loaded');
};

// ---------- painting tiles ----------
function tileAt(e) {
  if (!tilesImg) return null;
  const cv = $('#tilesCv'), b = cv.getBoundingClientRect();
  const x = (e.clientX - b.left) * cv.width / b.width, y = (e.clientY - b.top) * cv.height / b.height;
  const G = sheetGeom(pack.tiles.size, cv.width, cv.height);
  const c = Math.floor((x - G.cell) / G.cell), r = Math.floor((y - G.cell) / G.cell);
  return r >= 0 && c >= 0 && r < G.rows && c < G.cols ? { r, c } : null;
}

const HIT_WORDS = { S: 'solid', '^': 'top half', ' ': 'passes through', 0: 'ramp', 1: 'ramp', 2: 'ramp', 3: 'ramp' };

$('#tilesCv').addEventListener('mousemove', e => {
  const hot = tileAt(e);
  if (hot?.r === tilesHot?.r && hot?.c === tilesHot?.c) return;
  tilesHot = hot;
  drawSheet();
  const hit = hot && (pack.tiles.row_C[hot.r] ?? ' ');
  $('#tilesHover').textContent = hot ? `${tileName(hot.r, hot.c)} · row ${hot.r + 1}, column ${hot.c + 1} · ${HIT_WORDS[hit] || hit}` : '';
});
$('#tilesCv').addEventListener('mouseleave', () => { tilesHot = null; drawSheet(); $('#tilesHover').textContent = ''; });
$('#tilesCv').addEventListener('click', e => {
  const hot = tileAt(e);
  if (hot) editTile(hot.r, hot.c).catch(err => toast(err.message, true));
});

// A tile opens in the pixel editor alone, as a one-frame stand-in object —
// a tile is a still picture, so there is nothing to step through or play —
// and every settled stroke goes straight back into its cell on the sheet.
async function editTile(r, c) {
  const t = pack.tiles;
  const img = await loadImg(t.src);
  const G = sheetGeom(t.size, img.naturalWidth, img.naturalHeight);
  const sheet = blankCanvas(img.naturalWidth, img.naturalHeight);
  const sg = sheet.getContext('2d');
  sg.drawImage(img, 0, 0);
  const p = G.at(r, c);
  const tc = blankCanvas(G.size, G.size);
  tc.getContext('2d').drawImage(sheet, p.x, p.y, G.size, G.size, 0, 0, G.size, G.size);
  const part = { id: 'tile', name: `tile ${tileName(r, c)}`, color: '#ffffff' };
  const f = { id: `tile-${r}-${c}`, src: tc.toDataURL(), partId: part.id };
  fcan.set(f.id, tc);
  const stand = { name: 'Tiles', fw: G.size, fh: G.size, frames: [f], parts: [part] };
  openPaint(stand, f, {
    single: true,
    onSave: g => {
      sg.clearRect(p.x, p.y, G.size, G.size);
      sg.drawImage(frameCanvas(stand, g), p.x, p.y);
      t.src = sheet.toDataURL('image/png');
      tilesImg = sheet;
      drawSheet();
    }
  });
}

// A blank sheet laid out from the labels: a row per row glyph, a column per
// tint name, and the labels themselves written in the gutter to read it by.
$('#tilesNew').onclick = async () => {
  const t = pack.tiles;
  const rows = t.row_1.length, cols = t.col_0.length;
  const got = await ask('Start a new terrain sheet', [
    { type: 'note', label: `${rows} rows (one per row glyph) × ${cols} columns (one per column name), at ${t.size}px a tile — set by the labels below the sheet.` },
    ...(t.src ? [{ type: 'note', label: 'This replaces the sheet that is loaded now. Ctrl+Z brings it back.' }] : [])
  ], 'Make it');
  if (!got) return;
  const cell = t.size * 1.25;
  const sheet = blankCanvas(cell * (cols + 1), cell * (rows + 1));
  const g = sheet.getContext('2d');
  g.fillStyle = '#8a80b0';
  g.font = `${Math.round(cell * 0.32)}px monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let r = 0; r < rows; r++) g.fillText(tileName(r), cell / 2, cell * (r + 1.5));
  for (let c = 0; c < cols; c++) g.fillText(t.col_0[c] || '', cell * (c + 1.5), cell / 2);
  markUndo();
  t.src = sheet.toDataURL('image/png');
  renderTiles();
  savePack();
  toast('New sheet — click a tile to paint it');
};
