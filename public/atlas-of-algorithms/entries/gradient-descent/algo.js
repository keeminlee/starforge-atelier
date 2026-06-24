/* =====================================================================
 * gradient-descent / algo.js  —  The Atlas of Algorithms (Optimization & Flows)
 * ---------------------------------------------------------------------
 * Minimize a 2-D function by repeatedly stepping downhill along the negative
 * gradient: x ← x − η∇f(x). On a convex, L-smooth f with step η ≤ 1/L the
 * loss decreases monotonically and converges to the minimum; too large a
 * step overshoots and diverges. One source of truth (ADR-0001); reg. ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var FUNCS = {
    bowl: { dom: [-2.2, 2.2, -2.2, 2.2], min: [0, 0], eta: 0.06, label: 'Bowl  x²+y²',
      f: function (x, y) { return x * x + y * y; }, grad: function (x, y) { return [2 * x, 2 * y]; },
      start: function (g) { return [-1.9 + g() * 3.8, -1.9 + g() * 3.8]; } },
    elongated: { dom: [-2.2, 2.2, -1.1, 1.1], min: [0, 0], eta: 0.012, label: 'Elongated  x²+12y²',
      f: function (x, y) { return x * x + 12 * y * y; }, grad: function (x, y) { return [2 * x, 24 * y]; },
      start: function (g) { return [-1.9 + g() * 3.8, (g() < 0.5 ? -1 : 1) * (0.7 + g() * 0.3)]; } },
    rosenbrock: { dom: [-2, 2, -1, 3], min: [1, 1], eta: 0.0012, label: 'Rosenbrock (non-convex)',
      f: function (x, y) { var a = 1 - x, b = y - x * x; return a * a + 100 * b * b; },
      grad: function (x, y) { var b = y - x * x; return [-2 * (1 - x) - 400 * x * b, 200 * b]; },
      start: function (g) { return [-1.5 + g() * 0.8, 2 + g() * 0.6]; } }
  };

  var metadata = {
    title: 'Gradient Descent',
    slug: 'gradient-descent',
    family: 'optimization',
    oneLiner: 'Find a minimum by repeatedly stepping downhill — the workhorse that trains almost everything.',
    invariant: 'For a convex, smooth loss with a small enough step, every step decreases the loss and the path converges to the minimum.',
    cost: { time: 'O(1) gradient/step', space: 'O(1)' },
    controls: [
      { key: 'func', type: 'select', label: 'Surface', value: 'elongated',
        options: [{ value: 'bowl', label: 'Bowl (well-conditioned)' }, { value: 'elongated', label: 'Elongated valley' }, { value: 'rosenbrock', label: 'Rosenbrock (non-convex)' }] },
      { key: 'eta', type: 'slider', label: 'Step size ×', min: 1, max: 120, step: 1, value: 10 },
      { key: 'shuffle', type: 'button', label: 'New start',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var F = FUNCS[params.func] || FUNCS.elongated;
    var eta = F.eta * ((params.eta != null ? params.eta : 10) / 10);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var p = F.start(rng);
    var path = [p.slice()], vals = [F.f(p[0], p[1])];
    var N = 80, diverged = false;
    for (var s = 0; s < N; s++) {
      var g = F.grad(p[0], p[1]);
      p = [p[0] - eta * g[0], p[1] - eta * g[1]];
      var fv = F.f(p[0], p[1]);
      path.push(p.slice()); vals.push(fv);
      if (!isFinite(fv) || fv > 1e7 || Math.abs(p[0]) > 50 || Math.abs(p[1]) > 50) { diverged = true; break; }
      if (fv < 1e-9 && Math.hypot(p[0] - F.min[0], p[1] - F.min[1]) < 1e-4) break;
    }

    function frame(k, status) {
      var cur = path[k], loss = vals[k];
      var gnorm = (function () { var gg = F.grad(cur[0], cur[1]); return Math.hypot(gg[0], gg[1]); })();
      return {
        func: params.func || 'elongated', dom: F.dom, min: F.min, label: F.label, eta: eta,
        path: path.slice(0, k + 1), point: cur, loss: loss, diverged: diverged && k === path.length - 1,
        readout: [
          { label: 'loss f(x)', value: loss < 1e4 ? loss.toFixed(3) : loss.toExponential(1) },
          { label: 'step', value: k + ' / ' + (path.length - 1) },
          { label: '‖∇f‖', value: gnorm < 1e4 ? gnorm.toFixed(2) : '∞' }
        ],
        annotation: status === 'start'
          ? 'Each step moves opposite the gradient (steepest downhill) by η·∇f. The contour shading is the loss; the path should slide to the dark minimum.'
          : (status === 'done'
            ? (diverged ? 'Diverged — the step size η is too large for this surface: each step overshoots and the loss explodes. Lower η.' : 'Converged to the minimum at loss ' + loss.toFixed(3) + '. On a convex surface with a small enough step, descent is guaranteed.')
            : 'Step ' + k + ': loss ' + loss.toFixed(3) + ', gradient magnitude ' + gnorm.toFixed(2) + '. Step downhill again.'),
        status: status
      };
    }

    yield frame(0, 'start');
    for (var k = 1; k < path.length - 1; k++) yield frame(k, 'run');
    if (path.length > 1) yield frame(path.length - 1, 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var dom = snap.dom; if (!dom) return;
    var F = { bowl: function (x, y) { return x * x + y * y; }, elongated: function (x, y) { return x * x + 12 * y * y; }, rosenbrock: function (x, y) { var a = 1 - x, b = y - x * x; return a * a + 100 * b * b; } }[snap.func];
    var pad = 20, plotW = w - 2 * pad, plotH = h - 2 * pad, ox = pad, oy = pad;
    function sx(x) { return ox + (x - dom[0]) / (dom[1] - dom[0]) * plotW; }
    function sy(y) { return oy + (1 - (y - dom[2]) / (dom[3] - dom[2])) * plotH; }

    // contour heatmap
    var G = 56, fmin = Infinity, fmax = -Infinity, grid = [];
    for (var i = 0; i < G; i++) { grid.push([]); for (var j = 0; j < G; j++) { var x = dom[0] + (i + 0.5) / G * (dom[1] - dom[0]); var y = dom[2] + (j + 0.5) / G * (dom[3] - dom[2]); var v = F(x, y); grid[i].push(v); if (v < fmin) fmin = v; if (v > fmax) fmax = v; } }
    var cw = plotW / G, ch = plotH / G;
    for (var a = 0; a < G; a++) for (var b = 0; b < G; b++) {
      var t = Math.pow((grid[a][b] - fmin) / (fmax - fmin + 1e-9), 0.34);   // compress range
      ctx.globalAlpha = 0.12 + 0.72 * t; ctx.fillStyle = theme.muted;
      ctx.fillRect(ox + a * cw, oy + (G - 1 - b) * ch, cw + 1, ch + 1);
    }
    ctx.globalAlpha = 1;

    // descent path
    var P = snap.path;
    ctx.save(); ctx.strokeStyle = theme.accent; ctx.lineWidth = 2;
    ctx.beginPath(); for (var k = 0; k < P.length; k++) { var X = sx(P[k][0]), Y = sy(P[k][1]); if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.stroke();
    ctx.fillStyle = theme.accent;
    for (var d = 0; d < P.length; d++) { ctx.beginPath(); ctx.arc(sx(P[d][0]), sy(P[d][1]), 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();

    // minimum (green) + current point (orange)
    ctx.fillStyle = theme.invariant; ctx.beginPath(); ctx.arc(sx(snap.min[0]), sy(snap.min[1]), 6, 0, Math.PI * 2); ctx.fill();
    var c = snap.point; ctx.fillStyle = snap.diverged ? theme.warn : theme.warn;
    ctx.beginPath(); ctx.arc(sx(Math.max(dom[0], Math.min(dom[1], c[0]))), sy(Math.max(dom[2], Math.min(dom[3], c[1]))), 5.5, 0, Math.PI * 2); ctx.fill();
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
