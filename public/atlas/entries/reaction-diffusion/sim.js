/* Gray–Scott reaction–diffusion — Turing patterns on a toroidal grid.
 * Extends Atlas.Sim. Two chemical fields U and V diffuse and react:
 *   U' = U + (Du·∇²U − U·V² + f·(1−U))·dt
 *   V' = V + (Dv·∇²V + U·V² − (f+k)·V)·dt
 * The Laplacian ∇² is a 3×3 convolution (center −1, orthogonals +0.2,
 * diagonals +0.05) with wrap-around edges. V is rendered through a color ramp.
 * Choose a preset, tune feed/kill, drag to paint V, and watch spots, mazes,
 * and mitotic blobs self-organize. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  const CELL = 3;       // logical pixels per simulation cell (coarse for speed)
  const Du = 0.16, Dv = 0.08, dt = 1.0;

  // Named (feed, kill) regimes from Pearson (1993) / the Gray–Scott literature.
  const PRESETS = {
    'coral':   { f: 0.0545, k: 0.0620, label: 'Coral growth' },
    'mitosis': { f: 0.0367, k: 0.0649, label: 'Mitosis' },
    'spots':   { f: 0.0300, k: 0.0620, label: 'Spots' },
    'maze':    { f: 0.0290, k: 0.0570, label: 'Maze' },
    'waves':   { f: 0.0140, k: 0.0540, label: 'Waves / U-skate' }
  };

  class ReactionDiffusion extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
    }

    setup() {
      this.cols = Math.max(1, Math.floor(this.width / CELL));
      this.rows = Math.max(1, Math.floor(this.height / CELL));
      const n = this.cols * this.rows;
      this.U = new Float32Array(n);
      this.V = new Float32Array(n);
      this.U2 = new Float32Array(n);
      this.V2 = new Float32Array(n);
      // Real ImageData in the browser; null under the headless stub (no canvas).
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.cols, this.rows) : null;
      this.img = (made && made.data) ? made : null;
      this.seed();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // U=1 everywhere, V=0, then drop a few noisy squares of V≈0.5. The first
    // square sits dead center; the rest are scattered to break symmetry.
    seed() {
      const { U, V, cols, rows } = this;
      U.fill(1); V.fill(0);
      const blobs = 7;
      const r = Math.max(4, Math.floor(Math.min(cols, rows) * 0.06));
      for (let b = 0; b < blobs; b++) {
        const bx = b === 0 ? (cols >> 1) : Math.floor(cols * (0.2 + 0.6 * Math.random()));
        const by = b === 0 ? (rows >> 1) : Math.floor(rows * (0.2 + 0.6 * Math.random()));
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const x = ((bx + dx) % cols + cols) % cols;
            const y = ((by + dy) % rows + rows) % rows;
            const i = this.idx(x, y);
            U[i] = clamp(0.5 + (Math.random() - 0.5) * 0.1, 0, 1);
            V[i] = clamp(0.25 + Math.random() * 0.25, 0, 1);
          }
        }
      }
    }

    step() {
      const sub = Math.round(this.params.speed ?? 8);
      for (let s = 0; s < sub; s++) this.react();
    }

    // One Gray–Scott update over the whole grid into the back buffers.
    react() {
      const { U, V, U2, V2, cols, rows } = this;
      const f = this.params.feed ?? 0.0545;
      const k = this.params.kill ?? 0.0620;
      for (let y = 0; y < rows; y++) {
        const yU = (y - 1 + rows) % rows, yD = (y + 1) % rows;
        const rowU = y * cols, rowUu = yU * cols, rowDd = yD * cols;
        for (let x = 0; x < cols; x++) {
          const xL = (x - 1 + cols) % cols, xR = (x + 1) % cols;
          const i = rowU + x;
          const u = U[i], v = V[i];
          // 3×3 Laplacian: center −1, orthogonal +0.2, diagonal +0.05.
          const lapU =
            -u +
            0.2 * (U[rowU + xL] + U[rowU + xR] + U[rowUu + x] + U[rowDd + x]) +
            0.05 * (U[rowUu + xL] + U[rowUu + xR] + U[rowDd + xL] + U[rowDd + xR]);
          const lapV =
            -v +
            0.2 * (V[rowU + xL] + V[rowU + xR] + V[rowUu + x] + V[rowDd + x]) +
            0.05 * (V[rowUu + xL] + V[rowUu + xR] + V[rowDd + xL] + V[rowDd + xR]);
          const uvv = u * v * v;
          let nu = u + (Du * lapU - uvv + f * (1 - u)) * dt;
          let nv = v + (Dv * lapV + uvv - (f + k) * v) * dt;
          U2[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
          V2[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
        }
      }
      // swap buffers
      this.U = U2; this.U2 = U;
      this.V = V2; this.V2 = V;
    }

    draw(ctx, w, h) {
      const { V, U, img } = this;
      if (!img) return; // headless / no canvas: rendering is a no-op
      const data = img.data;
      for (let i = 0; i < V.length; i++) {
        // Map the activator (U−V, high where V dominates) to a teal→amber ramp.
        const t = clamp(V[i] - U[i] + 0.6, 0, 1);
        const c = ramp(t);
        const j = i << 2;
        data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255;
      }
      // Draw the small grid into a scratch canvas-free path: blit, then scale.
      ctx.imageSmoothingEnabled = false;
      // putImageData ignores transforms, so paint at native cell resolution via
      // a temporary bitmap drawn scaled with drawImage.
      this._blit(ctx, w, h);
    }

    _blit(ctx, w, h) {
      // Lazily create an offscreen canvas sized to the grid, draw the ImageData
      // there, then scale it up onto the visible canvas.
      if (!this._off || this._off.width !== this.cols || this._off.height !== this.rows) {
        this._off = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (this._off) { this._off.width = this.cols; this._off.height = this.rows; }
        this._offCtx = this._off ? this._off.getContext('2d') : null;
      }
      if (!this._offCtx) return; // headless: rendering is a no-op
      this._offCtx.putImageData(this.img, 0, 0);
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this._off, 0, 0, this.cols, this.rows, 0, 0, w, h);
    }

    // Paint a soft brush of V (and depress U) at a pointer location.
    paintAt(p) {
      const cx = Math.floor(p.nx * this.cols);
      const cy = Math.floor(p.ny * this.rows);
      const r = 5;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const x = ((cx + dx) % this.cols + this.cols) % this.cols;
          const y = ((cy + dy) % this.rows + this.rows) % this.rows;
          const i = this.idx(x, y);
          this.V[i] = clamp(this.V[i] + 0.6, 0, 1);
          this.U[i] = clamp(this.U[i] - 0.3, 0, 1);
        }
      }
      if (!this.running) this._renderOnce();
    }
  }

  // teal (low V) → deep blue → amber (high V) ramp, returns [r,g,b].
  function ramp(t) {
    // three-stop gradient
    if (t < 0.5) {
      const u = t / 0.5;                 // 0..1 : background → mid
      return [
        Math.round(6 + u * (24 - 6)),
        Math.round(28 + u * (40 - 28)),
        Math.round(38 + u * (90 - 38))
      ];
    }
    const u = (t - 0.5) / 0.5;           // 0..1 : mid → amber
    return [
      Math.round(24 + u * (232 - 24)),
      Math.round(40 + u * (170 - 40)),
      Math.round(90 + u * (70 - 90))
    ];
  }

  // ---- mount + controls ----
  const sim = new ReactionDiffusion('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.seed(); sim._renderOnce(); } });

  const presetOptions = Object.keys(PRESETS).map(key => ({ value: key, label: PRESETS[key].label }));
  sim.select('preset', presetOptions, {
    value: 'coral',
    onChange: v => {
      const p = PRESETS[v];
      if (!p) return;
      sim.params.feed = p.f;
      sim.params.kill = p.k;
      // reflect into the slider UI
      if (sim._feedInput) { sim._feedInput.value = p.f; sim._feedInput.dispatchEvent(new Event('input')); }
      if (sim._killInput) { sim._killInput.value = p.k; sim._killInput.dispatchEvent(new Event('input')); }
      sim.seed();
      sim._renderOnce();
    }
  });

  sim._feedInput = sim.slider('feed', { min: 0.0, max: 0.1, step: 0.0001, value: PRESETS.coral.f,
    fmt: v => v.toFixed(4) });
  sim._killInput = sim.slider('kill', { min: 0.04, max: 0.07, step: 0.0001, value: PRESETS.coral.k,
    fmt: v => v.toFixed(4) });
  sim.slider('speed', { min: 1, max: 24, step: 1, value: 16, fmt: v => v + ' steps' });

  // paint V where the user drags
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p);
  });

  sim.readout(s =>
    `feed ${(s.params.feed ?? 0).toFixed(4)}  ·  kill ${(s.params.kill ?? 0).toFixed(4)}  ·  ${s.cols}×${s.rows}`);
})();
