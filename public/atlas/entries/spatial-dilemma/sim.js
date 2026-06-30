/* The Spatial Dilemma — Nowak & May's spatial Prisoner's Dilemma (1992).
 * Extends Atlas.Sim. A toroidal grid where every cell is a COOPERATOR (C, 1) or a
 * DEFECTOR (D, 0), stored as an Int8Array. Each generation has two synchronous
 * phases:
 *
 *   1. PLAY. Every cell plays the one-shot Prisoner's Dilemma against each of its
 *      8 Moore neighbours AND against itself (self-interaction, as in the classic
 *      Nowak–May model), accumulating a total payoff over its 9 interactions.
 *      Nowak–May payoff convention (R=1, T=b, S=0, P=0):
 *        - a COOPERATOR earns 1 per cooperator partner, 0 per defector partner;
 *        - a DEFECTOR  earns b per cooperator partner, 0 per defector partner.
 *      Since a cell scores only against cooperators, payoff is just a weighted
 *      count of cooperator partners:
 *        score(C) = (# cooperators among the 9 cells: 8 neighbours + self)
 *        score(D) = b · (# cooperators among the 8 neighbours)   [self is D, so 0]
 *
 *   2. UPDATE. Every cell simultaneously adopts the strategy of the HIGHEST-SCORING
 *      cell in its Moore neighbourhood, including itself — "imitate the most
 *      successful neighbour." TIE-BREAKING: a cell keeps its current strategy
 *      unless some neighbour strictly out-scores its own best-scoring same-strategy
 *      option; concretely we track the best score seen so far and only switch when
 *      a STRICTLY greater score appears, scanning self first. So on a tie the
 *      incumbent (self, scanned first) wins and the cell is unchanged.
 *
 * The emergent result: even though defection is individually tempting (b > 1),
 * COOPERATION PERSISTS INDEFINITELY by forming spatial clusters whose interiors
 * support each other, while the boundaries churn in evolving, often fractal,
 * kaleidoscopic patterns. The temptation b (1 < b < 2) is the control knob:
 * low b lets cooperators dominate, b ≈ 1.85 gives the classic chaotic regime
 * (with Moore neighbourhood + self-interaction), high b lets defectors win.
 *
 * RENDERING — the iconic Nowak–May 4-colour scheme, colouring each cell by its
 * CURRENT and PREVIOUS strategy so the moving fronts light up:
 *   C→C  cooperator stayed cooperator  → blue
 *   D→D  defector stayed defector       → red
 *   C→D  just defected                  → yellow
 *   D→C  just cooperated                → green
 *
 * Exposes this.grid, this.cols/this.rows and this.cooperatorFraction() for tests,
 * plus a deterministic this.seedRng(s). */
(function () {
  'use strict';
  const { Sim, clamp } = Atlas;

  const CELL = 3;        // logical pixels per simulation cell
  const D = 0, C = 1;    // strategy codes: Defector / Cooperator

  // 4-colour scheme keyed by (prev<<1 | cur):
  //   prev C cur C → blue, prev D cur D → red,
  //   prev C cur D → yellow, prev D cur C → green.
  const COL_CC = [70, 130, 230];   // blue   — stayed cooperator
  const COL_DD = [200, 50, 50];    // red    — stayed defector
  const COL_CD = [235, 205, 60];   // yellow — just became defector
  const COL_DC = [70, 200, 110];   // green  — just became cooperator

  class SpatialDilemma extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
      this.grid = null;      // Int8Array current strategies
      this.prev = null;      // Int8Array previous strategies (for 4-colour scheme)
      this.next = null;      // Int8Array scratch for the synchronous update
      this.score = null;     // Float64Array payoff per cell
      this.img = null;
      this._rng = mulberry32(0xc0ffee);
    }

    setup() {
      this.cols = Math.max(1, Math.floor(this.width / CELL));
      this.rows = Math.max(1, Math.floor(this.height / CELL));
      const n = this.cols * this.rows;
      this.grid = new Int8Array(n);
      this.prev = new Int8Array(n);
      this.next = new Int8Array(n);
      this.score = new Float64Array(n);
      const made = this.ctx.createImageData ? this.ctx.createImageData(this.cols, this.rows) : null;
      this.img = (made && made.data) ? made : null;
      this.seed();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // deterministic seeding helper for tests
    seedRng(s) { this._rng = mulberry32(s >>> 0); }

    // (Re)seed the grid according to the selected seed type.
    seed() {
      const { cols, rows, grid } = this;
      const n = cols * rows;
      const type = (this.params && this.params.seed) || 'single';
      if (type === 'random') {
        const frac = (this.params && this.params.coopFrac);
        const p = (frac === undefined || frac === null) ? 0.9 : frac;
        for (let i = 0; i < n; i++) grid[i] = this._rng() < p ? C : D;
      } else {
        // Single defector in an all-cooperator sea — the iconic kaleidoscope.
        grid.fill(C);
        const cx = cols >> 1, cy = rows >> 1;
        grid[this.idx(cx, cy)] = D;
      }
      // Previous = current at seed, so nothing flashes as a transition on frame 0.
      this.prev.set(grid);
    }

    // One generation: play all interactions, then imitate the best neighbour.
    step() {
      const speed = (this.params && this.params.speed | 0) || 1;
      for (let s = 0; s < speed; s++) this.generation();
    }

    generation() {
      const { cols, rows, grid, score } = this;
      const b = (this.params && this.params.b) || 1.85;

      // --- Phase 1: PLAY. Accumulate each cell's payoff over its 9 interactions
      // (8 Moore neighbours + itself). score = (#cooperator partners) weighted by
      // 1 if the cell is a cooperator, b if it is a defector. Self counts as a
      // partner too: a cooperator's self-interaction adds 1; a defector's adds 0.
      for (let y = 0; y < rows; y++) {
        const yU = y === 0 ? rows - 1 : y - 1;
        const yD = y === rows - 1 ? 0 : y + 1;
        for (let x = 0; x < cols; x++) {
          const xL = x === 0 ? cols - 1 : x - 1;
          const xR = x === cols - 1 ? 0 : x + 1;
          const i = y * cols + x;
          // count cooperators among the 9 cells (8 neighbours + self)
          let coop =
            grid[yU * cols + xL] + grid[yU * cols + x] + grid[yU * cols + xR] +
            grid[y  * cols + xL] + grid[i]             + grid[y  * cols + xR] +
            grid[yD * cols + xL] + grid[yD * cols + x] + grid[yD * cols + xR];
          // grid values are 0/1, so `coop` is the cooperator count directly.
          if (grid[i] === C) {
            score[i] = coop;          // cooperator earns 1 per cooperator (incl. self)
          } else {
            // defector: self is D and contributes 0, so subtract nothing —
            // `coop` already excludes self because self is D (value 0).
            score[i] = b * coop;      // defector earns b per cooperator neighbour
          }
        }
      }

      // --- Phase 2: UPDATE. Each cell copies the strategy of the highest-scoring
      // cell in its Moore neighbourhood (including itself). Scan self first and
      // only switch on a STRICTLY greater score → ties favour the incumbent.
      const { next } = this;
      for (let y = 0; y < rows; y++) {
        const yU = y === 0 ? rows - 1 : y - 1;
        const yD = y === rows - 1 ? 0 : y + 1;
        for (let x = 0; x < cols; x++) {
          const xL = x === 0 ? cols - 1 : x - 1;
          const xR = x === cols - 1 ? 0 : x + 1;
          const i = y * cols + x;
          let bestS = score[i];        // self scanned first (incumbent)
          let bestStrat = grid[i];
          // helper inline: consider a neighbour j
          let j;
          j = yU * cols + xL; if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = yU * cols + x;  if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = yU * cols + xR; if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = y  * cols + xL; if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = y  * cols + xR; if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = yD * cols + xL; if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = yD * cols + x;  if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          j = yD * cols + xR; if (score[j] > bestS) { bestS = score[j]; bestStrat = grid[j]; }
          next[i] = bestStrat;
        }
      }

      // commit: prev ← old grid, grid ← next
      this.prev.set(grid);
      grid.set(next);
    }

    // Fraction of cells that are cooperators (for readout + tests).
    cooperatorFraction() {
      const grid = this.grid;
      let c = 0;
      for (let i = 0; i < grid.length; i++) c += grid[i];   // C=1, D=0
      return grid.length ? c / grid.length : 0;
    }

    draw(ctx, w, h) {
      const { grid, prev, img } = this;
      if (!img) return; // headless / no canvas
      const data = img.data;
      for (let i = 0; i < grid.length; i++) {
        const cur = grid[i], pv = prev[i];
        let col;
        if (cur === C) col = pv === C ? COL_CC : COL_DC;   // blue / green
        else col = pv === D ? COL_DD : COL_CD;             // red / yellow
        const j = i << 2;
        data[j] = col[0]; data[j + 1] = col[1]; data[j + 2] = col[2]; data[j + 3] = 255;
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
  const sim = new SpatialDilemma('#stage');
  sim.start();

  const reseed = () => { sim.seed(); if (!sim.running) sim._renderOnce(); };

  sim.standardRail({ randomize: () => { sim.params.seed = 'random'; reseed(); } });

  // THE knob: the temptation to defect. 1.0–2.0; ~1.85 is the classic chaos.
  sim.slider('b', { min: 1.0, max: 2.0, step: 0.01, value: 1.85,
    fmt: v => 'b = ' + v.toFixed(2) });

  sim.select('seed', [
    { value: 'single', label: 'Single defector' },
    { value: 'random', label: 'Random mix' },
  ], { value: 'single', onChange: reseed });

  sim.slider('coopFrac', { min: 0.1, max: 1.0, step: 0.01, value: 0.9,
    fmt: v => Math.round(v * 100) + '% cooperators', onInput: () => {
      if ((sim.params.seed || 'single') === 'random') reseed();
    } });

  sim.slider('speed', { min: 1, max: 8, step: 1, value: 1, fmt: v => v + ' gens/frame' });

  sim.readout(s => {
    const f = s.cooperatorFraction();
    const b = (s.params && s.params.b) || 1.85;
    return `b = ${b.toFixed(2)}  ·  cooperators ${(f * 100).toFixed(1)}%  ·  ` +
      `defectors ${((1 - f) * 100).toFixed(1)}%`;
  });
})();
