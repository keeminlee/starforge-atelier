/* Site percolation on the square lattice — the connectivity phase transition.
 * Extends Atlas.Sim. Each site is independently occupied with probability p (else
 * empty). Occupied sites that touch orthogonally (4-connectivity) form connected
 * CLUSTERS, found here with a weighted union-find (path compression + union by
 * size) — no recursion, so the grid can be large. A cluster SPANS when it reaches
 * both the top and bottom rows. As p rises through the percolation threshold
 * p_c ≈ 0.5927, a single giant spanning cluster abruptly appears: below p_c only
 * small isolated islands; above p_c a system-wide network; near p_c clusters of
 * every size (fractal, scale-free). Two modes: "manual" (re-sample on demand) and
 * "sweep" (slowly ramp p up and down across p_c so the giant cluster blinks in and
 * out). Cluster colors are a stable per-root hash; the spanning cluster is drawn
 * bright so connection visibly snaps into place. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 4;                 // logical pixels per site
  const PC = 0.5927;              // site-percolation threshold, square lattice (numerical)

  class Percolation extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.p = 0.59;
      this._sweepDir = 1;         // sweep mode: +1 ramping up, -1 ramping down
      this._img = null;
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      const n = this.cols * this.rows;
      this.occ = new Uint8Array(n);     // 1 = occupied, 0 = empty
      this.parent = new Int32Array(n);  // union-find parent
      this.size = new Int32Array(n);    // union-find component size (valid at roots)
      this.label = new Int32Array(n);   // per-site cluster root (after labelling)
      this.p = (this.params && this.params.p) || this.p;
      this.generate();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // ---- the model: sample, then find clusters ----
    generate() {
      const occ = this.occ;
      const p = this.p;
      let occupied = 0;
      for (let i = 0; i < occ.length; i++) {
        if (Math.random() < p) { occ[i] = 1; occupied++; } else occ[i] = 0;
      }
      this.occupied = occupied;
      this.findClusters();
      if (this._setupDone && !this.running) this._renderOnce();
    }

    // weighted union-find with path compression (iterative; no recursion).
    _find(a) {
      const parent = this.parent;
      let root = a;
      while (parent[root] !== root) root = parent[root];
      // path compression
      while (parent[a] !== root) { const nx = parent[a]; parent[a] = root; a = nx; }
      return root;
    }

    _union(a, b) {
      const parent = this.parent, size = this.size;
      let ra = this._find(a), rb = this._find(b);
      if (ra === rb) return;
      if (size[ra] < size[rb]) { const t = ra; ra = rb; rb = t; }
      parent[rb] = ra;
      size[ra] += size[rb];
    }

    /* Build clusters of occupied sites via 4-connectivity (left + up neighbours
     * suffice in a single pass), then read off the labels, largest cluster, and
     * whether any cluster spans top↔bottom (and left↔right, reported separately). */
    findClusters() {
      const { cols, rows, occ, parent, size, label } = this;
      const n = occ.length;
      for (let i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (!occ[i]) continue;
          if (x > 0 && occ[i - 1]) this._union(i, i - 1);          // left
          if (y > 0 && occ[i - cols]) this._union(i, i - cols);    // up
        }
      }

      // Final labels + largest cluster.
      let largest = 0, largestRoot = -1, clusters = 0;
      for (let i = 0; i < n; i++) {
        if (!occ[i]) { label[i] = -1; continue; }
        const r = this._find(i);
        label[i] = r;
        if (i === r) clusters++;            // count each root once
        if (size[r] > largest) { largest = size[r]; largestRoot = r; }
      }
      this.clusterCount = clusters;
      this.largestSize = largest;
      this.largestRoot = largestRoot;
      this.largestFraction = largest / n;   // largest cluster / total sites

      // Spanning: does one cluster reach both the top row and the bottom row?
      this.spanningRoot = this._spanRoot();
      this.spans = this.spanningRoot >= 0;
    }

    // Returns the root of a top↔bottom spanning cluster, or -1. Also sets _spansLR.
    _spanRoot() {
      const { cols, rows, occ } = this;
      // top↔bottom: a root present on row 0 AND on row rows-1
      const topRoots = new Set();
      for (let x = 0; x < cols; x++) {
        const i = x;
        if (occ[i]) topRoots.add(this._find(i));
      }
      let tbRoot = -1;
      const base = (rows - 1) * cols;
      for (let x = 0; x < cols; x++) {
        const i = base + x;
        if (occ[i] && topRoots.has(this._find(i))) { tbRoot = this._find(i); break; }
      }
      // left↔right (reported in readout for context)
      const leftRoots = new Set();
      for (let y = 0; y < rows; y++) {
        const i = y * cols;
        if (occ[i]) leftRoots.add(this._find(i));
      }
      let lrRoot = -1;
      for (let y = 0; y < rows; y++) {
        const i = y * cols + (cols - 1);
        if (occ[i] && leftRoots.has(this._find(i))) { lrRoot = this._find(i); break; }
      }
      this._spansLR = lrRoot >= 0;
      return tbRoot;
    }

    step() {
      const mode = (this.params && this.params.mode) || 'manual';
      if (mode !== 'sweep') return;        // manual mode is static between actions
      // Slowly ramp p up and down across p_c, re-sampling each tick so the giant
      // cluster visibly appears and vanishes around the threshold.
      const speed = (this.params && this.params.speed) || 0.004;
      let p = this.p + this._sweepDir * speed;
      if (p >= 0.85) { p = 0.85; this._sweepDir = -1; }
      else if (p <= 0.35) { p = 0.35; this._sweepDir = 1; }
      this.p = p;
      this.params.p = p;
      this._syncSlider();
      this.generate();
    }

    // Reflect the swept p back onto the slider UI (first range input in the rail).
    _syncSlider() {
      if (!this._pSlider) {
        this._pSlider = this._controlsEl &&
          this._controlsEl.querySelector && this._controlsEl.querySelector('input[type=range]');
      }
      if (this._pSlider) {
        this._pSlider.value = this.p.toFixed(3);
        const val = this._pSlider.previousElementSibling;
        // label/val span update is best-effort; readout always shows live p
      }
    }

    draw(ctx, w, h) {
      const { cols, rows, occ, label } = this;
      // Build/refresh a site-sized ImageData, then upscale-blit crisply.
      if (!this._img || this._img.width !== cols || this._img.height !== rows) {
        this._img = ctx.createImageData ? ctx.createImageData(cols, rows) : null;
      }
      if (!this._img || !this._img.data) return;   // headless stub: nothing to draw
      const data = this._img.data;
      const span = this.spanningRoot;
      for (let i = 0, q = 0; i < occ.length; i++, q += 4) {
        if (!occ[i]) {
          data[q] = 10; data[q + 1] = 11; data[q + 2] = 14;        // empty: near-black
        } else if (label[i] === span && span >= 0) {
          data[q] = 245; data[q + 1] = 246; data[q + 2] = 235;     // spanning: bright
        } else {
          const c = clusterColor(label[i]);
          data[q] = c[0]; data[q + 1] = c[1]; data[q + 2] = c[2];
        }
        data[q + 3] = 255;
      }
      const off = this._scratch || (this._scratch = makeScratch());
      off.canvas.width = cols; off.canvas.height = rows;
      off.ctx.putImageData(this._img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(off.canvas, 0, 0, cols * CELL, rows * CELL);
    }
  }

  // Stable per-cluster color: hash the root id into a hue, mid saturation/value,
  // so each cluster gets a consistent, distinguishable tint.
  function clusterColor(root) {
    // integer hash → hue
    let h = root * 2654435761 >>> 0;
    h ^= h >>> 13; h = (h * 1274126177) >>> 0;
    const hue = (h % 360);
    return hsvToRgb(hue, 0.55, 0.82);
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60)      { r = c; g = x; b = 0; }
    else if (h < 120){ r = x; g = c; b = 0; }
    else if (h < 180){ r = 0; g = c; b = x; }
    else if (h < 240){ r = 0; g = x; b = c; }
    else if (h < 300){ r = x; g = 0; b = c; }
    else             { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  // A tiny offscreen canvas to upscale the site grid crisply.
  function makeScratch() {
    const c = (typeof document !== 'undefined' && document.createElement)
      ? document.createElement('canvas') : { getContext: () => null, width: 0, height: 0 };
    return { canvas: c, ctx: c.getContext ? c.getContext('2d') : null };
  }

  // ---- mount + controls ----
  const sim = new Percolation('#stage');
  sim.start();

  sim.standardRail({ randomize: () => sim.generate() });

  sim.slider('p', { min: 0, max: 1, step: 0.005, value: 0.59,
    fmt: v => v.toFixed(3) + (Math.abs(v - PC) < 0.008 ? ' ≈p_c' : ''),
    onInput: v => { sim.p = v; if ((sim.params.mode || 'manual') === 'manual') sim.generate(); } });

  sim.select('mode', [
    { value: 'manual', label: 'Manual (re-sample on change)' },
    { value: 'sweep', label: 'Sweep (ramp p across p_c)' }
  ], { value: 'manual' });

  sim.slider('speed', { min: 0.001, max: 0.02, step: 0.001, value: 0.004,
    fmt: v => 'Δp ' + v.toFixed(3) + '/tick' });

  sim.button('set p = p_c', () => {
    const ps = sim._controlsEl.querySelector('input[type=range]');
    if (ps) { ps.value = PC.toFixed(3); ps.dispatchEvent(new Event('input')); }
    else { sim.params.p = PC; sim.p = PC; sim.generate(); }
  });

  sim.readout(s => {
    const frac = (s.largestFraction * 100).toFixed(1);
    return `p ${s.p.toFixed(3)}  ·  largest ${frac}% of sites  ·  ` +
      `spans ${s.spans ? 'YES ↕' : 'no'}${s._spansLR ? ' ↔' : ''}  ·  ` +
      `clusters ${s.clusterCount}  ·  ${s.cols}×${s.rows}`;
  });
})();
