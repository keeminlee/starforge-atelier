/* =====================================================================
 * binary-search / algo.js  —  The Atlas of Algorithms (Searching family)
 * One source of truth (ADR-0001); registration per ADR-0007; Algo.bars().
 * The array is sorted ascending (binary search requires it); the dashed
 * line marks the target value.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Binary Search',
    slug: 'binary-search',
    family: 'searching',
    oneLiner: 'Halve a sorted array each step: compare the middle, then throw away the half that cannot contain the target.',
    invariant: 'If the target is present, it is always inside the live window [lo, hi].',
    cost: { time: 'Θ(log n)', space: 'O(1)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Size', min: 6, max: 56, step: 1, value: 24 },
      { key: 'target', type: 'slider', label: 'Target', min: 1, max: 113, step: 1, value: 30 },
      { key: 'shuffle', type: 'button', label: 'New target',
        onClick: function (api) {
          var p = api.getParams();
          var rng = root.Algo.rng(((p.nonce || 0) + 1) * 2654435761 >>> 0);
          api.setParam('nonce', (p.nonce || 0) + 1);
          api.setParam('target', 1 + Math.floor(rng() * (2 * p.n)));
        } }
    ]
  };

  // Sorted array of distinct EVEN values 2,4,…,2n — so odd targets (and
  // targets > 2n) are genuinely absent, exercising the empty-window case.
  function buildInput(params) {
    var n = Math.max(2, params.n || 24);
    var a = [];
    for (var k = 0; k < n; k++) a.push(2 * (k + 1));
    return a;
  }

  function* run(input, params) {
    params = params || {};
    var a = buildInput(params);
    var n = a.length;
    var target = params.target != null ? params.target : 30;
    var comparisons = 0;

    function snap(hl, annotation, status) {
      hl = hl || {};
      hl.refValue = target;
      return { array: a.slice(), counters: { comparisons: comparisons, probes: comparisons }, highlight: hl, annotation: annotation, status: status };
    }

    var lo = 0, hi = n - 1, found = -1;

    yield snap({ window: [lo, hi] },
      'Search a sorted array for target ' + target + '. It must lie inside the window [0, ' + (n - 1) + '] — if it exists at all.', 'start');

    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      comparisons++;
      yield snap({ window: [lo, hi], mid: mid },
        'Probe the middle: a[' + mid + '] = ' + a[mid] + ' vs target ' + target + '.', 'probe');
      if (a[mid] === target) {
        found = mid;
        yield snap({ window: [lo, hi], found: mid },
          'a[' + mid + '] = ' + target + ' — found it at index ' + mid + '. ✓', 'found');
        break;
      } else if (a[mid] < target) {
        lo = mid + 1;
        yield snap({ window: [lo, hi], discarded: 'left' },
          'a[' + mid + '] < ' + target + ' → the target can only be to the right. Discard the left half; search [' + lo + ', ' + hi + '].', 'narrow');
      } else {
        hi = mid - 1;
        yield snap({ window: [lo, hi], discarded: 'right' },
          'a[' + mid + '] > ' + target + ' → the target can only be to the left. Discard the right half; search [' + lo + ', ' + (hi) + '].', 'narrow');
      }
    }

    if (found === -1) {
      yield snap({ window: [lo, hi] },
        'The window is empty (lo > hi) → ' + target + ' is not in the array. ' + comparisons + ' probes, all of log₂ n.', 'absent');
    }
  }

  function draw(ctx, snap, w, h, theme) {
    var a = snap.array || [];
    if (!a.length) return;
    var hl = snap.highlight || {};
    var win = hl.window || null;
    var mid = (hl.mid != null) ? hl.mid : null;
    var found = (hl.found != null) ? hl.found : null;

    root.Algo.bars(ctx, {
      values: a, w: w, h: h, theme: theme, refValue: hl.refValue,
      colorFor: function (idx) {
        if (found != null && idx === found) return theme.invariant;           // located
        if (mid != null && idx === mid) return theme.accent;                  // the probe
        if (win && idx >= win[0] && idx <= win[1]) return theme.ink;          // live window
        return theme.muted;                                                   // discarded
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
