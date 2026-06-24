/* =====================================================================
 * max-flow / algo.js  —  The Atlas of Algorithms (Optimization & Flows)
 * ---------------------------------------------------------------------
 * Maximum flow by Edmonds–Karp (BFS-augmenting Ford–Fulkerson). Repeatedly
 * find a shortest augmenting path from source to sink in the RESIDUAL graph
 * and push its bottleneck capacity, until none remains. By the max-flow /
 * min-cut theorem the final flow value equals the capacity of the minimum
 * s–t cut. One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var N = 6, S = 0, T = 5;
  var POS = [[0.07, 0.5], [0.37, 0.24], [0.37, 0.76], [0.66, 0.24], [0.66, 0.76], [0.93, 0.5]];
  var EDGES = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 5], [4, 5]];

  var metadata = {
    title: 'Maximum Flow (Edmonds–Karp)',
    slug: 'max-flow',
    family: 'optimization',
    oneLiner: 'Push as much as possible from source to sink — and discover the bottleneck cut that limits it.',
    invariant: 'Max-flow = min-cut: the final flow value equals the capacity of the smallest set of edges whose removal disconnects source from sink.',
    cost: { time: 'O(V·E²)', space: 'O(V + E)' },
    controls: [
      { key: 'shuffle', type: 'button', label: 'New capacities',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var cap = []; for (var i = 0; i < N; i++) { cap.push([]); for (var j = 0; j < N; j++) cap[i].push(0); }
    var flow = []; for (var i2 = 0; i2 < N; i2++) { flow.push([]); for (var j2 = 0; j2 < N; j2++) flow[i2].push(0); }
    for (var e = 0; e < EDGES.length; e++) cap[EDGES[e][0]][EDGES[e][1]] = 3 + Math.floor(rng() * 7);

    function resid(u, v) { return cap[u][v] - flow[u][v]; }
    function edgesView() { return EDGES.map(function (ed) { return { u: ed[0], v: ed[1], cap: cap[ed[0]][ed[1]], flow: flow[ed[0]][ed[1]] }; }); }
    function outflow() { var f = 0; for (var v = 0; v < N; v++) f += flow[S][v]; return f; }

    function snap(hl, annotation, status) {
      return {
        nodes: POS, edges: edgesView(), src: S, sink: T,
        path: hl.path || null, bottleneck: hl.bottleneck == null ? null : hl.bottleneck,
        cutSet: hl.cutSet || null, cutEdges: hl.cutEdges || null, maxflow: outflow(),
        status: status,
        readout: [
          { label: 'flow value', value: outflow() },
          { label: 'augmenting paths', value: hl.paths == null ? 0 : hl.paths },
          { label: status === 'done' ? 'min cut' : 'phase', value: status === 'done' ? hl.cutCap : (status === 'augment' ? 'push ' + hl.bottleneck : 'search') }
        ],
        annotation: annotation
      };
    }

    yield snap({ paths: 0 }, 'Find the most flow from source S to sink T without exceeding any edge\'s capacity. Repeatedly search for a path with spare capacity and push as much as it allows.', 'start');

    function bfs() {
      var parent = []; for (var i = 0; i < N; i++) parent.push(-1);
      parent[S] = S; var q = [S];
      while (q.length) {
        var u = q.shift();
        for (var v = 0; v < N; v++) if (parent[v] < 0 && resid(u, v) > 0) { parent[v] = u; if (v === T) return parent; q.push(v); }
      }
      return null;
    }

    var paths = 0;
    while (true) {
      var parent = bfs();
      if (!parent) break;
      // reconstruct path + bottleneck
      var path = [], b = Infinity, cur = T;
      while (cur !== S) { var p = parent[cur]; path.unshift(cur); b = Math.min(b, resid(p, cur)); cur = p; }
      path.unshift(S);
      paths++;
      yield snap({ path: path.slice(), bottleneck: b, paths: paths }, 'Augmenting path ' + path.join(' → ') + ' has spare capacity all along it; its bottleneck is ' + b + '. Push ' + b + ' unit' + (b === 1 ? '' : 's') + ' of flow.', 'path');
      for (var k = 0; k + 1 < path.length; k++) { var a = path[k], c = path[k + 1]; flow[a][c] += b; flow[c][a] -= b; }
      yield snap({ path: path.slice(), bottleneck: b, paths: paths }, 'Flow is now ' + outflow() + '. Some edges along the path may be saturated (flow = capacity); search again.', 'augment');
    }

    // min cut: nodes reachable from S in the residual graph
    var reach = []; for (var i = 0; i < N; i++) reach.push(false);
    reach[S] = true; var stack = [S];
    while (stack.length) { var u2 = stack.pop(); for (var v2 = 0; v2 < N; v2++) if (!reach[v2] && resid(u2, v2) > 0) { reach[v2] = true; stack.push(v2); } }
    var cutEdges = [], cutCap = 0;
    for (var e2 = 0; e2 < EDGES.length; e2++) { var uu = EDGES[e2][0], vv = EDGES[e2][1]; if (reach[uu] && !reach[vv]) { cutEdges.push([uu, vv]); cutCap += cap[uu][vv]; } }

    var fin = snap({ cutSet: reach.slice(), cutEdges: cutEdges.slice(), cutCap: cutCap, paths: paths }, 'No augmenting path remains, so the flow is maximum: ' + outflow() + '. The reachable set from S marks the minimum cut — its ' + cutEdges.length + ' saturated edge' + (cutEdges.length === 1 ? '' : 's') + ' have total capacity ' + cutCap + ', exactly the max flow. Max-flow = min-cut.', 'done');
    fin.report = { edges: edgesView(), maxflow: outflow(), cutSet: reach.slice(), cutEdges: cutEdges.slice(), cutCap: cutCap, cap: cap.map(function (r) { return r.slice(); }) };
    yield fin;
  }

  function arrow(ctx, x1, y1, x2, y2, r1, r2, color, lw) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    var ax = x1 + dx * r1, ay = y1 + dy * r1, bx = x2 - dx * r2, by = y2 - dy * r2;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    var ah = 9;
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.lineTo(bx - dx * ah - dy * ah * 0.5, by - dy * ah + dx * ah * 0.5);
    ctx.lineTo(bx - dx * ah + dy * ah * 0.5, by - dy * ah - dx * ah * 0.5);
    ctx.closePath(); ctx.fill();
    return [(ax + bx) / 2, (ay + by) / 2];
  }

  function draw(ctx, snap, w, h, theme) {
    var pad = 50, pw = w - 2 * pad, ph = h - 2 * pad;
    function X(i) { return pad + snap.nodes[i][0] * pw; }
    function Y(i) { return pad + snap.nodes[i][1] * ph; }
    var r = 22;
    var onPath = {}; if (snap.path) for (var p = 0; p + 1 < snap.path.length; p++) onPath[snap.path[p] + '-' + snap.path[p + 1]] = true;
    var cutKey = {}; if (snap.cutEdges) for (var c = 0; c < snap.cutEdges.length; c++) cutKey[snap.cutEdges[c][0] + '-' + snap.cutEdges[c][1]] = true;

    // edges
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var e = 0; e < snap.edges.length; e++) {
      var ed = snap.edges[e], key = ed.u + '-' + ed.v;
      var sat = ed.flow >= ed.cap && ed.cap > 0;
      var color = theme.grid, lw = 2;
      if (ed.flow > 0) { color = theme.accent; }
      if (sat) { color = theme.cost; }
      if (cutKey[key]) { color = theme.warn; lw = 3.5; }
      if (onPath[key]) { color = theme.invariant; lw = 4; }
      var mid = arrow(ctx, X(ed.u), Y(ed.u), X(ed.v), Y(ed.v), r, r, color, lw);
      // label flow/cap
      ctx.font = '600 13px ' + (theme.mono || 'monospace');
      var lx = mid[0], ly = mid[1] - 12;
      ctx.fillStyle = theme.bg; ctx.fillRect(lx - 18, ly - 9, 36, 18);
      ctx.fillStyle = (ed.flow > 0 ? theme.ink : theme.muted);
      ctx.fillText(ed.flow + '/' + ed.cap, lx, ly);
    }

    // nodes
    for (var i = 0; i < snap.nodes.length; i++) {
      var inCut = snap.cutSet ? snap.cutSet[i] : false;
      var fill = theme.panel_2 || theme.panel;
      if (i === snap.src) fill = theme.invariant;
      else if (i === snap.sink) fill = theme.warn;
      else if (snap.cutSet) fill = inCut ? theme.accent : (theme.panel_2 || theme.panel);
      ctx.fillStyle = fill; ctx.strokeStyle = theme.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(i), Y(i), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = (i === snap.src || i === snap.sink || (snap.cutSet && inCut)) ? theme.bg : theme.ink;
      ctx.font = '600 15px ' + (theme.mono || 'monospace');
      ctx.fillText(i === snap.src ? 'S' : i === snap.sink ? 'T' : String(i), X(i), Y(i) + 0.5);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
