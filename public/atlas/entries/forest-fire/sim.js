/* The Drossel–Schwabl Forest-Fire Model — self-organized criticality.
 * Extends Atlas.Sim. Each cell is empty (0), tree (1), or burning (2). All cells
 * update synchronously each tick by four rules:
 *   1. burning  → empty.
 *   2. tree with a burning von-Neumann (4-) neighbor → burning.
 *   3. tree with no burning neighbor → burning with probability f (lightning).
 *   4. empty → tree with probability p (growth).
 * In the regime p ≫ f the grid self-organizes to a critical state: forests regrow,
 * rare sparks trigger fires that sweep connected stands, and fire sizes follow an
 * approximate power law — no parameter tuned to a special value. A cousin of the
 * sandpile (the Atlas's other SOC entry) and percolation (fire spreads through
 * connected trees exactly like percolation through occupied sites). Toroidal grid. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 3;          // logical pixels per cell
  const EMPTY = 0, TREE = 1, BURN = 2;

  class ForestFire extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.lastFireSize = 0;   // cells burned in the most recent spark-triggered fire
      this.maxFireSize = 0;    // largest such fire this run
      this.fires = 0;          // number of spark-triggered fires recorded
      this.burningCount = 0;   // cells currently burning
      this.treeCount = 0;      // cells that are trees
      // Coarse log-binned histogram of fire sizes (the SOC signature).
      // bins: 1, 2-3, 4-7, 8-15, 16-63, 64-255, 256-1023, 1024+
      this.hist = new Int32Array(8);
      // Per-tick bookkeeping: trace each currently-spreading fire back to the
      // spark that started it, so we can report a single fire's total size.
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      const n = this.cols * this.rows;
      this.cur = new Uint8Array(n);   // current state per cell (0/1/2)
      this.nxt = new Uint8Array(n);   // scratch for the synchronous update
      // fireId[i] tags which ongoing fire a burning cell belongs to, so a single
      // spark's blaze can be summed across the many ticks it burns.
      this.fireId = new Int32Array(n);
      this.fireId.fill(-1);
      this._nextFireId = 0;
      this._fireSize = new Map();     // fireId → running cell count for live fires
      this.lastFireSize = 0;
      this.maxFireSize = 0;
      this.fires = 0;
      this.hist.fill(0);
      // Seed with a moderate tree cover so there's something to burn immediately.
      const seed = 0.55;
      for (let i = 0; i < n; i++) this.cur[i] = Math.random() < seed ? TREE : EMPTY;
      this.recount();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    recount() {
      let t = 0, b = 0;
      const cur = this.cur;
      for (let i = 0; i < cur.length; i++) {
        if (cur[i] === TREE) t++;
        else if (cur[i] === BURN) b++;
      }
      this.treeCount = t;
      this.burningCount = b;
    }

    // One synchronous update of the whole grid.
    step() {
      const { cols, rows, cur, nxt, fireId } = this;
      const p = this.params.p ?? 0.02;
      const f = this.params.f ?? 1e-4;
      const fireIdNext = this._fireIdNext ||
        (this._fireIdNext = new Int32Array(cur.length));
      fireIdNext.fill(-1);

      let trees = 0, burning = 0;

      for (let y = 0; y < rows; y++) {
        const yU = (y - 1 + rows) % rows, yD = (y + 1) % rows;
        for (let x = 0; x < cols; x++) {
          const xL = (x - 1 + cols) % cols, xR = (x + 1) % cols;
          const i = y * cols + x;
          const s = cur[i];

          if (s === BURN) {
            nxt[i] = EMPTY;                          // rule 1: burning → empty
            continue;
          }
          if (s === EMPTY) {
            nxt[i] = (Math.random() < p) ? TREE : EMPTY;  // rule 4: growth
            if (nxt[i] === TREE) trees++;
            continue;
          }
          // s === TREE: rule 2 (catch from a burning neighbor) then rule 3 (lightning)
          const nU = cur[yU * cols + x], nD = cur[yD * cols + x];
          const nL = cur[y * cols + xL], nR = cur[y * cols + xR];
          if (nU === BURN || nD === BURN || nL === BURN || nR === BURN) {
            nxt[i] = BURN;
            burning++;
            // Inherit the fire id of a burning neighbor (any one — they merge).
            let fid = -1;
            if (nU === BURN) fid = fireId[yU * cols + x];
            else if (nD === BURN) fid = fireId[yD * cols + x];
            else if (nL === BURN) fid = fireId[y * cols + xL];
            else fid = fireId[y * cols + xR];
            if (fid < 0) fid = this._nextFireId++;   // safety: untracked source
            fireIdNext[i] = fid;
            this._fireSize.set(fid, (this._fireSize.get(fid) || 0) + 1);
          } else if (Math.random() < f) {
            nxt[i] = BURN;                            // rule 3: lightning strike
            burning++;
            const fid = this._nextFireId++;           // a brand-new spark
            fireIdNext[i] = fid;
            this._fireSize.set(fid, 1);
          } else {
            nxt[i] = TREE;
            trees++;
          }
        }
      }

      // A fire is "done" when no cell carries its id into the next tick. Detect
      // by comparing the set of live ids before/after; any id that vanished has
      // finished burning, so record its accumulated size.
      const stillLive = new Set();
      for (let i = 0; i < fireIdNext.length; i++) {
        if (fireIdNext[i] >= 0) stillLive.add(fireIdNext[i]);
      }
      for (const [fid, size] of this._fireSize) {
        if (!stillLive.has(fid)) {
          this._finishFire(size);
          this._fireSize.delete(fid);
        }
      }

      this.cur.set(nxt);
      this.fireId.set(fireIdNext);
      this.treeCount = trees;
      this.burningCount = burning;
    }

    // Record a completed fire's size into stats + histogram.
    _finishFire(size) {
      this.fires++;
      this.lastFireSize = size;
      if (size > this.maxFireSize) this.maxFireSize = size;
      let bin;
      if (size < 2) bin = 0;
      else if (size < 4) bin = 1;
      else if (size < 8) bin = 2;
      else if (size < 16) bin = 3;
      else if (size < 64) bin = 4;
      else if (size < 256) bin = 5;
      else if (size < 1024) bin = 6;
      else bin = 7;
      this.hist[bin]++;
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows, cur } = this;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const s = cur[y * cols + x];
          if (s === EMPTY) continue;                  // dark background shows through
          ctx.fillStyle = (s === TREE) ? TREE_COLOR : BURN_COLOR;
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }

    // Light a fire where the user clicks: set the tree (or empty→tree→burning)
    // under the pointer, and its immediate neighborhood, burning.
    igniteAt(p, r = 1) {
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
      const { cols, rows } = this;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = (cx + dx + cols) % cols, y = (cy + dy + rows) % rows;
          const i = this.idx(x, y);
          // Start a fresh spark id so the click's blaze is tracked as one fire.
          if (this.cur[i] !== BURN) {
            this.cur[i] = BURN;
            const fid = this._nextFireId++;
            this.fireId[i] = fid;
            this._fireSize.set(fid, (this._fireSize.get(fid) || 0) + 1);
          }
        }
      }
      this.recount();
      if (!this.running) this._renderOnce();
    }
  }

  const TREE_COLOR = '#2fae8e';   // living forest — teal-green
  const BURN_COLOR = '#ff8a3c';   // active fire front — bright amber

  // SOC presets: p ≫ f gives clean self-organized criticality; "frequent
  // lightning" raises f so many small fires keep the forest sparse.
  const PRESETS = {
    soc:     { p: 0.03,  f: 0.00005 },
    frequent:{ p: 0.03,  f: 0.005 }
  };

  // ---- mount + controls ----
  const sim = new ForestFire('#stage');
  sim.start();

  sim.standardRail({ randomize: () => sim.reset() });

  sim.select('preset', [
    { value: 'soc', label: 'SOC (p ≫ f)' },
    { value: 'frequent', label: 'Frequent lightning' }
  ], { value: 'soc', onChange: v => {
    const pre = PRESETS[v] || PRESETS.soc;
    setSlider('p', pre.p);
    setSlider('f', pre.f);
    sim.params.p = pre.p;
    sim.params.f = pre.f;
  }});

  // Growth probability p (per empty cell per tick).
  sim.slider('p', { min: 0.001, max: 0.1, step: 0.001, value: 0.03,
    fmt: v => 'p ' + v.toFixed(3) });

  // Lightning probability f (per tree per tick). Keep f ≪ p for the SOC regime.
  sim.slider('f', { min: 0.00001, max: 0.01, step: 0.00001, value: 0.00005,
    fmt: v => 'f ' + fmtSci(v) });

  // Simulation speed: synchronous updates per rendered frame.
  sim.slider('speed', { min: 1, max: 8, step: 1, value: 1, fmt: v => v + '×',
    onInput: v => { sim.stepsPerFrame = Math.max(1, Math.round(v)); } });
  sim.stepsPerFrame = 1;

  // Click/drag to start a fire.
  sim.onPointer((type, p) => {
    if (type === 'down' || type === 'drag') sim.igniteAt(p, 1);
  });

  sim.readout(s => {
    const n = s.cols * s.rows;
    const cover = n ? (100 * s.treeCount / n).toFixed(1) : '0.0';
    const p = s.params.p ?? 0, f = s.params.f ?? 0;
    const ratio = f > 0 ? Math.round(p / f) : Infinity;
    const ratioStr = isFinite(ratio) ? ratio.toLocaleString() : '∞';
    return `cover ${cover}%  ·  burning ${s.burningCount}  ·  ` +
      `last fire ${s.lastFireSize}  ·  max ${s.maxFireSize}  ·  ` +
      `p/f ${ratioStr}  ·  fires ${s.fires}  ·  ` +
      `sizes[1,2,4,8,16,64,256,1k+] ${histStr(s.hist)}`;
  });

  // Reflect a preset value back onto a slider's UI (label + thumb).
  function setSlider(name, value) {
    const inputs = sim._controlsEl.querySelectorAll('input[type=range]');
    for (const input of inputs) {
      const label = input.previousElementSibling; // <label><span>name</span><span class=val>…</span></label>
      const nameSpan = label && label.firstElementChild;
      if (nameSpan && nameSpan.textContent === name) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
        return;
      }
    }
  }

  function fmtSci(v) {
    if (v >= 0.001) return v.toFixed(4);
    return v.toExponential(0);
  }

  function histStr(hist) {
    return '[' + Array.from(hist).join(',') + ']';
  }
})();
