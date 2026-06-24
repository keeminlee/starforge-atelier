/* =====================================================================
 * a-star / algo.js  —  The Atlas of Algorithms (Graphs)
 * ---------------------------------------------------------------------
 * A* = Dijkstra with a goal-directed admissible heuristic. Order the
 * frontier by f = g + h, where g is the cost so far and h is a lower bound
 * on the remaining cost to the target (here Manhattan distance × the
 * minimum terrain weight). Because h never over-estimates, the path found
 * is still optimal — but A* explores far fewer cells than Dijkstra.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'A* Search',
    slug: 'a-star',
    family: 'graphs',
    oneLiner: 'Dijkstra with a sense of direction: a heuristic pulls the search toward the goal, so it settles a fraction of the cells.',
    invariant: 'With an admissible heuristic (never over-estimating the remaining cost), the path A* returns is still a shortest path.',
    cost: { time: 'O((V+E) log V)', space: 'O(V)' },
    controls: [
      { key: 'cols', type: 'slider', label: 'Grid width', min: 12, max: 32, step: 2, value: 24 },
      { key: 'roughness', type: 'slider', label: 'Terrain roughness', min: 1, max: 9, step: 1, value: 6 },
      { key: 'shuffle', type: 'button', label: 'New terrain',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function buildTerrain(rows, cols, rough, rng) {
    var N = rows * cols, maxW = 1 + rough;
    var field = new Array(N); for (var i = 0; i < N; i++) field[i] = rng();
    for (var pass = 0; pass < 2; pass++) {
      var nf = field.slice();
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var s = 0, cnt = 0;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          s += field[(rr) * cols + cc]; cnt++;
        }
        nf[r * cols + c] = s / cnt;
      }
      field = nf;
    }
    return field.map(function (v) { return 1 + Math.round(v * (maxW - 1)); });
  }

  // Best-first search settling in priority order f = g + hFn(node); early-stop
  // at target. With hFn ≡ 0 this is plain Dijkstra; with an admissible hFn, A*.
  // Returns { order, g, parent }.
  function search(rows, cols, w, src, tgt, hFn) {
    var N = rows * cols;
    var g = new Array(N).fill(Infinity), parent = new Array(N).fill(-1), done = new Array(N).fill(false);
    g[src] = 0; var order = [];
    while (true) {
      var u = -1, best = Infinity;
      for (var z = 0; z < N; z++) if (!done[z] && g[z] < Infinity) { var f = g[z] + hFn(z); if (f < best) { best = f; u = z; } }
      if (u === -1) break;
      done[u] = true; order.push(u);
      if (u === tgt) break;
      var ur = Math.floor(u / cols), uc = u % cols;
      var nb = [[ur - 1, uc], [ur + 1, uc], [ur, uc - 1], [ur, uc + 1]];
      for (var k = 0; k < 4; k++) {
        var nr = nb[k][0], nc = nb[k][1]; if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        var ni = nr * cols + nc; if (done[ni]) continue;
        var nd = g[u] + w[ni]; if (nd < g[ni]) { g[ni] = nd; parent[ni] = u; }
      }
    }
    return { order: order, g: g, parent: parent };
  }
  var ZERO = function () { return 0; };

  function* run(input, params) {
    params = params || {};
    var cols = Math.max(8, params.cols || 24);
    var rows = Math.max(6, Math.round(cols * 0.6));
    var rough = (params.roughness != null ? params.roughness : 6);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var w = buildTerrain(rows, cols, rough, rng);
    var minW = Math.min.apply(null, w);
    var src = 1 * cols + 1, tgt = (rows - 2) * cols + (cols - 2);
    var tr2 = rows - 2, tc2 = cols - 2;
    function h(node) { var r = Math.floor(node / cols), c = node % cols; return (Math.abs(r - tr2) + Math.abs(c - tc2)) * minW; }

    var N = rows * cols;
    var aStar = search(rows, cols, w, src, tgt, h);        // A* (f = g + h)
    var order = aStar.order, g = aStar.g, parent = aStar.parent;
    var dij = search(rows, cols, w, src, tgt, ZERO);        // plain Dijkstra, for the contrast
    var dijSettled = dij.order.length;

    var settleRank = new Array(N).fill(-1);
    for (var oi = 0; oi < order.length; oi++) settleRank[order[oi]] = oi;
    var path = []; for (var t = tgt; t !== -1; t = parent[t]) path.push(t); path.reverse();
    var totalSettled = order.length;

    function frame(s, showPath, status) {
      var current = s > 0 ? order[s - 1] : -1;
      return {
        rows: rows, cols: cols, w: w, maxW: 1 + rough, dist: g, settleRank: settleRank, src: src, tgt: tgt,
        path: path, settled: s, current: current, showPath: showPath, astar: totalSettled, dij: dijSettled,
        readout: [
          { label: showPath ? 'path cost' : 'settling', value: showPath ? g[tgt] : ('node ' + s) },
          { label: 'A* settled', value: s + ' / ' + N },
          { label: showPath ? 'vs Dijkstra' : 'cost so far', value: showPath ? (totalSettled + ' cells, Dijkstra ' + dijSettled) : (current >= 0 ? g[current] : 0) }
        ],
        annotation: status === 'start'
          ? 'A* orders the frontier by f = g + h: cost-so-far plus a heuristic guess of the cost left. The guess pulls the search toward the target (orange).'
          : (showPath
            ? 'Target reached at optimal cost ' + g[tgt] + ' — same as Dijkstra, but A* settled only ' + totalSettled + ' cells vs Dijkstra’s ' + dijSettled + '.'
            : 'Settled ' + s + ' cells, biased toward the target by the heuristic — far fewer than Dijkstra would by now.'),
        status: status
      };
    }

    yield frame(0, false, 'start');
    var STEPS = 70, stride = Math.max(1, Math.floor(totalSettled / STEPS));
    for (var ss = 1; ss <= totalSettled; ss++) if (ss % stride === 0 || ss === totalSettled) yield frame(ss, false, 'run');
    yield frame(totalSettled, true, 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var rows = snap.rows, cols = snap.cols, weight = snap.w, settleRank = snap.settleRank;
    if (!rows) return;
    var maxW = snap.maxW, settled = snap.settled, current = snap.current;
    var pathSet = null;
    if (snap.showPath) { pathSet = {}; for (var pi = 0; pi < snap.path.length; pi++) pathSet[snap.path[pi]] = true; }
    root.Algo.grid(ctx, { rows: rows, cols: cols, w: w, h: h }, function (x, y, cell, r, c) {
      var i = r * cols + c;
      ctx.fillStyle = theme.bg; ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = 0.10 + 0.55 * ((weight[i] - 1) / (maxW - 1 || 1));
      ctx.fillStyle = theme.muted; ctx.fillRect(x, y, cell, cell); ctx.globalAlpha = 1;
      var rank = settleRank[i];
      if (rank >= 0 && rank < settled) { ctx.globalAlpha = 0.34; ctx.fillStyle = theme.accent; ctx.fillRect(x, y, cell, cell); ctx.globalAlpha = 1; }
      if (i === current) { ctx.fillStyle = theme.accent; ctx.fillRect(x, y, cell, cell); }
      if (pathSet && pathSet[i]) { ctx.fillStyle = theme.invariant; ctx.fillRect(x, y, cell, cell); }
      if (i === snap.src) { ctx.fillStyle = theme.cost; ctx.fillRect(x, y, cell, cell); }
      if (i === snap.tgt) { ctx.fillStyle = theme.warn; ctx.fillRect(x, y, cell, cell); }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
