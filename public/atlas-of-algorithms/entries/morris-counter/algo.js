/* =====================================================================
 * morris-counter / algo.js  —  The Atlas of Algorithms (Sketching & Streaming)
 * ---------------------------------------------------------------------
 * The GUARANTEE-LENS exemplar (ADR-0005). Morris's approximate counter
 * (1978): store a small exponent X; on each increment bump X with
 * probability 2^(-X); estimate the true count as 2^X − 1. The stored
 * value is a RANDOM VARIABLE with E[2^X − 1] = n (exactly unbiased) but
 * large per-run variance — so the *mean* of many counters tracks the
 * truth while individuals scatter. The visualization shows exactly that.
 *
 * One source of truth (ADR-0001): this `run` is the real algorithm; the
 * headless test runs it across many seeded trials and asserts the
 * theorem's bound statistically. Registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Morris Counter',
    slug: 'morris-counter',
    family: 'streaming',
    oneLiner: 'Count to a billion in a byte — approximately. Store log log n bits and accept a random, but unbiased, estimate.',
    invariant: 'The estimate is a random variable, but E[2^X − 1] = n exactly: averaged over many counters, it tracks the true count.',
    cost: { time: 'O(1)/update', space: 'O(log log n) bits' },
    controls: [
      { key: 'n', type: 'slider', label: 'Stream length (n)', min: 100, max: 4000, step: 100, value: 1500 },
      { key: 'counters', type: 'slider', label: 'Parallel counters', min: 1, max: 64, step: 1, value: 16 },
      { key: 'shuffle', type: 'button', label: 'New run',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var N = Math.max(10, params.n || 1500);
    var m = Math.max(1, params.counters || 16);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var X = [];
    for (var c = 0; c < m; c++) X.push(0);

    // Record sampled points of the run; each point keeps the per-counter
    // estimates, their mean, and the spread. The full series is shared by
    // reference across frames (immutable once built) — frames differ only
    // in `upto`, so playback scrubs cheaply.
    var STEPS = 64;
    var stride = Math.max(1, Math.floor(N / STEPS));
    var series = [];
    var yMax = 1;

    function estimates() {
      var e = [];
      for (var c = 0; c < m; c++) { var v = Math.pow(2, X[c]) - 1; e.push(v); if (v > yMax) yMax = v; }
      return e;
    }
    function record(t) {
      var e = estimates();
      var sum = 0, lo = Infinity, hi = -Infinity;
      for (var c = 0; c < m; c++) { sum += e[c]; if (e[c] < lo) lo = e[c]; if (e[c] > hi) hi = e[c]; }
      series.push({ t: t, est: e, mean: sum / m, lo: lo, hi: hi });
    }

    record(0);
    for (var t = 1; t <= N; t++) {
      for (var ci = 0; ci < m; ci++) {
        if (rand() < Math.pow(2, -X[ci])) X[ci]++;
      }
      if (t % stride === 0 || t === N) record(t);
    }
    // Fix the y-scale at a multiple of n so the truth line sits mid-height and the
    // mean/spread fill the frame; rare high outliers clip at the top (handled by py()).
    yMax = N * 1.9;

    var maxX = 0; for (var d = 0; d < m; d++) if (X[d] > maxX) maxX = X[d];
    var bitsExact = Math.ceil(Math.log2(N + 1));
    var bitsMorris = Math.max(1, Math.ceil(Math.log2(maxX + 1)));

    function frame(k, status) {
      var pt = series[k - 1];
      var relErr = pt.t > 0 ? Math.abs(pt.mean - pt.t) / pt.t : 0;
      return {
        series: series, upto: k, N: N, m: m, yMax: yMax,
        readout: [
          { label: 'true n', value: pt.t },
          { label: 'estimate (mean of ' + m + ')', value: Math.round(pt.mean) },
          { label: 'rel. error', value: (relErr * 100).toFixed(1) + '%' },
          { label: 'bits', value: bitsExact + ' → ' + bitsMorris }
        ],
        annotation: status === 'start'
          ? 'Each of the ' + m + ' counters stores a tiny exponent X and bumps it only with probability 2^−X. The estimate is 2^X − 1.'
          : 'At true count ' + pt.t + ': the mean estimate is ' + Math.round(pt.mean) + ' (' + (relErr * 100).toFixed(1) + '% off). Individual counters (faint) scatter; their mean (blue) hugs the truth (green).',
        status: status
      };
    }

    yield frame(1, 'start');
    for (var k = 2; k <= series.length; k++) yield frame(k, 'run');
    // Final emphasis frame.
    var lastFrame = frame(series.length, 'done');
    lastFrame.annotation = 'Done. With ' + m + ' counters the mean estimate landed within ' +
      (Math.abs(series[series.length - 1].mean - N) / N * 100).toFixed(1) + '% of n = ' + N +
      ', using ' + bitsMorris + ' bits per counter instead of ' + bitsExact + '. Unbiased, not exact. ✓';
    yield lastFrame;
  }

  function draw(ctx, snap, w, h, theme) {
    var series = snap.series || [];
    var upto = snap.upto || 0;
    var N = snap.N || 1;
    var m = snap.m || 1;
    var yMax = snap.yMax || N;
    if (!series.length || upto < 1) return;

    var padL = 52, padR = 16, padT = 16, padB = 30;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var x0 = padL, y0 = padT + plotH;

    function px(t) { return x0 + (t / N) * plotW; }
    function py(v) { return y0 - (Math.min(v, yMax) / yMax) * plotH; }

    // axes
    ctx.save();
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, padT); ctx.lineTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();
    // y-axis labels (0, yMax) and the n marker
    ctx.fillStyle = theme.muted; ctx.font = '12px ' + (theme.mono || 'monospace');
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('0', x0 - 8, y0);
    ctx.fillText(String(Math.round(yMax)), x0 - 8, padT + 6);
    ctx.restore();

    // truth line y = t (the ideal the mean should track)
    ctx.save();
    ctx.strokeStyle = theme.invariant; ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(N), py(N)); ctx.stroke();
    ctx.restore();

    // individual counter trajectories (faint) — show the spread
    ctx.save();
    ctx.strokeStyle = theme.muted; ctx.globalAlpha = Math.max(0.12, Math.min(0.5, 6 / m)); ctx.lineWidth = 1;
    for (var c = 0; c < m; c++) {
      ctx.beginPath();
      for (var k = 0; k < upto; k++) {
        var p = series[k];
        var X = px(p.t), Y = py(p.est[c]);
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // mean trajectory (bold) — the unbiased estimator
    ctx.save();
    ctx.strokeStyle = theme.accent; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var k2 = 0; k2 < upto; k2++) {
      var p2 = series[k2];
      var Xx = px(p2.t), Yy = py(p2.mean);
      if (k2 === 0) ctx.moveTo(Xx, Yy); else ctx.lineTo(Xx, Yy);
    }
    ctx.stroke();
    // current point dot
    var cur = series[upto - 1];
    ctx.fillStyle = theme.accent;
    ctx.beginPath(); ctx.arc(px(cur.t), py(cur.mean), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
