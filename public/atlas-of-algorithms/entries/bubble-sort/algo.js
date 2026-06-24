/* =====================================================================
 * bubble-sort / algo.js  —  The Atlas of Algorithms
 * One source of truth (ADR-0001); registration per ADR-0007.
 * Uses the shared Algo.bars() renderer.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Bubble Sort',
    slug: 'bubble-sort',
    family: 'sorting',
    oneLiner: 'Sweep through the list swapping out-of-order neighbors; the largest value "bubbles" to the end each pass.',
    invariant: 'After pass k, the k largest values occupy their final sorted positions at the end.',
    cost: { time: 'O(n²)', space: 'O(1)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Size', min: 6, max: 60, step: 1, value: 22 },
      { key: 'dist', type: 'select', label: 'Initial order', value: 'random',
        options: [
          { value: 'random',   label: 'Random' },
          { value: 'sorted',   label: 'Already sorted (best)' },
          { value: 'reversed', label: 'Reversed (worst)' },
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
      highlight: { sorted: [n, n] },
      annotation: 'Sweep left to right, swapping any out-of-order neighbors. Each full pass floats the largest remaining value to the end.',
      status: 'start'
    });

    for (var end = n - 1; end > 0; end--) {
      var swappedThisPass = false;
      for (var j = 0; j < end; j++) {
        comparisons++;
        yield snap({
          highlight: { sorted: [end + 1, n], compare: [j, j + 1] },
          annotation: 'Compare neighbors a[' + j + '] = ' + a[j] + ' and a[' + (j + 1) + '] = ' + a[j + 1] + '.',
          status: 'compare'
        });
        if (a[j] > a[j + 1]) {
          var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;
          swaps++; swappedThisPass = true;
          yield snap({
            highlight: { sorted: [end + 1, n], compare: [j, j + 1] },
            annotation: 'Out of order → swap. The larger value moves one step right.',
            status: 'swap'
          });
        }
      }
      yield snap({
        highlight: { sorted: [end, n] },
        annotation: 'End of pass: a[' + end + '] is now the largest of the unsorted part and is locked in. Sorted tail = a[' + end + '..' + n + ').',
        status: 'pass-end'
      });
      if (!swappedThisPass) {
        yield snap({
          done: true,
          highlight: { sorted: [0, n] },
          annotation: 'A full pass made no swaps → everything is already in order. Early exit. ✓',
          status: 'early-exit'
        });
        return;
      }
    }

    yield snap({
      done: true,
      highlight: { sorted: [0, n] },
      annotation: 'Done — every value has bubbled to its place. ✓',
      status: 'done'
    });
  }

  function draw(ctx, snap, w, h, theme) {
    var a = snap.array || [];
    if (!a.length) return;
    var hl = snap.highlight || {};
    var sorted = hl.sorted || null;
    var pair = hl.compare || null;

    root.Algo.bars(ctx, {
      values: a, w: w, h: h, theme: theme, sortedRange: sorted,
      colorFor: function (idx) {
        if (pair && (idx === pair[0] || idx === pair[1])) {
          var larger = a[pair[0]] >= a[pair[1]] ? pair[0] : pair[1];
          return idx === larger ? theme.warn : theme.accent;   // larger bubbles right (warn), smaller (accent)
        }
        if (sorted && idx >= sorted[0] && idx < sorted[1]) return theme.invariant;  // sorted tail
        return theme.muted;
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
