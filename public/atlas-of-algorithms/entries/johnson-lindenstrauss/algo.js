/* =====================================================================
 * johnson-lindenstrauss / algo.js  —  The Atlas of Algorithms (Similarity)
 * ---------------------------------------------------------------------
 * The JL lemma: n points in high dimension D can be projected to
 * k = O(ε⁻² log n) dimensions by a random linear map so that EVERY pairwise
 * distance is preserved within a factor (1±ε), with high probability. The
 * map: a k×D matrix R of i.i.d. N(0,1), scaled by 1/√k; then ‖Rx‖ ≈ ‖x‖.
 *
 * Visualization: a calibration scatter — true distance (x) vs projected
 * distance (y) for every pair — hugging the diagonal inside a ±ε band.
 * Scrubbing increases k and the cloud tightens onto the diagonal. Uses
 * numlib's Gaussian (ADR-0006). Statistical verification (ADR-0005).
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var D = 80;  // source (high) dimension

  var metadata = {
    title: 'Johnson–Lindenstrauss',
    slug: 'johnson-lindenstrauss',
    family: 'similarity',
    oneLiner: 'Squash high-dimensional points into far fewer dimensions by random projection — and keep every pairwise distance almost exactly.',
    invariant: 'A random projection to k dims preserves each pairwise distance within (1±ε) with high probability; the cloud tightens onto the diagonal as k grows.',
    cost: { time: 'O(n·k·D) project', space: 'k×D matrix' },
    controls: [
      { key: 'points', type: 'slider', label: 'Points (n)', min: 8, max: 36, step: 2, value: 24 },
      { key: 'eps', type: 'slider', label: 'Tolerance ε', min: 5, max: 40, step: 1, value: 20 }, // percent
      { key: 'shuffle', type: 'button', label: 'New data',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(4, params.points || 24);
    var eps = (params.eps != null ? params.eps : 20) / 100;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var Num = root.Numlib;

    // n random points in D dims; all pairwise true distances.
    var pts = [];
    for (var i = 0; i < n; i++) pts.push(Num.gaussianVector(D, rng));
    var pairs = [];
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
      var diff = Num.axpy(pts[a], -1, pts[b]);
      pairs.push({ i: a, j: b, dTrue: Num.norm(diff) });
    }
    var maxTrue = 0; for (var p = 0; p < pairs.length; p++) maxTrue = Math.max(maxTrue, pairs[p].dTrue);

    // One projection matrix of kMax Gaussian rows; dimension-k projection uses
    // its first k rows (so growing k adds rows — a coherent animation).
    var kMax = Math.min(D, 64);
    var Rrows = [];
    for (var r = 0; r < kMax; r++) Rrows.push(Num.gaussianVector(D, rng));

    function project(k) {
      var inv = 1 / Math.sqrt(k);
      var proj = [];
      for (var idx = 0; idx < n; idx++) {
        var row = new Array(k);
        for (var rr = 0; rr < k; rr++) row[rr] = Num.dot(Rrows[rr], pts[idx]) * inv;
        proj.push(row);
      }
      return proj;
    }

    var kValues = [];
    for (var k = 2; k <= kMax; k += 2) kValues.push(k);

    function frame(k, status) {
      var proj = project(k);
      var pts2 = [];
      var within = 0, sumRatio = 0, sumSq = 0;
      for (var q = 0; q < pairs.length; q++) {
        var pr = pairs[q];
        var dp = Num.norm(Num.axpy(proj[pr.i], -1, proj[pr.j]));
        var ratio = pr.dTrue > 1e-12 ? dp / pr.dTrue : 1;
        if (Math.abs(ratio - 1) <= eps) within++;
        sumRatio += ratio; sumSq += ratio * ratio;
        pts2.push([pr.dTrue, dp]);
      }
      var m = pairs.length;
      var meanRatio = sumRatio / m;
      var stdRatio = Math.sqrt(Math.max(0, sumSq / m - meanRatio * meanRatio));
      var withinFrac = within / m;
      return {
        scatter: pts2, maxTrue: maxTrue, eps: eps, k: k, D: D, n: n,
        withinFrac: withinFrac, meanRatio: meanRatio, stdRatio: stdRatio, pairCount: m,
        readout: [
          { label: 'project D→k', value: D + ' → ' + k },
          { label: 'within ±' + Math.round(eps * 100) + '%', value: (withinFrac * 100).toFixed(0) + '% of pairs' },
          { label: 'mean ratio', value: meanRatio.toFixed(3) }
        ],
        annotation: status === 'start'
          ? 'Each dot is one pair of points: true distance (x) vs distance after projecting ' + D + '→' + k + ' dims (y). The diagonal is "perfectly preserved"; the dashed band is ±' + Math.round(eps * 100) + '%.'
          : 'Projected ' + D + ' → ' + k + ' dims: ' + (withinFrac * 100).toFixed(0) + '% of pairwise distances land within ±' + Math.round(eps * 100) + '%. More dimensions ⇒ the cloud tightens onto the diagonal.',
        status: status
      };
    }

    yield frame(kValues[0], 'start');
    for (var f = 1; f < kValues.length; f++) yield frame(kValues[f], f === kValues.length - 1 ? 'done' : 'run');
  }

  function draw(ctx, snap, w, h, theme) {
    var pts = snap.scatter || []; if (!pts.length) return;
    var eps = snap.eps, axisMax = (snap.maxTrue || 1) * 1.25;

    var padL = 52, padR = 18, padT = 16, padB = 34;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var x0 = padL, y0 = padT + plotH;
    function px(d) { return x0 + (d / axisMax) * plotW; }
    function py(d) { return y0 - (Math.min(d, axisMax) / axisMax) * plotH; }

    // axes
    ctx.save();
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.fillStyle = theme.muted;
    ctx.font = '12px ' + (theme.mono || 'monospace'); ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    ctx.beginPath(); ctx.moveTo(x0, padT); ctx.lineTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();
    ctx.fillText('proj', x0 - 8, padT + 8);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('true distance', x0 + plotW / 2, y0 + 10);
    ctx.restore();

    // ±ε band (dashed) + the perfect-preservation diagonal
    ctx.save();
    ctx.strokeStyle = theme.warn; ctx.lineWidth = 1.2; if (ctx.setLineDash) ctx.setLineDash([5, 5]);
    [1 + eps, 1 - eps].forEach(function (mlt) {
      ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(axisMax), py(axisMax * mlt)); ctx.stroke();
    });
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = theme.invariant; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(axisMax), py(axisMax)); ctx.stroke();
    ctx.restore();

    // points: green inside the band, orange (warn) outside
    for (var i = 0; i < pts.length; i++) {
      var dt = pts[i][0], dp = pts[i][1];
      var ratio = dt > 1e-12 ? dp / dt : 1;
      ctx.fillStyle = Math.abs(ratio - 1) <= eps ? theme.invariant : theme.warn;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(px(dt), py(dp), 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
