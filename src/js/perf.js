// ---------- Debug: performance ----------
// With the ⏱ button on (it shows while Debug is on in Options), every stage of
// a frame is timed and the averages drawn over the level, twice a second:
// what the fixed-step update spent on her physics, on the objects and on her
// body, and what drawing spent on the backdrop, each tile layer, the objects,
// the worm and the lantern dark — with the frame rate, the steps a frame,
// how many tiles, objects and images were drawn, and the heap where the
// browser tells. Off, the marks cost one boolean test each.
const perf = {
  on: false,
  acc: {},          // ms summed over the window, by stage
  counts: {},       // things counted over the window, by kind
  frames: 0,
  since: 0,
  shown: null,      // the last window's averages, as drawn
  rawDraw: null
};

const PERF_WINDOW = 500;     // ms each set of averages covers

// What a stage is called on screen, in the order it is listed; the indented
// ones are part of the line above.
const PERF_ROWS = [
  ['update', 'update (all steps)'],
  ['physics', '  her physics'],
  ['objects', '  objects'],
  ['body', '  her body'],
  ['draw', 'draw'],
  ['background', '  background'],
  ['tilesBack', '  tiles, back'],
  ['tilesMain', '  tiles, main'],
  ['tilesFront', '  tiles, front'],
  ['entities', '  objects'],
  ['worm', '  worm'],
  ['dark', '  lantern dark'],
  ['frame', 'whole frame']
];

const perfNow = () => (perf.on ? performance.now() : 0);
function perfAdd(stage, t0) { if (perf.on) perf.acc[stage] = (perf.acc[stage] || 0) + performance.now() - t0; }
function perfCount(kind, n = 1) { if (perf.on) perf.counts[kind] = (perf.counts[kind] || 0) + n; }

// Counting images means seeing every drawImage, so the context's own is
// wrapped while timing is on and given back after.
function setPerf(on) {
  perf.on = on;
  perf.acc = {};
  perf.counts = {};
  perf.frames = 0;
  perf.since = performance.now();
  perf.shown = null;
  if (on && !perf.rawDraw) {
    perf.rawDraw = ctx.drawImage;
    ctx.drawImage = function (...a) { perf.counts.images = (perf.counts.images || 0) + 1; return perf.rawDraw.apply(this, a); };
  } else if (!on && perf.rawDraw) {
    delete ctx.drawImage;      // back to the prototype's
    perf.rawDraw = null;
  }
}

// One frame done: fold it in, and every window turn the sums into averages.
function perfFrame(now) {
  if (!perf.on) return;
  perf.frames++;
  const span = now - perf.since;
  if (span < PERF_WINDOW) return;
  const per = v => v / perf.frames;
  const mem = performance.memory;
  perf.shown = {
    fps: perf.frames * 1000 / span,
    ms: Object.fromEntries(Object.entries(perf.acc).map(([k, v]) => [k, per(v)])),
    counts: Object.fromEntries(Object.entries(perf.counts).map(([k, v]) => [k, per(v)])),
    heap: mem ? mem.usedJSHeapSize / 1048576 : null
  };
  perf.acc = {};
  perf.counts = {};
  perf.frames = 0;
  perf.since = now;
}

// The panel, top left under the score, in the canvas's own pixels so it stays
// crisp and the same size whatever the zoom. A bar is the share of a 60 fps
// frame's 16.7 ms the stage took.
function drawPerf() {
  if (!perf.on) return;
  const s = perf.shown;
  const dpr = window.devicePixelRatio || 1;
  const line = 15 * dpr, pad = 8 * dpr, w = 290 * dpr;
  const rows = PERF_ROWS.filter(([k]) => !s || s.ms[k] !== undefined);
  const extra = 4;
  const h = pad * 2 + line * (rows.length + extra + 1);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const x0 = 10 * dpr, y0 = 44 * dpr;
  ctx.fillStyle = 'rgba(10,6,20,0.78)';
  ctx.fillRect(x0, y0, w, h);
  ctx.font = `${11 * dpr}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top';
  let y = y0 + pad;
  const text = (t, x, color = '#efe9ff') => { ctx.fillStyle = color; ctx.fillText(t, x, y); };
  if (!s) {
    text('measuring…', x0 + pad);
    ctx.restore();
    return;
  }
  const budget = 1000 / 60;
  text(`${s.fps.toFixed(0)} fps · ${(s.counts.steps || 0).toFixed(2)} steps a frame`, x0 + pad, '#ffb547');
  y += line;
  for (const [k, label] of rows) {
    const v = s.ms[k] || 0;
    const sub = label.startsWith(' ');
    const bx = x0 + 168 * dpr, bw = 70 * dpr;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bx, y + 3 * dpr, bw, 7 * dpr);
    ctx.fillStyle = v > budget ? '#ff6f6f' : v > budget / 2 ? '#ffb547' : '#6ff0c8';
    ctx.fillRect(bx, y + 3 * dpr, Math.min(1, v / budget) * bw, 7 * dpr);
    text(label, x0 + pad, sub ? '#a69cc9' : '#efe9ff');
    text(`${v.toFixed(2)} ms`.padStart(9), bx + bw + 4 * dpr, sub ? '#a69cc9' : '#efe9ff');
    y += line;
  }
  y += line * 0.3;
  const c = s.counts;
  text(`tiles drawn   ${Math.round(c.tiles || 0)}`, x0 + pad, '#a69cc9'); y += line;
  text(`objects       ${Math.round(c.objects || 0)} live, ${Math.round(c.drawn || 0)} drawn`, x0 + pad, '#a69cc9'); y += line;
  text(`images drawn  ${Math.round(c.images || 0)}`, x0 + pad, '#a69cc9'); y += line;
  text(`heap          ${s.heap === null ? 'not told' : s.heap.toFixed(1) + ' MB'}`, x0 + pad, '#a69cc9');
  ctx.restore();
}
