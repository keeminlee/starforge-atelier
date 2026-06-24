/* =====================================================================
 * sieve-of-eratosthenes / algo.js  —  The Atlas of Algorithms (Numerical)
 * ---------------------------------------------------------------------
 * Lay out 1..n; repeatedly take the next uncrossed number p — it must be
 * prime — and cross out its multiples (starting at p², since smaller ones
 * are already gone). When p² > n the survivors are exactly the primes.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Sieve of Eratosthenes',
    slug: 'sieve-of-eratosthenes',
    family: 'numerical',
    oneLiner: 'Find every prime up to n by crossing out the multiples of each prime in turn — what survives is prime.',
    invariant: 'When the sieve reaches an uncrossed number p, p is prime; striking multiples of primes never crosses out a prime.',
    cost: { time: 'O(n log log n)', space: 'O(n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Up to n', min: 30, max: 210, step: 10, value: 120 }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(10, params.n || 120);
    var cols = Math.ceil(Math.sqrt(n));

    var crossed = new Array(n + 1).fill(false);
    crossed[0] = true; if (n >= 1) crossed[1] = true;   // 1 is not prime

    function snap(currentPrime, struck, done, annotation, status) {
      var primes = [];
      if (done) for (var v = 2; v <= n; v++) if (!crossed[v]) primes.push(v);
      return {
        n: n, cols: cols, crossed: crossed.slice(), current: currentPrime, struck: struck || [],
        done: done, primeCount: done ? primes.length : null,
        readout: [
          { label: 'up to n', value: n },
          { label: done ? 'primes found' : 'sieving', value: done ? primes.length : (currentPrime > 0 ? 'multiples of ' + currentPrime : '—') },
          { label: done ? 'π(' + n + ')' : 'crossed', value: done ? primes.length : crossed.filter(function (x, i) { return x && i >= 2; }).length }
        ],
        annotation: annotation, status: status
      };
    }

    yield snap(0, [], false, 'Every number 2..n starts as a prime candidate (1 is set aside). Take the next uncrossed number and strike out its multiples.', 'start');

    for (var p = 2; p * p <= n; p++) {
      if (crossed[p]) continue;            // already composite ⇒ skip
      var struck = [];
      for (var m = p * p; m <= n; m += p) { if (!crossed[m]) { crossed[m] = true; struck.push(m); } }
      yield snap(p, struck, false, p + ' is prime (still uncrossed). Cross out its multiples from ' + (p * p) + ' onward — ' + struck.length + ' new composites struck.', 'run');
    }

    yield snap(0, [], true, 'Done — once p² > n, every uncrossed number is prime. Found ' + (function () { var c = 0; for (var v = 2; v <= n; v++) if (!crossed[v]) c++; return c; })() + ' primes ≤ ' + n + '. The green cells are the primes.', 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var n = snap.n, cols = snap.cols, crossed = snap.crossed; if (!n) return;
    var rows = Math.ceil(n / cols);
    var pad = 16, gap = 2;
    var cell = Math.min((w - 2 * pad - gap * (cols - 1)) / cols, (h - 2 * pad - gap * (rows - 1)) / rows);
    var gw = cols * cell + (cols - 1) * gap, gh = rows * cell + (rows - 1) * gap;
    var ox = (w - gw) / 2, oy = (h - gh) / 2;
    var struckSet = {}; for (var s = 0; s < snap.struck.length; s++) struckSet[snap.struck[s]] = true;
    var fontPx = Math.max(7, Math.min(15, cell * 0.46));
    ctx.font = fontPx + 'px ' + (theme.mono || 'monospace');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (var v = 1; v <= n; v++) {
      var k = v - 1, r = Math.floor(k / cols), c = k % cols;
      var x = ox + c * (cell + gap), y = oy + r * (cell + gap);
      var fill = theme.panel, ink = theme.muted;
      if (v === 1) { fill = theme.panel; ink = theme.faint || theme.muted; }
      else if (snap.done) {
        if (!crossed[v]) { fill = theme.invariant; ink = theme.bg; }       // prime
        else { fill = theme.panel; ink = theme.faint || theme.muted; }     // composite
      } else if (v === snap.current) { fill = theme.invariant; ink = theme.bg; }   // the sieving prime
      else if (struckSet[v]) { fill = theme.warn; ink = theme.bg; }                // just struck
      else if (crossed[v]) { fill = theme.panel; ink = theme.faint || theme.muted; } // already composite
      else { fill = theme.panel_2 || theme.panel; ink = theme.ink; }                // still a candidate
      ctx.fillStyle = fill; ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = ink; ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 0.5);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
