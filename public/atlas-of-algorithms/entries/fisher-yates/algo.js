/* =====================================================================
 * fisher-yates / algo.js  —  The Atlas of Algorithms (Randomized)
 * ---------------------------------------------------------------------
 * The Fisher–Yates (Knuth) shuffle. For i from n−1 down to 1, swap a[i]
 * with a[random j in 0..i]. Every one of the n! orderings is equally
 * likely, in O(n) time and in place. The visualization first runs one
 * shuffle, then accumulates many to show the position×value frequencies
 * flattening to uniform. One source of truth (ADR-0001); reg. ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Fisher–Yates Shuffle',
    slug: 'fisher-yates',
    family: 'randomized',
    oneLiner: 'Shuffle a deck so every ordering is equally likely — one pass, one swap per card, no bias.',
    invariant: 'Each of the n! permutations is produced with equal probability 1/n!; every value is equally likely in every position.',
    cost: { time: 'O(n)', space: 'O(1)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Cards (n)', min: 3, max: 7, step: 1, value: 5 },
      { key: 'runs', type: 'slider', label: 'Shuffles to sample', min: 200, max: 4000, step: 200, value: 2000 },
      { key: 'shuffle', type: 'button', label: 'New seed',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(2, params.n || 5);
    var R = Math.max(50, params.runs || 2000);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    function snap(phase, hl, annotation, status, extra) {
      var base = { phase: phase, n: n, highlight: hl || {}, annotation: annotation, status: status,
        readout: [{ label: 'cards', value: n }] };
      if (extra) for (var key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) base[key] = extra[key];
      return base;
    }

    // ---- Phase 1: animate ONE shuffle ----
    var a = []; for (var z = 0; z < n; z++) a.push(z);
    yield snap('shuffle', { arr: a.slice(), i: n, j: -1 },
      'Start with the deck in order. Walk from the last card down; for each, swap it with a uniformly-random card at or before it.', 'start',
      { readout: [{ label: 'cards', value: n }, { label: 'phase', value: 'one shuffle' }, { label: 'step', value: 0 }] });
    for (var i = n - 1; i >= 1; i--) {
      var j = Math.floor(rng() * (i + 1));
      yield snap('shuffle', { arr: a.slice(), i: i, j: j, before: true },
        'Position ' + i + ': pick a random j in [0, ' + i + '] → j = ' + j + '. Swap a[' + i + '] and a[' + j + '].', 'pick',
        { readout: [{ label: 'cards', value: n }, { label: 'fixing position', value: i }, { label: 'random j', value: j }] });
      var t = a[i]; a[i] = a[j]; a[j] = t;
      yield snap('shuffle', { arr: a.slice(), i: i, j: j, before: false },
        'Swapped. Position ' + i + ' is now locked; everything from ' + i + ' to ' + (n - 1) + ' is final.', 'swap',
        { readout: [{ label: 'cards', value: n }, { label: 'locked', value: (n - i) + ' / ' + n }, { label: 'random j', value: j }] });
    }
    yield snap('shuffle', { arr: a.slice(), i: 0, j: -1 }, 'One uniformly-random shuffle done. But is it really unbiased? Sample many shuffles and watch the position×value frequencies.', 'shuffle-done', { readout: [{ label: 'cards', value: n }, { label: 'phase', value: 'one shuffle' }, { label: 'step', value: 'done' }] });

    // ---- Phase 2: accumulate R shuffles into a position×value frequency grid ----
    var freq = []; for (var p = 0; p < n; p++) { var row = []; for (var v = 0; v < n; v++) row.push(0); freq.push(row); }
    var permCounts = {};
    var STEPS = 60, stride = Math.max(1, Math.floor(R / STEPS));
    function deviation(done) { var target = done, mx = 0; for (var p2 = 0; p2 < n; p2++) for (var v2 = 0; v2 < n; v2++) { var d = Math.abs(freq[p2][v2] / done - 1 / n); if (d > mx) mx = d; } return mx; }
    function record(done) {
      var probs = freq.map(function (rw) { return rw.map(function (c) { return c / done; }); });
      return { phase: 'verify', n: n, probs: probs, runsDone: done, maxDev: deviation(done), target: 1 / n,
        readout: [{ label: 'shuffles', value: done }, { label: 'target P', value: (1 / n).toFixed(3) }, { label: 'max deviation', value: (deviation(done) * 100).toFixed(1) + '%' }],
        annotation: 'After ' + done + ' shuffles, every cell (value v lands in position p) is within ' + (deviation(done) * 100).toFixed(1) + '% of the uniform 1/n = ' + (1 / n).toFixed(3) + '. No position favors any value.',
        status: 'verify' };
    }

    var b = new Array(n);
    for (var rr = 1; rr <= R; rr++) {
      for (var s = 0; s < n; s++) b[s] = s;
      for (var ii = n - 1; ii >= 1; ii--) { var jj = Math.floor(rng() * (ii + 1)); var tt = b[ii]; b[ii] = b[jj]; b[jj] = tt; }
      for (var pp = 0; pp < n; pp++) freq[pp][b[pp]]++;
      var key = b.join(','); permCounts[key] = (permCounts[key] || 0) + 1;
      if (rr % stride === 0 || rr === R) yield record(rr);
    }
    var fin = record(R);
    fin.report = { n: n, runs: R, freq: freq, permCounts: permCounts };
    fin.status = 'done';
    fin.annotation = 'Done — over ' + R + ' shuffles the frequencies are uniform (max deviation ' + (fin.maxDev * 100).toFixed(1) + '%). Every value is equally likely in every position, the hallmark of an unbiased shuffle. ✓';
    yield fin;
  }

  function drawShuffle(ctx, snap, w, h, theme) {
    var hl = snap.highlight, arr = hl.arr, n = snap.n;
    var pad = 24, gap = 10, cw = Math.min(90, (w - 2 * pad) / n - gap), ch = 70;
    var totalW = n * (cw + gap) - gap, ox = (w - totalW) / 2, oy = h * 0.42;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var k = 0; k < n; k++) {
      var x = ox + k * (cw + gap);
      var fill = theme.panel_2 || theme.panel, ink = theme.ink;
      if (k > hl.i && snap.status !== 'start') { fill = theme.invariant; ink = theme.bg; }    // locked/final
      if (k === hl.i && hl.i >= 1) { fill = theme.warn; ink = theme.bg; }                     // current position
      if (k === hl.j && hl.j >= 0) { fill = theme.accent; ink = theme.bg; }                   // random partner
      ctx.fillStyle = fill; ctx.strokeStyle = (theme.line || theme.grid); ctx.lineWidth = 2;
      ctx.fillRect(x, oy, cw, ch); ctx.strokeRect(x, oy, cw, ch);
      ctx.fillStyle = ink; ctx.font = '600 ' + Math.min(26, cw * 0.4) + 'px ' + (theme.mono || 'monospace');
      ctx.fillText(String(arr[k]), x + cw / 2, oy + ch / 2 + 1);
      ctx.fillStyle = theme.faint || theme.muted; ctx.font = '11px ' + (theme.mono || 'monospace');
      ctx.fillText('pos ' + k, x + cw / 2, oy + ch + 14);
    }
  }

  function drawVerify(ctx, snap, w, h, theme) {
    var n = snap.n, probs = snap.probs, target = snap.target;
    root.Algo.grid(ctx, { rows: n, cols: n, w: w, h: h, pad: 40, gap: 4 }, function (x, y, cell, r, c) {
      var p = probs[r][c];
      ctx.fillStyle = theme.panel; ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = Math.min(1, 0.12 + 0.8 * (p / (2 * target))); ctx.fillStyle = theme.accent;
      ctx.fillRect(x, y, cell, cell); ctx.globalAlpha = 1;
      if (Math.abs(p - target) <= 0.02) { ctx.strokeStyle = theme.invariant; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2); }
    });
  }

  function draw(ctx, snap, w, h, theme) { if (snap.phase === 'verify') drawVerify(ctx, snap, w, h, theme); else drawShuffle(ctx, snap, w, h, theme); }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
