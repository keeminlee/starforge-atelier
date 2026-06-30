/* Greenberg–Hastings excitable medium — spiral and target waves.
 * Extends Atlas.Sim. Each cell holds one of N states (Uint8Array):
 *   0            = resting (quiescent, ready to fire)
 *   1            = excited (the wavefront)
 *   2 … N−1      = refractory (recovering; immune to re-excitation)
 *
 * Synchronous Greenberg–Hastings update each tick:
 *   • A RESTING cell (state 0) becomes EXCITED (state 1) iff at least
 *     `threshold` of its neighbors are EXCITED (state 1).
 *   • Any NON-RESTING cell in state s advances to s+1; from N−1 it wraps to 0.
 * So excitation lasts one tick, then the cell is refractory for N−2 ticks,
 * then rests again. The refractory tail makes waves one-directional and is what
 * lets a broken wavefront curl into a self-sustaining ROTATING SPIRAL.
 *
 * Unlike the spirals of spatial rock-paper-scissors (cyclic dominance) or the
 * Turing patterns of reaction–diffusion, these spirals arise from EXCITABILITY:
 * quiet → fire when poked → recover. Seed a spiral, target waves, or random
 * turbulence, or paint your own excited cells and break a wavefront. */
(function () {
  'use strict';
  const { Sim, clamp, randInt } = Atlas;

  const CELL = 3;       // logical pixels per simulation cell

  // von Neumann (4) neighbors — the canonical Greenberg–Hastings neighborhood.
  const VN = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  class ExcitableMedia extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
    }

    setup() {
      this.nStates = Math.max(3, Math.round(this.params.states ?? 8));
      this.cols = Math.max(1, Math.floor(this.width / CELL));
      this.rows = Math.max(1, Math.floor(this.height / CELL));
      const n = this.cols * this.rows;
      this.grid = new Uint8Array(n);
      this.next = new Uint8Array(n);
      // Pacemaker bookkeeping for the "target" pattern: cell index + period.
      this.pacemaker = -1;
      this._buildPalette();
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.cols, this.rows) : null;
      this.img = (made && made.data) ? made : null;
      this.seed();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // ---- seeding patterns -------------------------------------------------
    seed() {
      const pat = this.params.pattern ?? 'spiral';
      this.grid.fill(0);
      this.pacemaker = -1;
      if (pat === 'spiral') this._seedSpiral();
      else if (pat === 'target') this._seedTarget();
      else this._seedRandom();
    }

    // A phase singularity: set each cell's state from its ANGLE around the centre,
    // so the states wind once (0…N−1) all the way around. That winding is a
    // topological defect that cannot smooth itself out — the centre becomes a
    // spiral core and the medium rotates as a single sustained spiral wave.
    _seedSpiral() {
      const { grid, cols, rows, nStates } = this;
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
      const pitch = 0.03; // radial winding per cell → visible spiral ARMS, not rings
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = x - cx, dy = y - cy;
          const a = Math.atan2(dy, dx) / (2 * Math.PI); // −0.5 … 0.5
          const r = Math.hypot(dx, dy);
          let ph = a + r * pitch;        // Archimedean phase → iso-phase = spirals
          ph = ph - Math.floor(ph);      // wrap to 0 … 1
          grid[this.idx(x, y)] = Math.floor(ph * nStates) % nStates;
        }
      }
    }

    // A single periodic pacemaker at the center that re-fires every nStates
    // ticks → concentric expanding rings (target waves).
    _seedTarget() {
      const cx = this.cols >> 1;
      const cy = this.rows >> 1;
      this.pacemaker = this.idx(cx, cy);
      this.grid[this.pacemaker] = 1;   // fire now; it re-fires on its own period
    }

    // A random scatter of excited and refractory cells → colliding waves and
    // spontaneous spirals (a turbulent sea).
    _seedRandom() {
      const { grid, nStates } = this;
      for (let i = 0; i < grid.length; i++) {
        // ~12% seeded: mostly excited, some refractory, to break symmetry.
        if (Math.random() < 0.12) {
          grid[i] = Math.random() < 0.5 ? 1 : randInt(2, nStates);
        }
      }
    }

    // ---- the rule ---------------------------------------------------------
    // Advance one Greenberg–Hastings tick (synchronous) into the back buffer.
    step() {
      const { grid, next, cols, rows, nStates } = this;
      const threshold = Math.max(1, Math.round(this.params.threshold ?? 1));
      for (let y = 0; y < rows; y++) {
        const yU = (y - 1 + rows) % rows, yD = (y + 1) % rows;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const s = grid[i];
          if (s === 0) {
            // Resting: count excited (state 1) von Neumann neighbors (toroidal).
            const xL = (x - 1 + cols) % cols, xR = (x + 1) % cols;
            let exc = 0;
            if (grid[y * cols + xL] === 1) exc++;
            if (grid[y * cols + xR] === 1) exc++;
            if (grid[yU * cols + x] === 1) exc++;
            if (grid[yD * cols + x] === 1) exc++;
            next[i] = exc >= threshold ? 1 : 0;
          } else {
            // Non-resting: deterministically advance, wrapping N−1 → 0.
            next[i] = s + 1 >= nStates ? 0 : s + 1;
          }
        }
      }
      // Keep the pacemaker firing on its natural period: when it returns to rest
      // it will re-fire because nStates is its cycle length. Forcing it here
      // guarantees a clean periodic source even if neighbors perturb it.
      if (this.pacemaker >= 0 && next[this.pacemaker] === 0) {
        next[this.pacemaker] = 1;
      }
      // swap buffers
      this.grid = next;
      this.next = grid;
    }

    // Fraction of cells currently excited (state 1) — for the readout/tests.
    excitedFraction() {
      const g = this.grid;
      let c = 0;
      for (let i = 0; i < g.length; i++) if (g[i] === 1) c++;
      return c / g.length;
    }

    // ---- rendering --------------------------------------------------------
    // Build an N-entry color ramp: resting dark; excited bright amber/white;
    // refractory states fade amber → teal → dark so the wave glows at the front
    // and trails a fading tail.
    _buildPalette() {
      const N = this.nStates;
      const pal = new Uint8Array(N * 3);
      // resting (0): near-black background.
      pal[0] = 8; pal[1] = 10; pal[2] = 14;
      // excited (1): hot, near-white amber.
      pal[3] = 255; pal[4] = 244; pal[5] = 220;
      // refractory (2 … N−1): amber → teal → dark fade.
      const ref = N - 2;   // number of refractory states
      for (let s = 2; s < N; s++) {
        const t = ref <= 1 ? 0 : (s - 2) / (ref - 1);   // 0 at front, 1 at tail
        let r, g, b;
        if (t < 0.5) {
          const u = t / 0.5;                 // amber → teal
          r = Math.round(232 + u * (60 - 232));
          g = Math.round(170 + u * (190 - 170));
          b = Math.round(70 + u * (175 - 70));
        } else {
          const u = (t - 0.5) / 0.5;         // teal → dark
          r = Math.round(60 + u * (10 - 60));
          g = Math.round(190 + u * (16 - 190));
          b = Math.round(175 + u * (22 - 175));
        }
        const j = s * 3;
        pal[j] = r; pal[j + 1] = g; pal[j + 2] = b;
      }
      this.palette = pal;
    }

    draw(ctx, w, h) {
      const { grid, img, palette } = this;
      if (!img) return; // headless / no canvas
      const data = img.data;
      for (let i = 0; i < grid.length; i++) {
        const s = grid[i];
        const p = s * 3;
        const j = i << 2;
        data[j] = palette[p]; data[j + 1] = palette[p + 1]; data[j + 2] = palette[p + 2];
        data[j + 3] = 255;
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

    // Paint a brush of excited cells; the reader can start waves or break a
    // wavefront (drag through one) to spawn a spiral.
    paintAt(p) {
      const cx = Math.floor(p.nx * this.cols);
      const cy = Math.floor(p.ny * this.rows);
      const r = 2;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const x = ((cx + dx) % this.cols + this.cols) % this.cols;
          const y = ((cy + dy) % this.rows + this.rows) % this.rows;
          this.grid[this.idx(x, y)] = 1;   // excite
        }
      }
      if (!this.running) this._renderOnce();
    }
  }

  // ---- mount + controls ---------------------------------------------------
  const sim = new ExcitableMedia('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.params.pattern = 'random'; if (sim._patternSel) sim._patternSel.value = 'random'; sim.seed(); sim._renderOnce(); } });

  sim._patternSel = sim.select('pattern', [
    { value: 'spiral', label: 'Spiral' },
    { value: 'target', label: 'Target waves' },
    { value: 'random', label: 'Random' }
  ], { value: 'spiral', onChange: () => { sim.seed(); sim._renderOnce(); } });

  // states N (refractory length): longer = thicker wave tails / different pitch.
  sim.slider('states', { min: 4, max: 16, step: 1, value: 8, fmt: v => v + ' states',
    onInput: () => { sim.setup(); sim._renderOnce(); } });

  sim.slider('threshold', { min: 1, max: 3, step: 1, value: 1, fmt: v => v + '' });

  sim.slider('speed', { min: 1, max: 8, step: 1, value: 1, fmt: v => v + ' / frame',
    onInput: v => { sim.stepsPerFrame = Math.max(1, Math.round(v)); } });
  sim.stepsPerFrame = 1;

  // paint excited cells where the user drags
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p);
  });

  sim.readout(s =>
    `N=${s.nStates}  ·  threshold ${Math.round(s.params.threshold ?? 1)}  ·  ` +
    `excited ${(s.excitedFraction() * 100).toFixed(1)}%`);
})();
