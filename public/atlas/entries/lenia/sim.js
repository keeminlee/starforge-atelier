/* Lenia — a continuous cellular automaton (Bert Chan, 2019).
 *
 * Life with the integers turned into smooth curves. A single continuous field
 * A(x,y) ∈ [0,1] lives on a toroidal grid. Each step:
 *   1. Potential  U = K ∗ A   (convolution of A with a smooth radial kernel K)
 *   2. Growth     G(u) = 2·exp(−(u−μ)²/(2σ²)) − 1   (a Gaussian bump in [−1,1])
 *   3. Update     A ← clip(A + dt·G(U), 0, 1),  all cells synchronously.
 *
 * With the canonical Orbium parameters (μ=0.15, σ=0.015, dt=0.1, kernel
 * radius R=13) a small embedded creature — "Orbium" — glides smoothly across
 * the field, turning and self-repairing. Tuning μ and σ mutates or kills it.
 *
 * Render: A is mapped through a dark→teal→amber→white ramp via ImageData,
 * scaled to the canvas (the field-rendering pattern borrowed from the
 * reaction–diffusion entry). No external deps; vanilla ES + Canvas. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  const CELL = 7;   // logical pixels per simulation cell (zoomed so the Orbium reads large)
  const R = 13;     // kernel radius in cells

  // dst[i] = OR of src over the toroidal window [i−R, i+R]. Used to find the
  // active band of rows/columns so the heavy convolution can skip empty space.
  function orWindow(src, dst, n, R) {
    for (let i = 0; i < n; i++) {
      let any = 0;
      for (let d = -R; d <= R; d++) {
        let j = i + d; if (j < 0) j += n; else if (j >= n) j -= n;
        if (src[j]) { any = 1; break; }
      }
      dst[i] = any;
    }
  }

  // ---- canonical Orbium creature (Chan 2019) -----------------------------
  // The published Orbium "animal": a 20×20 matrix of values in [0,1], here
  // quantized to one decimal for compactness. This is the real Orbium pattern
  // from Bert Chan's Lenia (μ=0.15, σ=0.015, dt=0.1, R=13), the canonical
  // smooth glider. Source: Chan (2019), Lenia GitHub reference implementation.
  const ORBIUM = [
    [0,0,0,0,0,0,0.1,0.14,0.1,0,0,0.03,0.03,0,0,0.3,0,0,0,0],
    [0,0,0,0,0,0.08,0.24,0.3,0.3,0.18,0.14,0.15,0.16,0.32,0.2,0.24,0,0,0,0],
    [0,0,0,0,0,0.15,0.34,0.44,0.46,0.38,0.18,0.14,0.11,0.13,0.19,0.18,0.45,0,0,0],
    [0,0,0,0,0.06,0.13,0.39,0.5,0.5,0.37,0.06,0,0,0,0.02,0.16,0.68,0,0,0],
    [0,0,0,0.11,0.17,0.17,0.33,0.4,0.38,0.28,0.14,0,0,0,0,0,0.18,0.42,0,0],
    [0,0,0.09,0.18,0.13,0.06,0.08,0.26,0.32,0.32,0.27,0,0,0,0,0,0,0.82,0,0],
    [0.27,0,0.16,0.12,0,0,0,0.25,0.38,0.44,0.45,0.34,0,0,0,0,0,0.22,0.17,0],
    [0,0.07,0.2,0.02,0,0,0,0.31,0.48,0.57,0.6,0.57,0,0,0,0,0,0,0.49,0],
    [0,0.59,0.19,0,0,0,0,0.2,0.57,0.69,0.76,0.76,0.49,0,0,0,0,0,0.36,0],
    [0,0.58,0.19,0,0,0,0,0,0.67,0.83,0.9,0.92,0.87,0.12,0,0,0,0,0.22,0.07],
    [0,0,0.46,0,0,0,0,0,0.7,0.93,1,1,1,0.61,0,0,0,0,0.18,0.11],
    [0,0,0.82,0,0,0,0,0,0.47,1,1,0.98,1,0.96,0.27,0,0,0,0.19,0.1],
    [0,0,0.46,0,0,0,0,0,0.25,1,1,0.84,0.92,0.97,0.54,0.14,0.04,0.1,0.21,0.05],
    [0,0,0,0.4,0,0,0,0,0.09,0.8,1,0.82,0.8,0.85,0.63,0.31,0.18,0.19,0.2,0.01],
    [0,0,0,0.36,0.1,0,0,0,0.05,0.54,0.86,0.79,0.74,0.72,0.6,0.39,0.28,0.24,0.13,0],
    [0,0,0,0.01,0.3,0.07,0,0,0.08,0.36,0.64,0.7,0.64,0.6,0.51,0.39,0.29,0.19,0.04,0],
    [0,0,0,0,0.1,0.24,0.14,0.1,0.15,0.29,0.45,0.53,0.52,0.46,0.4,0.31,0.21,0.08,0,0],
    [0,0,0,0,0,0.08,0.21,0.21,0.22,0.29,0.36,0.39,0.37,0.33,0.26,0.18,0.09,0,0,0],
    [0,0,0,0,0,0,0,0.03,0.13,0.19,0.22,0.24,0.22,0.17,0.1,0.05,0.01,0,0,0],
    [0,0,0,0,0,0,0,0,0,0.02,0.06,0.08,0.09,0.07,0.04,0.01,0,0,0,0]
  ];

  class Lenia extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
    }

    setup() {
      this.gw = Math.max(1, Math.floor(this.width / CELL));
      this.gh = Math.max(1, Math.floor(this.height / CELL));
      const n = this.gw * this.gh;
      this.A = new Float32Array(n);
      this.A2 = new Float32Array(n);
      this.buildKernel();
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.gw, this.gh) : null;
      this.img = (made && made.data) ? made : null;
      const seed = (this.params && this.params.seed) || 'orbium';
      this.applySeed(seed);
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.gw + x; }

    // Precompute the kernel as a list of (dx, dy, weight) offsets within R.
    // The kernel shell is a smooth bump over normalized radius r∈(0,1):
    //   core(r) = exp(4 − 4/(4r(1−r)))   → 0 at the edges, 1 at r=0.5.
    // Weights are normalized so Σ w = 1, making U a weighted average of A.
    buildKernel() {
      const offs = [];
      let sum = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const r = dist / R;
          if (r >= 1 || r <= 0) continue;       // inside the disc, exclude center
          const w = Math.exp(4 - 4 / (4 * r * (1 - r)));  // smooth 0→1→0 bump
          if (w < 1e-4) continue;
          offs.push(dx, dy, w);
          sum += w;
        }
      }
      // normalize weights to sum to 1
      for (let i = 2; i < offs.length; i += 3) offs[i] /= sum;
      this.kOff = new Int16Array(offs.length);
      this.kW = new Float32Array(offs.length / 3);
      for (let i = 0, j = 0; i < offs.length; i += 3, j++) {
        this.kOff[i] = offs[i]; this.kOff[i + 1] = offs[i + 1];
        this.kW[j] = offs[i + 2];
      }
      this.kN = this.kW.length;
    }

    applySeed(kind) {
      const { A, gw, gh } = this;
      A.fill(0);
      if (kind === 'orbium') {
        // Stamp the canonical Orbium a touch below-left of centre so its upward-right
        // glide carries it through the middle of the (now zoomed-in) field.
        this.stampMatrix(ORBIUM, Math.floor(gw * 0.38) - 10, Math.floor(gh * 0.62) - 10);
      } else if (kind === 'random') {
        // Random soup = many smooth Gaussian blobs of random radius/height.
        const blobs = Math.max(6, Math.floor((gw * gh) / 1800));
        for (let b = 0; b < blobs; b++) {
          const cx = Math.random() * gw, cy = Math.random() * gh;
          const rad = 6 + Math.random() * 14;
          const amp = 0.4 + Math.random() * 0.6;
          this.blob(cx, cy, rad, amp);
        }
      } else if (kind === 'clear') {
        /* leave empty — paint by hand */
      }
    }

    // Stamp a 2D float matrix into the field at integer offset (ox,oy), toroidal.
    stampMatrix(m, ox, oy) {
      const { A, gw, gh } = this;
      for (let y = 0; y < m.length; y++) {
        const row = m[y];
        for (let x = 0; x < row.length; x++) {
          const v = row[x];
          if (v <= 0) continue;
          const cx = ((ox + x) % gw + gw) % gw;
          const cy = ((oy + y) % gh + gh) % gh;
          A[this.idx(cx, cy)] = clamp(v, 0, 1);
        }
      }
    }

    // Add a smooth Gaussian blob of A centered at (cx,cy), toroidal.
    blob(cx, cy, rad, amp) {
      const { A, gw, gh } = this;
      const ir = Math.ceil(rad);
      const cxi = Math.round(cx), cyi = Math.round(cy);
      for (let dy = -ir; dy <= ir; dy++) {
        for (let dx = -ir; dx <= ir; dx++) {
          const d2 = dx * dx + dy * dy;
          const g = amp * Math.exp(-d2 / (2 * (rad * 0.5) * (rad * 0.5)));
          if (g < 0.01) continue;
          const x = ((cxi + dx) % gw + gw) % gw;
          const y = ((cyi + dy) % gh + gh) % gh;
          const i = this.idx(x, y);
          A[i] = clamp(A[i] + g, 0, 1);
        }
      }
    }

    step() {
      const sub = Math.max(1, Math.round(this.params.speed ?? 1));
      for (let s = 0; s < sub; s++) this.update();
    }

    // One synchronous Lenia update: U = K∗A, then A ← clip(A + dt·G(U), 0, 1).
    // Optimization: a cell can only be nonzero if there is mass within radius R of
    // it (otherwise U=0 → growth=−1 → it stays clipped at 0). So we mark the active
    // rows/columns and skip the convolution everywhere else. This is EXACT — skipped
    // cells are provably zero — so a localized creature (Orbium) runs many times
    // faster while behaving identically. (A full grid of mass falls back to no skip.)
    update() {
      const { A, A2, gw, gh, kOff, kW, kN } = this;
      const mu = this.params.mu ?? 0.15;
      const sigma = this.params.sigma ?? 0.015;
      const dt = this.params.dt ?? 0.1;
      const inv2s2 = 1 / (2 * sigma * sigma);
      const EPS = 1e-4;

      if (!this._colMass || this._colMass.length !== gw) {
        this._colMass = new Uint8Array(gw); this._colNear = new Uint8Array(gw);
      }
      if (!this._rowMass || this._rowMass.length !== gh) {
        this._rowMass = new Uint8Array(gh); this._rowNear = new Uint8Array(gh);
      }
      const colMass = this._colMass, rowMass = this._rowMass, colNear = this._colNear, rowNear = this._rowNear;
      colMass.fill(0); rowMass.fill(0);
      for (let y = 0; y < gh; y++) {
        const row = y * gw;
        for (let x = 0; x < gw; x++) if (A[row + x] > EPS) { colMass[x] = 1; rowMass[y] = 1; }
      }
      orWindow(colMass, colNear, gw, R);
      orWindow(rowMass, rowNear, gh, R);

      for (let y = 0; y < gh; y++) {
        const row = y * gw;
        if (!rowNear[y]) { for (let x = 0; x < gw; x++) A2[row + x] = 0; continue; }
        for (let x = 0; x < gw; x++) {
          const i = row + x;
          if (!colNear[x]) { A2[i] = 0; continue; }
          let u = 0;
          for (let k = 0, o = 0; k < kN; k++, o += 3) {
            let nx = x + kOff[o];
            let ny = y + kOff[o + 1];
            if (nx < 0) nx += gw; else if (nx >= gw) nx -= gw;
            if (ny < 0) ny += gh; else if (ny >= gh) ny -= gh;
            u += A[ny * gw + nx] * kW[k];
          }
          const d = u - mu;
          const g = 2 * Math.exp(-(d * d) * inv2s2) - 1;
          let na = A[i] + dt * g;
          A2[i] = na < 0 ? 0 : na > 1 ? 1 : na;
        }
      }
      this.A = A2; this.A2 = A;
    }

    // Σ A — total mass, the key health signal: a stable creature holds it
    // roughly constant; collapse → 0 or saturation means it has died.
    mass() {
      const A = this.A;
      let s = 0;
      for (let i = 0; i < A.length; i++) s += A[i];
      return s;
    }

    draw(ctx, w, h) {
      const { A, img } = this;
      if (!img) return; // headless / no canvas: rendering is a no-op
      const data = img.data;
      for (let i = 0; i < A.length; i++) {
        const c = ramp(A[i]);
        const j = i << 2;
        data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255;
      }
      this._blit(ctx, w, h);
    }

    _blit(ctx, w, h) {
      if (!this._off || this._off.width !== this.gw || this._off.height !== this.gh) {
        this._off = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (this._off) { this._off.width = this.gw; this._off.height = this.gh; }
        this._offCtx = this._off ? this._off.getContext('2d') : null;
      }
      if (!this._offCtx) return; // headless: no-op
      this._offCtx.putImageData(this.img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this._off, 0, 0, this.gw, this.gh, 0, 0, w, h);
    }

    // Paint a smooth blob of A where the user drags (brush).
    paintAt(p) {
      const cx = p.nx * this.gw, cy = p.ny * this.gh;
      this.blob(cx, cy, 7, 0.7);
      if (!this.running) this._renderOnce();
    }
  }

  // A=0 dark → teal → amber → white at A=1.
  function ramp(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    // stops: 0.0 dark, 0.4 teal, 0.75 amber, 1.0 white
    let r, g, b;
    if (t < 0.4) {
      const u = t / 0.4;
      r = 6 + u * (26 - 6); g = 10 + u * (150 - 10); b = 18 + u * (150 - 18);
    } else if (t < 0.75) {
      const u = (t - 0.4) / 0.35;
      r = 26 + u * (235 - 26); g = 150 + u * (170 - 150); b = 150 + u * (60 - 150);
    } else {
      const u = (t - 0.75) / 0.25;
      r = 235 + u * (255 - 235); g = 170 + u * (255 - 170); b = 60 + u * (255 - 60);
    }
    return [r | 0, g | 0, b | 0];
  }

  // ---- mount + controls ----
  const sim = new Lenia('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.applySeed('random'); sim._renderOnce(); } });

  sim.select('seed', [
    { value: 'orbium', label: 'Orbium (glider)' },
    { value: 'random', label: 'Random soup' },
    { value: 'clear', label: 'Clear' }
  ], { value: 'orbium', onChange: v => { sim.applySeed(v); sim._renderOnce(); } });

  sim.slider('mu', { min: 0.10, max: 0.25, step: 0.001, value: 0.15,
    fmt: v => v.toFixed(3) });
  sim.slider('sigma', { min: 0.008, max: 0.030, step: 0.0005, value: 0.015,
    fmt: v => v.toFixed(4) });
  sim.slider('dt', { min: 0.02, max: 0.30, step: 0.01, value: 0.1,
    fmt: v => v.toFixed(2) });
  sim.slider('speed', { min: 1, max: 3, step: 1, value: 1, fmt: v => v + '×' });

  // paint smooth blobs of A where the user drags
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p);
  });

  sim.readout(s =>
    `mass ${s.mass().toFixed(0)}  ·  μ ${(s.params.mu ?? 0.15).toFixed(3)}  ·  ` +
    `σ ${(s.params.sigma ?? 0.015).toFixed(4)}  ·  ${s.gw}×${s.gh}`);
})();
