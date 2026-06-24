/* =====================================================================
 * count-min-sketch / algo.js  —  The Atlas of Algorithms (Sketching & Streaming)
 * ---------------------------------------------------------------------
 * Cormode–Muthukrishnan (2005). A d×w grid of counters with d hash
 * functions. Add(x): bump one cell per row, at column h_r(x). Query(x):
 * take the MIN of its d cells. Guarantee (the lens):
 *   - ONE-SIDED INVARIANT: estimate ≥ true count, always (collisions only add).
 *   - PROBABILISTIC: estimate ≤ true + εN with prob ≥ 1−δ  (ε=e/w, δ=e^−d).
 * One source of truth (ADR-0001); statistical verification (ADR-0005);
 * registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var UNIVERSE = 40;
  var P = 2147483647; // 2^31 − 1, prime

  var metadata = {
    title: 'Count–Min Sketch',
    slug: 'count-min-sketch',
    family: 'streaming',
    oneLiner: 'Count every item in a stream using one small grid — never undercounting, and overcounting only a little.',
    invariant: 'The estimate (min over d rows) never undercounts; it overcounts by ≤ εn with probability ≥ 1−δ.',
    cost: { time: 'O(d)/update', space: 'O(d·w) counters' },
    controls: [
      { key: 'w', type: 'slider', label: 'Width (columns)', min: 4, max: 20, step: 1, value: 11 },
      { key: 'd', type: 'slider', label: 'Depth (rows / hashes)', min: 1, max: 6, step: 1, value: 4 },
      { key: 'events', type: 'slider', label: 'Stream length', min: 40, max: 300, step: 10, value: 150 },
      { key: 'shuffle', type: 'button', label: 'New run',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var w = Math.max(2, params.w || 11);
    var d = Math.max(1, params.d || 4);
    var N = Math.max(10, params.events || 150);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    // d pairwise-independent hashes h_r(x) = ((a_r·x + b_r) mod P) mod w
    var A = [], B = [];
    for (var r = 0; r < d; r++) { A.push(1 + Math.floor(rand() * (P - 1))); B.push(Math.floor(rand() * P)); }
    function cellsOf(x) { var cs = []; for (var r = 0; r < d; r++) cs.push(((A[r] * x + B[r]) % P) % w); return cs; }

    var grid = [];
    for (var r2 = 0; r2 < d; r2++) { var row = []; for (var c = 0; c < w; c++) row.push(0); grid.push(row); }
    var truth = {};
    var tracked = 0; // item 0 is the heavy hitter we watch

    function estimateOf(x) { var cs = cellsOf(x), m = Infinity, mr = 0; for (var r = 0; r < d; r++) { var v = grid[r][cs[r]]; if (v < m) { m = v; mr = r; } } return { est: m, minRow: mr, cells: cs }; }

    // Build the stream up front (deterministic): a heavy hitter + a couple of
    // medium items + uniform noise — a realistic skewed frequency distribution.
    var stream = [];
    for (var t = 0; t < N; t++) {
      var u = rand();
      var item;
      if (u < 0.34) item = 0;
      else if (u < 0.52) item = 1 + Math.floor(rand() * 3);
      else item = Math.floor(rand() * UNIVERSE);
      stream.push(item);
    }

    function gridCopy() { var g = []; for (var r = 0; r < d; r++) g.push(grid[r].slice()); return g; }

    function snap(annotation, status, addCells) {
      var q = estimateOf(tracked);
      var tru = truth[tracked] || 0;
      var est = q.est === Infinity ? 0 : q.est;
      var hl = {
        trackCells: q.cells.map(function (col, r) { return { r: r, c: col }; }),
        trackMin: { r: q.minRow, c: q.cells[q.minRow] }
      };
      if (addCells) hl.addCells = addCells;
      return {
        grid: gridCopy(), d: d, w: w, highlight: hl, annotation: annotation, status: status,
        readout: [
          { label: 'tracking', value: 'item ' + tracked },
          { label: 'true', value: tru },
          { label: 'estimate (min)', value: est },
          { label: 'overcount', value: est - tru }
        ]
      };
    }

    yield snap('A d×w grid of counters (d hash functions). Stream items in; each item bumps one cell per row. We track item 0 (a heavy hitter).', 'start');

    for (var s = 0; s < N; s++) {
      var x = stream[s];
      var cs = cellsOf(x);
      for (var rr = 0; rr < d; rr++) grid[rr][cs[rr]] += 1;
      truth[x] = (truth[x] || 0) + 1;
      yield snap('Add item ' + x + ' → +1 to one cell per row. Tracked item ' + tracked + ': true ' + (truth[tracked] || 0) + ', estimate (min of its ' + d + ' cells) ' + estimateOf(tracked).est + '.', 'add', cs.map(function (col, r) { return { r: r, c: col }; }));
    }

    // Final report for the test + a closing query frame.
    var items = [];
    for (var it = 0; it < UNIVERSE; it++) items.push({ item: it, trueCount: truth[it] || 0, estimate: estimateOf(it).est });
    var eps = Math.E / w, delta = Math.exp(-d);
    var fin = snap('Query item ' + tracked + ': read its ' + d + ' cells (outlined) and take the MIN (green) = ' + estimateOf(tracked).est + '. It can only be ≥ the true count ' + (truth[tracked] || 0) + '. ✓', 'done');
    fin.report = { N: N, w: w, d: d, eps: eps, delta: delta, items: items };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var grid = snap.grid || [];
    var d = grid.length; if (!d) return;
    var W = grid[0].length;
    var hl = snap.highlight || {};

    var pad = 18, gap = 3;
    var cellW = (w - 2 * pad - gap * (W - 1)) / W;
    var cellH = (h - 2 * pad - gap * (d - 1)) / d;
    var maxVal = 1;
    for (var r = 0; r < d; r++) for (var c = 0; c < W; c++) if (grid[r][c] > maxVal) maxVal = grid[r][c];

    function cellXY(r, c) { return { x: pad + c * (cellW + gap), y: pad + r * (cellH + gap) }; }

    // heatmap cells
    for (var r1 = 0; r1 < d; r1++) {
      for (var c1 = 0; c1 < W; c1++) {
        var p = cellXY(r1, c1);
        ctx.fillStyle = theme.panel; ctx.fillRect(p.x, p.y, cellW, cellH);
        var v = grid[r1][c1];
        if (v > 0) {
          ctx.save();
          ctx.globalAlpha = 0.18 + 0.82 * (v / maxVal);
          ctx.fillStyle = theme.cost;
          ctx.fillRect(p.x, p.y, cellW, cellH);
          ctx.restore();
        }
      }
    }

    function border(cell, color, lw) {
      var p = cellXY(cell.r, cell.c);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.strokeRect(p.x + lw / 2, p.y + lw / 2, cellW - lw, cellH - lw); ctx.restore();
    }

    // tracked item's cells (white outline), then the current-add cells (blue),
    // then the MIN tracked cell (green = the estimate) on top.
    if (hl.trackCells) hl.trackCells.forEach(function (cell) { border(cell, theme.ink, 2); });
    if (hl.addCells) hl.addCells.forEach(function (cell) { border(cell, theme.accent, 3); });
    if (hl.trackMin) border(hl.trackMin, theme.invariant, 3.5);
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
