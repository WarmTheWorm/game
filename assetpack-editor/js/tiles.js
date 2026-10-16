// ---------- the terrain sheet ----------
// The sheet is a grid of tiles: a row per kind of tile, a column per tint. A
// row is named by two characters — the 1# of a 1#1 block — and says what it
// collides as; the third character of a block is the column, always 0 to 9.
// They are kept as the strings a level pack carries (row_0, row_1, row_C),
// edited here a row at a time.

const TILE_COLUMNS = '0123456789';

// What a row can collide as, by the character the game reads.
const TILE_HITS = [
  [' ', 'None'], ['S', 'Solid'], ['^', 'Top half'],
  ['0', 'Ramp up ◢'], ['1', 'Ramp down ◣'], ['2', 'Ceiling ramp ◥'], ['3', 'Ceiling ramp ◤']
];

// Where things sit on the sheet, as src/js/tileset.js reads it: every cell is
// the tile plus a margin of an eighth of a tile each side, and only the tile
// is ever drawn. A sheet from before carries one more cell of labels down the
// left and across the top; it is told by its width.
function sheetGeom(size, w, h) {
  const cell = size * 1.25, inset = size / 8;
  const gutter = Math.round(w / cell) > TILE_COLUMNS.length ? cell : 0;
  return {
    size, cell, gutter,
    cols: Math.max(0, Math.floor((w - gutter) / cell)),
    rows: Math.max(0, Math.floor((h - gutter) / cell)),
    at: (r, c) => ({ x: gutter + c * cell + inset, y: gutter + r * cell + inset })
  };
}

// A sheet with the old label cells has them cut off, once. True if it had.
async function migrateTileSheet(p) {
  const t = p.tiles;
  t.col_0 = TILE_COLUMNS;
  if (!t.src) return false;
  const img = await loadImg(t.src).catch(() => null);
  if (!img) return false;
  const G = sheetGeom(t.size, img.naturalWidth, img.naturalHeight);
  if (!G.gutter) return false;
  const c = blankCanvas(img.naturalWidth - G.gutter, img.naturalHeight - G.gutter);
  c.getContext('2d').drawImage(img, -G.gutter, -G.gutter);
  t.src = c.toDataURL('image/png');
  return true;
}

// The row strings stretched or cut to the sheet's rows, so every row has an
// id, a glyph, a collision and a draw mode.
function fitRows(n) {
  const t = pack.tiles;
  const fit = (s, pad) => (s || '').padEnd(n, pad).slice(0, n);
  t.row_0 = fit(t.row_0, ' ');
  t.row_1 = fit(t.row_1, ' ');
  t.row_C = fit(t.row_C, ' ');
  t.row_D = fit(t.row_D, 'T');
}

const setAt = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);

// What a map block calls the tile at (row, column), e.g. 1#1.
const tileName = (r, c) => {
  const t = pack.tiles, ch = s => (s && s !== ' ' ? s : '·');
  return ch(t.row_0[r]) + ch(t.row_1[r]) + (c === undefined ? '' : TILE_COLUMNS[c] || '·');
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
      renderTileRows(G.rows);
    }).catch(() => { $('#tilesDims').textContent = 'That sheet could not be read'; });
  } else {
    tilesImg = null;
    drawSheet();
    $('#tilesDims').textContent = 'No sheet loaded — load one, or start a new one to draw.';
    renderTileRows(0);
  }
}

// One line per row of the sheet: its first tile, its two-character name and
// what it collides as.
function renderTileRows(n) {
  const t = pack.tiles;
  if (n) fitRows(n);
  const hitOpts = cur => TILE_HITS.map(([v, label]) => `<option value="${v === ' ' ? '_' : v}" ${v === cur ? 'selected' : ''}>${label}</option>`).join('');
  $('#tilesProps').innerHTML = `
    <label class="ctl"><div class="row"><span>Tile size</span><output>${t.size}px</output></div>
      <input type="range" data-t="size" min="8" max="128" step="8" value="${t.size}"></label>
    ${n ? `<div class="trows" style="grid-column:1/-1">
      <div class="trow head"><span>Row</span><span></span><span>Id</span><span>Glyph</span><span>Collides as</span></div>
      ${[...Array(n).keys()].map(r => `<div class="trow" data-r="${r}">
        <span class="mono">${r + 1}</span>
        <canvas class="ico" width="24" height="24" data-trow="${r}" aria-hidden="true"></canvas>
        <input class="mono" data-tr="id" maxlength="1" value="${esc(t.row_0[r].trim())}" placeholder="·" aria-label="Row ${r + 1} id" spellcheck="false">
        <input class="mono" data-tr="glyph" maxlength="1" value="${esc(t.row_1[r].trim())}" placeholder="·" aria-label="Row ${r + 1} glyph" spellcheck="false">
        <select data-tr="hit" aria-label="Row ${r + 1} collision">${hitOpts(t.row_C[r])}</select>
      </div>`).join('')}
      <p class="hint">A map block names a tile by its row's id and glyph, then its column 0–9: row <code>1#</code>, column 1 is <code>1#1</code>. An id left empty takes any digit.</p>
    </div>` : ''}`;
  // each row's first tile, from the sheet as it is now
  if (tilesImg && n) {
    const w = tilesImg.naturalWidth || tilesImg.width, h = tilesImg.naturalHeight || tilesImg.height;
    const G = sheetGeom(t.size, w, h);
    $$('#tilesProps canvas[data-trow]').forEach(cv => {
      const p = G.at(+cv.dataset.trow, 0);
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(tilesImg, p.x, p.y, G.size, G.size, 0, 0, 24, 24);
    });
  }
}

$('#tilesProps').addEventListener('input', e => {
  const t = pack.tiles;
  if (e.target.dataset.t === 'size') {
    markUndo();
    t.size = +e.target.value;
    e.target.parentElement.querySelector('output').textContent = t.size + 'px';
    savePack();
    return;
  }
  const what = e.target.dataset.tr;
  const row = e.target.closest('[data-r]');
  if (!what || !row) return;
  const r = +row.dataset.r;
  markUndo();
  const ch = (e.target.value || ' ').slice(-1);
  if (what === 'id') t.row_0 = setAt(t.row_0, r, ch);
  if (what === 'glyph') t.row_1 = setAt(t.row_1, r, ch);
  if (what === 'hit') t.row_C = setAt(t.row_C, r, e.target.value === '_' ? ' ' : e.target.value);
  savePack();
});
// a size change moves where every tile is, so the rows and sheet are redrawn
$('#tilesProps').addEventListener('change', e => { if (e.target.dataset.t === 'size') renderTiles(); });

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
  const got = await ask('Start a new terrain sheet', [
    { key: 'rows', label: 'Rows — one per kind of tile', type: 'number', value: t.row_1.length || 20 },
    { type: 'note', label: `Each row has 10 columns, 0 to 9, at ${t.size}px a tile. Name the rows and say what they collide as below the sheet.` },
    ...(t.src ? [{ type: 'note', label: 'This replaces the sheet that is loaded now. Ctrl+Z brings it back.' }] : [])
  ], 'Make it');
  if (!got) return;
  const rows = parseInt(got.rows, 10);
  if (!(rows >= 1 && rows <= 64)) { toast('Pick from 1 to 64 rows', true); return; }
  const cell = t.size * 1.25;
  const sheet = blankCanvas(cell * TILE_COLUMNS.length, cell * rows);
  markUndo();
  t.src = sheet.toDataURL('image/png');
  fitRows(rows);
  renderTiles();
  savePack();
  toast('New sheet — click a tile to paint it');
};
