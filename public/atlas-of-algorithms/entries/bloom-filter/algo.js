/* =====================================================================
 * bloom-filter / algo.js  —  The Atlas of Algorithms (Hashing)
 * ---------------------------------------------------------------------
 * A space-tiny probabilistic set: m bits + k hash functions. add(x) sets
 * the k bits h₁(x)..hₖ(x); query(x) returns true iff all k are set. So:
 *   - NO FALSE NEGATIVES, ever (an added item's bits are all set).
 *   - false positives at rate ≈ (1 − e^(−kn/m))^k (collisions light all k).
 * One source of truth (ADR-0001); statistical verification (ADR-0005).
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Bloom Filter',
    slug: 'bloom-filter',
    family: 'hashing',
    oneLiner: 'Test set membership in a handful of bits — it never misses a member, but occasionally cries wolf.',
    invariant: 'No false negatives: an item that was added always tests positive. False positives occur at a predictable rate.',
    cost: { time: 'O(k) per op', space: 'm bits' },
    controls: [
      { key: 'm', type: 'slider', label: 'Bits (m)', min: 24, max: 128, step: 8, value: 64 },
      { key: 'k', type: 'slider', label: 'Hashes (k)', min: 1, max: 8, step: 1, value: 4 },
      { key: 'items', type: 'slider', label: 'Items added (n)', min: 4, max: 40, step: 2, value: 16 },
      { key: 'shuffle', type: 'button', label: 'New hashes',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var m = Math.max(8, params.m || 64);
    var k = Math.max(1, params.k || 4);
    var n = Math.max(1, params.items || 16);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;

    // k near-independent uniform hashes via a Murmur-style finalizer.
    function indices(x) {
      var out = [];
      for (var r = 0; r < k; r++) {
        var z = (Math.imul(x + 1, 2654435761) + Math.imul(r + 1, 40503) + seed) >>> 0;
        z = Math.imul(z ^ (z >>> 16), 0x45d9f3b) >>> 0;
        z = Math.imul(z ^ (z >>> 16), 0x45d9f3b) >>> 0;
        z = (z ^ (z >>> 16)) >>> 0;
        out.push(z % m);
      }
      return out;
    }

    var bits = new Array(m).fill(false);
    var added = []; for (var a = 0; a < n; a++) added.push(a);     // items 0..n-1

    // Predict the false-positive rate. Exact-ish given the load: once a
    // fraction p of bits are set, a random query's k bits are all set with
    // probability ≈ p^k. The classic closed form (1−e^(−kn/m))^k is the
    // large-m approximation of p (it under-estimates for small m).
    var finalBits = new Array(m).fill(false);
    for (var fx = 0; fx < n; fx++) { var fi = indices(fx); for (var fb = 0; fb < fi.length; fb++) finalBits[fi[fb]] = true; }
    var pSet = finalBits.filter(Boolean).length / m;
    var predicted = Math.pow(pSet, k);
    var predictedClassic = Math.pow(1 - Math.exp(-k * n / m), k);

    function bitsSet() { var c = 0; for (var i = 0; i < m; i++) if (bits[i]) c++; return c; }
    function snap(hl, phase, annotation, status, fpInfo) {
      return {
        bits: bits.slice(), m: m, k: k, n: n, highlight: hl || {}, phase: phase, predicted: predicted,
        readout: [
          { label: 'bits set', value: bitsSet() + ' / ' + m },
          { label: 'items added', value: hl.addedSoFar != null ? hl.addedSoFar : n },
          { label: 'FP rate', value: fpInfo ? (fpInfo.measured + ' (≈ ' + (predicted * 100).toFixed(0) + '% predicted)') : (predicted * 100).toFixed(0) + '% predicted' }
        ],
        annotation: annotation, status: status
      };
    }

    yield snap({}, 'start', 'A bit array of ' + m + ' bits and ' + k + ' hash functions. Adding an item lights ' + k + ' bits; a membership test passes only if all ' + k + ' of an item’s bits are lit.', 'start');

    // add phase
    for (var x = 0; x < n; x++) {
      var ix = indices(x);
      yield snap({ probe: ix, addedSoFar: x }, 'add', 'Add item ' + x + ': set its ' + k + ' bits (' + ix.join(', ') + ').', 'add');
      for (var b = 0; b < ix.length; b++) bits[ix[b]] = true;
    }

    // query a few added items (true positives — demonstrating no false negatives)
    for (var q = 0; q < Math.min(3, n); q++) {
      var qi = indices(q), all = qi.every(function (i) { return bits[i]; });
      yield snap({ probe: qi }, 'query-present', 'Query added item ' + q + ': all ' + k + ' bits lit → present. (An added item can never fail — no false negatives.)', all ? 'tp' : 'fn-BUG');
    }

    // query absent items (some collide → false positives)
    var fp = 0, tested = 0;
    var absentToAnimate = 10;
    for (var t = 0; t < absentToAnimate; t++) {
      var item = n + t; var ai = indices(item); var hit = ai.every(function (i) { return bits[i]; });
      tested++; if (hit) fp++;
      yield snap({ probe: ai }, 'query-absent', 'Query never-added item ' + item + ': ' + (hit ? 'all bits happen to be lit → FALSE POSITIVE.' : 'a bit is unlit → correctly reported absent.'), hit ? 'fp' : 'tn',
        { measured: (fp / tested * 100).toFixed(0) + '%' });
    }

    // big FP measurement for the report (not animated)
    var T = 500, fpBig = 0, addedIdx = [], absentIdx = [];
    for (var ax = 0; ax < n; ax++) addedIdx.push(indices(ax));
    for (var tt = 0; tt < T; tt++) { var idx = indices(n + 1000 + tt); absentIdx.push(idx); if (idx.every(function (i) { return bits[i]; })) fpBig++; }
    var fpEmpirical = fpBig / T;

    var fin = snap({}, 'done', 'Done. Over ' + T + ' never-added queries the false-positive rate was ' + (fpEmpirical * 100).toFixed(1) + '% — matching p^k = ' + (predicted * 100).toFixed(1) + '% (p = ' + (pSet * 100).toFixed(0) + '% of bits set). The classic formula (1−e^(−kn/m))^k ≈ ' + (predictedClassic * 100).toFixed(1) + '%. No added item ever failed. ✓', 'done',
      { measured: (fpEmpirical * 100).toFixed(1) + '%' });
    fin.report = { m: m, k: k, n: n, bits: bits.slice(), addedIdx: addedIdx, absentIdx: absentIdx, fpEmpirical: fpEmpirical, predicted: predicted, predictedClassic: predictedClassic, pSet: pSet };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var bits = snap.bits, m = snap.m; if (!bits) return;
    var cols = Math.min(16, m), rows = Math.ceil(m / cols);
    var probe = {}; if (snap.highlight.probe) for (var p = 0; p < snap.highlight.probe.length; p++) probe[snap.highlight.probe[p]] = true;
    root.Algo.grid(ctx, { rows: rows, cols: cols, w: w, h: h, pad: 24, gap: 4 }, function (x, y, cell, r, c) {
      var i = r * cols + c; if (i >= m) return;
      var fill = theme.panel;
      if (bits[i]) { ctx.globalAlpha = 0.55; ctx.fillStyle = theme.accent; ctx.fillRect(x, y, cell, cell); ctx.globalAlpha = 1; fill = null; }
      else { ctx.fillStyle = theme.panel; ctx.fillRect(x, y, cell, cell); }
      if (probe[i]) {
        var hot = (snap.status === 'fp') ? theme.warn : (snap.status === 'tn') ? theme.muted : theme.invariant;
        ctx.fillStyle = (snap.phase === 'add') ? theme.accent : hot;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = (snap.status === 'fp') ? theme.warn : theme.invariant; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
