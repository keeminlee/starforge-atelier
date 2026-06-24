/* =====================================================================
 * lsh / algo.js  —  The Atlas of Algorithms (Similarity & high-dim search)
 * ---------------------------------------------------------------------
 * Locality-sensitive hashing by BANDING (the MinHash-LSH scheme). Split an
 * m-row signature into b bands of r rows (m = b·r). Two items become
 * candidates if they agree on ALL r rows of at least one band. Since each
 * row matches with probability s = the Jaccard similarity, the probability
 * a pair is a candidate is the famous S-CURVE:
 *      P(candidate) = 1 − (1 − s^r)^b
 * with a sharp threshold near s* = (1/b)^(1/r). We simulate per-row matches
 * as Bernoulli(s) (faithful given MinHash's P[row match]=s) and show the
 * empirical collision rate converging onto the theoretical curve.
 *
 * Statistical verification (ADR-0005). One source of truth (ADR-0001);
 * registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Locality-Sensitive Hashing',
    slug: 'lsh',
    family: 'similarity',
    oneLiner: 'Bucket items so that similar ones collide and dissimilar ones don’t — turning nearest-neighbor search into a near-linear scan.',
    invariant: 'Banding makes the collision probability an S-curve, 1 − (1 − sʳ)ᵇ: similar pairs almost always collide, dissimilar pairs almost never.',
    cost: { time: 'O(b) per item', space: 'O(b) buckets' },
    controls: [
      { key: 'b', type: 'slider', label: 'Bands (b)', min: 2, max: 25, step: 1, value: 10 },
      { key: 'r', type: 'slider', label: 'Rows per band (r)', min: 1, max: 10, step: 1, value: 4 },
      { key: 'shuffle', type: 'button', label: 'New trials',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var b = Math.max(1, params.b || 10);
    var r = Math.max(1, params.r || 4);
    var m = b * r;
    var T = Math.max(50, params.trials || 1500);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var sValues = [];
    for (var i = 0; i <= 20; i++) sValues.push(i / 20);   // similarities 0,0.05,…,1
    var theory = sValues.map(function (s) { return 1 - Math.pow(1 - Math.pow(s, r), b); });
    var threshold = Math.pow(1 / b, 1 / r);

    // One trial at similarity s: m Bernoulli(s) row-matches, banded; candidate
    // iff some band has all r rows matching.
    function isCandidate(s) {
      for (var band = 0; band < b; band++) {
        var all = true;
        for (var row = 0; row < r; row++) { if (rand() >= s) { all = false; break; } }
        if (all) return true;
      }
      return false;
    }

    var collisions = sValues.map(function () { return 0; });
    var STEPS = 50, stride = Math.max(1, Math.floor(T / STEPS));
    var series = [];
    function record(done) { series.push({ trials: done, empirical: collisions.map(function (c) { return c / done; }) }); }

    for (var t = 1; t <= T; t++) {
      for (var si = 0; si < sValues.length; si++) if (isCandidate(sValues[si])) collisions[si] += 1;
      if (t % stride === 0 || t === T) record(t);
    }

    function frame(idx, status) {
      var pt = series[idx];
      return {
        sValues: sValues, theory: theory, empirical: pt.empirical, threshold: threshold,
        b: b, r: r, m: m, trials: pt.trials,
        readout: [
          { label: 'b × r = m', value: b + ' × ' + r + ' = ' + m },
          { label: 'threshold s*', value: threshold.toFixed(3) },
          { label: 'trials', value: pt.trials }
        ],
        annotation: status === 'start'
          ? 'Green curve: the theoretical collision probability 1 − (1 − sʳ)ᵇ. Dashed line: the threshold s* ≈ (1/b)^(1/r). Dots: the empirical rate, filling in.'
          : 'After ' + pt.trials + ' trials per point, the empirical collision rate (dots) tracks the S-curve. Below s* ≈ ' + threshold.toFixed(3) + ' pairs rarely collide; above it they almost always do.',
        status: status
      };
    }

    yield frame(0, 'start');
    for (var f = 1; f < series.length; f++) yield frame(f, f === series.length - 1 ? 'done' : 'run');
  }

  function draw(ctx, snap, w, h, theme) {
    var sVals = snap.sValues || []; if (!sVals.length) return;
    var theory = snap.theory, emp = snap.empirical, thr = snap.threshold;

    var padL = 48, padR = 18, padT = 16, padB = 34;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var x0 = padL, y0 = padT + plotH;
    function px(s) { return x0 + s * plotW; }
    function py(p) { return y0 - p * plotH; }

    // axes + gridlines at 0, 0.5, 1
    ctx.save();
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.fillStyle = theme.muted;
    ctx.font = '12px ' + (theme.mono || 'monospace'); ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    [0, 0.5, 1].forEach(function (p) { var y = py(p); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + plotW, y); ctx.stroke(); ctx.fillText(p.toFixed(1), x0 - 8, y); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [0, 0.5, 1].forEach(function (s) { ctx.fillText('s=' + s.toFixed(1), px(s), y0 + 8); });
    ctx.restore();

    // threshold line
    ctx.save();
    ctx.strokeStyle = theme.warn; ctx.lineWidth = 1.5; if (ctx.setLineDash) ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(px(thr), padT); ctx.lineTo(px(thr), y0); ctx.stroke();
    ctx.restore();

    // theoretical S-curve (smooth)
    ctx.save();
    ctx.strokeStyle = theme.invariant; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var k = 0; k <= 100; k++) {
      var s = k / 100;
      var p = 1 - Math.pow(1 - Math.pow(s, snap.r), snap.b);
      var X = px(s), Y = py(p);
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.restore();

    // empirical dots
    ctx.save();
    ctx.fillStyle = theme.accent;
    for (var i = 0; i < sVals.length; i++) {
      ctx.beginPath(); ctx.arc(px(sVals[i]), py(emp[i]), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
