/* =====================================================================
 * kruskal / algo.js  —  The Atlas of Algorithms (Graphs & Networks)
 * ---------------------------------------------------------------------
 * Kruskal's minimum spanning tree (1956). Sort the edges by weight and add
 * each one unless its endpoints are already connected — a cycle check done
 * in near-constant time with union–find. The greedy "cheapest safe edge"
 * rule yields a minimum-weight tree spanning every vertex. One source of
 * truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: "Kruskal's MST",
    slug: 'kruskal',
    family: 'graphs',
    oneLiner: 'Connect everything for the least total weight — add the cheapest edge that never makes a cycle.',
    invariant: 'The cut property: the lightest edge crossing any cut is safe, so greedily taking cheapest acyclic edges builds a minimum spanning tree.',
    cost: { time: 'O(E log E)', space: 'O(V + E)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Vertices', min: 6, max: 10, step: 1, value: 8 },
      { key: 'shuffle', type: 'button', label: 'New graph',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(4, params.n || 8);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var pos = []; for (var i = 0; i < n; i++) pos.push([Math.cos(2 * Math.PI * i / n - Math.PI / 2), Math.sin(2 * Math.PI * i / n - Math.PI / 2)]);

    // connected graph: random spanning tree (shuffled chain) + extra edges
    var perm = []; for (var p = 0; p < n; p++) perm.push(p);
    for (var s = n - 1; s > 0; s--) { var r = Math.floor(rng() * (s + 1)); var t = perm[s]; perm[s] = perm[r]; perm[r] = t; }
    var seen = {}, edges = [];
    function addEdge(a, b) { if (a === b) return; var key = Math.min(a, b) + '-' + Math.max(a, b); if (seen[key]) return; seen[key] = 1; edges.push({ u: a, v: b, w: 2 + Math.floor(rng() * 28) }); }
    for (var c = 1; c < n; c++) addEdge(perm[c], perm[Math.floor(rng() * c)]);   // spanning tree
    var extra = Math.round(n * 0.8);
    for (var e = 0; e < extra; e++) addEdge(Math.floor(rng() * n), Math.floor(rng() * n));
    edges.sort(function (a, b) { return a.w - b.w; });

    var parent = []; var rank = []; for (var z = 0; z < n; z++) { parent.push(z); rank.push(0); }
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { var ra = find(a), rb = find(b); if (ra === rb) return false; if (rank[ra] < rank[rb]) parent[ra] = rb; else if (rank[ra] > rank[rb]) parent[rb] = ra; else { parent[rb] = ra; rank[ra]++; } return true; }

    var status = edges.map(function () { return 'pending'; });
    function comps() { var c = []; for (var i = 0; i < n; i++) c.push(find(i)); return c; }
    function snap(cur, total, mstCount, annotation, st) {
      return {
        n: n, pos: pos, edges: edges.map(function (ed) { return { u: ed.u, v: ed.v, w: ed.w }; }), status: status.slice(),
        comp: comps(), current: cur, total: total, status_phase: st,
        readout: [
          { label: 'tree edges', value: mstCount + ' / ' + (n - 1) },
          { label: 'total weight', value: total },
          { label: st === 'done' ? 'components' : 'considering', value: st === 'done' ? new Set(comps()).size : (cur >= 0 ? 'edge w=' + edges[cur].w : '—') }
        ],
        annotation: annotation
      };
    }

    yield snap(-1, 0, 0, 'Sort all ' + edges.length + ' edges by weight. Walk them cheapest-first; take an edge only if it joins two so-far-separate pieces (no cycle), tracked with union–find.', 'start');

    var total = 0, mstCount = 0;
    for (var ei = 0; ei < edges.length && mstCount < n - 1; ei++) {
      var ed = edges[ei];
      var safe = find(ed.u) !== find(ed.v);
      if (safe) { union(ed.u, ed.v); status[ei] = 'accepted'; total += ed.w; mstCount++; }
      else { status[ei] = 'rejected'; }
      yield snap(ei, total, mstCount, 'Edge ' + ed.u + '–' + ed.v + ' (w=' + ed.w + '): ' + (safe ? 'endpoints were in different components → ADD it; merge them. Total ' + total + '.' : 'endpoints already connected → would make a cycle, SKIP.'), safe ? 'accept' : 'reject');
    }

    var fin = snap(-1, total, mstCount, 'Spanning tree complete: ' + mstCount + ' edges (n−1) connect all ' + n + ' vertices for minimum total weight ' + total + '. Every remaining edge would only have closed a cycle.', 'done');
    fin.report = { n: n, edges: edges.map(function (ed) { return { u: ed.u, v: ed.v, w: ed.w }; }), status: status.slice(), total: total, mstCount: mstCount, comp: comps() };
    yield fin;
  }

  function compColor(rootId, theme) { if (rootId == null) return theme.muted; return 'hsl(' + ((rootId * 67 + 20) % 360) + ', 60%, 60%)'; }

  function draw(ctx, snap, w, h, theme) {
    var pad = 56, pw = w - 2 * pad, ph = h - 2 * pad;
    function X(i) { return pad + (snap.pos[i][0] * 0.5 + 0.5) * pw; }
    function Y(i) { return pad + (snap.pos[i][1] * 0.5 + 0.5) * ph; }
    var r = 20;

    // edges
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var e = 0; e < snap.edges.length; e++) {
      var ed = snap.edges[e], st = snap.status[e];
      var x1 = X(ed.u), y1 = Y(ed.u), x2 = X(ed.v), y2 = Y(ed.v);
      var color = theme.grid, lw = 1.5, alpha = 0.5;
      if (st === 'accepted') { color = theme.invariant; lw = 4; alpha = 1; }
      if (st === 'rejected') { color = theme.warn; lw = 1.5; alpha = 0.28; }
      if (e === snap.current) { color = theme.accent; lw = 4; alpha = 1; }
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      if (st === 'rejected') { if (ctx.setLineDash) ctx.setLineDash([4, 4]); } ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // weight label
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.fillStyle = theme.bg; ctx.fillRect(mx - 11, my - 8, 22, 16);
      ctx.fillStyle = (e === snap.current) ? theme.accent : (st === 'accepted' ? theme.invariant : theme.muted);
      ctx.font = '600 12px ' + (theme.mono || 'monospace'); ctx.fillText(String(ed.w), mx, my);
    }

    // nodes (colored by component)
    for (var i = 0; i < snap.n; i++) {
      ctx.fillStyle = compColor(snap.comp[i], theme); ctx.strokeStyle = theme.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(i), Y(i), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = theme.bg; ctx.font = '600 14px ' + (theme.mono || 'monospace');
      ctx.fillText(String(i), X(i), Y(i) + 0.5);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
