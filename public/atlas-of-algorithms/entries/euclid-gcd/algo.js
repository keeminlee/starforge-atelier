/* =====================================================================
 * euclid-gcd / algo.js  —  The Atlas of Algorithms (Numerical Methods)
 * ---------------------------------------------------------------------
 * The Euclidean algorithm (c. 300 BC) — arguably the oldest algorithm still
 * in use. gcd(a,b) = gcd(b, a mod b), repeated until the remainder is 0.
 * Shown geometrically (anthyphairesis): tile an a×b rectangle with the
 * largest squares that fit; the remainder is a smaller rectangle; the side
 * of the final squares is the gcd. One source of truth (ADR-0001); reg. 0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Euclidean Algorithm',
    slug: 'euclid-gcd',
    family: 'numerical',
    oneLiner: 'Find the greatest common divisor by repeatedly replacing the larger number with its remainder — the oldest algorithm.',
    invariant: 'gcd(a, b) = gcd(b, a mod b): every step preserves the set of common divisors, so the last non-zero value is the gcd.',
    cost: { time: 'O(log min(a,b))', space: 'O(1)' },
    controls: [
      { key: 'a', type: 'slider', label: 'a', min: 8, max: 64, step: 1, value: 48 },
      { key: 'b', type: 'slider', label: 'b', min: 8, max: 64, step: 1, value: 36 },
      { key: 'shuffle', type: 'button', label: 'Random a, b',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var a0 = Math.max(1, params.a || 48), b0 = Math.max(1, params.b || 36);
    if (params.nonce) {       // shuffle → random pair (often with a non-trivial gcd)
      var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng((params.nonce * 2654435761 + 1013904223) >>> 0) : Math.random;
      var g = 2 + Math.floor(rng() * 8);
      a0 = g * (2 + Math.floor(rng() * 7)); b0 = g * (1 + Math.floor(rng() * 7));
    }

    // authoritative numeric gcd + the division steps
    var steps = [], A = Math.max(a0, b0), B = Math.min(a0, b0);
    while (B > 0) { var q = Math.floor(A / B), r = A % B; steps.push({ A: A, B: B, q: q, r: r }); A = B; B = r; }
    var gcd = A;

    function snap(squares, rect, idx, annotation, status) {
      var st = idx >= 0 && idx < steps.length ? steps[idx] : null;
      return {
        a: a0, b: b0, gcd: gcd, squares: squares.slice(), rect: rect ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h } : null,
        status: status,
        readout: [
          { label: 'a, b', value: a0 + ', ' + b0 },
          { label: 'step', value: st ? st.A + ' = ' + st.q + '·' + st.B + ' + ' + st.r : (status === 'done' ? 'remainder 0' : '—') },
          { label: 'gcd', value: status === 'done' ? gcd : '…' }
        ],
        annotation: annotation
      };
    }

    yield snap([], { x: 0, y: 0, w: a0, h: b0 }, -1,
      'gcd(' + a0 + ', ' + b0 + '): tile the ' + a0 + '×' + b0 + ' rectangle with the biggest squares that fit. Each leftover is a smaller rectangle — the same problem, scaled down.', 'start');

    // geometric carving: squares of side min(w,h) off the long end
    var squares = [], x = 0, y = 0, w = a0, h = b0, round = 0, lastSize = Math.min(w, h);
    while (w > 0 && h > 0) {
      var s = Math.min(w, h); lastSize = s;
      if (w >= h) {
        var cx = Math.floor(w / h);
        for (var k = 0; k < cx; k++) squares.push({ x: x + k * h, y: y, size: h, round: round });
        x += cx * h; w -= cx * h;
      } else {
        var cy = Math.floor(h / w);
        for (var k2 = 0; k2 < cy; k2++) squares.push({ x: x, y: y + k2 * w, size: w, round: round });
        y += cy * w; h -= cy * w;
      }
      var rem = (w > 0 && h > 0) ? { x: x, y: y, w: w, h: h } : null;
      yield snap(squares, rem, round,
        'Square of side ' + s + ' fits ' + (steps[round] ? steps[round].q : '') + '× ' + (steps[round] && steps[round].r ? '→ a ' + (w || h) + '-wide strip remains.' : '→ it tiles exactly. That side is the gcd.'), 'carve');
      round++;
    }

    yield snap(squares, null, steps.length,
      'Done. The smallest square has side ' + gcd + ' and tiles everything evenly — so gcd(' + a0 + ', ' + b0 + ') = ' + gcd + '. It divides both, and no larger number could.', 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var a = snap.a, b = snap.b;
    var pad = 30, plotW = w - 2 * pad, plotH = h - 2 * pad;
    var scale = Math.min(plotW / a, plotH / b);
    var rw = a * scale, rh = b * scale, ox = (w - rw) / 2, oy = (h - rh) / 2;
    function PX(vx) { return ox + vx * scale; }
    function PY(vy) { return oy + vy * scale; }

    var roundColors = [theme.accent, theme.cost];
    for (var i = 0; i < snap.squares.length; i++) {
      var sq = snap.squares[i];
      var isGcd = snap.status === 'done' && sq.size === snap.gcd;
      ctx.fillStyle = isGcd ? theme.invariant : roundColors[sq.round % 2];
      ctx.globalAlpha = isGcd ? 0.85 : 0.32 + 0.04 * (sq.round % 3);
      ctx.fillRect(PX(sq.x), PY(sq.y), sq.size * scale, sq.size * scale);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = theme.bg; ctx.lineWidth = 1.5;
      ctx.strokeRect(PX(sq.x), PY(sq.y), sq.size * scale, sq.size * scale);
      if (sq.size * scale > 22) {
        ctx.fillStyle = isGcd ? theme.bg : theme.ink; ctx.globalAlpha = isGcd ? 1 : 0.7;
        ctx.font = '600 ' + Math.min(15, sq.size * scale * 0.3) + 'px ' + (theme.mono || 'monospace');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(sq.size), PX(sq.x) + sq.size * scale / 2, PY(sq.y) + sq.size * scale / 2); ctx.globalAlpha = 1;
      }
    }
    // remaining rectangle outline
    if (snap.rect) {
      ctx.strokeStyle = theme.warn; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      ctx.strokeRect(PX(snap.rect.x), PY(snap.rect.y), snap.rect.w * scale, snap.rect.h * scale); ctx.setLineDash([]);
    }
    // overall border
    ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.5; ctx.strokeRect(ox, oy, rw, rh);
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
