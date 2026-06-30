/* The Abelian Sandpile — Bak–Tang–Wiesenfeld self-organized criticality.
 * Extends Atlas.Sim. Each cell holds an integer pile of grains. Any cell with
 * 4 or more grains topples: it sheds 4 grains, one to each orthogonal neighbor;
 * grains that fall off the edge are lost (open boundary). Toppling is done with
 * a work queue so only unstable cells are revisited. Two modes: drip grains at
 * random sites and watch scale-free avalanches (SOC), or pour at the center and
 * grow the self-similar fractal pile (Single pile). */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 4; // logical pixels per cell

  class Sandpile extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.total = 0;        // total grains on the grid
      this.lastAval = 0;     // topplings from the most recent dropped grain
      this.maxAval = 0;      // largest avalanche seen this run
      this.drops = 0;        // grains added so far
      // Coarse log-binned histogram of avalanche sizes (SOC mode).
      this.hist = new Int32Array(8); // bins: 0, 1, 2-3, 4-7, 8-15, 16-63, 64-255, 256+
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      const n = this.cols * this.rows;
      this.h = new Int32Array(n);     // grain heights
      this._queue = new Int32Array(n); // scratch work queue of cell indices
      this._inq = new Uint8Array(n);   // membership flag to dedupe the queue
      this.total = 0;
      this.lastAval = 0;
      this.maxAval = 0;
      this.drops = 0;
      this.hist.fill(0);
      // SOC warm-up: drive the pile to near-critical density up front, so avalanches
      // of every size appear immediately instead of after ~30s of slow filling. The
      // SOC attractor is normally reached BY driving; this just fast-forwards the
      // burn-in (~1.8 grains/cell, then one bulk relaxation — Abelian, so the order
      // of additions doesn't matter). Skipped in single-pile mode (its growth is the show).
      const mode = (this.params && this.params.mode) || 'soc';
      if (mode !== 'single') {
        const warm = Math.floor(1.8 * n);
        for (let k = 0; k < warm; k++) this.h[(Math.random() * n) | 0]++;
        this.total = warm;
        this.relax();        // stabilize; relax() decrements total for grains lost off-edge
        this.drops = 0;      // don't count the burn-in as user drops
        this.hist.fill(0);   // keep the avalanche-size histogram clean
      }
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // Add `n` grains to cell (x,y) without relaxing. Returns false if off-grid.
    addAt(x, y, n = 1) {
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return false;
      this.h[this.idx(x, y)] += n;
      this.total += n;
      return true;
    }

    // Relax the whole grid: topple every unstable cell until all are stable.
    // Returns the number of topplings performed (the avalanche size). A work
    // queue holds candidate-unstable cells, with `_inq` as a membership flag so
    // a cell is never queued twice; `_qn` is the live tail. Only cells that
    // might have become unstable are ever revisited — no full rescans.
    relax() {
      const { h, cols, rows, _queue, _inq } = this;
      let head = 0;
      this._qn = 0;
      // Seed the queue with every currently-unstable cell.
      for (let i = 0; i < h.length; i++) {
        if (h[i] >= 4 && !_inq[i]) { _queue[this._qn++] = i; _inq[i] = 1; }
      }
      let topplings = 0;
      while (head < this._qn) {
        const i = _queue[head++];
        _inq[i] = 0;
        if (h[i] < 4) continue;
        // Topple as many times as the cell can in one visit (fast for big piles).
        const times = h[i] >> 2;          // floor(h/4)
        h[i] -= times * 4;
        topplings += times;
        const x = i % cols, y = (i / cols) | 0;
        // Distribute `times` grains to each orthogonal neighbor; off-grid is lost.
        if (x > 0)        this._give(i - 1, times);
        else              this.total -= times;          // fell off left edge
        if (x < cols - 1) this._give(i + 1, times);
        else              this.total -= times;          // fell off right edge
        if (y > 0)        this._give(i - cols, times);
        else              this.total -= times;          // fell off top edge
        if (y < rows - 1) this._give(i + cols, times);
        else              this.total -= times;          // fell off bottom edge
        // If this cell is still over threshold, re-enqueue it.
        if (h[i] >= 4 && !_inq[i]) { _queue[this._qn++] = i; _inq[i] = 1; }
      }
      return topplings;
    }

    // Give `n` grains to neighbor cell j and enqueue it if it becomes unstable.
    _give(j, n) {
      this.h[j] += n;
      if (this.h[j] >= 4 && !this._inq[j]) { this._queue[this._qn++] = j; this._inq[j] = 1; }
    }

    // Drop a single grain (per `mode`), relax, and record the avalanche.
    dropOne() {
      const mode = this.params.mode || 'soc';
      if (mode === 'single') {
        this.addAt(this.cols >> 1, this.rows >> 1, 1);
      } else {
        this.addAt((Math.random() * this.cols) | 0, (Math.random() * this.rows) | 0, 1);
      }
      const aval = this.relax();
      this.drops++;
      this.lastAval = aval;
      if (aval > this.maxAval) this.maxAval = aval;
      this._record(aval);
      return aval;
    }

    _record(aval) {
      let bin;
      if (aval === 0) bin = 0;
      else if (aval === 1) bin = 1;
      else if (aval < 4) bin = 2;
      else if (aval < 8) bin = 3;
      else if (aval < 16) bin = 4;
      else if (aval < 64) bin = 5;
      else if (aval < 256) bin = 6;
      else bin = 7;
      this.hist[bin]++;
    }

    step() {
      const per = Math.max(1, Math.round(this.params.speed ?? 8));
      const mode = this.params.mode || 'soc';
      if (mode === 'single') {
        // Pour a heap at the center each tick, then relax once for the whole batch.
        this.addAt(this.cols >> 1, this.rows >> 1, per);
        const aval = this.relax();
        this.drops += per;
        this.lastAval = aval;
        if (aval > this.maxAval) this.maxAval = aval;
      } else {
        for (let k = 0; k < per; k++) this.dropOne();
      }
    }

    // Dump a big batch of grains at the center and relax (button).
    addBatchCenter(n) {
      this.addAt(this.cols >> 1, this.rows >> 1, n);
      const aval = this.relax();
      this.drops += n;
      this.lastAval = aval;
      if (aval > this.maxAval) this.maxAval = aval;
      if (!this.running) this._renderOnce();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows } = this;
      const hh = this.h;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = hh[y * cols + x];
          if (v === 0) continue; // leave background showing for empty cells
          ctx.fillStyle = HEIGHT_COLOR[v < 4 ? v : 3];
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }

    dropAtPointer(p, n) {
      const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
      if (!this.addAt(x, y, n)) return;
      const aval = this.relax();
      this.drops += n;
      this.lastAval = aval;
      if (aval > this.maxAval) this.maxAval = aval;
      if (!this.running) this._renderOnce();
    }
  }

  // height → distinct colors. 0 is background (drawn as skip); 1 teal, 2 amber, 3 orchid.
  const HEIGHT_COLOR = [
    '#0e2a2a', // 0 (unused — background shows instead), kept for indexing
    '#7fd1c1', // 1 grain — phosphor teal
    '#e0a35e', // 2 grains — amber
    '#c98bd0'  // 3 grains — orchid (critical slope)
  ];

  // ---- mount + controls ----
  const sim = new Sandpile('#stage');
  sim.start();

  sim.standardRail();
  sim.select('mode', [
    { value: 'soc', label: 'Self-organized criticality' },
    { value: 'single', label: 'Single pile (center)' }
  ], { value: 'soc', onChange: () => { sim.reset(); } });
  sim.slider('speed', { min: 1, max: 200, step: 1, value: 8,
    fmt: v => v + ' grains/tick' });
  sim.button('+1000 at center', () => sim.addBatchCenter(1000));

  // drop grains where the user clicks or drags
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.dropAtPointer(p, 1);
  });

  sim.readout(s => {
    const dist = s.params.mode === 'single'
      ? ''
      : `  ·  aval bins[0,1,2-3,4-7,8+,16+,64+,256+] ${histStr(s.hist)}`;
    return `grains ${s.total}  ·  drops ${s.drops}  ·  last aval ${s.lastAval}  ·  max ${s.maxAval}${dist}`;
  });

  function histStr(hist) {
    return '[' + Array.from(hist).join(',') + ']';
  }
})();
