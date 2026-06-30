/* The Voter Model — the simplest model of opinion dynamics / neutral imitation.
 * Extends Atlas.Sim. A grid where each cell holds one of q opinions (a Uint8Array
 * of ids 0..q−1). The classic voter rule, repeated:
 *
 *   pick a random cell, pick a random one of its 4 (von Neumann) neighbours,
 *   and copy that neighbour's opinion onto the cell.
 *
 * One "sweep" = N such single-cell updates (N = number of cells). From a random
 * start, domains of single-opinion consensus grow and coarsen: the number of
 * disagreeing neighbour pairs (the "interface density") shrinks over time. On a
 * finite lattice the system eventually FIXATES on one opinion everywhere — an
 * absorbing state from which it can never escape, because no opinion can appear
 * from nowhere (a cell only ever copies an opinion already held by a neighbour).
 *
 * KEY CONTRAST TO ISING: the voter model has NO surface tension. Interfaces do
 * not contract to minimise their length the way Ising domain walls do; they are
 * rough and wander diffusively. In 2D the model coarsens only logarithmically
 * slowly and never grows smooth, rounded domain walls. It looks superficially
 * like Ising coarsening but is governed by entirely different physics — it is in
 * fact the spatial Moran / neutral model of population genetics.
 *
 * ZEALOTS: a small fraction of cells can be made stubborn ("zealots") — they
 * never change their opinion. With zealots of two competing opinions present,
 * the system can never reach consensus and instead settles into a perpetually
 * mixed, fluctuating state.
 *
 * Exposes this.grid, this.cols/this.rows, this.interfaceDensity(),
 * this.opinionCounts(), this.distinctOpinions(), this.largestFraction(), and a
 * deterministic this.seedRng(s) for headless testing. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  const CELL = 4;        // logical pixels per cell

  // Opinion colours (teal, amber, orchid, sky, lime). Index = opinion id.
  const COLORS = [
    [90, 209, 192],   // 0 teal
    [224, 137, 42],   // 1 amber
    [186, 104, 200],  // 2 orchid
    [96, 165, 224],   // 3 sky blue
    [156, 204, 86],   // 4 lime
  ];

  class Voter extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.grid = null;        // Uint8Array of opinion ids
      this.zealot = null;      // Uint8Array flag: 1 if this cell never changes
      this.sweeps = 0;
      this._img = null;        // lazily-built ImageData for fast blitting
      this._off = null;        // offscreen canvas for crisp upscaling
      this._rng = mulberry32(0x1a2b3c4d);
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      this.seed();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // deterministic seeding helper for tests; reseeds the RNG when given a seed
    seedRng(s) { this._rng = mulberry32(s >>> 0); }

    // (Re)seed the grid with random opinions and a random set of zealots.
    seed() {
      const n = this.cols * this.rows;
      const q = (this.params && this.params.q | 0) || 2;
      this.grid = new Uint8Array(n);
      this.zealot = new Uint8Array(n);
      for (let i = 0; i < n; i++) this.grid[i] = (this._rng() * q) | 0;
      this.applyZealots();
      this.sweeps = 0;
    }

    // Mark a random fraction of cells as zealots. Their opinions are left as
    // seeded, so with two opinions the zealot set already splits between them —
    // competing stubborn agents that prevent consensus.
    applyZealots() {
      const frac = (this.params && this.params.zealots) ?? 0;
      const n = this.zealot.length;
      this.zealot.fill(0);
      if (frac <= 0) return;
      for (let i = 0; i < n; i++) if (this._rng() < frac) this.zealot[i] = 1;
    }

    // One sweep = N single-cell voter updates (N = number of cells).
    sweep() {
      const { cols, rows, grid, zealot } = this;
      const n = cols * rows;
      for (let k = 0; k < n; k++) {
        const x = (this._rng() * cols) | 0;
        const y = (this._rng() * rows) | 0;
        const i = y * cols + x;
        if (zealot[i]) continue;          // zealots never change
        // pick one of the 4 von Neumann neighbours (toroidal wrap)
        const dir = (this._rng() * 4) | 0;
        let nx = x, ny = y;
        if (dir === 0) nx = x === 0 ? cols - 1 : x - 1;
        else if (dir === 1) nx = x === cols - 1 ? 0 : x + 1;
        else if (dir === 2) ny = y === 0 ? rows - 1 : y - 1;
        else ny = y === rows - 1 ? 0 : y + 1;
        grid[i] = grid[ny * cols + nx];   // copy the neighbour's opinion
      }
      this.sweeps++;
    }

    step() {
      const speed = (this.params && this.params.speed | 0) || 1;
      for (let s = 0; s < speed; s++) this.sweep();
    }

    // ---- order parameters (browser-independent; used by readout + tests) ----

    // Fraction of (right + down) neighbour bonds whose endpoints DISAGREE.
    // This is the coarsening order parameter: it starts near (q−1)/q for a random
    // grid and decreases as domains grow. Zero exactly at full consensus.
    interfaceDensity() {
      const { cols, rows, grid } = this;
      let disagree = 0, total = 0;
      for (let y = 0; y < rows; y++) {
        const yD = y === rows - 1 ? 0 : y + 1;
        for (let x = 0; x < cols; x++) {
          const xR = x === cols - 1 ? 0 : x + 1;
          const i = y * cols + x;
          const a = grid[i];
          if (a !== grid[y * cols + xR]) disagree++;   // horizontal bond
          if (a !== grid[yD * cols + x]) disagree++;    // vertical bond
          total += 2;
        }
      }
      return total ? disagree / total : 0;
    }

    // Count cells holding each opinion id (length = current q, padded to 5).
    opinionCounts() {
      const q = (this.params && this.params.q | 0) || 2;
      const counts = new Array(Math.max(q, 1)).fill(0);
      const grid = this.grid;
      for (let i = 0; i < grid.length; i++) {
        const o = grid[i];
        if (o < counts.length) counts[o]++;
      }
      return counts;
    }

    // Number of distinct opinions still present anywhere on the grid.
    distinctOpinions() {
      return this.opinionCounts().filter(c => c > 0).length;
    }

    // Fraction of cells held by the single most popular opinion (1 at consensus).
    largestFraction() {
      const counts = this.opinionCounts();
      let max = 0;
      for (const c of counts) if (c > max) max = c;
      const n = this.grid.length;
      return n ? max / n : 0;
    }

    // Paint opinion (this.params.paint) under the pointer.
    paintAt(p) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      const q = (this.params && this.params.q | 0) || 2;
      const o = clamp((this.params && this.params.paint | 0) || 0, 0, q - 1);
      const r = 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const cx = ((x + dx) % this.cols + this.cols) % this.cols;
        const cy = ((y + dy) % this.rows + this.rows) % this.rows;
        if (dx * dx + dy * dy <= r * r) this.grid[this.idx(cx, cy)] = o;
      }
      if (!this.running) this._renderOnce();
    }

    draw(ctx, w, h) {
      const { cols, rows, grid } = this;
      if (!this._img || this._img.width !== cols || this._img.height !== rows) {
        this._img = ctx.createImageData ? ctx.createImageData(cols, rows) : null;
      }
      if (!this._img || !this._img.data) return;   // headless stub: nothing to draw
      const data = this._img.data;
      for (let i = 0, p = 0; i < grid.length; i++, p += 4) {
        const c = COLORS[grid[i]] || COLORS[0];
        data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255;
      }
      const off = this._offscreen(cols, rows);
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      if (off.ctx && off.ctx.putImageData) {
        off.ctx.putImageData(this._img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off.canvas, 0, 0, cols * CELL, rows * CELL);
      }
    }

    _offscreen(w, h) {
      if (!this._off || this._off.canvas.width !== w || this._off.canvas.height !== h) {
        const canvas = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (canvas) {
          canvas.width = w; canvas.height = h;
          this._off = { canvas, ctx: canvas.getContext('2d') };
        } else {
          this._off = { canvas: { width: w, height: h }, ctx: null };
        }
      }
      return this._off;
    }
  }

  // small deterministic PRNG so tests are reproducible
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- mount + controls ----
  const sim = new Voter('#stage');
  sim.start();

  const reseed = () => { sim.seed(); if (!sim.running) sim._renderOnce(); };

  sim.standardRail({ randomize: reseed });

  sim.slider('q', { min: 2, max: 5, step: 1, value: 2,
    fmt: v => v + ' opinions', onInput: reseed });

  sim.slider('speed', { min: 1, max: 12, step: 1, value: 3,
    fmt: v => v + ' sweeps/frame' });

  sim.slider('zealots', { min: 0, max: 0.1, step: 0.005, value: 0,
    fmt: v => Math.round(v * 100) + '%', onInput: reseed });

  // which opinion the pointer paints
  sim.select('paint', [
    { value: 0, label: 'opinion 1 (teal)' },
    { value: 1, label: 'opinion 2 (amber)' },
    { value: 2, label: 'opinion 3 (orchid)' },
    { value: 3, label: 'opinion 4 (sky)' },
    { value: 4, label: 'opinion 5 (lime)' },
  ], { value: 0, onChange: v => { sim.params.paint = v | 0; } });
  sim.params.paint = 0;

  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p);
  });

  sim.readout(s => {
    const distinct = s.distinctOpinions();
    const largest = s.largestFraction();
    const iface = s.interfaceDensity();
    return `${distinct} opinion${distinct === 1 ? '' : 's'} left  ·  ` +
      `largest ${Math.round(largest * 100)}%  ·  ` +
      `interface ${(iface * 100).toFixed(1)}%`;
  });
})();
