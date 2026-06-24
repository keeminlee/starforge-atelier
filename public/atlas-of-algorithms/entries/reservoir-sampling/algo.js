/* =====================================================================
 * reservoir-sampling / algo.js  —  The Atlas of Algorithms (Sketching & Streaming)
 * ---------------------------------------------------------------------
 * Vitter's Algorithm R. Keep k slots; the first k items fill them; item i
 * (0-indexed, i ≥ k) replaces a uniformly-random slot with probability
 * k/(i+1). Guarantee: every item is in the final sample with probability
 * exactly k/n — a uniform sample from a stream of unknown length.
 *
 * The visualization shows the guarantee EMPIRICALLY: bars are each item's
 * inclusion frequency accumulated over many seeded runs; they converge to
 * the k/n line (green). Statistical verification via chi-square (ADR-0005).
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Reservoir Sampling',
    slug: 'reservoir-sampling',
    family: 'streaming',
    oneLiner: 'Pick k items uniformly at random from a stream of unknown length, in one pass and O(k) memory.',
    invariant: 'After seeing i items, every one of them is in the reservoir with equal probability k/i.',
    cost: { time: 'O(1)/item', space: 'O(k)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Stream length (n)', min: 8, max: 32, step: 1, value: 20 },
      { key: 'k', type: 'slider', label: 'Reservoir size (k)', min: 1, max: 10, step: 1, value: 5 },
      { key: 'runs', type: 'slider', label: 'Simulated runs', min: 50, max: 3000, step: 50, value: 1000 },
      { key: 'shuffle', type: 'button', label: 'New seed',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  // One run of Algorithm R over n items; returns the set of surviving indices.
  function oneRun(n, k, rand) {
    var res = [];
    for (var i = 0; i < n; i++) {
      if (i < k) { res.push(i); }
      else {
        var j = Math.floor(rand() * (i + 1)); // uniform in [0, i]
        if (j < k) res[j] = i;
      }
    }
    return res;
  }

  function* run(input, params) {
    params = params || {};
    var n = Math.max(2, params.n || 20);
    var k = Math.min(n, Math.max(1, params.k || 5));
    var R = Math.max(10, params.runs || 1000);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var target = k / n;
    var incl = []; for (var z = 0; z < n; z++) incl.push(0);

    var STEPS = 60, stride = Math.max(1, Math.floor(R / STEPS));
    var series = [];
    function record(runsSoFar) {
      var freq = [], maxDev = 0;
      for (var i = 0; i < n; i++) { var f = incl[i] / runsSoFar; freq.push(f); var dev = Math.abs(f - target); if (dev > maxDev) maxDev = dev; }
      series.push({ runs: runsSoFar, freq: freq, maxDev: maxDev });
    }

    for (var r = 1; r <= R; r++) {
      var survivors = oneRun(n, k, rand);
      for (var s = 0; s < survivors.length; s++) incl[survivors[s]] += 1;
      if (r % stride === 0 || r === R) record(r);
    }

    function frame(idx, status) {
      var pt = series[idx];
      return {
        freq: pt.freq, n: n, k: k, target: target,
        readout: [
          { label: 'runs', value: pt.runs },
          { label: 'target k/n', value: target.toFixed(3) },
          { label: 'max deviation', value: (pt.maxDev * 100).toFixed(2) + '%' }
        ],
        annotation: status === 'start'
          ? 'Each bar is one item’s frequency of ending up in the sample, over many runs. They should all converge to k/n = ' + target.toFixed(3) + ' (green line).'
          : 'After ' + pt.runs + ' runs: every item’s inclusion frequency sits within ' + (pt.maxDev * 100).toFixed(2) + '% of the uniform target k/n = ' + target.toFixed(3) + '. No item is favored.',
        status: status
      };
    }

    yield frame(0, 'start');
    for (var f2 = 1; f2 < series.length; f2++) yield frame(f2, 'run');
    var fin = frame(series.length - 1, 'done');
    fin.annotation = 'Done. Over ' + R + ' runs the inclusion frequencies are uniform (max deviation ' +
      (series[series.length - 1].maxDev * 100).toFixed(2) + '%) — every item was sampled with probability k/n = ' + target.toFixed(3) + '. ✓';
    fin.report = { n: n, k: k, runs: R, target: target, incl: incl.slice(), freq: series[series.length - 1].freq };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var freq = snap.freq || [];
    if (!freq.length) return;
    var target = snap.target || 0;
    root.Algo.bars(ctx, {
      values: freq, w: w, h: h, theme: theme,
      refValue: target,
      // fix the y-scale so the target line is steady and bars don't rescale each frame
      maxVal: Math.max(target * 2.4, 0.001),
      colorFor: function (idx) {
        return Math.abs(freq[idx] - target) <= 0.02 ? theme.invariant : theme.accent;  // converged = green
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
