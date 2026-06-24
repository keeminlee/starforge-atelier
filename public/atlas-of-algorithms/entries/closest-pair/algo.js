/* =====================================================================
 * closest-pair / algo.js  —  The Atlas of Algorithms (Computational Geometry)
 * ---------------------------------------------------------------------
 * Closest pair of points by divide & conquer (Shamos–Hoey / Bentley). Sort
 * by x, split at the median, recurse on each half to get the smaller min
 * distance δ, then check the vertical strip of width 2δ around the split —
 * where, scanned in y-order, each point need only be compared to a constant
 * number of neighbors. O(n log n). One source of truth (ADR-0001); reg. 0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Closest Pair of Points',
    slug: 'closest-pair',
    family: 'geometry',
    oneLiner: 'Find the two nearest points among many in O(n log n) — divide the plane, then mind only a thin strip.',
    invariant: 'No pair straddling the split can be closer than δ without both points lying in the 2δ strip — so the strip scan misses nothing.',
    cost: { time: 'O(n log n)', space: 'O(n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Points', min: 8, max: 28, step: 2, value: 18 },
      { key: 'shuffle', type: 'button', label: 'New points',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(4, params.n || 18);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var P = [];
    for (var i = 0; i < n; i++) P.push({ x: 0.06 + rng() * 0.88, y: 0.10 + rng() * 0.80 });
    P.sort(function (a, b) { return a.x - b.x; });
    function dist(i, j) { var dx = P[i].x - P[j].x, dy = P[i].y - P[j].y; return Math.sqrt(dx * dx + dy * dy); }

    var comparisons = 0;
    function snap(hl, annotation, status) {
      return {
        points: P.map(function (p) { return [p.x, p.y]; }), n: n,
        range: hl.range || null, splitX: hl.splitX == null ? null : hl.splitX, delta: hl.delta == null ? null : hl.delta,
        strip: hl.strip || null, best: hl.best || null, checkPair: hl.checkPair || null,
        status: status, comparisons: comparisons,
        readout: [
          { label: 'points', value: n },
          { label: 'best distance', value: hl.delta != null ? hl.delta.toFixed(3) : '—' },
          { label: 'comparisons', value: comparisons }
        ],
        annotation: annotation
      };
    }

    function* rec(lo, hi, depth) {
      var k = hi - lo;
      if (k <= 3) {
        var best = { d: Infinity, a: -1, b: -1 };
        for (var i = lo; i < hi; i++) for (var j = i + 1; j < hi; j++) { comparisons++; var d = dist(i, j); if (d < best.d) best = { d: d, a: i, b: j }; }
        yield snap({ range: [lo, hi], delta: best.d, best: [best.a, best.b] }, 'Base case: ' + k + ' points — compare them all directly. Closest here: ' + best.d.toFixed(3) + '.', 'base');
        return best;
      }
      var mid = (lo + hi) >> 1, midX = P[mid].x;
      var Lb = yield* rec(lo, mid, depth + 1);
      var Rb = yield* rec(mid, hi, depth + 1);
      var best = Lb.d <= Rb.d ? Lb : Rb;
      yield snap({ range: [lo, hi], splitX: midX, delta: best.d, best: [best.a, best.b] },
        'Merged halves: the closer side gives δ = ' + best.d.toFixed(3) + '. Now a cross-split pair could still beat it — but only inside the strip within δ of the split line.', 'merge');

      // strip: points within δ of the split, scanned in y order
      var strip = [];
      for (var s = lo; s < hi; s++) if (Math.abs(P[s].x - midX) < best.d) strip.push(s);
      strip.sort(function (a, b) { return P[a].y - P[b].y; });
      if (strip.length > 1) yield snap({ range: [lo, hi], splitX: midX, delta: best.d, strip: strip.slice(), best: [best.a, best.b] }, 'The strip holds ' + strip.length + ' points within δ of the split. Sorted by y, each compares to only the next few — a packing argument caps it at a constant.', 'strip');

      for (var a2 = 0; a2 < strip.length; a2++) {
        for (var b2 = a2 + 1; b2 < strip.length && b2 <= a2 + 7; b2++) {
          var pi = strip[a2], pj = strip[b2];
          if (P[pj].y - P[pi].y >= best.d) break;     // too far in y: stop (the key bound)
          comparisons++;
          var dd = dist(pi, pj);
          if (dd < best.d) {
            best = { d: dd, a: pi, b: pj };
            yield snap({ range: [lo, hi], splitX: midX, delta: best.d, strip: strip.slice(), best: [best.a, best.b], checkPair: [pi, pj] }, 'A cross-strip pair is closer: δ ↓ ' + dd.toFixed(3) + '.', 'cross');
          }
        }
      }
      return best;
    }

    yield snap({}, 'Sort the points by x. Split at the median, solve each half, then reconcile across the dividing line.', 'start');
    var answer = yield* rec(0, n, 0);
    var fin = snap({ delta: answer.d, best: [answer.a, answer.b] }, 'Done. The closest pair is distance ' + answer.d.toFixed(3) + ' apart, found in ' + comparisons + ' distance checks — far fewer than the ' + (n * (n - 1) / 2) + ' a brute-force scan would need.', 'done');
    fin.report = { points: P.map(function (p) { return [p.x, p.y]; }), bestPair: [answer.a, answer.b], bestDist: answer.d };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var pts = snap.points, n = snap.n;
    var pad = 30, plotW = w - 2 * pad, plotH = h - 2 * pad;
    function X(x) { return pad + x * plotW; }
    function Y(y) { return pad + (1 - y) * plotH; }

    // strip band
    if (snap.splitX != null && snap.delta != null) {
      ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.10;
      ctx.fillRect(X(snap.splitX - snap.delta), pad, X(snap.splitX + snap.delta) - X(snap.splitX - snap.delta), plotH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(X(snap.splitX), pad); ctx.lineTo(X(snap.splitX), pad + plotH); ctx.stroke(); ctx.setLineDash([]);
    }

    // current check pair (blue line)
    if (snap.checkPair) {
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(pts[snap.checkPair[0]][0]), Y(pts[snap.checkPair[0]][1])); ctx.lineTo(X(pts[snap.checkPair[1]][0]), Y(pts[snap.checkPair[1]][1])); ctx.stroke();
    }
    // best pair (green line)
    if (snap.best && snap.best[0] >= 0) {
      ctx.strokeStyle = theme.invariant; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(pts[snap.best[0]][0]), Y(pts[snap.best[0]][1])); ctx.lineTo(X(pts[snap.best[1]][0]), Y(pts[snap.best[1]][1])); ctx.stroke();
    }

    // points
    var inStrip = {}; if (snap.strip) for (var s = 0; s < snap.strip.length; s++) inStrip[snap.strip[s]] = true;
    var inRange = function (i) { return !snap.range || (i >= snap.range[0] && i < snap.range[1]); };
    for (var i = 0; i < n; i++) {
      var active = inRange(i);
      ctx.fillStyle = inStrip[i] ? theme.accent : (active ? theme.ink : theme.muted);
      ctx.beginPath(); ctx.arc(X(pts[i][0]), Y(pts[i][1]), active ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // best pair endpoints on top
    if (snap.best && snap.best[0] >= 0) {
      ctx.fillStyle = theme.invariant;
      for (var e = 0; e < 2; e++) { ctx.beginPath(); ctx.arc(X(pts[snap.best[e]][0]), Y(pts[snap.best[e]][1]), 6, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
