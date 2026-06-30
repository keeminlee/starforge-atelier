/* Schelling's Segregation Model — agents on a grid relocate when too few of
 * their Moore-neighbors share their type. Extends Atlas.Sim.
 *
 * Two agent types (A, B) plus empty cells. An agent is "happy" if the fraction
 * of its *occupied* 8-neighbors that share its type is ≥ tolerance τ. Agents
 * with zero occupied neighbors are counted as happy (an isolated agent has no
 * one to be unhappy about — an explicit choice; see notes.md). Each sweep finds
 * the unhappy agents and relocates each to a uniformly-random empty cell (the
 * classic "random relocation" variant). The grid wraps toroidally.
 *
 * Exposes `this.happyFraction` and `this.segregation` for headless testing. */
(function () {
  'use strict';
  const { Sim, randInt } = Atlas;

  const CELL = 7;        // logical pixels per cell
  const EMPTY = 0, A = 1, B = 2;

  class Schelling extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6 });
      this.happyFraction = 0;
      this.segregation = 0;
      this.sweeps = 0;
    }

    setup() {
      this.cols = Math.floor(this.width / CELL);
      this.rows = Math.floor(this.height / CELL);
      this.seed();
    }

    onResize() { this.setup(); }

    idx(x, y) { return y * this.cols + x; }

    // (Re)seed the grid from the density / mix params.
    seed() {
      const n = this.cols * this.rows;
      this.grid = new Uint8Array(n);
      this.empties = [];        // list of empty-cell indices (for O(1) relocation)
      this.emptyAt = new Int32Array(n).fill(-1); // index → position in empties[]
      this.sweeps = 0;

      const density = (this.params && this.params.density) ?? 0.9;
      const mix = (this.params && this.params.mix) ?? 0.5;
      for (let i = 0; i < n; i++) {
        if (Math.random() < density) {
          this.grid[i] = Math.random() < mix ? A : B;
        } else {
          this.grid[i] = EMPTY;
          this.emptyAt[i] = this.empties.length;
          this.empties.push(i);
        }
      }
      this.recount();
    }

    // Count happy fraction and the segregation index over all occupied cells.
    recount() {
      const { cols, rows, grid } = this;
      const tau = (this.params && this.params.tolerance) ?? 0.3;
      let occupied = 0, happy = 0, segSum = 0, withNeighbors = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const t = grid[this.idx(x, y)];
          if (t === EMPTY) continue;
          occupied++;
          const { same, total } = this.neighborTally(x, y, t);
          if (total === 0) { happy++; continue; } // isolated agent: happy by choice
          const frac = same / total;
          segSum += frac;
          withNeighbors++;
          if (frac >= tau) happy++;
        }
      }
      this.occupied = occupied;
      this.happyCount = happy;
      this.happyFraction = occupied ? happy / occupied : 1;
      // Segregation index averages same/total only over agents that HAVE
      // neighbors (the ratio is undefined otherwise).
      this.withNeighbors = withNeighbors;
      this.segregation = withNeighbors ? segSum / withNeighbors : 0;
    }

    // Toroidal Moore-neighborhood tally for an agent of type `t` at (x,y).
    neighborTally(x, y, t) {
      const { cols, rows, grid } = this;
      let same = 0, total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = (y + dy + rows) % rows;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + cols) % cols;
          const nt = grid[ny * cols + nx];
          if (nt === EMPTY) continue;
          total++;
          if (nt === t) same++;
        }
      }
      return { same, total };
    }

    isHappy(x, y, t) {
      const { same, total } = this.neighborTally(x, y, t);
      if (total === 0) return true;
      const tau = (this.params && this.params.tolerance) ?? 0.3;
      return same / total >= tau;
    }

    // Move the agent at cell `from` to empty cell `to`, keeping empties[] valid.
    relocate(from, to) {
      const t = this.grid[from];
      this.grid[to] = t;
      this.grid[from] = EMPTY;
      // `to` is no longer empty: swap-remove it from empties[].
      const posTo = this.emptyAt[to];
      const last = this.empties[this.empties.length - 1];
      this.empties[posTo] = last;
      this.emptyAt[last] = posTo;
      this.empties.pop();
      this.emptyAt[to] = -1;
      // `from` is now empty: append it.
      this.emptyAt[from] = this.empties.length;
      this.empties.push(from);
    }

    // One sweep: relocate every currently-unhappy agent once (snapshot the
    // unhappy set first so within-sweep moves don't cascade unfairly).
    sweep() {
      const { cols, rows, grid } = this;
      if (this.empties.length === 0) { this.sweeps++; return 0; }
      const unhappy = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = this.idx(x, y);
          const t = grid[i];
          if (t === EMPTY) continue;
          if (!this.isHappy(x, y, t)) unhappy.push(i);
        }
      }
      // shuffle order so relocation isn't biased by scan order
      for (let i = unhappy.length - 1; i > 0; i--) {
        const j = randInt(0, i + 1);
        const tmp = unhappy[i]; unhappy[i] = unhappy[j]; unhappy[j] = tmp;
      }
      let moved = 0;
      for (const from of unhappy) {
        if (this.grid[from] === EMPTY) continue; // shouldn't happen, but be safe
        if (this.empties.length === 0) break;
        const k = randInt(0, this.empties.length);
        const to = this.empties[k];
        this.relocate(from, to);
        moved++;
      }
      this.sweeps++;
      return moved;
    }

    step() {
      const speed = (this.params && this.params.speed) ?? 1;
      for (let s = 0; s < speed; s++) this.sweep();
      this.recount();
    }

    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const { cols, rows, grid } = this;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const t = grid[this.idx(x, y)];
          if (t === EMPTY) continue;
          ctx.fillStyle = t === A ? '#5ad1c0' : '#e0892a';
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    }
  }

  // ---- mount + controls ----
  const sim = new Schelling('#stage');
  sim.start();

  const reseed = () => { sim.seed(); sim._renderOnce(); };

  sim.standardRail({ randomize: reseed });
  sim.slider('tolerance', { min: 0, max: 1, step: 0.01, value: 0.3,
    fmt: v => Math.round(v * 100) + '%' });
  sim.slider('density', { min: 0.5, max: 0.95, step: 0.01, value: 0.9,
    fmt: v => Math.round(v * 100) + '%', onInput: reseed });
  sim.slider('mix', { min: 0.2, max: 0.8, step: 0.01, value: 0.5,
    fmt: v => Math.round(v * 100) + '% A', onInput: reseed });
  sim.slider('speed', { min: 1, max: 8, step: 1, value: 1, fmt: v => v + '×' });

  sim.readout(s =>
    `happy ${Math.round(s.happyFraction * 100)}%  ·  ` +
    `segregation ${Math.round(s.segregation * 100)}%  ·  sweep ${s.sweeps}`);
})();
