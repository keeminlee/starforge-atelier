/* Self-Replication — the Fredkin parity rule, a CA that copies ANY pattern.
 *
 * A 2-state toroidal grid (Uint8Array). The update rule is pure PARITY (XOR):
 *
 *     next(x,y) = ( N + E + S + W ) mod 2          (von Neumann, 4 neighbors)
 *
 * The cell does NOT include itself — its next state is just the parity of the
 * count of live von Neumann neighbors. This rule is *linear* over GF(2): the
 * evolution of any configuration equals the XOR-superposition of the evolutions
 * of its individual live cells. Fredkin's theorem then gives a startling result
 * — every initial pattern is REPLICATED. A single cell, after 2^n steps, has
 * become four cells at distance 2^n in the four cardinal directions; by
 * linearity a whole seed becomes four copies of itself at those offsets, then
 * those four replicate again, and so on, in an expanding fractal of clones.
 *
 * Between the power-of-two moments the grid is a churning Pascal-triangle-mod-2
 * (Sierpiński) texture; AT t = 2^n it RESOLVES into clean, exact copies of the
 * seed. We detect those "copy frames" and flag them in the readout.
 *
 * A Moore variant (8 neighbors, parity) also replicates — into EIGHT copies at
 * the corners and edges — for a different look.
 *
 * This is *trivial* self-replication in Langton's sense: the linear rule does
 * the duplicating for free; the copies carry no encoded instructions. That is a
 * deliberately honest contrast with non-trivial self-reproduction (von Neumann's
 * universal constructor, Langton's loops, DNA) — see the entry prose.
 *
 * Render: cells via ImageData (alive = teal/white, dead = dark), cell size ~3px
 * so the expanding family of copies is visible. No external deps; vanilla ES. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 3; // logical pixels per cell

  const LIVE = [120, 226, 209]; // teal
  const COPY = [236, 248, 255]; // near-white flash on a clean-copy frame
  const BG = [8, 10, 13];

  // Seed glyphs as little asymmetric bitmaps (rows of strings; '#' = live).
  // Asymmetry is the point: it lets the eye confirm copies are real copies and
  // not an accident of symmetry.
  const SEEDS = {
    arrow: [
      '..#..',
      '...#.',
      '#####',
      '...#.',
      '..#..',
    ],
    'F-glyph': [
      '####',
      '#...',
      '###.',
      '#...',
      '#...',
    ],
    'R-glyph': [
      '###.',
      '#..#',
      '###.',
      '#.#.',
      '#..#',
    ],
    glider: [
      '.#.',
      '..#',
      '###',
    ],
    single: [
      '#',
    ],
  };

  class SelfReplication extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.cols = 0;
      this.rows = 0;
      this.grid = null;     // Uint8Array of 0/1
      this._next = null;
      this.gen = 0;         // simulation step count (distinct from Sim.ticks)
      this.live = 0;        // live-cell count
      this.seedCells = 0;   // live cells in the planted seed (for copy math)
      this._img = null;
      this._copyFrame = false;   // true when this step landed on a power of two
      this._copyCount = 0;       // how many copies the seed has resolved into
      this._off = null;
      this._offCtx = null;
    }

    setup() {
      this.cols = Math.max(8, Math.floor(this.width / CELL));
      this.rows = Math.max(8, Math.floor(this.height / CELL));
      this.grid = new Uint8Array(this.cols * this.rows);
      this._next = new Uint8Array(this.cols * this.rows);
      this.gen = 0;
      this._copyFrame = false;
      this._copyCount = 1;
      this.plantSeed((this.params && this.params.seed) || 'arrow');
      this._img = (this.ctx && this.ctx.createImageData)
        ? this.ctx.createImageData(this.cols, this.rows) : null;
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // Count live cells currently in the grid.
    countLive() {
      let n = 0;
      const g = this.grid;
      for (let i = 0; i < g.length; i++) n += g[i];
      this.live = n;
      return n;
    }

    // Plant one of the named seed glyphs at the center of a cleared grid.
    plantSeed(name) {
      this.grid.fill(0);
      this.gen = 0;
      this._copyFrame = false;
      this._copyCount = 1;
      const bmp = SEEDS[name];
      if (!bmp || name === 'paint') {
        // "paint-your-own": leave the grid blank for the reader to draw on.
        this.seedCells = 0;
        this.countLive();
        return;
      }
      const h = bmp.length;
      const w = Math.max(...bmp.map(r => r.length));
      const ox = (this.cols >> 1) - (w >> 1);
      const oy = (this.rows >> 1) - (h >> 1);
      let cells = 0;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < bmp[r].length; c++) {
          if (bmp[r][c] === '#') {
            const x = ox + c, y = oy + r;
            if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) {
              this.grid[this.idx(x, y)] = 1;
              cells++;
            }
          }
        }
      }
      this.seedCells = cells;
      this.countLive();
    }

    // ---- the rule: next state = parity (XOR) of the neighbors, NOT self ----
    // von Neumann (4 neighbors) by default; Moore (8 neighbors) optional.
    computeNext(src, dst) {
      const C = this.cols, R = this.rows;
      const moore = (this.params && this.params.neighborhood) === 'moore';
      for (let y = 0; y < R; y++) {
        const yU = (y - 1 + R) % R, yD = (y + 1) % R;
        for (let x = 0; x < C; x++) {
          const xL = (x - 1 + C) % C, xR = (x + 1) % C;
          let sum = src[yU * C + x] + src[yD * C + x]
                  + src[y * C + xL] + src[y * C + xR];
          if (moore) {
            sum += src[yU * C + xL] + src[yU * C + xR]
                 + src[yD * C + xL] + src[yD * C + xR];
          }
          dst[y * C + x] = sum & 1; // parity / XOR
        }
      }
    }

    // Atlas's render loop calls step() once per tick.
    step() {
      this.computeNext(this.grid, this._next);
      const tmp = this.grid; this.grid = this._next; this._next = tmp;
      this.gen++;
      this.countLive();
      this._detectCopyFrame();
    }

    // A "copy frame" is a power-of-two step: the churning texture resolves into
    // clean translated copies of the seed. von Neumann parity makes 4 copies at
    // each doubling (Moore: 8), so the copy multiple is a power of 4 (or 8).
    _detectCopyFrame() {
      const t = this.gen;
      const isPow2 = t > 0 && (t & (t - 1)) === 0;
      this._copyFrame = isPow2 && this.seedCells > 0;
      if (this._copyFrame) {
        // At t = 2^n the von Neumann parity rule yields 4 copies of whatever was
        // there at t = 2^(n-1) — so the copy multiple is a power of 4 (Moore: 8).
        // Derive it from the live-cell count vs. the seed when it stays clean.
        const mult = this.seedCells > 0 ? Math.round(this.live / this.seedCells) : 0;
        this._copyCount = mult;
      }
    }

    // ---- render ----
    draw(ctx, w, h) {
      if (this._img) this._drawImage(ctx, w, h);
      else this._drawRects(ctx, w, h);
    }

    _drawImage(ctx, w, h) {
      const data = this._img.data, g = this.grid, n = g.length;
      const c = this._copyFrame ? COPY : LIVE;
      for (let i = 0; i < n; i++) {
        const j = i << 2;
        if (g[i]) { data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255; }
        else { data[j] = BG[0]; data[j + 1] = BG[1]; data[j + 2] = BG[2]; data[j + 3] = 255; }
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
    }

    _drawRects(ctx, w, h) {
      ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
      ctx.fillRect(0, 0, w, h);
      const c = this._copyFrame ? COPY : LIVE;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      const g = this.grid;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (g[this.idx(x, y)]) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }

    // Toggle a cell under the pointer (paint-your-own seeds).
    paintAt(p, on) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
      const i = this.idx(x, y);
      this.grid[i] = on == null ? (this.grid[i] ? 0 : 1) : (on ? 1 : 0);
      // Painting redefines the seed: reset the clock and recount so the copy
      // detector measures against what the reader just drew.
      this.gen = 0;
      this._copyFrame = false;
      this._copyCount = 1;
      this.seedCells = this.countLive();
      if (!this.running) this._renderOnce();
    }
  }

  // ---- mount + controls ----
  const sim = new SelfReplication('#stage');
  sim.start();

  const SEED_OPTIONS = [
    { value: 'arrow',   label: 'Arrow (asymmetric)' },
    { value: 'F-glyph', label: 'F glyph' },
    { value: 'R-glyph', label: 'R glyph' },
    { value: 'glider',  label: 'Glider shape' },
    { value: 'single',  label: 'Single cell' },
    { value: 'paint',   label: 'Paint your own' },
  ];

  sim.standardRail({
    randomize: () => {
      const pick = SEED_OPTIONS[Math.floor(Math.random() * (SEED_OPTIONS.length - 1))].value;
      sim.params.seed = pick;
      const sel = sim.host.querySelector('select');
      if (sel) sel.value = pick;
      sim.plantSeed(pick);
      if (!sim.running) sim._renderOnce();
    },
  });

  sim.select('seed', SEED_OPTIONS, {
    value: 'arrow',
    onChange: v => { sim.plantSeed(v); if (!sim.running) sim._renderOnce(); },
  });

  sim.select('neighborhood', [
    { value: 'vonneumann', label: 'von Neumann (4 → 4 copies)' },
    { value: 'moore',      label: 'Moore (8 → 8 copies)' },
  ], {
    value: 'vonneumann',
    onChange: () => { sim.plantSeed(sim.params.seed || 'arrow'); if (!sim.running) sim._renderOnce(); },
  });

  sim.slider('speed', { min: 1, max: 8, step: 1, value: 1,
    fmt: v => v + ' step' + (v > 1 ? 's' : '') + '/frame',
    onInput: v => { sim.stepsPerFrame = v; } });
  sim.stepsPerFrame = 1;

  // Paint cells: down/drag turns cells ON (so you can draw a shape).
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p, true);
  });

  sim.readout(s => {
    const base = `step ${s.gen}  ·  live ${s.live.toLocaleString()}  ·  ${s.cols}×${s.rows}`;
    if (s._copyFrame && s._copyCount > 1) {
      return base + `  ·  ✦ resolved into ${s._copyCount} copies`;
    }
    if (s._copyFrame && s._copyCount === 1) {
      return base + `  ·  ✦ clean copy frame`;
    }
    return base + `  ·  churning Sierpiński texture`;
  });
})();
