/* The 2D Ising model of ferromagnetism — Metropolis Monte Carlo on a torus.
 * Extends Atlas.Sim. A grid of spins s ∈ {+1,−1}; each interacts with its four
 * orthogonal neighbours with energy E = −J Σ s_i s_j (J = 1). Temperature T is
 * the agitation that fights alignment. Below the Onsager critical temperature
 * Tc = 2/ln(1+√2) ≈ 2.269 the system spontaneously magnetizes into large
 * domains; above it, thermal noise wins and magnetization vanishes; right at Tc,
 * fluctuating domains appear at every scale. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 3;                       // logical pixels per spin
  const TC = 2 / Math.log(1 + Math.SQRT2); // ≈ 2.2691853 — exact Onsager value

  class Ising extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.T = 2.27;                    // temperature in units of J/k_B
      this._expCache = null;            // precomputed acceptance probs for this T,h
      this._cacheT = NaN;
      this._cacheH = NaN;
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      const n = this.cols * this.rows;
      this.s = new Int8Array(n);        // spins, +1 / −1
      this.sweeps = 0;
      this._img = null;                 // lazily-built ImageData
      const init = (this.params && this.params.start) || 'hot';
      this.applyStart(init);
      this.T = (this.params && this.params.temperature) || this.T;
      this._buildExp();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    applyStart(kind) {
      const s = this.s;
      if (kind === 'cold') {
        s.fill(1);                      // fully aligned (ground state)
      } else {
        for (let i = 0; i < s.length; i++) s[i] = Math.random() < 0.5 ? 1 : -1; // T=∞
      }
      this.sweeps = 0;
    }

    /* Precompute the Metropolis acceptance probabilities. For the 4-neighbour
     * square lattice the neighbour sum nb ∈ {−4,−2,0,2,4}, so ΔE for a flip
     * (ΔE = 2·s_i·(J·nb + h)) takes only a handful of values. Caching min(1,
     * exp(−ΔE/T)) avoids a Math.exp per spin. Recomputed only when T or h moves. */
    _buildExp() {
      const T = this.T;
      const h = (this.params && this.params.field) || 0;
      // key by (nbSum, spin): index 0..9 → nbSum=-4..4 step2 (5) × spin(2)
      const probs = new Float64Array(10);
      let k = 0;
      for (let nb = -4; nb <= 4; nb += 2) {
        for (let sp = -1; sp <= 1; sp += 2) {
          const dE = 2 * sp * (nb + h);            // J = 1
          probs[k++] = dE <= 0 ? 1 : Math.exp(-dE / T);
        }
      }
      this._expCache = probs;
      this._cacheT = T;
      this._cacheH = h;
    }

    // map (nbSum ∈ {-4,-2,0,2,4}, spin ∈ {-1,+1}) → cache slot
    _prob(nb, sp) {
      const row = (nb + 4) >> 1;        // 0..4
      const col = (sp + 1) >> 1;        // 0 or 1
      return this._expCache[row * 2 + col];
    }

    step() {
      // Resync temperature/field from controls and rebuild cache if they moved.
      this.T = (this.params && this.params.temperature) || this.T;
      const h = (this.params && this.params.field) || 0;
      if (this.T !== this._cacheT || h !== this._cacheH) this._buildExp();

      const sweepsPerFrame = (this.params && this.params.speed) || 4;
      const n = this.s.length;
      const total = sweepsPerFrame * n;          // flip-attempts this frame
      for (let a = 0; a < total; a++) this._attempt();
      this.sweeps += sweepsPerFrame;
    }

    // One Metropolis flip attempt at a random site.
    _attempt() {
      const { cols, rows, s } = this;
      const x = (Math.random() * cols) | 0;
      const y = (Math.random() * rows) | 0;
      const i = y * cols + x;
      const xL = x === 0 ? cols - 1 : x - 1;
      const xR = x === cols - 1 ? 0 : x + 1;
      const yU = y === 0 ? rows - 1 : y - 1;
      const yD = y === rows - 1 ? 0 : y + 1;
      const sum =
        s[y * cols + xL] + s[y * cols + xR] +
        s[yU * cols + x] + s[yD * cols + x];
      const sp = s[i];
      if (Math.random() < this._prob(sum, sp)) s[i] = -sp;
    }

    // total magnetization per site, m = (Σ s)/N  ∈ [−1, 1]
    magnetization() {
      const s = this.s;
      let sum = 0;
      for (let i = 0; i < s.length; i++) sum += s[i];
      return sum / s.length;
    }

    // energy per site = −J Σ_<ij> s_i s_j / N (count each bond once: right+down)
    energyPerSite() {
      const { cols, rows, s } = this;
      let e = 0;
      for (let y = 0; y < rows; y++) {
        const yD = y === rows - 1 ? 0 : y + 1;
        for (let x = 0; x < cols; x++) {
          const xR = x === cols - 1 ? 0 : x + 1;
          const i = y * cols + x;
          e -= s[i] * s[y * cols + xR];   // horizontal bond
          e -= s[i] * s[yD * cols + x];   // vertical bond
        }
      }
      return e / s.length;                // J = 1
    }

    draw(ctx, w, h) {
      const { cols, rows, s } = this;
      // Build/refresh an ImageData sized to the spin grid, then scale-blit it.
      if (!this._img || this._img.width !== cols || this._img.height !== rows) {
        this._img = ctx.createImageData ? ctx.createImageData(cols, rows) : null;
      }
      if (!this._img || !this._img.data) return; // headless stub: nothing to draw
      const data = this._img.data;
      // +1 → warm amber (224,163,94); −1 → dark teal (32,58,66)
      for (let i = 0, p = 0; i < s.length; i++, p += 4) {
        if (s[i] > 0) { data[p] = 224; data[p + 1] = 163; data[p + 2] = 94; }
        else          { data[p] = 32;  data[p + 1] = 58;  data[p + 2] = 66; }
        data[p + 3] = 255;
      }
      // Blit the small image, then upscale onto the canvas with no smoothing.
      const off = this._scratch || (this._scratch = makeScratch());
      off.canvas.width = cols; off.canvas.height = rows;
      off.ctx.putImageData(this._img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(off.canvas, 0, 0, cols * CELL, rows * CELL);
    }

    // Paint a domain of +1 (down) / −1 (drag w/ alt? — kept simple: paints +1).
    paintAt(p, value) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      const r = 3;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const cx = ((x + dx) % this.cols + this.cols) % this.cols;
        const cy = ((y + dy) % this.rows + this.rows) % this.rows;
        if (dx * dx + dy * dy <= r * r) this.s[this.idx(cx, cy)] = value;
      }
      if (!this.running) this._renderOnce();
    }
  }

  // A tiny offscreen canvas used to upscale the spin grid crisply.
  function makeScratch() {
    const c = (typeof document !== 'undefined' && document.createElement)
      ? document.createElement('canvas') : { getContext: () => null, width: 0, height: 0 };
    return { canvas: c, ctx: c.getContext ? c.getContext('2d') : null };
  }

  // ---- mount + controls ----
  const sim = new Ising('#stage');
  sim.start();

  sim.standardRail({ randomize: () => { sim.applyStart('hot'); sim._renderOnce(); } });

  sim.select('start', [
    { value: 'hot', label: 'Hot / random' },
    { value: 'cold', label: 'Cold / aligned' }
  ], { value: 'hot', onChange: v => { sim.applyStart(v); sim._renderOnce(); } });

  sim.slider('temperature', { min: 0.5, max: 4.0, step: 0.01, value: 2.27,
    fmt: v => v.toFixed(2) + (Math.abs(v - TC) < 0.02 ? ' ≈Tc' : ''),
    onInput: () => sim._buildExp() });

  sim.slider('speed', { min: 1, max: 20, step: 1, value: 4,
    fmt: v => v + ' sweeps/frame' });

  sim.slider('field', { min: -1, max: 1, step: 0.05, value: 0,
    fmt: v => v.toFixed(2), onInput: () => sim._buildExp() });

  sim.button('set T = Tc', () => {
    // The temperature slider is the first <input type=range> in the rail.
    const tslider = sim._controlsEl.querySelectorAll('input[type=range]')[0];
    if (tslider) {
      tslider.value = TC.toFixed(2);
      tslider.dispatchEvent(new Event('input'));
    } else {
      sim.params.temperature = TC; sim.T = TC; sim._buildExp();
    }
  });

  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.paintAt(p, 1);
  });

  sim.readout(s => {
    const m = s.magnetization();
    return `T ${s.T.toFixed(2)}  ·  m ${m.toFixed(3)}  ·  |m| ${Math.abs(m).toFixed(3)}` +
      `  ·  E/N ${s.energyPerSite().toFixed(3)}  ·  ${s.cols}×${s.rows}`;
  });
})();
