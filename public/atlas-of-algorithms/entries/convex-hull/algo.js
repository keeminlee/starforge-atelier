/* =====================================================================
 * convex-hull / algo.js  —  The Atlas of Algorithms (Computational Geometry)
 * ---------------------------------------------------------------------
 * Andrew's monotone chain. Sort points by (x, then y); sweep left→right
 * building the lower hull, then right→left building the upper hull, each
 * time popping any vertex that would make a non-left turn (cross ≤ 0).
 * The result is the smallest convex polygon containing every point.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Convex Hull',
    slug: 'convex-hull',
    family: 'geometry',
    oneLiner: 'Snap a rubber band around a cloud of points — the smallest convex polygon that contains them all.',
    invariant: 'Every turn around the hull is a left turn (it is convex), and every input point lies inside or on it.',
    cost: { time: 'O(n log n)', space: 'O(n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Points', min: 6, max: 40, step: 1, value: 22 },
      { key: 'shuffle', type: 'button', label: 'New points',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(3, params.n || 22);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    // points in [0.06, 0.94]² (margin), seeded
    var pts = [];
    for (var i = 0; i < n; i++) pts.push([0.06 + rng() * 0.88, 0.06 + rng() * 0.88]);
    var order = pts.map(function (_, i) { return i; }).sort(function (a, b) { return pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]; });

    function cross(o, a, b) { return (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]); }

    var turns = 0;
    function snap(lower, upper, current, phase, action, annotation, status) {
      return {
        pts: pts, lower: lower.slice(), upper: upper.slice(), current: current, phase: phase,
        hull: status === 'done' ? lower.concat(upper) : null, turns: turns,
        readout: [
          { label: 'points', value: n },
          { label: 'hull vertices', value: status === 'done' ? (lower.length + upper.length) : (lower.length + upper.length) },
          { label: status === 'done' ? 'orientation tests' : 'building', value: status === 'done' ? turns : (phase + ' hull') }
        ],
        annotation: annotation, status: status
      };
    }

    // ---- lower hull (left → right) ----
    var lower = [];
    yield snap(lower, [], -1, 'lower', 'start', 'Sort the points left to right, then sweep across building the lower hull — popping any vertex that would bend the wrong way.', 'start');
    for (var li = 0; li < order.length; li++) {
      var p = order[li];
      while (lower.length >= 2 && (turns++, cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)) {
        var popped = lower.pop();
        yield snap(lower, [], p, 'lower', 'pop', 'Adding this point would make a right turn at the previous vertex — pop it; the boundary must stay convex.', 'run');
      }
      lower.push(p);
      yield snap(lower, [], p, 'lower', 'push', 'Extend the lower hull to this point. Lower chain: ' + lower.length + ' vertices.', 'run');
    }
    var lowerFinal = lower.slice(0, lower.length - 1); // drop last (shared with upper)

    // ---- upper hull (right → left) ----
    var upper = [];
    for (var ui = order.length - 1; ui >= 0; ui--) {
      var q = order[ui];
      while (upper.length >= 2 && (turns++, cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)) {
        upper.pop();
        yield snap(lowerFinal, upper, q, 'upper', 'pop', 'Same rule on the way back: pop any vertex that bends the wrong way.', 'run');
      }
      upper.push(q);
      yield snap(lowerFinal, upper, q, 'upper', 'push', 'Extend the upper hull. Upper chain: ' + upper.length + ' vertices.', 'run');
    }
    var upperFinal = upper.slice(0, upper.length - 1);

    yield snap(lowerFinal, upperFinal, -1, 'done', 'done',
      'Done — the lower and upper chains close into the convex hull: ' + (lowerFinal.length + upperFinal.length) + ' vertices wrapping all ' + n + ' points. Every turn is a left turn.', 'done');
  }

  function draw(ctx, snap, w, h, theme) {
    var pts = snap.pts; if (!pts) return;
    var pad = 28;
    var sx = w - 2 * pad, sy = h - 2 * pad, s = Math.min(sx, sy);
    var ox = (w - s) / 2, oy = (h - s) / 2;
    function X(i) { return ox + pts[i][0] * s; }
    function Y(i) { return oy + (1 - pts[i][1]) * s; }   // flip y (math up)

    var hull = snap.hull;
    // hull polygon (done) or the two chains (in progress)
    ctx.save();
    ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    if (hull && hull.length >= 2) {
      ctx.strokeStyle = theme.invariant; ctx.fillStyle = theme.invariant;
      ctx.globalAlpha = 0.10; ctx.beginPath();
      ctx.moveTo(X(hull[0]), Y(hull[0])); for (var f = 1; f < hull.length; f++) ctx.lineTo(X(hull[f]), Y(hull[f])); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.stroke();
    } else {
      ctx.strokeStyle = theme.accent;
      function chain(arr) { if (arr.length < 2) return; ctx.beginPath(); ctx.moveTo(X(arr[0]), Y(arr[0])); for (var k = 1; k < arr.length; k++) ctx.lineTo(X(arr[k]), Y(arr[k])); ctx.stroke(); }
      chain(snap.lower); chain(snap.upper);
    }
    ctx.restore();

    // points
    var onHull = {};
    if (hull) for (var hi = 0; hi < hull.length; hi++) onHull[hull[hi]] = true;
    for (var i = 0; i < pts.length; i++) {
      var r = 4;
      var color = theme.muted;
      if (hull) { if (onHull[i]) { color = theme.invariant; r = 5; } }
      else if (i === snap.current) { color = theme.warn; r = 6; }
      else if (snap.lower.indexOf(i) !== -1 || snap.upper.indexOf(i) !== -1) { color = theme.accent; r = 5; }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(i), Y(i), r, 0, Math.PI * 2); ctx.fill();
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
