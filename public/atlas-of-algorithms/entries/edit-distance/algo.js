/* =====================================================================
 * edit-distance / algo.js  —  The Atlas of Algorithms (Dynamic Programming)
 * ---------------------------------------------------------------------
 * Levenshtein distance by dynamic programming. dp[i][j] = the edit distance
 * between the first i chars of A and first j chars of B. Each interior cell
 * is min(insert, delete, substitute/match) of three neighbors; the corner
 * is the answer, and backtracking the chosen neighbors recovers an optimal
 * alignment. One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var ALPHA = ['a', 'b', 'c', 'd'];

  var metadata = {
    title: 'Edit Distance',
    slug: 'edit-distance',
    family: 'dp',
    oneLiner: 'The fewest insert/delete/substitute edits to turn one string into another — built up from a grid of subproblems.',
    invariant: 'dp[i][j] is the exact edit distance between the first i characters of A and the first j of B.',
    cost: { time: 'O(m·n)', space: 'O(m·n)' },
    controls: [
      { key: 'lenA', type: 'slider', label: 'Length of A', min: 3, max: 8, step: 1, value: 6 },
      { key: 'lenB', type: 'slider', label: 'Length of B', min: 3, max: 8, step: 1, value: 6 },
      { key: 'shuffle', type: 'button', label: 'New strings',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var m = Math.max(2, params.lenA || 6), n = Math.max(2, params.lenB || 6);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    function rc() { return ALPHA[Math.floor(rng() * ALPHA.length)]; }
    var A = '', B = '';
    for (var ai = 0; ai < m; ai++) A += rc();
    for (var bi = 0; bi < n; bi++) B += rc();

    // dp[(m+1) x (n+1)], null = not yet computed
    var dp = []; for (var r = 0; r <= m; r++) { var row = []; for (var c = 0; c <= n; c++) row.push(null); dp.push(row); }
    for (var j0 = 0; j0 <= n; j0++) dp[0][j0] = j0;   // base: turn "" into B[0..j) = j inserts
    for (var i0 = 0; i0 <= m; i0++) dp[i0][0] = i0;   // base: turn A[0..i) into "" = i deletes

    function snap(hl, phase, annotation, status) {
      return {
        A: A, B: B, m: m, n: n, dp: dp.map(function (row) { return row.slice(); }),
        highlight: hl || {}, phase: phase, maxVal: m + n,
        readout: [
          { label: 'A → B', value: A + ' → ' + B },
          { label: phase === 'fill' ? 'computing' : 'edit distance', value: phase === 'fill' ? ('dp[' + hl.i + '][' + hl.j + ']') : dp[m][n] },
          { label: 'distance', value: dp[m][n] != null ? dp[m][n] : '…' }
        ],
        annotation: annotation, status: status
      };
    }

    yield snap({}, 'fill', 'Base cases filled: row 0 is "all inserts", column 0 is "all deletes". Now fill each interior cell from its three neighbors.', 'start');

    for (var i = 1; i <= m; i++) {
      for (var j = 1; j <= n; j++) {
        var match = A[i - 1] === B[j - 1];
        var sub = dp[i - 1][j - 1] + (match ? 0 : 1);
        var del = dp[i - 1][j] + 1;
        var ins = dp[i][j - 1] + 1;
        dp[i][j] = Math.min(sub, del, ins);
        yield snap({ i: i, j: j, sources: [[i - 1, j - 1], [i - 1, j], [i, j - 1]] }, 'fill',
          (match ? '"' + A[i - 1] + '"="' + B[j - 1] + '" → free match: take the diagonal (' + dp[i - 1][j - 1] + ').'
            : 'mismatch → 1 + min(diag ' + dp[i - 1][j - 1] + ', up ' + dp[i - 1][j] + ', left ' + dp[i][j - 1] + ') = ' + dp[i][j] + '.'),
          'fill');
      }
    }

    // backtrack an optimal alignment
    var pi = m, pj = n, path = [[m, n]];
    while (pi > 0 || pj > 0) {
      if (pi > 0 && pj > 0 && dp[pi][pj] === dp[pi - 1][pj - 1] + (A[pi - 1] === B[pj - 1] ? 0 : 1)) { pi--; pj--; }
      else if (pi > 0 && dp[pi][pj] === dp[pi - 1][pj] + 1) { pi--; }
      else { pj--; }
      path.push([pi, pj]);
    }
    path.reverse();

    yield snap({ path: path }, 'done', 'Filled. The bottom-right cell is the edit distance: ' + dp[m][n] + '. The green trail backtracks one optimal sequence of edits (diagonal = keep/substitute, vertical = delete, horizontal = insert).', 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var dp = snap.dp, m = snap.m, n = snap.n, A = snap.A, B = snap.B;
    var hl = snap.highlight || {}, maxVal = snap.maxVal || 1;
    var pathSet = {};
    if (hl.path) for (var p = 0; p < hl.path.length; p++) pathSet[hl.path[p][0] + ',' + hl.path[p][1]] = true;
    var srcSet = {};
    if (hl.sources) for (var s = 0; s < hl.sources.length; s++) srcSet[hl.sources[s][0] + ',' + hl.sources[s][1]] = true;

    // grid covers (m+1)x(n+1); leave a margin top/left for the string headers
    var headPad = 30;
    var geo = root.Algo.grid(ctx, { rows: m + 1, cols: n + 1, w: w, h: h - headPad, pad: 16, gap: 3 }, function (x, y, cell, r, c) {
      var val = dp[r][c];
      var key = r + ',' + c;
      // base fill shaded by value
      ctx.fillStyle = theme.panel; ctx.fillRect(x, y + headPad, cell, cell);
      if (val != null) { ctx.globalAlpha = 0.08 + 0.5 * (val / maxVal); ctx.fillStyle = theme.cost; ctx.fillRect(x, y + headPad, cell, cell); ctx.globalAlpha = 1; }
      if (srcSet[key]) { ctx.globalAlpha = 0.35; ctx.fillStyle = theme.warn; ctx.fillRect(x, y + headPad, cell, cell); ctx.globalAlpha = 1; }
      if (pathSet[key]) { ctx.globalAlpha = 0.5; ctx.fillStyle = theme.invariant; ctx.fillRect(x, y + headPad, cell, cell); ctx.globalAlpha = 1; }
      if (r === hl.i && c === hl.j) { ctx.strokeStyle = theme.accent; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + headPad + 1, cell - 2, cell - 2); }
      if (val != null) {
        ctx.fillStyle = theme.ink; ctx.font = Math.max(9, cell * 0.4) + 'px ' + (theme.mono || 'monospace');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(val), x + cell / 2, y + headPad + cell / 2 + 0.5);
      }
    });
    // string headers using the grid geometry
    if (geo) {
      ctx.fillStyle = theme.accent; ctx.font = '600 ' + Math.max(10, geo.cell * 0.5) + 'px ' + (theme.mono || 'monospace');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var jc = 0; jc < n; jc++) { var bx = geo.ox + (jc + 1) * (geo.cell + geo.gap) + geo.cell / 2; ctx.fillText(B[jc], bx, geo.oy + headPad - 14); }
      ctx.textAlign = 'right';
      for (var ir = 0; ir < m; ir++) { var ay = geo.oy + headPad + (ir + 1) * (geo.cell + geo.gap) + geo.cell / 2; ctx.fillText(A[ir], geo.ox - 8, ay); }
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
