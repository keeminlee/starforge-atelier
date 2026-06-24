/* =====================================================================
 * minhash / algo.js  —  The Atlas of Algorithms (Similarity & high-dim search)
 * ---------------------------------------------------------------------
 * Broder (1997). For a random hash h, minhash_h(S) = min_{x∈S} h(x). The
 * key fact: P[ minhash(A) = minhash(B) ] = J(A,B) = |A∩B|/|A∪B|, because
 * the element of A∪B achieving the global minimum is uniform, and the
 * signatures match iff it lies in A∩B. So the FRACTION of matching hashes
 * over m independent hashes is an unbiased estimate of the Jaccard
 * similarity, with variance J(1−J)/m.
 *
 * Guarantee shown empirically + statistical verification (ADR-0005).
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var SET = 20;       // |A| = |B|

  var metadata = {
    title: 'MinHash',
    slug: 'minhash',
    family: 'similarity',
    oneLiner: 'Estimate how similar two sets are from the chance their smallest hash collides — Jaccard similarity in a handful of numbers.',
    invariant: 'P[minhash(A) = minhash(B)] = J(A,B); the fraction of matching hashes estimates the Jaccard similarity (unbiased).',
    cost: { time: 'O(m·|S|) sign.', space: 'O(m) signature' },
    controls: [
      { key: 'hashes', type: 'slider', label: 'Hash functions (m)', min: 4, max: 100, step: 1, value: 40 },
      { key: 'shared', type: 'slider', label: 'Shared elements |A∩B|', min: 0, max: 20, step: 1, value: 10 },
      { key: 'shuffle', type: 'button', label: 'New hashes',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function buildSets(shared) {
    shared = Math.max(0, Math.min(SET, shared));
    var A = [], B = [];
    for (var x = 0; x < SET; x++) A.push(x);                 // A = {0..SET-1}
    for (var s = 0; s < shared; s++) B.push(s);              // shared prefix
    for (var u = 0; u < SET - shared; u++) B.push(SET + u);  // B's unique tail
    return { A: A, B: B, shared: shared, aOnly: SET - shared, bOnly: SET - shared, union: 2 * SET - shared };
  }

  function* run(input, params) {
    params = params || {};
    var m = Math.max(1, params.hashes || 40);
    var shared = params.shared != null ? params.shared : 10;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rand = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var sets = buildSets(shared);
    var trueJ = sets.union > 0 ? sets.shared / sets.union : 1;

    // Each hash is a TRULY RANDOM ranking of the universe (a fresh random value
    // per element). This is min-wise independent, so P[match] = J exactly. NOTE:
    // a naive linear hash (a·x+b mod p) is only 2-universal and would BIAS the
    // estimate — see the entry's honesty note. Universe = 0..2·SET−1.
    var U = 2 * SET;
    var hvals = [];
    for (var r = 0; r < m; r++) { var row = []; for (var x = 0; x < U; x++) row.push(rand()); hvals.push(row); }
    function minhash(S, r) { var mn = Infinity; for (var i = 0; i < S.length; i++) { var hv = hvals[r][S[i]]; if (hv < mn) mn = hv; } return mn; }

    var sigA = [], sigB = [], match = [];
    for (var h = 0; h < m; h++) { var ma = minhash(sets.A, h), mb = minhash(sets.B, h); sigA.push(ma); sigB.push(mb); match.push(ma === mb); }

    function frame(upto, status) {
      var matched = 0; for (var i = 0; i < upto; i++) if (match[i]) matched++;
      var est = upto > 0 ? matched / upto : 0;
      return {
        sets: sets, sigA: sigA, sigB: sigB, match: match, upto: upto, m: m, trueJ: trueJ, estimate: est,
        readout: [
          { label: 'true Jaccard', value: trueJ.toFixed(3) },
          { label: 'estimate (' + upto + ' hashes)', value: est.toFixed(3) },
          { label: 'error', value: (Math.abs(est - trueJ) * 100).toFixed(1) + '%' }
        ],
        annotation: status === 'start'
          ? 'Top bar: the true overlap of A and B (green = shared, so J = green fraction). Each column below is one hash: green if minhash(A)=minhash(B).'
          : 'After ' + upto + ' hashes: ' + matched + ' matched → estimate ' + est.toFixed(3) + ' vs true Jaccard ' + trueJ.toFixed(3) + '.',
        status: status
      };
    }

    yield frame(0, 'start');
    for (var u = 1; u <= m; u++) yield frame(u, u === m ? 'done' : 'run');
  }

  function draw(ctx, snap, w, h, theme) {
    var sets = snap.sets; if (!sets) return;
    var m = snap.m, upto = snap.upto || 0;
    var sigMatch = snap.match || [];
    var pad = 18;

    // ---- top: the true set overlap as a proportional bar (green = J) ----
    var barY = pad, barH = Math.min(46, h * 0.16);
    var fullW = w - 2 * pad;
    var union = sets.union;
    var segs = [
      { n: sets.shared, color: theme.invariant },  // A∩B
      { n: sets.aOnly, color: theme.accent },       // A only
      { n: sets.bOnly, color: theme.cost }          // B only
    ];
    var cx = pad;
    for (var s = 0; s < segs.length; s++) {
      var sw = (segs[s].n / union) * fullW;
      ctx.fillStyle = segs[s].color;
      ctx.fillRect(cx, barY, Math.max(0, sw - 1), barH);
      cx += sw;
    }

    // ---- bottom: m signature columns (A row, B row); matched columns green ----
    var gridTop = barY + barH + 22;
    var gridH = h - gridTop - pad;
    var rowH = Math.min(gridH / 2 - 6, 80);
    var gap = Math.max(1, Math.min(5, Math.floor((fullW / m) * 0.2)));
    var cw = (fullW - gap * (m - 1)) / m;

    for (var r = 0; r < m; r++) {
      var x = pad + r * (cw + gap);
      var revealed = r < upto;
      var aColor, bColor;
      if (!revealed) { aColor = bColor = theme.panel; }
      else if (sigMatch[r]) { aColor = bColor = theme.invariant; }
      else { aColor = theme.accent; bColor = theme.cost; }
      ctx.fillStyle = aColor; ctx.fillRect(x, gridTop, cw, rowH);
      ctx.fillStyle = bColor; ctx.fillRect(x, gridTop + rowH + 6, cw, rowH);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
