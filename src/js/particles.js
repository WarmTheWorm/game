// ---------- Particle systems ----------
// Sparks, dust, drifting motes: a cloud of small dots or tiny sprites, each
// thrown out at a speed and angle, pulled by gravity, slowed by drag, and
// shrinking and changing colour over its life. An object of this class is a
// recipe for one, and it is used two ways:
//
//   placed in a level, it streams from its spot, `rate` particles a frame —
//   a fountain, fireflies, smoke from a chimney — or, with no rate, bursts
//   `count` there every `interval` frames;
//   named by another object's property (a coin's takeParticles, a rock's
//   breakParticles), it bursts once, `count` particles, where that thing went.
//
// Its sprite is optional: without one each particle is a dot of its colour,
// with one each is that sprite's current frame, sized and faded the same way.
const PARTICLE_CAP = 300;            // live particles one system may have

class ParticleSystem extends Entity {
  static bucket = 'emitters';
  static editor = {
    label: 'Particle system',
    code: '0Z',
    props: {
      count: { type: 'int', default: 16, label: 'Particles in a burst' },
      rate: { type: 'float', default: 0, label: 'Particles a frame, placed in a level (0 = bursts instead)' },
      interval: { type: 'int', default: 60, label: 'Frames between bursts, placed with no rate (0 = never)' },
      speed: { type: 'float', default: 2, label: 'Speed, px a frame' },
      speedJitter: { type: 'float', default: 0.5, label: 'Speed varies by, as a share' },
      angle: { type: 'int', default: -90, label: 'Direction, degrees (0 right, -90 up)' },
      spread: { type: 'int', default: 360, label: 'Spread round it, degrees' },
      gravity: { type: 'float', default: 0.1, label: 'Gravity (negative rises)' },
      drag: { type: 'float', default: 0.97, label: 'Speed kept each frame (1 = no drag)' },
      life: { type: 'int', default: 30, label: 'Life, frames' },
      lifeJitter: { type: 'float', default: 0.3, label: 'Life varies by, as a share' },
      radius: { type: 'float', default: 0, label: 'Starts anywhere within, px' },
      sizeStart: { type: 'float', default: 4, label: 'Size at birth, px' },
      sizeEnd: { type: 'float', default: 0, label: 'Size at death, px' },
      colorStart: { type: 'color', default: '#ffffff', label: 'Colour at birth' },
      colorEnd: { type: 'color', default: '#ffffff', label: 'Colour at death' },
      fade: { type: 'bool', default: true, label: 'Fades out' },
      shape: { type: 'choice', options: ['circle', 'square', 'spark'], default: 'circle', label: 'Shape, without a sprite' },
      glow: { type: 'bool', default: false, label: 'Glows (adds light)' }
    }
  };

  // It may have no art of its own; the level editor marks where it stands.
  static spriteOptional = true;
  static marker = { colour: '#ffb347', letter: '✶' };   // so the editor puts no stand-in under its symbol

  // Its symbol where a level is built, drawn from its own props so each
  // system reads apart at a glance: a cone the way it throws and as wide as
  // its spread (a ring for all round), shaded from its birth colour to its
  // death colour, a few particles in it in its own shape, colours and sizes,
  // an arrow if gravity pulls them, and what it does placed — ≈ and its rate
  // if it streams, ✶ and its count if it bursts.
  static drawGuide(g, view) {
    if (view.mode === 'debug') return;
    const p = this.propsFor(view.name);
    const panel = view.mode === 'panel';
    const s = panel ? view.size : TILE;                         // the cell, in what is drawn on
    const k = panel ? view.size / TILE : 1;                     // game units to that
    const cx = panel ? s / 2 : (view.c + 0.5) * TILE, cy = panel ? s / 2 : (view.r + 0.5) * TILE;
    const lw = 1 / (view.px || 1);
    const rgb0 = particleRgb(p.colorStart), rgb1 = particleRgb(p.colorEnd);
    const col = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const mix = t => rgb0.map((v, i) => Math.round(v + (rgb1[i] - v) * t));
    const a = p.angle * Math.PI / 180, spread = Math.min(360, Math.max(0, p.spread)) * Math.PI / 180;
    const R = s * 0.44;
    g.save();
    if (!view.hasArt) {
      g.fillStyle = 'rgba(20,16,32,0.55)';
      g.fillRect(cx - s / 2 + lw, cy - s / 2 + lw, s - 2 * lw, s - 2 * lw);
    }
    // the cone
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, col(rgb0, 0.55));
    grad.addColorStop(1, col(rgb1, 0.12));
    g.fillStyle = grad;
    g.strokeStyle = col(rgb0, 0.9);
    g.lineWidth = 1.2 * lw;
    g.beginPath();
    if (spread >= Math.PI * 2 - 1e-3) g.arc(cx, cy, R, 0, Math.PI * 2);
    else { g.moveTo(cx, cy); g.arc(cx, cy, R, a - spread / 2, a + spread / 2); g.closePath(); }
    g.fill();
    g.stroke();
    // a few of its particles, always the same ones, at their real size
    const shown = 6;
    for (let i = 0; i < shown; i++) {
      const t = (i * 0.61803) % 1;                             // how far out, so how old
      const ang = a + ((i + 0.5) / shown - 0.5) * Math.min(spread, Math.PI * 2 - 0.3);
      const d = R * (0.25 + 0.7 * t);
      const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d;
      const size = Math.max(1.2 * lw, (p.sizeStart + (p.sizeEnd - p.sizeStart) * t) * k);
      const c = mix(t);
      g.fillStyle = g.strokeStyle = col(c, p.fade ? 1 - t * 0.6 : 1);
      if (p.shape === 'square') g.fillRect(x - size / 2, y - size / 2, size, size);
      else if (p.shape === 'spark') {
        g.lineWidth = Math.max(lw, size / 2);
        g.beginPath();
        g.moveTo(x - Math.cos(ang) * size * 1.5, y - Math.sin(ang) * size * 1.5);
        g.lineTo(x + Math.cos(ang) * size, y + Math.sin(ang) * size);
        g.stroke();
      } else { g.beginPath(); g.arc(x, y, size / 2, 0, Math.PI * 2); g.fill(); }
    }
    // gravity: an arrow at its side, down if they fall, up if they rise
    if (Math.abs(p.gravity) > 0.005) {
      const up = p.gravity < 0, gx = cx - s * 0.38, h = s * 0.16;
      const y0 = cy + (up ? h : -h), y1 = cy + (up ? -h : h);
      g.strokeStyle = g.fillStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 1.5 * lw;
      g.beginPath(); g.moveTo(gx, y0); g.lineTo(gx, y1); g.stroke();
      const hd = s * 0.06 * (up ? -1 : 1);
      g.beginPath(); g.moveTo(gx - Math.abs(hd), y1 - hd); g.lineTo(gx, y1); g.lineTo(gx + Math.abs(hd), y1 - hd); g.stroke();
    }
    // what it does placed in a level
    const badge = p.rate > 0 ? `≈${+p.rate.toFixed(2)}` : p.interval > 0 ? `✶${p.count}` : `·${p.count}`;
    g.font = `bold ${Math.round(s * 0.24)}px system-ui, sans-serif`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.lineWidth = 3 * lw;
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.strokeText(badge, cx + s / 2 - 1.5 * lw, cy + s / 2 - lw);
    g.fillStyle = p.rate > 0 ? '#9fe3ff' : p.interval > 0 ? '#ffd27a' : '#c9c2d8';
    g.fillText(badge, cx + s / 2 - 1.5 * lw, cy + s / 2 - lw);
    g.restore();
  }

  // A few to start a pack with, which the asset pack creator adds to a pack
  // that has none. Codes follow in this order: 0Z0, 0Z1, ...
  static presets = {
    sparkle: { count: 14, speed: 2.2, gravity: 0.04, drag: 0.93, life: 26, sizeStart: 3.5, sizeEnd: 0, colorStart: '#fff6a8', colorEnd: '#ffb300', glow: true },
    gemSparkle: { count: 22, speed: 2.8, gravity: 0, drag: 0.92, life: 34, sizeStart: 3, sizeEnd: 0, colorStart: '#e8fbff', colorEnd: '#b06aff', shape: 'spark', glow: true },
    dust: { count: 12, speed: 2.4, angle: -90, spread: 150, gravity: 0.22, drag: 0.96, life: 30, sizeStart: 4, sizeEnd: 1.5, colorStart: '#b3a28c', colorEnd: '#5e5246', shape: 'square' },
    fireflies: { rate: 0.04, speed: 0.35, gravity: -0.004, drag: 0.995, life: 140, radius: 40, sizeStart: 2.5, sizeEnd: 0, colorStart: '#fffbb0', colorEnd: '#9cff5a', glow: true },
    fountain: { count: 30, rate: 0.7, speed: 4.2, speedJitter: 0.2, angle: -90, spread: 22, gravity: 0.2, drag: 0.99, life: 42, sizeStart: 3, sizeEnd: 1, colorStart: '#d8f6ff', colorEnd: '#3a86d6', fade: true }
  };

  constructor(name, x, y) {
    super(name, x, y);
    this.cloud = new ParticleCloud(this.props, x, y);
    this.streams = true;        // placed in a level; a burst never does
  }

  // One burst of the system an object property names (object::sparkle) at
  // x, y, drawn with the layer it came from. Nothing if it names none.
  static burst(ref, x, y, layer = LAYER_MAIN) {
    const name = refName(ref);
    if (!name || classOf(name) !== ParticleSystem) return;
    const s = new ParticleSystem(name, x, y);
    s.streams = false;
    s.layer = layer;
    s.cloud.emit(s.props.count);
    bursts.push(s);
  }

  // a burst is done once its last particle is
  get done() { return !this.streams && !this.cloud.parts.length; }

  update() {
    // a placed one only adds while it is anywhere near the screen; what it
    // already threw out keeps moving either way
    if (this.streams && this.nearView()) this.cloud.run();
    this.cloud.step();
  }

  nearView() {
    const m = VIEW_W;
    return this.x > cam.x - m && this.x < cam.x + VIEW_W + m && this.y > cam.y - m && this.y < cam.y + VIEW_H + m;
  }

  draw() {
    const n = this.cloud.parts.length;
    if (!n) return;
    const obj = this.obj && atlas.def(this.obj).frame ? this.obj : null;
    const frame = obj ? atlas.frame(obj) : 0;
    this.cloud.paint(ctx, obj && { size: Math.max(...atlas.size(obj)), draw: g => atlas.draw(obj, 0, 0, frame) });
    if (perf.on) perfCount('particles', n);
  }

  reset() { this.cloud.clear(); }

  mapCell() { return this.streams ? super.mapCell() : null; }

  debugShape() { return null; }
}

// The particles themselves: thrown out, moved and drawn by an object's props.
// Kept apart from the class so the asset pack creator can run one for its
// preview, with no level round it.
class ParticleCloud {
  constructor(props, x, y) {
    this.props = props;
    this.x = x;
    this.y = y;
    this.parts = [];
    this.owed = 0;              // the part of a particle `rate` has built up
    this.wait = 0;              // frames to the next burst, with no rate
    this.rgbStart = particleRgb(props.colorStart);
    this.rgbEnd = particleRgb(props.colorEnd);
  }

  clear() { this.parts.length = 0; this.owed = 0; this.wait = 0; }

  emit(n) {
    const p = this.props;
    const dir = p.angle * Math.PI / 180, spread = p.spread * Math.PI / 180;
    for (let i = 0; i < n && this.parts.length < PARTICLE_CAP; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const v = p.speed * (1 + (Math.random() * 2 - 1) * p.speedJitter);
      const r = p.radius * Math.sqrt(Math.random()), ra = Math.random() * Math.PI * 2;
      const life = Math.max(1, Math.round(p.life * (1 + (Math.random() * 2 - 1) * p.lifeJitter)));
      this.parts.push({ x: this.x + Math.cos(ra) * r, y: this.y + Math.sin(ra) * r,
                        vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life });
    }
  }

  // What a placed one throws out this frame: its share of `rate`, or with no
  // rate a burst of `count` every `interval` frames, the first at once.
  run() {
    const p = this.props;
    if (p.rate > 0) { this.stream(); return; }
    if (!(p.interval > 0)) return;
    if (this.wait-- > 0) return;
    this.wait = p.interval - 1;
    this.emit(p.count);
  }

  stream() {
    if (!(this.props.rate > 0)) return;
    this.owed += this.props.rate;
    const n = Math.floor(this.owed);
    this.owed -= n;
    this.emit(n);
  }

  step() {
    const p = this.props, list = this.parts;
    let keep = 0;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (++q.age >= q.life) continue;
      q.vx *= p.drag;
      q.vy = q.vy * p.drag + p.gravity;
      q.x += q.vx;
      q.y += q.vy;
      list[keep++] = q;
    }
    list.length = keep;
  }

  // On g, in its units. `art`, when the system wears a sprite, is
  // { size: its longer side, draw(g): the frame centred on 0, 0 }.
  paint(g, art) {
    const p = this.props, [r0, g0, b0] = this.rgbStart, [r1, g1, b1] = this.rgbEnd;
    g.save();
    if (p.glow) g.globalCompositeOperation = 'lighter';
    for (const q of this.parts) {
      const t = q.age / q.life;
      const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * t;
      if (size <= 0) continue;
      g.globalAlpha = p.fade ? 1 - t : 1;
      if (art) {
        const k = size / art.size;
        g.save();
        g.translate(q.x, q.y);
        g.scale(k, k);
        art.draw(g);
        g.restore();
        continue;
      }
      g.fillStyle = `rgb(${Math.round(r0 + (r1 - r0) * t)},${Math.round(g0 + (g1 - g0) * t)},${Math.round(b0 + (b1 - b0) * t)})`;
      if (p.shape === 'square') g.fillRect(q.x - size / 2, q.y - size / 2, size, size);
      else if (p.shape === 'spark') {
        // a streak along the way it is going, as long as it is fast
        g.strokeStyle = g.fillStyle;
        g.lineWidth = Math.max(0.5, size / 2);
        g.beginPath();
        g.moveTo(q.x - q.vx * 2, q.y - q.vy * 2);
        g.lineTo(q.x + q.vx, q.y + q.vy);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(q.x, q.y, size / 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }
}

function particleRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [n >> 16, (n >> 8) & 255, n & 255];
}
