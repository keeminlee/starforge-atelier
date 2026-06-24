/* =====================================================================
 * knapsack / algo.js  —  The Atlas of Algorithms (Dynamic Programming)
 * ---------------------------------------------------------------------
 * 0/1 knapsack. dp[i][w] = the best value obtainable from the first i items
 * within capacity w. Each cell is the better of two subproblems: SKIP item i
 * (dp[i-1][w]) or TAKE it (value_i + dp[i-1][w-weight_i]). Fill the table row
 * by row, then backtrack to recover which items were chosen. Pseudo-poly
 * O(nW). One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: '0/1 Knapsack',
    slug: 'knapsack',
    family: 'dp',
    oneLiner: 'Pack the most valuable subset that fits — by solving every smaller capacity for every prefix of items.',
    invariant: 'dp[i][w] is the exact optimum for the first i items under capacity w — the best of skipping or taking item i.',
    cost: { time: 'O(n·W)', space: 'O(n·W)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Items', min: 3, max: 6, step: 1, value: 5 },
      { key: 'cap', type: 'slider', label: 'Capacity', min: 6, max: 13, step: 1, value: 10 },
      { key: 'shuffle', type: 'button', label: 'New items',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(2, params.n || 5);
    var W = Math.max(4, params.cap || 10);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var weight = [], value = [];
    for (var t = 0; t < n; t++) { weight.push(1 + Math.floor(rng() * Math.max(2, W - 2))); value.push(3 + Math.floor(rng() * 16)); }

    var dp = []; for (var i = 0; i <= n; i++) { var row = []; for (var w = 0; w <= W; w++) row.push(i === 0 ? 0 : null); dp.push(row); }

    function snap(hl, annotation, status) {
      return {
        dp: dp.map(function (r) { return r.slice(); }), n: n, W: W, weight: weight.slice(), value: value.slice(),
        cur: hl.cur || null, skipSrc: hl.skipSrc || null, takeSrc: hl.takeSrc || null, took: hl.took,
        chosen: hl.chosen || null, btCell: hl.btCell || null, status: status,
        readout: [
          { label: 'items', value: n },
          { label: 'capacity', value: W },
          { label: 'best value', value: hl.best != null ? hl.best : (dp[n][W] != null ? dp[n][W] : '…') }
        ],
        annotation: annotation
      };
    }

    yield snap({}, 'Items with (weight, value). Build a table: dp[i][w] = best value from the first i items that fits capacity w. Row 0 (no items) is all zeros.', 'start');

    for (var ii = 1; ii <= n; ii++) {
      var wt = weight[ii - 1], val = value[ii - 1];
      for (var ww = 0; ww <= W; ww++) {
        var skip = dp[ii - 1][ww];
        var canTake = wt <= ww;
        var take = canTake ? val + dp[ii - 1][ww - wt] : -1;
        var took = canTake && take > skip;
        dp[ii][ww] = Math.max(skip, take);
        yield snap({
          cur: [ii, ww], skipSrc: [ii - 1, ww], takeSrc: canTake ? [ii - 1, ww - wt] : null, took: took
        }, 'dp[' + ii + '][' + ww + ']: item ' + ii + ' weighs ' + wt + (canTake
          ? ' (fits). Skip → ' + skip + ', or take → ' + val + '+' + dp[ii - 1][ww - wt] + '=' + take + '. Best ' + dp[ii][ww] + (took ? ' (take).' : ' (skip).')
          : ' > ' + ww + ' (too heavy). Must skip → ' + skip + '.'), 'fill');
      }
    }

    // backtrack the chosen items
    var chosen = [], ci = n, cw = W;
    while (ci > 0) {
      var picked = dp[ci][cw] !== dp[ci - 1][cw];
      yield snap({ btCell: [ci, cw], chosen: chosen.slice(), took: picked },
        'Backtrack at dp[' + ci + '][' + cw + ']=' + dp[ci][cw] + ': ' + (picked ? 'differs from the row above → item ' + ci + ' was taken (weight ' + weight[ci - 1] + ', value ' + value[ci - 1] + '). Move left by its weight.' : 'same as the row above → item ' + ci + ' was skipped.'), 'backtrack');
      if (picked) { chosen.push(ci - 1); cw -= weight[ci - 1]; }
      ci--;
    }

    var totW = chosen.reduce(function (s, idx) { return s + weight[idx]; }, 0);
    var fin = snap({ chosen: chosen.slice(), best: dp[n][W] }, 'Done. Best value ' + dp[n][W] + ' using items {' + chosen.map(function (x) { return x + 1; }).sort(function (a, b) { return a - b; }).join(', ') + '} (total weight ' + totW + ' ≤ ' + W + ').', 'done');
    fin.report = { n: n, W: W, weight: weight, value: value, dp: dp.map(function (r) { return r.slice(); }), best: dp[n][W], chosen: chosen.slice() };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var n = snap.n, W = snap.W, dp = snap.dp;
    var rows = n + 2, cols = W + 2;   // +1 header row, +1 header col
    var chosenSet = {}; if (snap.chosen) for (var c0 = 0; c0 < snap.chosen.length; c0++) chosenSet[snap.chosen[c0] + 1] = true;
    function eq(p, r, c) { return p && p[0] === r && p[1] === c; }

    root.Algo.grid(ctx, { rows: rows, cols: cols, w: w, h: h, pad: 20, gap: 3 }, function (x, y, cell, r, c) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var fs = Math.max(9, Math.min(16, cell * 0.4));
      // headers
      if (r === 0 && c === 0) { return; }
      if (r === 0) { ctx.fillStyle = theme.muted; ctx.font = fs + 'px ' + (theme.mono || 'monospace'); ctx.fillText(String(c - 1), x + cell / 2, y + cell / 2); return; }
      if (c === 0) {
        var item = r - 1;
        ctx.fillStyle = chosenSet[item] ? theme.invariant : theme.muted; ctx.font = '600 ' + (fs - 1) + 'px ' + (theme.mono || 'monospace');
        ctx.fillText(item === 0 ? '∅' : (item + '·' + snap.weight[item - 1] + '/' + snap.value[item - 1]), x + cell / 2, y + cell / 2);
        return;
      }
      var i = r - 1, ww = c - 1, val = dp[i][ww];
      var fill = theme.panel, stroke = null, lw = 1.5, ink = theme.muted;
      if (val != null) ink = theme.ink;
      if (eq(snap.skipSrc, i, ww)) { stroke = theme.accent; }
      if (eq(snap.takeSrc, i, ww)) { stroke = theme.cost; }
      if (eq(snap.cur, i, ww)) { fill = theme.accent; ink = theme.bg; stroke = null; }
      if (eq(snap.btCell, i, ww)) { fill = snap.took ? theme.invariant : theme.warn; ink = theme.bg; }
      if (snap.status === 'done' && i === n && ww === W) { fill = theme.invariant; ink = theme.bg; }
      ctx.fillStyle = fill; ctx.fillRect(x, y, cell, cell);
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3); }
      if (val != null) { ctx.fillStyle = ink; ctx.font = '600 ' + fs + 'px ' + (theme.mono || 'monospace'); ctx.fillText(String(val), x + cell / 2, y + cell / 2); }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
