/* =====================================================================
 * dijkstra / algo.js  —  The Atlas of Algorithms (Graphs)
 * ---------------------------------------------------------------------
 * Dijkstra's algorithm on a weighted grid (each cell has a movement/terrain
 * cost ≥ 1). Settle nodes in increasing tentative-distance order; once a
 * node is popped it is final, because all weights are ≥ 0. Unlike BFS, the
 * settled region grows by COST, not hops — it bulges through cheap terrain.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Dijkstra’s Algorithm',
    slug: 'dijkstra',
    family: 'graphs',
    oneLiner: 'Find the cheapest route through weighted terrain by always settling the nearest unfinished node next.',
    invariant: 'When a node is settled (popped with the smallest tentative distance), its distance is final — because every edge weight is ≥ 0.',
    cost: { time: 'O((V+E) log V)', space: 'O(V)' },
    controls: [
      { key: 'cols', type: 'slider', label: 'Grid width', min: 12, max: 32, step: 2, value: 24 },
      { key: 'roughness', type: 'slider', label: 'Terrain roughness', min: 1, max: 9, step: 1, value: 6 },
      { key: 'shuffle', type: 'button', label: 'New terrain',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var cols = Math.max(8, params.cols || 24);
    var rows = Math.max(6, Math.round(cols * 0.6));
    var rough = (params.roughness != null ? params.roughness : 6);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var N = rows * cols;
    function idx(r, c) { return r * cols + c; }

    // Smooth terrain weights 1..maxW (random field + box-blur ⇒ valleys & ridges).
    var maxW = 1 + rough;
    var field = new Array(N); for (var i = 0; i < N; i++) field[i] = rng();
    for (var pass = 0; pass < 2; pass++) {
      var nf = field.slice();
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var s = 0, cnt = 0;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          s += field[idx(rr, cc)]; cnt++;
        }
        nf[idx(r, c)] = s / cnt;
      }
      field = nf;
    }
    var w = field.map(function (v) { return 1 + Math.round(v * (maxW - 1)); });

    var src = idx(1, 1), tgt = idx(rows - 2, cols - 2);

    // Dijkstra (O(V²) — fine for a grid this size).
    var dist = new Array(N).fill(Infinity), parent = new Array(N).fill(-1), done = new Array(N).fill(false);
    dist[src] = 0;
    var order = [];
    while (true) {
      var u = -1, best = Infinity;
      for (var z = 0; z < N; z++) if (!done[z] && dist[z] < best) { best = dist[z]; u = z; }
      if (u === -1) break;
      done[u] = true; order.push(u);
      if (u === tgt) break;
      var ur = Math.floor(u / cols), uc = u % cols;
      var nb = [[ur - 1, uc], [ur + 1, uc], [ur, uc - 1], [ur, uc + 1]];
      for (var k = 0; k < 4; k++) {
        var nr = nb[k][0], nc = nb[k][1]; if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        var ni = idx(nr, nc);
        if (done[ni]) continue;
        var nd = dist[u] + w[ni];   // cost to ENTER cell ni
        if (nd < dist[ni]) { dist[ni] = nd; parent[ni] = u; }
      }
    }

    var settleRank = new Array(N).fill(-1);
    for (var oi = 0; oi < order.length; oi++) settleRank[order[oi]] = oi;
    var path = []; for (var t = tgt; t !== -1; t = parent[t]) path.push(t); path.reverse();
    var totalSettled = order.length;

    function frame(s, showPath, status) {
      var current = s > 0 ? order[s - 1] : -1;
      return {
        rows: rows, cols: cols, w: w, maxW: maxW, dist: dist, settleRank: settleRank, src: src, tgt: tgt,
        path: path, settled: s, current: current, showPath: showPath,
        readout: [
          { label: showPath ? 'path cost' : 'settling', value: showPath ? dist[tgt] : ('node ' + s) },
          { label: 'settled', value: s + ' / ' + N },
          { label: showPath ? 'path cells' : 'frontier dist', value: showPath ? path.length : (current >= 0 ? dist[current] : 0) }
        ],
        annotation: status === 'start'
          ? 'Each cell has a terrain cost (lighter = pricier). Dijkstra settles the cheapest-to-reach cell next; the settled region grows by cost, not by steps.'
          : (showPath
            ? 'Target settled at total cost ' + dist[tgt] + '. Backtracking parents gives the cheapest path (green) — not the fewest cells, the least total cost.'
            : 'Settled ' + s + ' cells; the newest (bright) is the closest unfinished cell, distance ' + dist[current] + '. Its distance is now final.'),
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
      // terrain base: darker = cheap, lighter = expensive
      ctx.fillStyle = theme.bg; ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = 0.10 + 0.55 * ((weight[i] - 1) / (maxW - 1 || 1));
      ctx.fillStyle = theme.muted; ctx.fillRect(x, y, cell, cell); ctx.globalAlpha = 1;
      // settled overlay
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
