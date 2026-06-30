/* Spatial rock-paper-scissors — cyclic dominance on a toroidal lattice.
 * Extends Atlas.Sim. Each cell holds one of N species (Int8Array). Cyclic
 * dominance: species i beats (i+1)%N … up to (i + floor(N/2))%N, and loses to
 * the rest. For N=3 this is plain rock-paper-scissors (0 beats 1 beats 2 beats
 * 0); for N=5 it is rock-paper-scissors-lizard-Spock (each beats the next two).
 *
 * Microstep dynamics (the simplest rule that produces spirals): pick a random
 * cell and a random neighbor; if the neighbor's species DOMINATES the cell's,
 * the cell is invaded (takes the neighbor's species). Run many microsteps per
 * frame. From a random soup this self-organizes into rotating spiral waves, and
 * all species coexist indefinitely — the chase never lets anyone win. */
(function () {
  'use strict';
  const { Sim, randInt } = Atlas;

  const CELL = 3;       // logical pixels per simulation cell

  // species palettes — distinct, on-brand colors. 5-species adds two more.
  const PALETTE = [
    [127, 209, 193],  // teal     #7fd1c1
    [224, 163, 94],   // amber    #e0a35e
    [201, 139, 208],  // orchid   #c98bd0
    [123, 168, 224],  // periwinkle #7ba8e0
    [224, 122, 122],  // coral    #e07a7a
  ];

  const RULES = {
    '3': { species: 3, label: '3 species (RPS)' },
    '5': { species: 5, label: '5 species (RPSLS)' }
  };

  // von Neumann (4) and Moore (8) neighbor offsets.
  const VN = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const MOORE = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

  class RPSSpatial extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
    }

    setup() {
      this.species = RULES[this.params.rule ?? '3'].species;
      this.cols = Math.max(1, Math.floor(this.width / CELL));
      this.rows = Math.max(1, Math.floor(this.height / CELL));
      const n = this.cols * this.rows;
      this.grid = new Int8Array(n);
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.cols, this.rows) : null;
      this.img = (made && made.data) ? made : null;
      this.seed();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // Fill the grid with a roughly equal random mix of all species.
    seed() {
      const { grid, species } = this;
      for (let i = 0; i < grid.length; i++) grid[i] = randInt(0, species);
    }

    // Does species `a` dominate species `b`?  In a cycle of N, a beats the next
    // floor(N/2) species after it (mod N). N=3: beats 1; N=5: beats 2.
    dominates(a, b) {
      if (a === b) return false;
      const N = this.species;
      const diff = ((b - a) % N + N) % N;     // steps from a forward to b
      return diff >= 1 && diff <= (N >> 1);
    }

    // One microstep: a random cell may be invaded by a random dominating neighbor.
    microstep(offsets) {
      const { grid, cols, rows } = this;
      const x = randInt(0, cols), y = randInt(0, rows);
      const i = this.idx(x, y);
      const o = offsets[randInt(0, offsets.length)];
      const nx = ((x + o[0]) % cols + cols) % cols;
      const ny = ((y + o[1]) % rows + rows) % rows;
      const j = this.idx(nx, ny);
      const me = grid[i], them = grid[j];
      if (this.dominates(them, me)) grid[i] = them;
    }

    step() {
      const offsets = (this.params.neighborhood ?? 'moore') === 'vonneumann' ? VN : MOORE;
      // Speed is microsteps per frame, scaled to grid size so spirals turn at a
      // comparable rate regardless of resolution. `speed` is in units of
      // full-grid sweeps per frame.
      const sweeps = this.params.speed ?? 6;
      const micro = Math.max(1, Math.round(sweeps * this.cols * this.rows));
      for (let s = 0; s < micro; s++) this.microstep(offsets);
    }

    // Population fraction of each species, for the readout and tests.
    fractions() {
      const { grid, species } = this;
      const counts = new Array(species).fill(0);
      for (let i = 0; i < grid.length; i++) counts[grid[i]]++;
      return counts.map(c => c / grid.length);
    }

    draw(ctx, w, h) {
      const { grid, img } = this;
      if (!img) return; // headless / no canvas
      const data = img.data;
      for (let i = 0; i < grid.length; i++) {
        const c = PALETTE[grid[i]] || PALETTE[0];
        const j = i << 2;
        data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255;
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
      if (!this._offCtx) return;
      this._offCtx.putImageData(this.img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this._off, 0, 0, this.cols, this.rows, 0, 0, w, h);
    }
  }

  // ---- mount + controls ----
  const sim = new RPSSpatial('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.seed(); sim._renderOnce(); } });

  sim.select('rule', Object.keys(RULES).map(k => ({ value: k, label: RULES[k].label })), {
    value: '3',
    onChange: () => { sim.setup(); sim._renderOnce(); }
  });

  sim.slider('speed', { min: 1, max: 20, step: 1, value: 9, fmt: v => v + ' sweeps' });

  sim.select('neighborhood', [
    { value: 'moore', label: 'Moore (8)' },
    { value: 'vonneumann', label: 'von Neumann (4)' }
  ], { value: 'moore' });

  const NAMES = ['teal', 'amber', 'orchid', 'periwinkle', 'coral'];
  sim.readout(s => {
    const f = s.fractions();
    return f.map((v, i) => `${NAMES[i]} ${(v * 100).toFixed(0)}%`).join('  ·  ');
  });
})();
