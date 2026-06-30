/* Langton's Ant — one agent, two rules, emergent highway (Langton 1986).
 *
 * A grid of colored cells and an ant with a position and a heading (N/E/S/W).
 * Each ant-step reads the cell under the ant and consults a turn rule, then:
 *   1. turn left or right 90° according to the rule for the current cell color,
 *   2. advance that cell's color by one (cycling 0→1→…→0),
 *   3. step forward one cell.
 *
 * Classic "RL" rule on an all-white grid: on white, turn RIGHT, flip to black;
 * on black, turn LEFT, flip to white. From a blank grid the ant makes a
 * symmetric, chaotic-looking mess for ~10,000 steps, then spontaneously settles
 * into a periodic 104-step cycle that translates — building a diagonal
 * "highway" that recurs forever (Bunimovich–Troubetzkoy proved the trajectory
 * is unbounded; the highway from a blank grid is empirical but always appears).
 *
 * Generalized "turmite" rules are a string like "RL", "RLR", "LLRR", … : each
 * character says which way to turn on that color; the ant cycles colors. "RL"
 * is Langton's ant; other strings give chaos, symmetric art, or highways.
 *
 * Render: cells colored by state (white→light tone, others→palette to dark),
 * the ant a bright accent dot. cell size 3px, large fixed grid. ImageData blit.
 * No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 3; // logical pixels per cell

  // Headings: 0=N, 1=E, 2=S, 3=W. Right = +1, Left = -1 (mod 4).
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  // Palette of cell colors, indexed by state. 0 is the light "white" tone;
  // higher states ramp toward dark, with a couple of mid hues for turmites.
  const PALETTE = [
    [232, 236, 240], // 0 white / light
    [22, 26, 34],    // 1 near-black
    [80, 196, 188],  // 2 teal
    [224, 150, 70],  // 3 amber
    [150, 110, 210], // 4 violet
    [210, 90, 110],  // 5 rose
    [120, 140, 60],  // 6 olive
    [90, 120, 170]   // 7 slate
  ];
  const BG = [6, 7, 10];

  // Preset turn rules. Each char ∈ {L,R}; index = cell state, value = turn.
  const RULES = [
    { value: 'RL',           label: "RL — Langton's ant (highway)" },
    { value: 'RLR',          label: 'RLR — chaotic, then highway' },
    { value: 'LLRR',         label: 'LLRR — symmetric, square-ish' },
    { value: 'LRRRRRLLR',    label: 'LRRRRRLLR — grows a filled cardioid' },
    { value: 'LLRRRLRLRLLR', label: 'LLRRRLRLRLLR — convoluted, spirals' },
    { value: 'RRLL',         label: 'RRLL — chaotic art' }
  ];

  class Ant extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.steps = 0;     // total ant-steps taken
      this.dark = 0;      // count of non-white cells
    }

    setup() {
      this.cols = Math.max(1, Math.floor(this.width / CELL));
      this.rows = Math.max(1, Math.floor(this.height / CELL));
      this.grid = new Uint8Array(this.cols * this.rows); // cell states, 0=white
      this.steps = 0;
      this.dark = 0;
      this.rule = this._parseRule((this.params && this.params.rule) || 'RL');
      this._spawnAnts((this.params && this.params.ants) || 1);
      this._resetBounds();
      this._img = (this.ctx && this.ctx.createImageData)
        ? this.ctx.createImageData(this.cols, this.rows) : null;
      this._dirty = true;
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // Turn rule as an array of +1 (R) / -1 (L) per cell state. Falls back to RL.
    _parseRule(str) {
      str = String(str || 'RL').toUpperCase().replace(/[^LR]/g, '');
      if (str.length < 2) str = 'RL';
      const r = new Int8Array(str.length);
      for (let i = 0; i < str.length; i++) r[i] = str[i] === 'R' ? 1 : -1;
      return r;
    }

    // Place `n` ants. One ant → dead center; several → clustered near center
    // with varied headings so they interact.
    _spawnAnts(n) {
      n = Math.max(1, Math.min(6, n | 0));
      const cx = this.cols >> 1, cy = this.rows >> 1;
      this.ants = [];
      for (let i = 0; i < n; i++) {
        const off = i === 0 ? 0 : (i * 7);
        this.ants.push({
          x: (cx + (i % 2 ? off : -off) + this.cols) % this.cols,
          y: (cy + (i % 2 ? -off : off) + this.rows) % this.rows,
          dir: i % 4
        });
      }
    }

    _resetBounds() {
      const a = this.ants[0];
      this.minX = a.x; this.maxX = a.x; this.minY = a.y; this.maxY = a.y;
    }

    // Convenience for tests: the first ant's position/heading.
    antPos() { const a = this.ants[0]; return { x: a.x, y: a.y, dir: a.dir }; }

    // Bounding-box span the ants have explored (a drift/growth signal).
    bboxSpan() { return (this.maxX - this.minX) + (this.maxY - this.minY); }

    // Reset to a blank grid with the ant(s) at center. `opts.randomize` picks a
    // random preset rule and a few starting cells, to perturb the world.
    reseed(randomize) {
      const rules = this.rule;
      if (randomize) {
        const pick = RULES[Math.floor(Math.random() * RULES.length)].value;
        this.params.rule = pick;
        const sel = this.host.querySelector('select');
        if (sel) sel.value = pick;
      }
      this.setup();
      if (randomize) {
        // sprinkle a few random colored cells near the center
        const cx = this.cols >> 1, cy = this.rows >> 1;
        const states = this.rule.length;
        for (let k = 0; k < 60; k++) {
          const x = (cx + (Math.random() * 40 | 0) - 20 + this.cols) % this.cols;
          const y = (cy + (Math.random() * 40 | 0) - 20 + this.rows) % this.rows;
          const s = 1 + (Math.random() * (states - 1) | 0);
          const i = this.idx(x, y);
          if (!this.grid[i]) this.dark++;
          this.grid[i] = s;
        }
      }
      this._renderOnce();
      return rules;
    }

    // One ant-step for a single ant `a` (toroidal wrap).
    stepAnt(a) {
      const i = this.idx(a.x, a.y);
      const s = this.grid[i];
      const states = this.rule.length;
      // turn per the rule for the current color
      a.dir = (a.dir + (s < states ? this.rule[s] : 1) + 4) & 3;
      // advance the cell's color, cycling
      const ns = (s + 1) % states;
      if (s === 0 && ns !== 0) this.dark++;
      else if (s !== 0 && ns === 0) this.dark--;
      this.grid[i] = ns;
      // step forward, wrapping
      a.x += DX[a.dir]; if (a.x < 0) a.x += this.cols; else if (a.x >= this.cols) a.x -= this.cols;
      a.y += DY[a.dir]; if (a.y < 0) a.y += this.rows; else if (a.y >= this.rows) a.y -= this.rows;
      // track explored bounding box
      if (a.x < this.minX) this.minX = a.x; else if (a.x > this.maxX) this.maxX = a.x;
      if (a.y < this.minY) this.minY = a.y; else if (a.y > this.maxY) this.maxY = a.y;
    }

    // Advance many ant-steps per frame so the highway emerges within seconds.
    step() {
      const n = Math.max(1, Math.round(this.params.speed ?? 800));
      const ants = this.ants;
      for (let k = 0; k < n; k++) {
        for (let j = 0; j < ants.length; j++) this.stepAnt(ants[j]);
        this.steps++;
      }
      this._dirty = true;
    }

    // Heuristic: after the chaotic phase, the bounding box grows steadily.
    // We call the highway "begun" once the ant has clearly escaped the blob
    // (span well past the chaotic-cloud scale) and keeps drifting. Single ant
    // with rule "RL" only — for the headline phenomenon.
    highwayBegun() {
      if (this.ants.length !== 1) return false;
      // The chaotic core of RL is ~O(100) cells across; a sustained span beyond
      // that, after >10k steps, means the ant is riding the highway out.
      return this.steps > 10500 && this.bboxSpan() > 150;
    }

    draw(ctx, w, h) {
      if (this._img) this._drawImage(ctx, w, h);
      else this._drawRects(ctx, w, h);
    }

    _drawImage(ctx, w, h) {
      const data = this._img.data, g = this.grid, n = g.length;
      for (let i = 0; i < n; i++) {
        const c = PALETTE[g[i]] || PALETTE[1];
        const j = i << 2;
        data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255;
      }
      // ants as bright accent pixels in the image
      for (const a of this.ants) {
        const j = this.idx(a.x, a.y) << 2;
        data[j] = 255; data[j + 1] = 60; data[j + 2] = 90; data[j + 3] = 255;
      }
      this._blit(ctx, w, h);
    }

    _blit(ctx, w, h) {
      if (!this._off || this._off.width !== this.cols || this._off.height !== this.rows) {
        this._off = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (this._off) { this._off.width = this.cols; this._off.height = this.rows; }
        this._offCtx = this._off ? this._off.getContext('2d') : null;
      }
      if (!this._offCtx) return; // headless: no-op
      this._offCtx.putImageData(this._img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this._off, 0, 0, this.cols, this.rows, 0, 0, w, h);
      // draw a slightly larger ant dot on top so it reads at small scale
      ctx.fillStyle = '#ff5d77';
      for (const a of this.ants) {
        ctx.fillRect(a.x * CELL - 1, a.y * CELL - 1, CELL + 2, CELL + 2);
      }
    }

    // Fallback path (no ImageData): plain fillRect cells.
    _drawRects(ctx, w, h) {
      ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
      ctx.fillRect(0, 0, w, h);
      const g = this.grid;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const s = g[this.idx(x, y)];
          if (s === 0) continue;
          const c = PALETTE[s] || PALETTE[1];
          ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      ctx.fillStyle = '#ff5d77';
      for (const a of this.ants) ctx.fillRect(a.x * CELL - 1, a.y * CELL - 1, CELL + 2, CELL + 2);
    }

    // Paint a cell to a new state under the pointer (perturb the world).
    paintAt(p) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const i = this.idx(x, y);
      const states = this.rule.length;
      const prev = this.grid[i];
      const next = (prev + 1) % states;
      if (prev === 0 && next !== 0) this.dark++;
      else if (prev !== 0 && next === 0) this.dark--;
      this.grid[i] = next;
      if (!this.running) this._renderOnce();
    }
  }

  // ---- mount + controls ----
  const sim = new Ant('#stage');
  sim.start();

  sim.standardRail({ randomize: () => sim.reseed(true) });

  sim.select('rule', RULES, {
    value: 'RL',
    onChange: () => sim.reseed(false)
  });
  // ant-steps per frame: default high so the ~12k-step highway shows in seconds
  sim.slider('speed', { min: 50, max: 3000, step: 50, value: 150,
    fmt: v => v + '/frame' });
  sim.slider('ants', { min: 1, max: 6, step: 1, value: 1,
    fmt: v => v + (v > 1 ? ' ants' : ' ant'),
    onInput: () => sim.reseed(false) });

  // paint cells to perturb the world
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p);
  });

  sim.readout(s => {
    const hw = s.highwayBegun() ? 'HIGHWAY' : (s.steps > 10500 ? 'escaping…' : 'chaos');
    return `steps ${s.steps.toLocaleString()}  ·  colored ${s.dark.toLocaleString()}  ·  ` +
      `${hw}  ·  ${s.cols}×${s.rows}`;
  });
})();
