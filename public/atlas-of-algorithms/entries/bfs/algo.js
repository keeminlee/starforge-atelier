/* =====================================================================
 * bfs / algo.js  —  The Atlas of Algorithms (Graphs)
 * ---------------------------------------------------------------------
 * Breadth-first search on a 4-connected grid with walls. BFS explores in
 * concentric distance layers (the "wave"); the first time a cell is
 * reached is along a shortest path, so backtracking parent pointers from
 * the target yields a shortest path in an unweighted graph.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Breadth-First Search',
    slug: 'bfs',
    family: 'graphs',
    oneLiner: 'Flood a grid in expanding waves; the first time the wave touches a cell, it has arrived by a shortest path.',
    invariant: 'When BFS first reaches a cell, its recorded distance is the true shortest-path distance from the source.',
    cost: { time: 'O(V + E)', space: 'O(V)' },
    controls: [
      { key: 'cols', type: 'slider', label: 'Grid width', min: 12, max: 36, step: 2, value: 26 },
      { key: 'walls', type: 'slider', label: 'Wall density %', min: 0, max: 40, step: 2, value: 26 },
      { key: 'shuffle', type: 'button', label: 'New maze',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var cols = Math.max(8, params.cols || 26);
    var rows = Math.max(6, Math.round(cols * 0.58));
    var p = (params.walls != null ? params.walls : 26) / 100;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var N = rows * cols;
    function idx(r, c) { return r * cols + c; }

    var src = idx(1, 1), tgt = idx(rows - 2, cols - 2);
    var wall = new Array(N);
    for (var i = 0; i < N; i++) wall[i] = rng() < p;
    // Carve a guaranteed monotone path src→tgt so the target is always reachable.
    var sr = 1, sc = 1, tr = rows - 2, tc = cols - 2;
    var cr = sr, cc = sc;
    wall[idx(cr, cc)] = false;
    while (cr !== tr || cc !== tc) {
      if (cr < tr && cc < tc) { if (rng() < 0.5) cr++; else cc++; }
      else if (cr < tr) cr++;
      else cc++;
      wall[idx(cr, cc)] = false;
    }
    wall[src] = false; wall[tgt] = false;

    // BFS
    var dist = new Array(N).fill(-1);
    var parent = new Array(N).fill(-1);
    var q = [src]; dist[src] = 0;
    var head = 0;
    while (head < q.length) {
      var cur = q[head++];
      var r = Math.floor(cur / cols), c = cur % cols;
      var nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (var k = 0; k < 4; k++) {
        var nr = nb[k][0], nc = nb[k][1];
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        var ni = idx(nr, nc);
        if (wall[ni] || dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1; parent[ni] = cur; q.push(ni);
      }
    }

    var maxLayer = dist[tgt];           // shortest-path distance (≥0; path guaranteed)
    var path = [];
    for (var t = tgt; t !== -1; t = parent[t]) path.push(t);
    path.reverse();

    function visitedCount(layer) { var n = 0; for (var z = 0; z < N; z++) if (dist[z] >= 0 && dist[z] <= layer) n++; return n; }

    function frame(layer, showPath, status) {
      var frontier = 0; for (var z = 0; z < N; z++) if (dist[z] === layer) frontier++;
      return {
        rows: rows, cols: cols, wall: wall, dist: dist, src: src, tgt: tgt, path: path,
        layer: layer, showPath: showPath, maxLayer: maxLayer,
        readout: [
          { label: showPath ? 'shortest path' : 'wave distance', value: showPath ? (maxLayer + ' steps') : layer },
          { label: 'cells reached', value: visitedCount(layer) },
          { label: showPath ? 'path length' : 'frontier', value: showPath ? path.length : frontier }
        ],
        annotation: status === 'start'
          ? 'BFS floods outward from the source (purple) one distance-layer at a time. The first wave to touch the target (orange) arrives by a shortest path.'
          : (showPath
            ? 'Target reached at distance ' + maxLayer + '. Backtracking parent pointers gives a shortest path (green) of ' + maxLayer + ' steps.'
            : 'Wave at distance ' + layer + ': every blue cell is exactly ' + layer + ' steps from the source. Reached ' + visitedCount(layer) + ' cells.'),
        status: status
      };
    }

    yield frame(0, false, 'start');
    for (var L = 1; L <= maxLayer; L++) yield frame(L, false, 'run');
    yield frame(maxLayer, true, 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var rows = snap.rows, cols = snap.cols, wall = snap.wall, dist = snap.dist;
    if (!rows) return;
    var layer = snap.layer, maxLayer = snap.maxLayer || 1;
    var pathSet = null;
    if (snap.showPath) { pathSet = {}; for (var pi = 0; pi < snap.path.length; pi++) pathSet[snap.path[pi]] = true; }

    root.Algo.grid(ctx, { rows: rows, cols: cols, w: w, h: h }, function (x, y, cell, r, c) {
      var i = r * cols + c;
      var fill = theme.panel, alpha = 1;
      if (wall[i]) { fill = theme.bg; }
      else if (i === snap.src) { fill = theme.cost; }
      else if (i === snap.tgt) { fill = theme.warn; }
      else if (pathSet && pathSet[i]) { fill = theme.invariant; }
      else if (dist[i] >= 0 && dist[i] === layer) { fill = theme.accent; }                 // frontier
      else if (dist[i] >= 0 && dist[i] < layer) { fill = theme.accent; alpha = 0.18 + 0.32 * (dist[i] / maxLayer); } // visited (faded by distance)
      ctx.globalAlpha = alpha; ctx.fillStyle = fill;
      ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = 1;
      if (wall[i]) { ctx.strokeStyle = theme.panel; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1); }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
