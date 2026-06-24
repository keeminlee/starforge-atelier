/* =====================================================================
 * selection-sort / algo.js  —  The Atlas of Algorithms
 * One source of truth (ADR-0001): this generator IS the algorithm.
 * Registration per ADR-0007. `run` is pure + DOM-free; `draw` only ctx.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Selection Sort',
    slug: 'selection-sort',
    family: 'sorting',
    oneLiner: 'Repeatedly find the smallest remaining value and move it to the front — the fewest swaps any sort can make.',
    invariant: 'The prefix a[0..i) holds the i smallest values, in order, each ≤ everything to its right.',
    cost: { time: 'Θ(n²)', space: 'O(1)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Size', min: 6, max: 60, step: 1, value: 22 },
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
    var n = Math.max(2, params.n || 22);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var a = [];
    for (var k = 0; k < n; k++) a.push(k + 1);
    if (params.dist === 'sorted') { /* ascending */ }
    else if (params.dist === 'reversed') { a.reverse(); }
    else if (params.dist === 'nearly') {
      var swaps = Math.max(1, Math.round(n * 0.12));
      for (var s = 0; s < swaps; s++) { var idx = Math.floor(rand() * (n - 1)); var t = a[idx]; a[idx] = a[idx + 1]; a[idx + 1] = t; }
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

    function snap(extra) {
      var base = { array: a.slice(), counters: { comparisons: comparisons, swaps: swaps } };
      for (var key in extra) { if (Object.prototype.hasOwnProperty.call(extra, key)) base[key] = extra[key]; }
      return base;
    }

    yield snap({
      highlight: { sorted: [0, 0] },
      annotation: 'Nothing is sorted yet. Each pass finds the smallest remaining value and locks it in at the front.',
      status: 'start'
    });

    for (var i = 0; i < n - 1; i++) {
      var minIdx = i;
      yield snap({
        highlight: { sorted: [0, i], min: minIdx, scan: i },
        annotation: 'Pass ' + (i + 1) + ': scan a[' + i + '..' + n + ') for the smallest. Candidate so far: a[' + minIdx + '] = ' + a[minIdx] + '.',
        status: 'select'
      });
      for (var j = i + 1; j < n; j++) {
        comparisons++;
        if (a[j] < a[minIdx]) minIdx = j;
        yield snap({
          highlight: { sorted: [0, i], min: minIdx, scan: j },
          annotation: 'Compare a[' + j + '] = ' + a[j] + ' against the smallest seen (a[' + minIdx + '] = ' + a[minIdx] + ').',
          status: 'scan'
        });
      }
      if (minIdx !== i) { var tmp = a[i]; a[i] = a[minIdx]; a[minIdx] = tmp; swaps++; }
      yield snap({
        highlight: { sorted: [0, i + 1], placed: i },
        annotation: 'Smallest is ' + a[i] + ' → place it at index ' + i + '. Now a[0..' + (i + 1) + ') holds the ' + (i + 1) + ' smallest values, sorted.',
        status: 'placed'
      });
    }

    yield snap({
      done: true,
      highlight: { sorted: [0, n] },
      annotation: 'Done — the whole array is sorted, in exactly ' + swaps + ' swaps (≤ n−1). ✓',
      status: 'done'
    });
  }

  function draw(ctx, snap, w, h, theme) {
    var a = snap.array || [];
    if (!a.length) return;
    var hl = snap.highlight || {};
    var sorted = hl.sorted || null;
    var scan = (hl.scan != null) ? hl.scan : null;
    var minIdx = (hl.min != null) ? hl.min : null;
    var placed = (hl.placed != null) ? hl.placed : null;

    root.Algo.bars(ctx, {
      values: a, w: w, h: h, theme: theme, sortedRange: sorted,
      colorFor: function (idx) {
        if (minIdx != null && idx === minIdx) return theme.warn;     // smallest found so far
        if (scan != null && idx === scan) return theme.accent;       // current scan position
        if (placed != null && idx === placed) return theme.invariant;
        if (sorted && idx >= sorted[0] && idx < sorted[1]) return theme.invariant;
        return theme.muted;
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
