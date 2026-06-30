/* Diffusion-Limited Aggregation (DLA) — Witten & Sander 1981.
 * Extends Atlas.Sim. A grid of cells, each empty or part of the aggregate.
 * One or more SEED cells start as aggregate. Repeatedly: release a random
 * walker on a launch circle around the cluster; let it random-walk; when it
 * steps next to an existing aggregate cell it STICKS (with probability
 * `stickiness`) and becomes aggregate, and a new walker is launched. Over
 * many particles this grows a branching fractal dendrite (fractal dimension
 * ~1.71 in 2D, off-lattice).
 *
 * Performance — the standard DLA accelerations are implemented:
 *  - Track the cluster's bounding radius R from the seed centroid. Each walker
 *    is launched on a circle of radius ~R+5 (not from infinity).
 *  - A walker that wanders past a kill radius (~2R + margin) is discarded and
 *    relaunched — it would otherwise take eons to drift back.
 *  - Far from the cluster the walker takes BIGGER steps (a jump proportional to
 *    its distance to the launch circle), reverting to unit steps near the front.
 *  - Many particles are aggregated per frame (a speed slider).
 *
 * Coloring: aggregate cells are tinted by attachment order, a gradient from an
 * early teal core to recent amber tips, so the growth history is legible.
 */
(function () {
  'use strict';
  const { Sim, clamp, TAU } = Atlas;

  const CELL = 3; // logical pixels per cell

  // 8-neighborhood offsets (a contact in any of the 8 directions sticks).
  const NX = [-1, 0, 1, -1, 1, -1, 0, 1];
  const NY = [-1, -1, -1, 0, 0, 1, 1, 1];

  class DLA extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.count = 0;     // aggregated particles (incl. seeds)
      this.seeds = 0;     // number of seed cells
      this.R = 0;         // current bounding radius of the cluster (cells)
      this.walker = null; // {x,y} of the live walker, for faint rendering
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      const n = this.cols * this.rows;
      this.occupied = new Uint8Array(n);   // 1 where aggregate
      this.order = new Float32Array(n);    // attachment order (0..1) for color
      this.count = 0;
      this.seeds = 0;
      this.R = 0;
      this.walker = null;
      this._orderTick = 0;  // monotone attachment counter
      this._orderMax = 1;   // running max for color normalization
      // Cluster center = launch origin. Set per seed mode.
      this.cx = this.cols >> 1;
      this.cy = this.rows >> 1;
      this._seedCluster(this.params.seed || 'center');
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }

    // Mark cell (x,y) as aggregate (no bounds check). `o` is attachment order 0..1.
    _set(x, y, o) {
      const i = this.idx(x, y);
      if (this.occupied[i]) return false;
      this.occupied[i] = 1;
      this.order[i] = o;
      this.count++;
      // Update bounding radius from the launch origin.
      const dx = x - this.cx, dy = y - this.cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > this.R) this.R = r;
      return true;
    }

    _seedCluster(mode) {
      this.occupied.fill(0);
      this.order.fill(0);
      this.count = 0;
      this.R = 0;
      const { cols, rows } = this;
      if (mode === 'bottom') {
        // A floor of seed cells along the bottom → upward forest of dendrites.
        // Launch origin sits at the floor; growth is mostly upward.
        this.cx = cols >> 1;
        this.cy = rows - 1;
        for (let x = 0; x < cols; x++) this._set(x, rows - 1, 0);
        this.seeds = cols;
        this.R = 0; // measured from the floor; height grows as R below
      } else if (mode === 'random') {
        // A handful of scattered seeds.
        this.cx = cols >> 1;
        this.cy = rows >> 1;
        const k = 6;
        for (let s = 0; s < k; s++) {
          const x = 2 + ((Math.random() * (cols - 4)) | 0);
          const y = 2 + ((Math.random() * (rows - 4)) | 0);
          this._set(x, y, 0);
        }
        this.seeds = this.count;
        // Radius from center to farthest seed already tracked by _set.
      } else {
        // Center seed → a single radial dendrite / snowflake-like cluster.
        this.cx = cols >> 1;
        this.cy = rows >> 1;
        this._set(this.cx, this.cy, 0);
        this.seeds = 1;
      }
    }

    // Is (x,y) adjacent (8-neighborhood) to any aggregate cell?
    _touching(x, y) {
      for (let k = 0; k < 8; k++) {
        const nx = x + NX[k], ny = y + NY[k];
        if (this.inBounds(nx, ny) && this.occupied[this.idx(nx, ny)]) return true;
      }
      return false;
    }

    // Launch one walker and walk it until it sticks (return true) or is killed
    // / aborted (return false). Implements the launch-circle + kill-circle +
    // adaptive-step accelerations.
    _launchOne() {
      const { cols, rows } = this;
      const bottom = (this.params.seed || 'center') === 'bottom';
      const sticky = clamp(this.params.stickiness ?? 0.8, 0.01, 1);

      // Launch radius: just outside the current cluster front.
      const launchR = this.R + 5;
      const killR = this.R * 2 + 20; // discard if it wanders this far out

      let x, y;
      if (bottom) {
        // Launch from a horizontal line a little above the tallest growth.
        const launchY = Math.max(1, this.cy - Math.ceil(this.R) - 5);
        x = (Math.random() * cols) | 0;
        y = launchY;
      } else {
        const a = Math.random() * TAU;
        x = Math.round(this.cx + Math.cos(a) * launchR);
        y = Math.round(this.cy + Math.sin(a) * launchR);
      }
      x = clamp(x, 0, cols - 1);
      y = clamp(y, 0, rows - 1);

      // If we somehow launched on/next to the cluster, bail (rare).
      if (this.occupied[this.idx(x, y)]) return false;

      let steps = 0;
      const maxSteps = 4000;
      while (steps++ < maxSteps) {
        // If adjacent to the aggregate, attempt to stick.
        if (this._touching(x, y)) {
          if (Math.random() < sticky) {
            this._set(x, y, this._nextOrder());
            this.walker = null;
            return true;
          }
          // Didn't stick: take a unit step and continue (denser growth).
        }

        // Adaptive step size: far from the cluster, jump in big strides.
        const dx0 = x - this.cx, dy0 = y - this.cy;
        const dist = bottom
          ? Math.abs(y - this.cy)
          : Math.sqrt(dx0 * dx0 + dy0 * dy0);
        // gap from the launch front; take steps up to that gap (min 1).
        const gap = Math.floor(dist - this.R - 1);
        const stepLen = gap > 2 ? Math.min(gap, 12) : 1;

        if (stepLen === 1) {
          // Unit random step in the 8-neighborhood (diagonal moves allowed).
          const k = (Math.random() * 8) | 0;
          x += NX[k]; y += NY[k];
        } else {
          // A larger jump in a random direction (keeps the walker mobile far out).
          const a = Math.random() * TAU;
          x += Math.round(Math.cos(a) * stepLen);
          y += Math.round(Math.sin(a) * stepLen);
        }

        // Kill / relaunch if it escapes the kill circle, or leaves the grid.
        const ex = x - this.cx, ey = y - this.cy;
        const er = bottom ? Math.abs(ey) : Math.sqrt(ex * ex + ey * ey);
        if (er > killR || x < 0 || y < 0 || x >= cols || y >= rows) {
          this.walker = null;
          return false; // aborted; caller will try another walker
        }
        this.walker = { x, y };
      }
      this.walker = null;
      return false; // exhausted step budget
    }

    _nextOrder() {
      // Monotone increasing tag in [0,1], based on particles added so far.
      // We don't know the final count, so use a soft saturating curve; the
      // draw() pass re-normalizes anyway via the running max.
      this._orderTick = (this._orderTick || 0) + 1;
      if (this._orderTick > this._orderMax) this._orderMax = this._orderTick;
      return this._orderTick;
    }

    // Aggregate up to `n` particles (each may take several walker attempts).
    grow(n) {
      let added = 0;
      let attempts = 0;
      const maxAttempts = n * 50 + 200;
      while (added < n && attempts++ < maxAttempts) {
        if (this._launchOne()) added++;
      }
      return added;
    }

    step() {
      const per = Math.max(1, Math.round(this.params.speed ?? 25));
      this.grow(per);
    }

    growBatch(n) {
      this.grow(n);
      if (!this.running) this._renderOnce();
    }

    // Place an aggregate seed cell at the pointer (lets the reader draw seeds).
    seedAtPointer(p) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      if (!this.inBounds(x, y)) return;
      if (this._set(x, y, this._nextOrder())) this.seeds++;
      if (!this.running) this._renderOnce();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows, occupied, order } = this;
      const omax = this._orderMax || 1;
      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        for (let x = 0; x < cols; x++) {
          const i = row + x;
          if (!occupied[i]) continue;
          // Normalize attachment order to 0..1 (0 = early core, 1 = recent tip).
          const t = order[i] > 0 ? clamp(order[i] / omax, 0, 1) : 0;
          ctx.fillStyle = gradient(t);
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      // Faintly draw the live walker so the process is visible.
      if (this.walker) {
        ctx.fillStyle = 'rgba(220,235,255,0.35)';
        ctx.fillRect(this.walker.x * CELL, this.walker.y * CELL, CELL, CELL);
      }
    }
  }

  // teal core (early) → amber tips (recent). Simple two-stop interpolation
  // through a green midtone keeps the gradient legible against the dark field.
  function gradient(t) {
    // stops: 0.0 teal #2bd4c4, 0.5 green-gold #8fcf6a, 1.0 amber #f0a83c
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = lerp(0x2b, 0x8f, u); g = lerp(0xd4, 0xcf, u); b = lerp(0xc4, 0x6a, u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = lerp(0x8f, 0xf0, u); g = lerp(0xcf, 0xa8, u); b = lerp(0x6a, 0x3c, u);
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- mount + controls ----
  const sim = new DLA('#stage');
  sim.start();

  sim.standardRail({ randomize: () => sim.reset() });
  sim.select('seed', [
    { value: 'center', label: 'Center seed' },
    { value: 'bottom', label: 'Bottom line' },
    { value: 'random', label: 'Random seeds' }
  ], { value: 'center', onChange: () => sim.reset() });
  sim.slider('speed', { min: 1, max: 200, step: 1, value: 25,
    fmt: v => v + ' /frame' });
  sim.slider('stickiness', { min: 0.05, max: 1, step: 0.05, value: 0.8,
    fmt: v => v.toFixed(2) });
  sim.button('grow 2000', () => sim.growBatch(2000));

  // Click / drag to place extra seed cells.
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.seedAtPointer(p);
  });

  sim.readout(s =>
    `particles ${s.count - s.seeds}  ·  cluster radius ${Math.round(s.R)} cells  ·  seeds ${s.seeds}`);
})();
