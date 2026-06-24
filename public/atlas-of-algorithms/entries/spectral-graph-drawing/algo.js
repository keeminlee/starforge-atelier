/* =====================================================================
 * spectral-graph-drawing / algo.js  —  The Atlas of Algorithms (Spectral)
 * ---------------------------------------------------------------------
 * Lay out a graph using the eigenvectors of its Laplacian L = D − A. The
 * smallest nonzero eigenvectors (Fiedler v₂ and the next v₃) give each node
 * a coordinate; plotting node i at (v₂[i], v₃[i]) pulls densely-connected
 * communities into separated blobs — found purely from the spectrum, with
 * no knowledge of the clusters. (Colors show the planted truth; positions
 * are unsupervised.) Uses numlib (ADR-0006). Animation morphs nodes from a
 * circle into the spectral layout.
 *
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Spectral Graph Drawing',
    slug: 'spectral-graph-drawing',
    family: 'spectral',
    oneLiner: 'Draw a graph using its Laplacian’s eigenvectors as coordinates — and watch hidden communities fall into place.',
    invariant: 'Placing node i at (Fiedler v₂[i], v₃[i]) minimizes the stretch of edges; tightly-connected nodes land near each other.',
    cost: { time: 'eigenvectors of L', space: 'O(n²) dense L' },
    controls: [
      { key: 'nodes', type: 'slider', label: 'Nodes', min: 12, max: 48, step: 3, value: 36 },
      { key: 'clusters', type: 'slider', label: 'Communities', min: 2, max: 5, step: 1, value: 3 },
      { key: 'shuffle', type: 'button', label: 'New graph',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(6, params.nodes || 36);
    var C = Math.max(2, Math.min(5, params.clusters || 3));
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var Num = root.Numlib;

    var cluster = [];
    for (var i = 0; i < n; i++) cluster.push(Math.floor(i * C / n));

    var A = [];
    for (var r = 0; r < n; r++) { var row = new Array(n); for (var q = 0; q < n; q++) row[q] = 0; A.push(row); }
    function addEdge(u, v) { if (u !== v && !A[u][v]) { A[u][v] = 1; A[v][u] = 1; } }

    // Backbone (guarantees a connected graph ⇒ λ₂ > 0): a path within each
    // community, plus one bridge between consecutive communities.
    for (var b = 1; b < n; b++) if (cluster[b] === cluster[b - 1]) addEdge(b - 1, b);
    var starts = []; for (var c = 0; c < C; c++) starts.push(Math.floor(c * n / C));
    for (var cc = 1; cc < C; cc++) addEdge(starts[cc - 1], starts[cc]);

    // Stochastic block model on top: dense within, sparse between.
    var pIntra = 0.45, pInter = 0.025;
    for (var u = 0; u < n; u++) for (var v = u + 1; v < n; v++) {
      var p = (cluster[u] === cluster[v]) ? pIntra : pInter;
      if (rand() < p) addEdge(u, v);
    }

    var edges = [];
    for (var a1 = 0; a1 < n; a1++) for (var a2 = a1 + 1; a2 < n; a2++) if (A[a1][a2]) edges.push([a1, a2]);

    var deg = A.map(function (row) { return row.reduce(function (s, x) { return s + x; }, 0); });
    var maxDeg = Math.max.apply(null, deg);
    var cShift = 2 * maxDeg + 1;
    var L = A.map(function (row, ii) { return row.map(function (x, jj) { return ii === jj ? deg[ii] : -x; }); });
    function Mv(x) { var o = new Array(n); for (var k = 0; k < n; k++) o[k] = cShift * x[k] - Num.dot(L[k], x); return o; }
    var ones = Num.normalize(new Array(n).fill(1));

    var pairs = Num.topEigenpairs(Mv, n, 2, { against: [ones], rng: root.Algo.rng(seed ^ 0x9e3779b9), tol: 1e-11, maxIter: 4000 });
    var v2 = pairs[0].vector, v3 = pairs[1].vector;
    var lambda2 = cShift - pairs[0].value;

    function scaled(v) { var mx = 0; for (var t = 0; t < v.length; t++) mx = Math.max(mx, Math.abs(v[t])); mx = mx || 1; return v.map(function (x) { return x / mx; }); }
    var sx = scaled(v2), sy = scaled(v3);
    var spectral = [], circle = [];
    for (var d = 0; d < n; d++) { spectral.push([sx[d], sy[d]]); circle.push([Math.cos(2 * Math.PI * d / n), Math.sin(2 * Math.PI * d / n)]); }

    function frame(t, status) {
      return {
        circle: circle, spectral: spectral, edges: edges, cluster: cluster, n: n, C: C, t: t,
        readout: [
          { label: 'nodes', value: n },
          { label: 'communities', value: C },
          { label: 'edges', value: edges.length },
          { label: 'λ₂ (connectivity)', value: lambda2.toFixed(3) }
        ],
        annotation: status === 'start'
          ? 'The nodes start on a circle, hiding their structure. Watch them relax to (Fiedler v₂, v₃) coordinates from the Laplacian spectrum.'
          : (status === 'done'
            ? 'Settled. The communities (colors) separate into blobs — recovered purely from the Laplacian’s eigenvectors, using no labels. λ₂ = ' + lambda2.toFixed(3) + '.'
            : 'Relaxing into the spectral layout: edges pull connected nodes together, so dense communities collapse to the same region.'),
        status: status
      };
    }

    var STEPS = 48;
    yield frame(0, 'start');
    for (var s2 = 1; s2 < STEPS; s2++) yield frame(s2 / STEPS, 'run');
    yield frame(1, 'done');
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function draw(ctx, snap, w, h, theme) {
    var circle = snap.circle, spectral = snap.spectral, edges = snap.edges, cluster = snap.cluster;
    if (!circle) return;
    var n = snap.n;
    var palette = [theme.accent, theme.invariant, theme.warn, theme.cost, theme.ink];
    var e = easeInOut(snap.t);

    var pad = 36;
    var R = Math.min(w, h) / 2 - pad;
    var cx = w / 2, cy = h / 2;
    var pos = [];
    for (var i = 0; i < n; i++) {
      var x = circle[i][0] + (spectral[i][0] - circle[i][0]) * e;
      var y = circle[i][1] + (spectral[i][1] - circle[i][1]) * e;
      pos.push([cx + x * R, cy + y * R]);
    }

    // edges (faint), then nodes (colored by community)
    ctx.save();
    ctx.strokeStyle = theme.grid; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    for (var k = 0; k < edges.length; k++) {
      var a = pos[edges[k][0]], b = pos[edges[k][1]];
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();

    var rad = Math.max(4, Math.min(9, 220 / n));
    for (var m = 0; m < n; m++) {
      ctx.fillStyle = palette[cluster[m] % palette.length];
      ctx.strokeStyle = theme.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pos[m][0], pos[m][1], rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
