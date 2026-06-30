/* Snow-crystal growth — Reiter's local cellular model.
 *   Reiter, C. A. (2005). "A local cellular model for snow crystal growth."
 *   Chaos, Solitons & Fractals 23(4), 1111–1119.
 *
 * A hexagonal cellular automaton. Each cell z holds a real value s(z) = the
 * amount of water there. A cell is FROZEN (part of the ice crystal) when
 * s(z) >= 1. Every cell starts at the background vapour level β except a single
 * centre cell set to 1 (the seed).
 *
 * Each time step splits, feeds, diffuses and recombines the water field:
 *   1. RECEPTIVE set: a cell is receptive if it is frozen OR has a frozen
 *      neighbour. (These are the sites where vapour is being captured by ice.)
 *   2. SPLIT each cell's water into u (non-receptive participating field) and
 *      v (held part): u = s if NOT receptive else 0;  v = s if receptive else 0.
 *   3. VAPOUR addition: add the constant γ to v at every receptive cell.
 *   4. DIFFUSE the non-receptive field with a hex average:
 *        u'(z) = u(z) + (α/2)·( mean_of_6_neighbours(u) − u(z) ).
 *   5. RECOMBINE: s(z) = u'(z) + v(z). Cells with s >= 1 are now frozen.
 *
 * Because the lattice is hexagonal and the rule isotropic, the crystal grows
 * with SIX-FOLD symmetry by construction; the diffusion-limited instability
 * (tips poke into richer vapour than valleys, so they grow faster) makes it
 * branch into dendrites — a snowflake.
 *
 * Coordinates: axial (q, r) stored in a 2D array of width=cols, height=rows.
 * Pointy-top hex. The six axial neighbour offsets are
 *   (+1, 0) (+1,-1) (0,-1) (-1,0) (-1,+1) (0,+1).
 * A 60° rotation about the origin in axial coords is (q,r) -> (-r, q+r).
 */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  // Axial neighbour offsets (exactly six — the hex neighbourhood).
  const HEX = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  // Morphology presets — (α, β, γ) triples from the Reiter regime survey.
  // β (background vapour / "humidity") is the morphology star knob.
  const PRESETS = {
    'dendrite':  { alpha: 1.0,  beta: 0.40,  gamma: 0.0010, label: 'Dendrite (branched star)' },
    'stellar':   { alpha: 1.0,  beta: 0.35,  gamma: 0.0010, label: 'Stellar dendrite' },
    'fern':      { alpha: 1.0,  beta: 0.40,  gamma: 0.0005, label: 'Fern (fine dendrite)' },
    'sectored':  { alpha: 1.0,  beta: 0.50,  gamma: 0.0500, label: 'Sectored plate' }
  };

  class Snowflake extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62, stepsPerFrame: 1 });
      this.frozenCount = 0;
      this.maxRadius = 0;   // furthest frozen ring from centre (hex distance)
    }

    setup() {
      // Choose a hex grid that comfortably fills the canvas. We size the lattice
      // by a fixed cell radius so the crystal is large but still fast.
      const HEXR = 3.0;                 // hex "size" in logical px (circumradius)
      this.hexr = HEXR;
      // Pointy-top spacing: horizontal = sqrt(3)*r, vertical = 1.5*r.
      const hstep = Math.sqrt(3) * HEXR;
      const vstep = 1.5 * HEXR;
      this.rows = Math.max(31, Math.floor(this.height / vstep) | 1);  // force odd
      // The axial render shears each row by hstep·(r/2), so a plain cols-wide
      // parallelogram leaves triangular gaps at the canvas corners. Widen cols by
      // rows/2 so the sheared lattice fully covers the rectangle (extra cells are
      // cheap and clipped out of drawing).
      this.cols = Math.max(31, (Math.floor(this.width / hstep) + (this.rows >> 1)) | 1); // force odd
      // store as a 2D "offset" array indexed [row][col]; we map row,col -> axial.
      const n = this.rows * this.cols;
      this.s = new Float32Array(n);     // water field
      this.s2 = new Float32Array(n);    // back buffer
      this.frozen = new Uint8Array(n);  // 1 where s >= 1

      // Centre cell (offset coords). Axial origin sits here.
      this.cRow = this.rows >> 1;
      this.cCol = this.cols >> 1;

      this.reseedField();
    }

    onResize() { this.setup(); }

    idx(row, col) { return row * this.cols + col; }
    inBounds(row, col) { return row >= 0 && col >= 0 && row < this.rows && col < this.cols; }

    // ---- coordinate conversions (axial <-> offset row/col) ----------------
    // We use an "even-r"-style offset built directly from axial so the six
    // neighbour offsets are exact and rotation is exact. Storage row/col is just
    // axial shifted to be non-negative: row = r + cRow, col = q + cCol + (r>>1)
    // would skew the array; instead we keep a direct axial<->offset that keeps
    // the neighbour set simple. We store by (r, q) with a per-row column shift so
    // axial neighbours land on the stored grid. To keep this robust we instead
    // store axial directly: row encodes r, col encodes q, both centred.
    axialToRC(q, r) {
      return { row: r + this.cRow, col: q + this.cCol };
    }
    rcToAxial(row, col) {
      return { q: col - this.cCol, r: row - this.cRow };
    }

    // hex (cube) distance from centre for axial (q, r)
    hexDist(q, r) {
      // cube: x=q, z=r, y=-x-z
      return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
    }

    // Background fill + single frozen seed at the centre.
    reseedField() {
      const beta = this.params.beta ?? 0.40;
      this.s.fill(beta);
      this.frozen.fill(0);
      const c = this.idx(this.cRow, this.cCol);
      this.s[c] = 1;
      this.frozen[c] = 1;
      this.frozenCount = 1;
      this.maxRadius = 0;
      this.ticks = 0;
    }

    // ---- the Reiter update ------------------------------------------------
    step() {
      const sub = Math.max(1, Math.round(this.params.speed ?? 1));
      for (let s = 0; s < sub; s++) this.reiter();
    }

    reiter() {
      const { s, s2, frozen, rows, cols } = this;
      const alpha = this.params.alpha ?? 1.0;
      const gamma = this.params.gamma ?? 0.001;
      const n = rows * cols;

      // Lazily allocate the receptive mask + the "u" (non-receptive participating)
      // field. u is s where a cell is NON-receptive, and 0 at receptive cells —
      // exactly Reiter's "set the receptive sites to zero" diffusion field.
      if (!this._recep || this._recep.length !== n) {
        this._recep = new Uint8Array(n);
        this._u = new Float32Array(n);
      }
      const recep = this._recep, u = this._u;

      // Active-region bound: the crystal grows from the centre and the far field
      // stays flat at β (no gradient → no diffusion, no freezing out there), so we
      // process only a box around the crystal: centre ± (maxRadius + margin). The
      // β-rim inside the margin is undisturbed, so this is exact; it turns the
      // per-frame cost from O(grid) into O(crystal) — the big growth-time speedup.
      const M = 14;
      const R = (this.maxRadius | 0) + M;
      const r0 = Math.max(1, this.cRow - R), r1 = Math.min(rows - 2, this.cRow + R);
      const c0 = Math.max(1, this.cCol - R), c1 = Math.min(cols - 2, this.cCol + R);

      // Pass 1 (over the box + a 1-cell ring, so pass 2's neighbour reads are
      // valid) — classify receptive cells and build the u field (= s on
      // non-receptive cells, 0 on receptive cells).
      for (let row = r0 - 1; row <= r1 + 1; row++) {
        for (let col = c0 - 1; col <= c1 + 1; col++) {
          const i = row * cols + col;
          let r = frozen[i] === 1;
          if (!r) {
            for (let k = 0; k < 6; k++) {
              const nr = row + HEX_RC[k][0], nc = col + HEX_RC[k][1];
              if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
              if (frozen[nr * cols + nc]) { r = true; break; }
            }
          }
          recep[i] = r ? 1 : 0;
          u[i] = r ? 0 : s[i];   // receptive sites zeroed in the diffusion field
        }
      }

      // Pass 2 (over the box) — Reiter update, committing s in place (pass 2 reads
      // only the pass-1 u snapshot, never s, so in-place update is exact):
      //   v(z)  = s(z) + γ   at receptive cells  (the HELD water, fed vapour),
      //   u'(z) = u(z) + (α/12)·( Σ_6 u(neighbour) − 6·u(z) )   [hex diffusion].
      // KEY: receptive cells have u(z)=0 but STILL collect inflow from their
      // non-receptive neighbours — exposed tips (more such neighbours) grow faster
      // than valleys, i.e. the diffusion-limited branching instability.
      const c = alpha / 12;
      let newFrozen = 0, count = 0, mr = 0;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const i = row * cols + col;
          const ui = u[i];
          let sum = 0;
          for (let k = 0; k < 6; k++) {
            const nr = row + HEX_RC[k][0], nc = col + HEX_RC[k][1];
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) { sum += ui; continue; }
            sum += u[nr * cols + nc];
          }
          const held = recep[i] ? s[i] + gamma : 0;
          s[i] = held + ui + c * (sum - 6 * ui);
          if (!frozen[i] && s[i] >= 1) { frozen[i] = 1; newFrozen++; }
          if (frozen[i]) {
            count++;
            const q = col - this.cCol, rr = row - this.cRow;
            const d = (Math.abs(q) + Math.abs(q + rr) + Math.abs(rr)) / 2;
            if (d > mr) mr = d;
          }
        }
      }
      // The box contains every frozen cell, so this count/radius is exact.
      this.frozenCount = count;
      this.maxRadius = mr;
    }

    // Test/readout accessor: is the cell at axial (q, r) frozen?
    frozenAt(q, r) {
      const { row, col } = this.axialToRC(q, r);
      if (!this.inBounds(row, col)) return false;
      return this.frozen[this.idx(row, col)] === 1;
    }

    // Water value at axial (q, r) (for tests / debugging).
    valueAt(q, r) {
      const { row, col } = this.axialToRC(q, r);
      if (!this.inBounds(row, col)) return 0;
      return this.s[this.idx(row, col)];
    }

    // ---- rendering --------------------------------------------------------
    draw(ctx, w, h) {
      const { s, frozen, rows, cols, hexr } = this;
      const hstep = Math.sqrt(3) * hexr;
      const vstep = 1.5 * hexr;
      const ox = w / 2, oy = h / 2;
      // The far field every distant cell sits at the same background β, which
      // renders to ONE flat colour — paint it once (sampled from a corner cell),
      // then draw only the active region around the crystal. This turns the draw
      // from O(grid) hexagon-fills into O(crystal + halo), the real perf win.
      const bv = clamp(s[0], 0, 1);
      ctx.fillStyle = `rgb(${(8 + 18 * bv) | 0},${(12 + 45 * bv) | 0},${(10 + 70 * bv) | 0})`;
      ctx.fillRect(0, 0, w, h);
      const R = (this.maxRadius | 0) + 16;
      const r0 = Math.max(0, this.cRow - R), r1 = Math.min(rows - 1, this.cRow + R);
      const c0 = Math.max(0, this.cCol - R), c1 = Math.min(cols - 1, this.cCol + R);
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const i = row * cols + col;
          const q = col - this.cCol, rr = row - this.cRow;
          const x = ox + hstep * (q + rr / 2);
          const y = oy + vstep * rr;
          if (x < -hexr || x > w + hexr || y < -hexr || y > h + hexr) continue;

          if (frozen[i]) {
            // Frozen ice: bright pale blue/white, lightly shaded by s.
            const t = clamp((s[i] - 1) * 0.9, 0, 1);
            hexPath(ctx, x, y, hexr);
            ctx.fillStyle = `rgb(${(200 + 55 * t) | 0},${(225 + 30 * t) | 0},255)`;
            ctx.fill();
          } else {
            // Vapour halo: only draw cells that differ from the flat β background
            // (the depleted/enriched zones near the crystal); the rest is already
            // painted by the background fill.
            const v = clamp(s[i], 0, 1);
            if (Math.abs(v - bv) < 0.015) continue;
            hexPath(ctx, x, y, hexr);
            ctx.fillStyle = `rgb(${(8 + 18 * v) | 0},${(12 + 45 * v) | 0},${(10 + 70 * v) | 0})`;
            ctx.fill();
          }
        }
      }
    }
  }

  // Offset (row, col) deltas that realise the six axial neighbours under our
  // direct axial<->offset mapping (row = r, col = q): an axial offset (dq, dr)
  // becomes a (drow, dcol) = (dr, dq) move. So HEX_RC mirrors HEX with swapped
  // order: [drow, dcol] = [dr, dq].
  const HEX_RC = HEX.map(([dq, dr]) => [dr, dq]);

  // Trace a pointy-top hexagon of circumradius `r` centred at (x, y).
  function hexPath(ctx, x, y, r) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 180 * (60 * k - 90); // pointy-top: first vertex up
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // ---- mount + controls ---------------------------------------------------
  const sim = new Snowflake('#stage');
  sim.start();

  sim.standardRail({
    randomize: () => {
      // Re-seed and jitter β slightly so each crystal differs — "no two alike".
      const jitter = (Math.random() - 0.5) * 0.06;
      const nb = clamp((sim.params.beta ?? 0.40) + jitter, 0.30, 0.95);
      if (sim._betaInput) {
        sim._betaInput.value = nb;
        sim._betaInput.dispatchEvent(new Event('input'));
      } else {
        sim.params.beta = nb;
      }
      sim.reset();
    }
  });

  const presetOptions = Object.keys(PRESETS).map(key => ({ value: key, label: PRESETS[key].label }));
  sim.select('preset', presetOptions, {
    value: 'dendrite',
    onChange: v => {
      const p = PRESETS[v];
      if (!p) return;
      sim.params.alpha = p.alpha;
      sim.params.beta = p.beta;
      sim.params.gamma = p.gamma;
      // reflect into the slider UI
      if (sim._alphaInput) { sim._alphaInput.value = p.alpha; sim._alphaInput.dispatchEvent(new Event('input')); }
      if (sim._betaInput)  { sim._betaInput.value = p.beta;   sim._betaInput.dispatchEvent(new Event('input')); }
      if (sim._gammaInput) { sim._gammaInput.value = p.gamma; sim._gammaInput.dispatchEvent(new Event('input')); }
      sim.reset();
    }
  });

  // β / humidity — the morphology star knob.
  sim._betaInput = sim.slider('β humidity', { min: 0.30, max: 0.95, step: 0.01, value: PRESETS.dendrite.beta,
    fmt: v => v.toFixed(2), onInput: () => sim.reset() });
  // α — diffusion rate.
  sim._alphaInput = sim.slider('α diffusion', { min: 0.5, max: 2.0, step: 0.01, value: PRESETS.dendrite.alpha,
    fmt: v => v.toFixed(2) });
  // γ — vapour addition (log-ish range: tiny values give dendrites, large give
  // compact plates). Fine step so the dendrite regime (~0.0005–0.002) is reachable.
  sim._gammaInput = sim.slider('γ vapour', { min: 0.0, max: 0.06, step: 0.0005, value: PRESETS.dendrite.gamma,
    fmt: v => v.toFixed(4) });
  // speed — Reiter steps per rendered frame.
  sim.slider('speed', { min: 1, max: 12, step: 1, value: 3, fmt: v => v + ' steps' });

  sim.readout(s =>
    `frozen ${s.frozenCount} cells  ·  radius ${Math.round(s.maxRadius)} hex  ·  β ${(s.params.beta ?? 0).toFixed(2)}`);
})();
