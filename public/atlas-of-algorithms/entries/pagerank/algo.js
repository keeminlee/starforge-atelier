/* =====================================================================
 * pagerank / algo.js  —  The Atlas of Algorithms (Spectral Graph Theory)
 * ---------------------------------------------------------------------
 * PageRank: the importance of a page is the long-run fraction of time a
 * "random surfer" spends there — following a random out-link with prob d
 * (damping) and teleporting to a random page with prob 1−d. That stationary
 * distribution is the dominant eigenvector of the Google matrix, found here
 * by power iteration. One source of truth (ADR-0001); registration ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'PageRank',
    slug: 'pagerank',
    family: 'spectral',
    oneLiner: 'Rank pages by where a random web surfer spends its time — the dominant eigenvector of the link graph.',
    invariant: 'The rank vector is the stationary distribution of the random surfer: it sums to 1 and is unchanged by one more step (P·r = r).',
    cost: { time: 'O(edges) per iteration', space: 'O(nodes + edges)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Pages', min: 6, max: 12, step: 1, value: 9 },
      { key: 'damping', type: 'slider', label: 'Damping % (d)', min: 50, max: 95, step: 5, value: 85 },
      { key: 'shuffle', type: 'button', label: 'New graph',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var N = Math.max(4, params.n || 9);
    var d = (params.damping != null ? params.damping : 85) / 100;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    // directed graph; out-links biased toward low indices ⇒ a few hubs emerge.
    var adj = []; for (var i = 0; i < N; i++) adj.push([]);
    for (var u = 0; u < N; u++) {
      var outdeg = 1 + Math.floor(rng() * 3);
      var seen = {};
      for (var e = 0; e < outdeg; e++) {
        var v = Math.floor(Math.pow(rng(), 1.8) * N);   // bias toward small index (popular)
        if (v !== u && !seen[v]) { seen[v] = true; adj[u].push(v); }
      }
    }
    var edges = []; for (var a = 0; a < N; a++) for (var b = 0; b < adj[a].length; b++) edges.push([a, adj[a][b]]);

    function step(r) {
      var out = new Array(N), dangling = 0;
      for (var i2 = 0; i2 < N; i2++) out[i2] = (1 - d) / N;     // teleport baseline
      for (var j = 0; j < N; j++) {
        if (adj[j].length === 0) { dangling += r[j]; continue; }
        var share = d * r[j] / adj[j].length;
        for (var t = 0; t < adj[j].length; t++) out[adj[j][t]] += share;
      }
      for (var k = 0; k < N; k++) out[k] += d * dangling / N;   // dangling mass spread uniformly
      return out;
    }

    // circular layout
    var pos = []; for (var p = 0; p < N; p++) pos.push([Math.cos(2 * Math.PI * p / N - Math.PI / 2), Math.sin(2 * Math.PI * p / N - Math.PI / 2)]);

    function snap(r, iter, res, status, annotation) {
      var top = 0; for (var i = 1; i < N; i++) if (r[i] > r[top]) top = i;
      return {
        N: N, pos: pos, edges: edges, ranks: r.slice(), top: top, iter: iter, d: d,
        readout: [
          { label: 'pages', value: N },
          { label: 'iteration', value: iter },
          { label: 'top page', value: '#' + top + ' (' + (r[top] * 100).toFixed(1) + '%)' }
        ],
        annotation: annotation, status: status
      };
    }

    // Iterate to genuine convergence; the final rank vector is what the test
    // checks, while only a sample of iterations are animated.
    var uniform = new Array(N).fill(1 / N);
    var history = [{ r: uniform.slice(), iter: 0, res: 1 }];
    var r = uniform.slice();
    for (var it = 1; it <= 200; it++) {
      var nx = step(r), res = 0; for (var q = 0; q < N; q++) res += Math.abs(nx[q] - r[q]);
      r = nx; history.push({ r: r.slice(), iter: it, res: res });
      if (res < 1e-9) break;
    }

    yield snap(history[0].r, 0, 1, 'start', 'Every page starts equally important (rank 1/n). A random surfer follows links with probability ' + (d * 100) + '% and teleports otherwise; iterate until the ranks stop changing.');
    var STEPS = 38, stride = Math.max(1, Math.floor(history.length / STEPS));
    for (var k = 1; k < history.length - 1; k++) {
      if (k % stride !== 0) continue;
      var hk = history[k];
      yield snap(hk.r, hk.iter, hk.res, 'run', 'Iteration ' + hk.iter + ': redistribute each page\'s rank along its out-links (+ teleport). Total change this step: ' + hk.res.toFixed(4) + '.');
    }
    var last = history[history.length - 1];
    var topF = 0; for (var i2 = 1; i2 < N; i2++) if (last.r[i2] > last.r[topF]) topF = i2;
    yield snap(last.r, last.iter, last.res, 'done', 'Converged after ' + last.iter + ' iterations. Ranks are stationary — one more surfing step leaves them unchanged (P·r = r), and they sum to 1. Bigger node = more important page; #' + topF + ' wins.');
  }

  function draw(ctx, snap, w, h, theme) {
    var N = snap.N, pos = snap.pos, ranks = snap.ranks; if (!N) return;
    var pad = 60, R = Math.min(w, h) / 2 - pad, cx = w / 2, cy = h / 2;
    function X(i) { return cx + pos[i][0] * R; }
    function Y(i) { return cy + pos[i][1] * R; }
    var maxR = Math.max.apply(null, ranks), top = snap.top;
    function rad(i) { return 9 + 34 * Math.sqrt(ranks[i] / (maxR || 1)); }

    // edges with arrowheads
    ctx.save(); ctx.strokeStyle = theme.line || theme.grid; ctx.fillStyle = theme.line || theme.grid; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
    for (var e = 0; e < snap.edges.length; e++) {
      var s = snap.edges[e][0], t = snap.edges[e][1];
      var x1 = X(s), y1 = Y(s), x2 = X(t), y2 = Y(t);
      var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      var rs = rad(s), rt = rad(t);
      var ax = x1 + dx * rs, ay = y1 + dy * rs, bx = x2 - dx * rt, by = y2 - dy * rt;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      // arrowhead
      var ah = 7, perpx = -dy, perpy = dx;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - dx * ah + perpx * ah * 0.5, by - dy * ah + perpy * ah * 0.5); ctx.lineTo(bx - dx * ah - perpx * ah * 0.5, by - dy * ah - perpy * ah * 0.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // nodes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < N; i++) {
      var rr = rad(i);
      ctx.fillStyle = (i === top) ? theme.invariant : theme.accent;
      ctx.strokeStyle = theme.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(i), Y(i), rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = theme.bg; ctx.font = '600 ' + Math.max(9, rr * 0.55) + 'px ' + (theme.mono || 'monospace');
      ctx.fillText(String(i), X(i), Y(i) + 0.5);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
