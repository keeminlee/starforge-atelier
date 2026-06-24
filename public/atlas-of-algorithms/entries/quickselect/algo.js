/* =====================================================================
 * quickselect / algo.js  —  The Atlas of Algorithms (Searching & Selection)
 * ---------------------------------------------------------------------
 * Quickselect (Hoare, 1961). Find the k-th smallest element by partitioning
 * like quicksort — but recurse into only the ONE side that contains rank k.
 * A partition places its pivot at its final sorted position p; comparing p
 * to k tells us which side to keep. Average O(n). One source of truth (0001).
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Quickselect',
    slug: 'quickselect',
    family: 'searching',
    oneLiner: 'Find the k-th smallest value without fully sorting — partition, then chase rank k into one side only.',
    invariant: 'After a partition, the pivot sits at its final sorted position p; rank k lies on the side p points to.',
    cost: { time: 'O(n) average, O(n²) worst', space: 'O(1)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Size (n)', min: 8, max: 22, step: 1, value: 15 },
      { key: 'k', type: 'slider', label: 'Rank k (k-th smallest)', min: 1, max: 22, step: 1, value: 8 },
      { key: 'shuffle', type: 'button', label: 'New array',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(4, params.n || 15);
    var kRank = Math.max(1, Math.min(n, params.k || 8));   // 1-indexed
    var kIdx = kRank - 1;                                   // 0-indexed target position
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var a = []; for (var i = 0; i < n; i++) a.push(8 + Math.floor(rng() * 92));

    var lo = 0, hi = n - 1, comparisons = 0, answerIdx = -1;

    function snap(st, hl, annotation) {
      return {
        array: a.slice(), n: n, kIdx: kIdx, kRank: kRank, lo: hl.lo, hi: hl.hi,
        pivotIdx: hl.pivotIdx == null ? -1 : hl.pivotIdx, i: hl.i == null ? -1 : hl.i, j: hl.j == null ? -1 : hl.j,
        answerIdx: answerIdx, status: st,
        readout: [
          { label: 'looking for', value: kRank + (kRank === 1 ? 'st' : kRank === 2 ? 'nd' : kRank === 3 ? 'rd' : 'th') + ' smallest' },
          { label: 'window', value: (hl.lo != null ? '[' + hl.lo + '…' + hl.hi + ']' : '—') + ' (' + (hl.lo != null ? hl.hi - hl.lo + 1 : 0) + ')' },
          { label: 'comparisons', value: comparisons }
        ],
        annotation: annotation
      };
    }

    yield snap('start', { lo: lo, hi: hi }, 'Find the ' + kRank + (kRank === 1 ? 'st' : kRank === 2 ? 'nd' : kRank === 3 ? 'rd' : 'th') + ' smallest. Partition the window around a pivot; the pivot lands at its final position, which tells us which side holds rank ' + kRank + '.');

    while (lo < hi) {
      var pivot = a[hi], store = lo;
      yield snap('pivot', { lo: lo, hi: hi, pivotIdx: hi, i: store }, 'Pivot = a[' + hi + '] = ' + pivot + '. Sweep the window, moving everything smaller than the pivot to the left.');
      for (var j = lo; j < hi; j++) {
        comparisons++;
        yield snap('scan', { lo: lo, hi: hi, pivotIdx: hi, i: store, j: j }, 'Compare a[' + j + '] = ' + a[j] + ' with pivot ' + pivot + (a[j] < pivot ? ' → smaller, move it left.' : ' → not smaller, leave it.'));
        if (a[j] < pivot) { var t = a[store]; a[store] = a[j]; a[j] = t; store++; }
      }
      var tt = a[store]; a[store] = a[hi]; a[hi] = tt;        // pivot to its final spot
      yield snap('placed', { lo: lo, hi: hi, pivotIdx: store, i: store }, 'Pivot is now at position ' + store + ' — its final sorted rank. ' + (store === kIdx ? 'That is exactly rank ' + kRank + '!' : store < kIdx ? 'Rank ' + kRank + ' is to its right; discard the left.' : 'Rank ' + kRank + ' is to its left; discard the right.'));
      if (store === kIdx) { answerIdx = store; break; }
      else if (store < kIdx) lo = store + 1;
      else hi = store - 1;
    }
    if (answerIdx < 0) answerIdx = lo;   // window collapsed to a single element

    yield snap('done', { lo: answerIdx, hi: answerIdx, pivotIdx: answerIdx }, 'Done. The ' + kRank + (kRank === 1 ? 'st' : kRank === 2 ? 'nd' : kRank === 3 ? 'rd' : 'th') + ' smallest is a[' + answerIdx + '] = ' + a[answerIdx] + ' — found in ' + comparisons + ' comparisons, without ever fully sorting.');
  }

  function draw(ctx, snap, w, h, theme) {
    var done = snap.status === 'done';
    root.Algo.bars(ctx, {
      values: snap.array, w: w, h: h, theme: theme,
      colorFor: function (idx) {
        if ((done || snap.status === 'placed') && idx === snap.answerIdx && snap.answerIdx >= 0) return theme.invariant;
        if (idx === snap.pivotIdx) return theme.warn;
        if (idx < snap.lo || idx > snap.hi) return theme.muted;     // discarded
        if (idx === snap.j) return theme.accent;
        if (snap.i >= 0 && idx >= snap.lo && idx < snap.i) return theme.cost;   // confirmed < pivot
        return theme.panel_2 || theme.ink;
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
