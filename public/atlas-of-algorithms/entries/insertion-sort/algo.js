/* =====================================================================
 * insertion-sort / algo.js  —  The Atlas of Algorithms
 * ---------------------------------------------------------------------
 * The exemplar entry. One source of truth (ADR-0001): this generator IS
 * the algorithm; the page animates its trace and the headless test runs
 * the same code and asserts the invariant.
 *
 * REGISTRATION (ADR-0007): an entry file builds an `entry` object and
 * registers it on `globalThis.__ATLAS_ENTRY__` (and module.exports when
 * present) so BOTH the browser page (`Algo.mount(window.__ATLAS_ENTRY__)`)
 * and the Node harness (`await import()` then read the global) get the
 * same object. `run` is pure + DOM-free; `draw` only touches the ctx.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Insertion Sort',
    slug: 'insertion-sort',
    family: 'sorting',
    oneLiner: 'Build a sorted prefix one element at a time, sliding each new value back into its place — the way most people sort a hand of cards.',
    invariant: 'The prefix a[0..i) is always sorted.',
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

  /* Build the input array (values 1..n, so bar heights are clean and the
   * permutation check is trivial) deterministically from the params. The
   * "New input" button bumps `nonce`, which reseeds the PRNG. */
  function buildInput(params) {
    var n = Math.max(2, params.n || 22);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var a = [];
    for (var k = 0; k < n; k++) a.push(k + 1);

    if (params.dist === 'sorted') {
      /* leave ascending */
    } else if (params.dist === 'reversed') {
      a.reverse();
    } else if (params.dist === 'nearly') {
      var swaps = Math.max(1, Math.round(n * 0.12));
      for (var s = 0; s < swaps; s++) {
        var idx = Math.floor(rand() * (n - 1));
        var t = a[idx]; a[idx] = a[idx + 1]; a[idx + 1] = t;
      }
    } else { // 'random' — Fisher–Yates
      for (var i = n - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
    }
    return a;
  }

  /* The instrumented algorithm. Yields a plain-data snapshot after each
   * meaningful step; nothing here touches the DOM. */
  function* run(input, params) {
    params = params || {};
    var a = buildInput(params);
    var n = a.length;
    var comparisons = 0, shifts = 0;

    function snap(extra) {
      var base = { array: a.slice(), counters: { comparisons: comparisons, shifts: shifts } };
      for (var key in extra) { if (Object.prototype.hasOwnProperty.call(extra, key)) base[key] = extra[key]; }
      return base;
    }

    yield snap({
      highlight: { sorted: [0, 1] },
      annotation: 'A single element a[0..1) is trivially sorted. Grow that sorted prefix one step at a time.',
      status: 'start'
    });

    for (var i = 1; i < n; i++) {
      var keyVal = a[i];
      var j = i - 1;

      yield snap({
        highlight: { sorted: [0, i], key: i, compare: j >= 0 ? j : null },
        annotation: 'Lift a[' + i + '] = ' + keyVal + '. The prefix a[0..' + i + ') is sorted; slide ' + keyVal + ' left until it fits.',
        status: 'select'
      });

      while (j >= 0) {
        comparisons++;
        if (a[j] > keyVal) {
          a[j + 1] = a[j];     // shift the bigger value one slot right
          shifts++;
          j--;
          yield snap({
            highlight: { sorted: [0, i + 1], key: j + 1, compare: j >= 0 ? j : null },
            annotation: 'Bigger than ' + keyVal + ' → shift right. (' + comparisons + ' comparisons, ' + shifts + ' shifts so far.)',
            status: 'shift'
          });
        } else {
          yield snap({
            highlight: { sorted: [0, i + 1], key: j + 1, compare: j },
            annotation: 'a[' + j + '] = ' + a[j] + ' ≤ ' + keyVal + ' → ' + keyVal + ' belongs just after it, at index ' + (j + 1) + '.',
            status: 'place'
          });
          break;
        }
      }

      a[j + 1] = keyVal;       // drop the lifted value into the hole
      yield snap({
        highlight: { sorted: [0, i + 1], placed: j + 1 },
        annotation: 'Placed ' + keyVal + ' at index ' + (j + 1) + '. Now a[0..' + (i + 1) + ') is sorted.',
        status: 'placed'
      });
    }

    yield snap({
      done: true,
      highlight: { sorted: [0, n] },
      annotation: 'Done — the whole array a[0..' + n + ') is sorted. ✓',
      status: 'done'
    });
  }

  /* ---- Rendering: bars. Color carries meaning (see the design tokens):
   * invariant green = the sorted prefix, accent blue = the comparison,
   * warn orange = the element being inserted, muted = not yet touched. */
  function draw(ctx, snap, w, h, theme) {
    var a = snap.array || [];
    if (!a.length) return;
    var hl = snap.highlight || {};
    var sorted = hl.sorted || null;
    var keyIdx = (hl.key != null) ? hl.key : (hl.placed != null ? hl.placed : null);
    var compare = (hl.compare != null) ? hl.compare : null;

    root.Algo.bars(ctx, {
      values: a, w: w, h: h, theme: theme, sortedRange: sorted,
      colorFor: function (idx) {
        if (keyIdx != null && idx === keyIdx) return theme.warn;     // the lifted key
        if (compare != null && idx === compare) return theme.accent; // active comparison
        if (sorted && idx >= sorted[0] && idx < sorted[1]) return theme.invariant; // sorted prefix
        return theme.muted;
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };

  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
