/* =====================================================================
 * merge-sort / algo.js  —  The Atlas of Algorithms
 * Bottom-up merge sort. One source of truth (ADR-0001); registration
 * per ADR-0007; rendering via the shared Algo.bars().
 *
 * Display model (no ghosts): during a merge of two runs, the snapshot's
 * array shows  merged-so-far ++ left-remaining ++ right-remaining  in the
 * active segment, so every frame is a true permutation of the input — the
 * sorted green prefix grows while the two colored run-tails are consumed.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Merge Sort',
    slug: 'merge-sort',
    family: 'sorting',
    oneLiner: 'Split into runs, then merge sorted runs into longer sorted runs — guaranteed n log n, and stable.',
    invariant: 'Every run of the current width is internally sorted; merging two sorted runs yields one sorted run.',
    cost: { time: 'Θ(n log n)', space: 'O(n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Size', min: 6, max: 56, step: 1, value: 24 },
      { key: 'dist', type: 'select', label: 'Initial order', value: 'random',
        options: [
          { value: 'random',   label: 'Random' },
          { value: 'sorted',   label: 'Already sorted' },
          { value: 'reversed', label: 'Reversed' },
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
    var comparisons = 0, writes = 0;

    // A display snapshot during a merge: active segment shows
    // merged ++ left[i:] ++ right[j:].
    function mergeSnap(lo, hi, left, right, i, j, merged, annotation, status) {
      var disp = a.slice();
      var seg = merged.concat(left.slice(i)).concat(right.slice(j));
      for (var t = 0; t < seg.length; t++) disp[lo + t] = seg[t];
      var k = lo + merged.length;
      var leftEnd = k + (left.length - i);
      return {
        array: disp,
        counters: { comparisons: comparisons, writes: writes },
        highlight: { segment: [lo, hi], merged: [lo, k], leftRun: [k, leftEnd], rightRun: [leftEnd, hi] },
        annotation: annotation, status: status
      };
    }

    yield {
      array: a.slice(), counters: { comparisons: 0, writes: 0 },
      highlight: { runs: 1 },
      annotation: 'Start: treat each element as a sorted run of length 1. Repeatedly merge adjacent runs, doubling the run width each pass.',
      status: 'start'
    };

    for (var width = 1; width < n; width *= 2) {
      for (var lo = 0; lo < n; lo += 2 * width) {
        var mid = Math.min(lo + width, n);
        var hi = Math.min(lo + 2 * width, n);
        if (mid >= hi) continue;                 // lone run at the tail: already sorted

        var left = a.slice(lo, mid);
        var right = a.slice(mid, hi);
        var i = 0, j = 0, merged = [];

        yield mergeSnap(lo, hi, left, right, i, j, merged,
          'Merge the sorted runs a[' + lo + '..' + mid + ') and a[' + mid + '..' + hi + ').', 'merge-start');

        while (i < left.length && j < right.length) {
          comparisons++;
          var pick;
          if (left[i] <= right[j]) { pick = left[i]; merged.push(left[i]); i++; }
          else { pick = right[j]; merged.push(right[j]); j++; }
          writes++;
          yield mergeSnap(lo, hi, left, right, i, j, merged,
            'Compare the run fronts; take the smaller → ' + pick + '.', 'merge');
        }
        while (i < left.length) { merged.push(left[i]); i++; writes++; yield mergeSnap(lo, hi, left, right, i, j, merged, 'Right run is empty; copy the rest of the left run.', 'merge'); }
        while (j < right.length) { merged.push(right[j]); j++; writes++; yield mergeSnap(lo, hi, left, right, i, j, merged, 'Left run is empty; copy the rest of the right run.', 'merge'); }

        for (var c = 0; c < merged.length; c++) a[lo + c] = merged[c];  // commit
        yield {
          array: a.slice(), counters: { comparisons: comparisons, writes: writes },
          highlight: { segment: [lo, hi], merged: [lo, hi] },
          annotation: 'a[' + lo + '..' + hi + ') is now one sorted run of width ' + (hi - lo) + '.',
          status: 'merged'
        };
      }
    }

    yield {
      array: a.slice(), counters: { comparisons: comparisons, writes: writes },
      highlight: { segment: [0, n], merged: [0, n] },
      annotation: 'Done — a single sorted run spans the whole array, in Θ(n log n) comparisons. ✓',
      status: 'done'
    };
  }

  function draw(ctx, snap, w, h, theme) {
    var a = snap.array || [];
    if (!a.length) return;
    var hl = snap.highlight || {};
    var merged = hl.merged || null;
    var leftRun = hl.leftRun || null;
    var rightRun = hl.rightRun || null;
    var runs = hl.runs || null;
    var inRange = function (idx, r) { return r && idx >= r[0] && idx < r[1]; };

    root.Algo.bars(ctx, {
      values: a, w: w, h: h, theme: theme,
      sortedRange: hl.segment || null,
      colorFor: function (idx) {
        if (inRange(idx, merged)) return theme.invariant;     // merged / sorted output
        if (inRange(idx, leftRun)) return theme.accent;       // left run, still to merge
        if (inRange(idx, rightRun)) return theme.cost;        // right run, still to merge
        if (runs) return (Math.floor(idx / runs) % 2 === 0) ? theme.muted : theme.ink;  // width-1 runs
        return theme.muted;
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
