/* =====================================================================
 * spectral-partitioning / algo.js  —  The Atlas of Algorithms (Spectral)
 * ---------------------------------------------------------------------
 * Cut a graph into two well-separated pieces using the Fiedler vector v₂.
 * Cheeger's "sweep" rounding: order the nodes by v₂, try every prefix as
 * one side, and keep the cut of minimum CONDUCTANCE φ(S) = cut(S,S̄) /
 * min(vol S, vol S̄). Cheeger's inequality bounds the result:
 *      λ₂/2  ≤  φ_G  ≤  √(2 λ₂)
 * so the spectral cut is provably near the best possible. Uses numlib
 * (ADR-0006). One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Spectral Partitioning',
    slug: 'spectral-partitioning',
    family: 'spectral',
    oneLiner: 'Split a graph into two balanced, weakly-connected halves by sweeping a cut along the Fiedler vector — provably near-optimal.',
    invariant: 'The best sweep-cut’s conductance φ obeys Cheeger’s inequality: λ₂/2 ≤ φ ≤ √(2λ₂).',
    cost: { time: 'Fiedler vector + O(n) sweep', space: 'O(n²) dense L' },
    controls: [
      { key: 'nodes', type: 'slider', label: 'Nodes', min: 12, max: 44, step: 2, value: 30 },
      { key: 'mixing', type: 'slider', label: 'Inter-cluster edges %', min: 1, max: 20, step: 1, value: 5 },
      { key: 'shuffle', type: 'button', label: 'New graph',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(8, params.nodes || 30);
    var pInter = (params.mixing != null ? params.mixing : 5) / 100;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var Num = root.Numlib;

    // Two planted communities (the cut should roughly recover them).
    var half = Math.floor(n / 2);
    var planted = []; for (var i = 0; i < n; i++) planted.push(i < half ? 0 : 1);

    var A = []; for (var r = 0; r < n; r++) { var row = new Array(n).fill(0); A.push(row); }
    function addEdge(u, v) { if (u !== v && !A[u][v]) { A[u][v] = 1; A[v][u] = 1; } }
    for (var b = 1; b < n; b++) if (planted[b] === planted[b - 1]) addEdge(b - 1, b); // connect each side
    addEdge(0, n - 1 < half ? 1 : half);                                              // one bridge
    addEdge(half - 1, half);
    var pIntra = 0.5;
    for (var u = 0; u < n; u++) for (var v = u + 1; v < n; v++) {
      var p = (planted[u] === planted[v]) ? pIntra : pInter;
      if (rng() < p) addEdge(u, v);
    }

    var edges = [];
    for (var a1 = 0; a1 < n; a1++) for (var a2 = a1 + 1; a2 < n; a2++) if (A[a1][a2]) edges.push([a1, a2]);
    var deg = A.map(function (row) { return row.reduce(function (s, x) { return s + x; }, 0); });
    var twoM = deg.reduce(function (s, x) { return s + x; }, 0);  // 2|E|

    // Cheeger's inequality is about the NORMALIZED Laplacian
    // L_norm = I − D^(−1/2) A D^(−1/2). Work with N = D^(−1/2) A D^(−1/2)
    // (eigenvalues ν ∈ [−1,1]; top ν=1 with eigenvector D^(1/2)1). Power-iterate
    // M = N + I (PSD, top = 2) deflated against that vector to get ν₂, then
    // μ₂ = 1 − ν₂ is L_norm's second eigenvalue; Cheeger: μ₂/2 ≤ φ ≤ √(2μ₂).
    var isq = deg.map(function (d) { return 1 / Math.sqrt(d || 1); });
    function Mv(x) {
      var y = new Array(n); for (var a = 0; a < n; a++) y[a] = isq[a] * x[a];   // D^(−1/2) x
      var o = new Array(n);
      for (var i = 0; i < n; i++) { var s = 0, row = A[i]; for (var j = 0; j < n; j++) if (row[j]) s += y[j]; o[i] = isq[i] * s + x[i]; }
      return o; // (N + I) x
    }
    var sqrtD = Num.normalize(deg.map(function (d) { return Math.sqrt(d); }));
    var pairs = Num.topEigenpairs(Mv, n, 2, { against: [sqrtD], rng: root.Algo.rng(seed ^ 0x9e3779b9), tol: 1e-11, maxIter: 4000 });
    var lambda2 = 2 - pairs[0].value;   // μ₂ = 1 − ν₂ = 2 − (1 + ν₂)
    // sweep/layout vectors: g = D^(−1/2) · (normalized-Laplacian eigenvector)
    var v2 = pairs[0].vector.map(function (val, i) { return val * isq[i]; });
    var v3 = pairs[1].vector.map(function (val, i) { return val * isq[i]; });
    var cheegerHi = Math.sqrt(2 * lambda2), cheegerLo = lambda2 / 2;

    // layout (spectral)
    function scaled(v) { var mx = 0; for (var t = 0; t < v.length; t++) mx = Math.max(mx, Math.abs(v[t])); mx = mx || 1; return v.map(function (x) { return x / mx; }); }
    var sx = scaled(v2), sy = scaled(v3);
    var pos = []; for (var d = 0; d < n; d++) pos.push([sx[d], sy[d]]);

    // Sweep cut along the Fiedler order.
    var order = v2.map(function (val, idx) { return idx; }).sort(function (a, c) { return v2[a] - v2[c]; });
    function conductanceOf(prefix) {
      var inA = new Array(n).fill(false);
      for (var z = 0; z < prefix; z++) inA[order[z]] = true;
      var cut = 0, volA = 0;
      for (var e = 0; e < edges.length; e++) { var eu = edges[e][0], ev = edges[e][1]; if (inA[eu] !== inA[ev]) cut++; }
      for (var g = 0; g < n; g++) if (inA[g]) volA += deg[g];
      var volB = twoM - volA;
      var denom = Math.min(volA, volB) || 1;
      return { cut: cut, phi: cut / denom, inA: inA };
    }

    var best = { phi: Infinity, prefix: 1 };
    for (var pfx = 1; pfx < n; pfx++) { var c = conductanceOf(pfx).phi; if (c < best.phi) { best.phi = c; best.prefix = pfx; } }

    function frame(prefix, status) {
      var cc = conductanceOf(prefix);
      var thr = prefix < n ? (sx[order[prefix - 1]] + sx[order[Math.min(prefix, n - 1)]]) / 2 : 1;
      return {
        pos: pos, edges: edges, inA: cc.inA, threshold: thr, n: n,
        phi: cc.phi, cut: cc.cut, best: best.phi, lambda2: lambda2, cheegerHi: cheegerHi, cheegerLo: cheegerLo,
        readout: [
          { label: 'conductance φ', value: cc.phi.toFixed(3) },
          { label: 'best φ*', value: best.phi.toFixed(3) },
          { label: 'Cheeger', value: cheegerLo.toFixed(3) + ' ≤ φ ≤ ' + cheegerHi.toFixed(3) }
        ],
        annotation: status === 'best'
          ? 'Best cut: conductance φ* = ' + best.phi.toFixed(3) + ', inside Cheeger’s bounds λ₂/2 = ' + cheegerLo.toFixed(3) + ' ≤ φ ≤ √(2λ₂) = ' + cheegerHi.toFixed(3) + '. The spectral cut is provably near-optimal. ✓'
          : 'Sweep the cut along the Fiedler order (vertical line). This split has ' + cc.cut + ' cut edges, conductance φ = ' + cc.phi.toFixed(3) + '. Best so far φ* = ' + best.phi.toFixed(3) + '.',
        status: status
      };
    }

    yield frame(1, 'start');
    for (var s2 = 2; s2 < n; s2++) yield frame(s2, 'run');
    yield frame(best.prefix, 'best');   // settle on the optimal sweep cut
  }

  function draw(ctx, snap, w, h, theme) {
    var pos = snap.pos, edges = snap.edges, inA = snap.inA; if (!pos) return;
    var n = snap.n;
    var pad = 36, R = Math.min(w, h) / 2 - pad, cx = w / 2, cy = h / 2;
    function X(i) { return cx + pos[i][0] * R; }
    function Y(i) { return cy + pos[i][1] * R; }

    // edges: cut edges (crossing the partition) bright orange, others faint
    for (var e = 0; e < edges.length; e++) {
      var u = edges[e][0], v = edges[e][1], cut = inA[u] !== inA[v];
      ctx.save();
      ctx.strokeStyle = cut ? theme.warn : theme.grid;
      ctx.globalAlpha = cut ? 0.95 : 0.4; ctx.lineWidth = cut ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(X(u), Y(u)); ctx.lineTo(X(v), Y(v)); ctx.stroke();
      ctx.restore();
    }
    // sweep line (vertical at threshold on the v₂ axis)
    var lineX = cx + snap.threshold * R;
    ctx.save();
    ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.5; if (ctx.setLineDash) ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(lineX, pad); ctx.lineTo(lineX, h - pad); ctx.stroke();
    ctx.restore();
    // nodes colored by side
    var rad = Math.max(4, Math.min(9, 220 / n));
    for (var m = 0; m < n; m++) {
      ctx.fillStyle = inA[m] ? theme.accent : theme.cost;
      ctx.strokeStyle = theme.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(m), Y(m), rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
