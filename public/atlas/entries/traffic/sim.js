/* Phantom Traffic Jams — the Nagel–Schreckenberg cellular automaton.
 *
 * A single-lane CIRCULAR road of L cells. Each cell is empty (-1) or holds one
 * car whose value is its integer speed v in {0..vmax}. Every timestep, for all
 * cars in parallel (compute then apply):
 *   1. Accelerate:  v ← min(v+1, vmax)
 *   2. Brake:       v ← min(v, gap)          (gap = empty cells to next car)
 *   3. Dawdle:      with prob p, v ← max(v-1, 0)   ← the crucial ingredient
 *   4. Move:        car advances v cells (wrapping the ring)
 *
 * Above a critical density, step 3 destabilizes dense-but-flowing traffic into
 * spontaneous stop-and-go waves — "phantom jams" that travel BACKWARD against
 * the flow, with no crash and no bottleneck. With p=0 there are no spontaneous
 * jams.
 *
 * Visualization: the unrolled ring as a thin strip at the top (cars colored by
 * speed), and below it a scrolling space–time diagram — each new timestep is a
 * new bottom row, older rows scroll up. Jams appear as dark stripes slanting
 * backward through time. Implemented by scrolling an ImageData buffer up by one
 * row per step and painting the newest state into the bottom row. */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  const STRIP_H = 26;   // logical px height of the live road strip
  const GAP_H = 6;      // gap between strip and space-time diagram

  class Traffic extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62 });
      this.L = 0;
      this.cells = null;     // Int16Array: -1 empty, else speed 0..vmax
      this.meanSpeed = 0;
      this._img = null;      // ImageData ring for the space-time diagram
      this._stH = 0;         // pixel rows in the diagram
      this._rng = mulberry32(0x9e3779b9);
    }

    setup() {
      // road length in cells, one cell per logical pixel of width
      this.L = Math.max(40, Math.floor(this.width));
      this.cells = new Int16Array(this.L).fill(-1);
      this._next = new Int16Array(this.L);
      this.meanSpeed = 0;
      this.seed();
      this._initDiagram();
    }

    onResize() { this.setup(); }

    // deterministic seeding helper for tests; reseeds the RNG when given a seed
    seedRng(s) { this._rng = mulberry32(s >>> 0); }

    // place cars at random distinct positions at density d, speed 0
    seed() {
      const d = (this.params && this.params.density) || 0.22;
      const L = this.L;
      this.cells.fill(-1);
      const target = Math.round(L * d);
      let placed = 0, guard = 0;
      while (placed < target && guard < L * 40) {
        const i = Math.floor(this._rng() * L);
        if (this.cells[i] < 0) { this.cells[i] = 0; placed++; }
        guard++;
      }
      this._carCount = placed;
      this._recomputeMean();
    }

    onSeedChange() { this.seed(); this._initDiagram(); if (!this.running) this._renderOnce(); }

    carCount() {
      let n = 0;
      for (let i = 0; i < this.L; i++) if (this.cells[i] >= 0) n++;
      return n;
    }

    _recomputeMean() {
      let sum = 0, n = 0;
      for (let i = 0; i < this.L; i++) {
        const v = this.cells[i];
        if (v >= 0) { sum += v; n++; }
      }
      this.meanSpeed = n ? sum / n : 0;
    }

    // gap = number of empty cells ahead to the next car (ring wraps)
    gapAhead(i) {
      const L = this.L, cells = this.cells;
      let g = 0;
      for (let k = 1; k <= L; k++) {
        if (cells[(i + k) % L] >= 0) break;
        g++;
      }
      return g;
    }

    step() {
      const L = this.L, cells = this.cells, next = this._next;
      const vmax = (this.params && this.params.vmax) | 0 || 5;
      const p = (this.params && this.params.p) ?? 0.25;
      next.fill(-1);

      // Phase A: compute new speed for each car in place (parallel update).
      // We read positions/gaps from the OLD configuration, then move into next.
      let sum = 0, n = 0;
      for (let i = 0; i < L; i++) {
        let v = cells[i];
        if (v < 0) continue;
        // 1. accelerate
        if (v < vmax) v++;
        // 2. brake to the gap ahead
        const gap = this.gapAhead(i);
        if (v > gap) v = gap;
        // 3. random dawdle
        if (v > 0 && this._rng() < p) v--;
        // 4. move v cells forward
        const j = (i + v) % L;
        next[j] = v;
        sum += v; n++;
      }
      cells.set(next);
      this.meanSpeed = n ? sum / n : 0;

      this._pushDiagramRow();
    }

    // ---- space-time diagram (scrolling ImageData) ----
    _initDiagram() {
      const w = Math.max(1, this.L);
      const stCss = Math.max(20, Math.round(this.height) - STRIP_H - GAP_H);
      this._stH = stCss;
      if (this.ctx && this.ctx.createImageData) {
        try { this._img = this.ctx.createImageData(w, stCss); }
        catch (e) { this._img = null; }
      } else this._img = null;
      if (this._img) {
        // fill with background color
        const d = this._img.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 6; d[i + 1] = 7; d[i + 2] = 10; d[i + 3] = 255;
        }
      }
    }

    _pushDiagramRow() {
      const img = this._img;
      if (!img) return;
      const w = img.width, h = img.height, d = img.data;
      const rowBytes = w * 4;
      // scroll everything up by one row
      d.copyWithin(0, rowBytes, h * rowBytes);
      // paint newest state into the bottom row
      const base = (h - 1) * rowBytes;
      const vmax = (this.params && this.params.vmax) | 0 || 5;
      for (let x = 0; x < w; x++) {
        const v = this.cells[x];
        const o = base + x * 4;
        if (v < 0) { d[o] = 6; d[o + 1] = 7; d[o + 2] = 10; d[o + 3] = 255; }
        else {
          const c = speedRGB(v, vmax);
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const vmax = (this.params && this.params.vmax) | 0 || 5;
      const L = this.L;
      const cw = w / L; // cell width in css px

      // --- live road strip (the unrolled ring) ---
      ctx.fillStyle = '#0d1016';
      ctx.fillRect(0, 0, w, STRIP_H);
      for (let i = 0; i < L; i++) {
        const v = this.cells[i];
        if (v < 0) continue;
        const c = speedRGB(v, vmax);
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(i * cw, 2, Math.max(1, cw - 0.4), STRIP_H - 4);
      }

      // --- space-time diagram ---
      if (this._img) {
        // stash the ImageData at native resolution onto an offscreen canvas
        // then stretch it to fill the diagram area, so it reads at any width.
        const off = this._offscreen();
        off.ctx.putImageData(this._img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const dy = STRIP_H + GAP_H;
        ctx.drawImage(off.canvas, 0, 0, this._img.width, this._img.height,
          0, dy, w, h - dy);
      }
    }

    _offscreen() {
      if (!this._off || this._off.canvas.width !== this._img.width ||
          this._off.canvas.height !== this._img.height) {
        const canvas = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (canvas) {
          canvas.width = this._img.width; canvas.height = this._img.height;
          this._off = { canvas, ctx: canvas.getContext('2d') };
        } else {
          this._off = { canvas: { width: this._img.width, height: this._img.height },
            ctx: { putImageData() {} } };
        }
      }
      return this._off;
    }
  }

  // speed → color: stopped red/amber → fast teal
  function speedRGB(v, vmax) {
    const t = vmax > 0 ? clamp(v / vmax, 0, 1) : 0;
    // t=0 (stopped): deep red; mid: amber; t=1 (fast): teal
    if (t < 0.5) {
      const u = t / 0.5;                 // red -> amber
      return [Math.round(214 + u * (240 - 214)),
              Math.round(50 + u * (176 - 50)),
              Math.round(48 + u * (60 - 48))];
    } else {
      const u = (t - 0.5) / 0.5;          // amber -> teal
      return [Math.round(240 - u * (240 - 60)),
              Math.round(176 + u * (209 - 176)),
              Math.round(60 + u * (180 - 60))];
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
  const sim = new Traffic('#stage');
  sim.start();

  const reseed = () => { sim.seed(); sim._initDiagram(); if (!sim.running) sim._renderOnce(); };

  sim.standardRail({ randomize: reseed });
  sim.slider('density', { min: 0.05, max: 0.6, step: 0.01, value: 0.22,
    fmt: v => Math.round(v * 100) + '%', onInput: reseed });
  sim.slider('vmax', { min: 1, max: 7, step: 1, value: 5, fmt: v => v + '' });
  sim.slider('p', { min: 0, max: 0.6, step: 0.01, value: 0.25,
    fmt: v => Math.round(v * 100) + '%' });
  sim.slider('speed', { min: 1, max: 6, step: 1, value: 2, fmt: v => v + '×',
    onInput: v => { sim.stepsPerFrame = v; } });
  sim.stepsPerFrame = 2;

  sim.readout(s => {
    const dens = s.L ? s.carCount() / s.L : 0;
    const flow = s.meanSpeed * dens;
    return `density ${(dens * 100).toFixed(0)}%  ·  mean speed ${s.meanSpeed.toFixed(2)}  ·  flow ${flow.toFixed(3)}`;
  });
})();
