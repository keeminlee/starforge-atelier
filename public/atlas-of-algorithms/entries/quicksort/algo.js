/* =====================================================================
 * quicksort / algo.js  —  The Atlas of Algorithms
 * Recursive quicksort with Lomuto partition (pivot = last element).
 * One source of truth (ADR-0001); registration per ADR-0007; Algo.bars().
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Quicksort',
    slug: 'quicksort',
    family: 'sorting',
    oneLiner: 'Pick a pivot, shove everything smaller to its left and larger to its right, then recurse — fast on average, in place.',
    invariant: 'After a partition, the pivot sits in its final sorted position: everything left is ≤ it, everything right is ≥ it.',
    cost: { time: 'Θ(n log n) avg' , space: 'O(log n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Size', min: 6, max: 56, step: 1, value: 24 },
      { key: 'dist', type: 'select', label: 'Initial order', value: 'random',
        options: [
          { value: 'random',   label: 'Random' },
          { value: 'sorted',   label: 'Already sorted (worst)' },
          { value: 'reversed', label: 'Reversed (worst)' },
          { value: 'nearly',   label: 'Nearly sorted' }
        ] },
      { key: 'shuffle', type: 'button', label: 'New input',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function buildInput(params) {
    var n = Math.max(2, params.n || 24);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var a = [];
    for (var k = 0; k < n; k++) a.push(k + 1);
    if (params.dist === 'sorted') { /* ascending */ }
    else if (params.dist === 'reversed') { a.reverse(); }
    else if (params.dist === 'nearly') {
      var sw = Math.max(1, Math.round(n * 0.12));
      for (var s = 0; s < sw; s++) { var idx = Math.floor(rand() * (n - 1)); var t = a[idx]; a[idx] = a[idx + 1]; a[idx + 1] = t; }
    } else {
      for (var i = n - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    }
    return a;
  }

  function* run(input, params) {
    params = params || {};
    var a = buildInput(params);
    var n = a.length;
    var comparisons = 0, swaps = 0;
    var placed = [];
    for (var p = 0; p < n; p++) placed.push(false);   // final-position flags (the invariant)

    function snap(hl, annotation, status) {
      hl = hl || {};
      hl.placedMask = placed.slice();
      return { array: a.slice(), counters: { comparisons: comparisons, swaps: swaps }, highlight: hl, annotation: annotation, status: status };
    }

    function* qsort(lo, hi) {
      if (lo > hi) return;
      if (lo === hi) {
        placed[lo] = true;
        yield snap({ range: [lo, hi] }, 'A single element a[' + lo + '] is trivially in place.', 'base');
        return;
      }
      var pivot = a[hi];
      var i = lo;
      yield snap({ range: [lo, hi], pivot: hi, i: i, j: lo },
        'Partition a[' + lo + '..' + hi + '] around the pivot a[' + hi + '] = ' + pivot + '.', 'partition-start');
      for (var j = lo; j < hi; j++) {
        comparisons++;
        yield snap({ range: [lo, hi], pivot: hi, i: i, j: j },
          'Is a[' + j + '] = ' + a[j] + ' ≤ pivot ' + pivot + '?', 'scan');
        if (a[j] <= pivot) {
          if (i !== j) { var t = a[i]; a[i] = a[j]; a[j] = t; swaps++; }
          i++;
          yield snap({ range: [lo, hi], pivot: hi, i: i, j: j },
            'Yes → swap it into the ≤-pivot region, now a[' + lo + '..' + i + ').', 'swap');
        }
      }
      if (i !== hi) { var t2 = a[i]; a[i] = a[hi]; a[hi] = t2; swaps++; }
      placed[i] = true;
      yield snap({ range: [lo, hi], pivot: i, i: i },
        'Pivot ' + pivot + ' drops into index ' + i + ' — its final sorted position. Left ≤ pivot ≤ right.', 'pivot-placed');
      yield* qsort(lo, i - 1);
      yield* qsort(i + 1, hi);
    }

    yield snap({}, 'Quicksort: choose a pivot, partition the rest around it, then recurse on each side.', 'start');
    yield* qsort(0, n - 1);
    yield snap({ range: [0, n - 1] }, 'Done — every pivot found its place; the array is sorted. ✓', 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var a = snap.array || [];
    if (!a.length) return;
    var hl = snap.highlight || {};
    var mask = hl.placedMask || null;
    var range = hl.range || null;
    var pivot = (hl.pivot != null) ? hl.pivot : null;
    var jScan = (hl.j != null) ? hl.j : null;
    var iBound = (hl.i != null) ? hl.i : null;

    root.Algo.bars(ctx, {
      values: a, w: w, h: h, theme: theme,
      colorFor: function (idx) {
        if (mask && mask[idx]) return theme.invariant;                       // locked in final position
        if (pivot != null && idx === pivot) return theme.warn;               // the pivot
        if (jScan != null && idx === jScan) return theme.accent;             // the scan cursor
        if (range && iBound != null && idx >= range[0] && idx < iBound) return theme.cost;  // ≤-pivot region
        if (range && idx >= range[0] && idx <= range[1]) return theme.ink;   // active window, in play
        return theme.muted;                                                  // dormant
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
