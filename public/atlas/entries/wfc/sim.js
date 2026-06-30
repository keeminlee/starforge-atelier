/* Wave Function Collapse — the "simple tiled model".
 *
 * A grid of cells, each starting in a SUPERPOSITION of every possible tile.
 * The algorithm crystallizes a globally coherent pattern from purely local
 * adjacency rules by repeating three steps:
 *
 *   1. OBSERVE   — find the un-collapsed cell with the lowest ENTROPY (fewest
 *                  remaining compatible tiles, >1); ties broken randomly. If
 *                  every cell is collapsed, we're done. If some cell has ZERO
 *                  options, that's a CONTRADICTION: we restart the whole grid
 *                  with a fresh seed (and count the restart).
 *   2. COLLAPSE  — pick one tile for that cell at random (weighted), discarding
 *                  its other options.
 *   3. PROPAGATE — push the change outward: for each neighbor, remove any tile
 *                  no longer compatible with ANY remaining tile of the changed
 *                  cell; if a neighbor's option set shrank, propagate from it
 *                  too. A stack-based constraint-propagation cascade that runs
 *                  until no more eliminations are possible.
 *
 * The emergent result is a connected network of pipes that no single local
 * choice planned — a different valid pattern every run. This is a GENERATIVE /
 * algorithmic flavor of emergence (like the Atlas's L-systems), not a stepping
 * dynamical system, and the quantum "wave function collapse" name is a loose
 * metaphor, not actual quantum mechanics.
 *
 * Tileset ("pipes"): each tile carries a socket on each of its 4 edges,
 * indexed [N, E, S, W]: 0 = blank, 1 = pipe. Two tiles may be neighbors iff
 * their touching edges MATCH (pipe meets pipe, blank meets blank), which
 * guarantees pipes always connect into coherent networks. Rotated variants are
 * generated programmatically from a few base tiles.
 *
 * Extends Atlas.Sim. Vanilla ES + Canvas, no external deps. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  // Edge order is [N, E, S, W]. Rotating a tile 90° clockwise shifts the
  // sockets so the old West edge becomes the new North, etc.
  const rotate = (s) => [s[3], s[0], s[1], s[2]];

  // Base tiles: name, sockets [N,E,S,W], how many distinct rotations to emit,
  // and a relative weight. `empty` is weighted heavily so networks stay sparse.
  function buildTileset() {
    const bases = [
      { name: 'empty',    sockets: [0, 0, 0, 0], rots: 1, weight: 3.0 },
      { name: 'straight', sockets: [1, 0, 1, 0], rots: 2, weight: 1.0 }, // N-S pipe
      { name: 'corner',   sockets: [1, 1, 0, 0], rots: 4, weight: 1.0 }, // N-E elbow
      { name: 'tee',      sockets: [1, 1, 1, 0], rots: 4, weight: 0.8 }, // N-E-S
      { name: 'cross',    sockets: [1, 1, 1, 1], rots: 1, weight: 0.6 },
    ];
    const tiles = [];
    for (const b of bases) {
      let s = b.sockets.slice();
      for (let r = 0; r < b.rots; r++) {
        tiles.push({ name: b.name, rot: r, sockets: s.slice(), weight: b.weight });
        s = rotate(s);
      }
    }
    return tiles;
  }

  // Direction table: dx,dy and the two touching edge indices. For direction d,
  // `edge` is the edge of THIS tile facing the neighbor, `opp` the neighbor's
  // edge facing back. Order: N, E, S, W.
  const DIRS = [
    { dx: 0, dy: -1, edge: 0, opp: 2 }, // N: my North touches neighbor's South
    { dx: 1, dy: 0, edge: 1, opp: 3 }, // E: my East  touches neighbor's West
    { dx: 0, dy: 1, edge: 2, opp: 0 }, // S
    { dx: -1, dy: 0, edge: 3, opp: 1 }, // W
  ];

  // Precompute, for each (tile a, direction d), the set of tiles b that may sit
  // in direction d from a: a's edge socket must equal b's opposite socket.
  // Stored as a boolean table allowed[d][a][b] for O(1) propagation checks.
  function buildAdjacency(tiles) {
    const T = tiles.length;
    const allowed = DIRS.map(() => {
      const m = new Array(T);
      for (let a = 0; a < T; a++) m[a] = new Uint8Array(T);
      return m;
    });
    for (let d = 0; d < DIRS.length; d++) {
      const { edge, opp } = DIRS[d];
      for (let a = 0; a < T; a++) {
        for (let b = 0; b < T; b++) {
          allowed[d][a][b] = tiles[a].sockets[edge] === tiles[b].sockets[opp] ? 1 : 0;
        }
      }
    }
    return allowed;
  }

  // ---- a tiny seedable PRNG so runs are reproducible in tests (mulberry32) ----
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class WaveFunctionCollapse extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.6, stepsPerFrame: 1 });
      this.tiles = buildTileset();
      this.adj = buildAdjacency(this.tiles);
      this.restarts = 0;
    }

    setup() {
      // Cell size is driven by the `grid` control (cells across). Fall back to a
      // sensible default before controls exist (first setup during start()).
      const across = Math.round((this.params && this.params.grid) || 20);
      this.cols = Math.max(2, across);
      this.cell = this.width / this.cols;
      this.rows = Math.max(2, Math.floor(this.height / this.cell));
      this.restarts = 0;
      this._seed = ((this.params && this.params.seed) || (Date.now() & 0x7fffffff)) >>> 0;
      this.initGrid(this._seed);
    }

    onResize() { this.setup(); }

    // Fresh grid: every cell holds the full superposition (all tiles allowed).
    // grid[i] is a Uint8Array option mask over tile ids; collapsed[i] is the
    // tile id once a cell has exactly one option, else -1.
    initGrid(seed) {
      const T = this.tiles.length;
      const n = this.cols * this.rows;
      this.rng = makeRng(seed >>> 0);
      this.grid = new Array(n);
      this.counts = new Int32Array(n);   // number of remaining options per cell
      this.collapsed = new Int32Array(n).fill(-1);
      for (let i = 0; i < n; i++) {
        this.grid[i] = new Uint8Array(T).fill(1);
        this.counts[i] = T;
      }
      this.done = false;
      this.contradiction = false;
    }

    idx(x, y) { return y * this.cols + x; }

    // ---- the three WFC steps ----

    // OBSERVE: return the index of the lowest-entropy un-collapsed cell, or -1
    // if all cells are collapsed. Ties broken with the seeded RNG. Detects a
    // contradiction (a cell with zero options) by setting this.contradiction.
    observe() {
      let best = -1, bestCount = Infinity, ties = 0;
      const n = this.cols * this.rows;
      for (let i = 0; i < n; i++) {
        const c = this.counts[i];
        if (c === 0) { this.contradiction = true; return -1; }
        if (c <= 1) continue;            // already collapsed
        if (c < bestCount) { bestCount = c; best = i; ties = 1; }
        else if (c === bestCount) {      // reservoir tie-break
          ties++;
          if (this.rng() < 1 / ties) best = i;
        }
      }
      return best;
    }

    // COLLAPSE cell i to a single tile, chosen by weight among its options.
    collapse(i) {
      const mask = this.grid[i];
      let total = 0;
      for (let t = 0; t < mask.length; t++) if (mask[t]) total += this.tiles[t].weight;
      let r = this.rng() * total, pick = -1;
      for (let t = 0; t < mask.length; t++) {
        if (!mask[t]) continue;
        r -= this.tiles[t].weight;
        if (r <= 0) { pick = t; break; }
      }
      if (pick < 0) for (let t = 0; t < mask.length; t++) if (mask[t]) { pick = t; break; }
      for (let t = 0; t < mask.length; t++) mask[t] = (t === pick) ? 1 : 0;
      this.counts[i] = 1;
      this.collapsed[i] = pick;
      return pick;
    }

    // PROPAGATE constraints outward from a stack of just-changed cells. For each
    // neighbor, remove any option not compatible with ANY remaining option of
    // the changed cell; if a neighbor shrank, push it too. Runs to fixpoint.
    // Returns false if it produced a contradiction (an empty cell).
    propagate(stack) {
      const { cols, rows, adj, grid, counts } = this;
      while (stack.length) {
        const ci = stack.pop();
        const cx = ci % cols, cy = (ci / cols) | 0;
        const here = grid[ci];
        for (let d = 0; d < DIRS.length; d++) {
          const nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          const nmask = grid[ni];
          const allowD = adj[d];
          let changed = false;
          for (let b = 0; b < nmask.length; b++) {
            if (!nmask[b]) continue;
            // Is neighbor-tile b supported by ANY remaining option a of `here`?
            let support = false;
            for (let a = 0; a < here.length; a++) {
              if (here[a] && allowD[a][b]) { support = true; break; }
            }
            if (!support) { nmask[b] = 0; counts[ni]--; changed = true; }
          }
          if (changed) {
            if (counts[ni] === 0) { this.contradiction = true; return false; }
            if (counts[ni] === 1 && this.collapsed[ni] < 0) {
              for (let b = 0; b < nmask.length; b++) if (nmask[b]) { this.collapsed[ni] = b; break; }
            }
            stack.push(ni);
          }
        }
      }
      return true;
    }

    // One full observe → collapse → propagate cycle. Restarts the whole grid on
    // a contradiction. Returns true while work remains, false once solved.
    advance() {
      if (this.done) return false;
      const i = this.observe();
      if (this.contradiction) { this.restart(); return true; }
      if (i < 0) { this.done = true; return false; } // all collapsed
      this.collapse(i);
      const ok = this.propagate([i]);
      if (!ok) { this.restart(); return true; }
      return true;
    }

    // Restart from scratch with a new seed derived from the current one, so a
    // contradicting layout doesn't repeat deterministically.
    restart() {
      this.restarts++;
      this._seed = (Math.imul(this._seed ^ 0x9e3779b9, 2654435761) + this.restarts) >>> 0;
      this.initGrid(this._seed);
    }

    // Run to full completion (used by tests / reduced-motion). Caps iterations
    // so a pathological tileset can't hang the harness.
    solve(maxCycles = 1e6) {
      let n = 0;
      while (this.advance() && n++ < maxCycles) { /* spin */ }
      return this.done;
    }

    step() {
      const speed = Math.round((this.params && this.params.speed) || 4);
      for (let s = 0; s < speed; s++) {
        if (!this.advance()) break;
      }
    }

    // ---- coherence check (for tests): every orthogonally-adjacent pair of
    // COLLAPSED cells must satisfy the adjacency rule (touching sockets match).
    isCoherent() {
      const { cols, rows } = this;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const a = this.collapsed[this.idx(x, y)];
          if (a < 0) continue;
          // check East and South neighbors (covers every pair once)
          for (const d of [1, 2]) {
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (nx >= cols || ny >= rows) continue;
            const b = this.collapsed[this.idx(nx, ny)];
            if (b < 0) continue;
            if (this.tiles[a].sockets[DIRS[d].edge] !== this.tiles[b].sockets[DIRS[d].opp]) {
              return false;
            }
          }
        }
      }
      return true;
    }

    numCollapsed() {
      let c = 0;
      for (let i = 0; i < this.collapsed.length; i++) if (this.collapsed[i] >= 0) c++;
      return c;
    }

    // ---- rendering ----
    draw(ctx, w, h) {
      if (!ctx || !ctx.fillRect) return; // headless: no canvas
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const cell = this.cell;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const i = this.idx(x, y);
          const px = x * cell, py = y * cell;
          const tid = this.collapsed[i];
          if (tid >= 0) this.drawTile(ctx, px, py, cell, this.tiles[tid]);
          else this.drawSuperposition(ctx, px, py, cell, this.counts[i]);
        }
      }
    }

    // A collapsed tile: line segments from the cell center to each piped edge,
    // rounded, in a warm teal on the dark ground. Connected pipes form paths.
    drawTile(ctx, px, py, cell, tile) {
      const cx = px + cell / 2, cy = py + cell / 2;
      const s = tile.sockets;
      if (s[0] + s[1] + s[2] + s[3] === 0) return; // empty: draw nothing
      ctx.strokeStyle = '#5fd6c8';
      ctx.lineWidth = Math.max(2, cell * 0.16);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (s[0]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, py); }            // N
      if (s[1]) { ctx.moveTo(cx, cy); ctx.lineTo(px + cell, cy); }     // E
      if (s[2]) { ctx.moveTo(cx, cy); ctx.lineTo(cx, py + cell); }     // S
      if (s[3]) { ctx.moveTo(cx, cy); ctx.lineTo(px, cy); }            // W
      ctx.stroke();
      // a small hub dot at junctions (tee/cross) reads as a connector
      if (s[0] + s[1] + s[2] + s[3] >= 3) {
        ctx.fillStyle = '#7ee0d3';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, cell * 0.10), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Still in superposition: a faint dot whose brightness encodes how many
    // options remain (fewer remaining → brighter, closer to collapsing).
    drawSuperposition(ctx, px, py, cell, count) {
      const T = this.tiles.length;
      const t = 1 - (count - 1) / Math.max(1, T - 1); // 0 (max entropy)..1
      const a = 0.06 + 0.22 * t;
      ctx.fillStyle = `rgba(120,150,170,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px + cell / 2, py + cell / 2, Math.max(1, cell * 0.07), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- mount + controls ----
  const sim = new WaveFunctionCollapse('#stage');
  sim.start();

  sim.standardRail({
    randomize: () => {
      sim.params.seed = (Date.now() & 0x7fffffff) >>> 0;
      sim.reset();
    }
  });

  sim.slider('grid', { min: 12, max: 40, step: 1, value: 20, fmt: v => v + ' cells',
    onInput: () => { sim.params.seed = (Date.now() & 0x7fffffff) >>> 0; sim.reset(); } });
  sim.slider('speed', { min: 1, max: 20, step: 1, value: 4, fmt: v => v + '/frame' });

  sim.readout(s => {
    const total = s.cols * s.rows;
    const done = s.numCollapsed();
    // entropy frontier: how many cells are still undecided (>1 option)
    let frontier = 0;
    for (let i = 0; i < s.counts.length; i++) if (s.counts[i] > 1) frontier++;
    return `${done}/${total} collapsed  ·  frontier ${frontier}  ·  restarts ${s.restarts}` +
      (s.done ? '  ·  ✓ complete' : '');
  });
})();
