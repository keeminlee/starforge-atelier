/* =====================================================================
 * binary-heap / algo.js  —  The Atlas of Algorithms (Trees & Structures)
 * ---------------------------------------------------------------------
 * An array-backed binary MIN-heap: node i has children 2i+1, 2i+2. Insert
 * appends then sifts up; extract-min returns the root, moves the last
 * element up, and sifts down. The heap property — every parent ≤ its
 * children — is restored after each op, so the root is always the minimum.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Binary Heap',
    slug: 'binary-heap',
    family: 'structures',
    oneLiner: 'A tree packed into an array that always serves the smallest item next — the engine inside a priority queue.',
    invariant: 'Every parent is ≤ both of its children, so the minimum is always at the root.',
    cost: { time: 'O(log n) per op', space: 'O(n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Values', min: 5, max: 18, step: 1, value: 12 },
      { key: 'shuffle', type: 'button', label: 'New values',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(3, params.n || 12);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var values = []; for (var v = 0; v < n; v++) values.push(10 + Math.floor(rng() * 90));
    var heap = [], output = [];

    function snap(hl, phase, action, settled, annotation) {
      return {
        heap: heap.slice(), highlight: hl || {}, phase: phase, action: action, settled: !!settled,
        output: output.slice(), size: heap.length, inserted: values.slice(),
        readout: [
          { label: 'phase', value: phase },
          { label: 'heap size', value: heap.length },
          { label: 'extracted', value: output.length + ' / ' + n }
        ],
        annotation: annotation, status: settled ? 'settled' : action
      };
    }

    function swap(i, j) { var t = heap[i]; heap[i] = heap[j]; heap[j] = t; }

    yield snap({}, 'build', 'start', true, 'A min-heap: insert each value (append, then sift up), then extract the minimum repeatedly. The root is always the smallest.');

    // --- inserts (sift up) ---
    for (var k = 0; k < values.length; k++) {
      var x = values[k];
      heap.push(x);
      yield snap({ node: heap.length - 1 }, 'insert', 'append', false, 'Insert ' + x + ': append at the end of the array (a new leaf), then sift it up.');
      var i = heap.length - 1;
      while (i > 0) {
        var par = (i - 1) >> 1;
        if (heap[i] < heap[par]) { swap(i, par); yield snap({ node: par, compare: i }, 'insert', 'sift-up', false, heap[par] + ' < its parent → swap up to keep parent ≤ child.'); i = par; }
        else break;
      }
      yield snap({}, 'insert', 'settled', true, x + ' placed; the heap property holds again.');
    }

    // --- extract-mins (sift down) ---
    while (heap.length > 0) {
      var mn = heap[0];
      output.push(mn);
      yield snap({ node: 0 }, 'extract', 'root', false, 'Extract-min: the root ' + mn + ' is the smallest element. Remove it.');
      var last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        yield snap({ node: 0 }, 'extract', 'move-last', false, 'Move the last leaf (' + last + ') to the root, then sift it down.');
        var p = 0;
        while (true) {
          var l = 2 * p + 1, r = 2 * p + 2, sm = p;
          if (l < heap.length && heap[l] < heap[sm]) sm = l;
          if (r < heap.length && heap[r] < heap[sm]) sm = r;
          if (sm !== p) { swap(p, sm); yield snap({ node: sm, compare: p }, 'extract', 'sift-down', false, 'Parent > smaller child → swap down.'); p = sm; }
          else break;
        }
      }
      yield snap({}, 'extract', 'settled', true, 'Extracted ' + mn + '. Output (sorted so far): [' + output.join(', ') + '].');
    }

    yield snap({}, 'done', 'done', true, 'Done — extract-min drained the heap in sorted order: [' + output.join(', ') + ']. That is exactly heapsort.');
  }

  function draw(ctx, snap, w, h, theme) {
    var heap = snap.heap, s = heap.length;
    var hl = snap.highlight || {};
    var pad = 24;
    var arrayH = 40;
    var treeTop = pad, treeBot = h - arrayH - 54;
    var levels = s > 0 ? Math.floor(Math.log2(s)) + 1 : 1;
    var levelH = (treeBot - treeTop) / Math.max(1, levels);
    var rad = Math.max(10, Math.min(20, levelH * 0.32, w / (Math.pow(2, levels - 1) * 2.4)));

    function pos(i) {
      var level = Math.floor(Math.log2(i + 1));
      var cnt = Math.pow(2, level), idxInLevel = i - (cnt - 1);
      return { x: pad + ((idxInLevel + 0.5) / cnt) * (w - 2 * pad), y: treeTop + (level + 0.5) * levelH };
    }

    // edges
    ctx.save(); ctx.strokeStyle = theme.line || theme.grid; ctx.lineWidth = 1.5;
    for (var i = 1; i < s; i++) { var a = pos(i), b = pos((i - 1) >> 1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.restore();

    // nodes
    var fontPx = Math.max(9, rad * 0.85);
    ctx.font = '600 ' + fontPx + 'px ' + (theme.mono || 'monospace');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var k = 0; k < s; k++) {
      var p = pos(k);
      var fill = theme.panel_2 || theme.panel, ink = theme.ink, ring = theme.line || theme.grid;
      if (k === hl.node) { fill = theme.accent; ink = theme.bg; ring = theme.accent; }
      else if (k === hl.compare) { fill = theme.warn; ink = theme.bg; ring = theme.warn; }
      else if (k === 0) { fill = theme.invariant; ink = theme.bg; ring = theme.invariant; }   // the min at the root
      ctx.fillStyle = fill; ctx.strokeStyle = ring; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillText(String(heap[k]), p.x, p.y + 0.5);
    }

    // backing array + extracted output, at the bottom
    var ay = h - arrayH - 26;
    var n = snap.inserted.length;
    var cw = Math.min(34, (w - 2 * pad) / n);
    ctx.font = '600 ' + Math.max(9, cw * 0.42) + 'px ' + (theme.mono || 'monospace');
    for (var c = 0; c < s; c++) {
      var x = pad + c * cw;
      var afill = (c === hl.node) ? theme.accent : (c === hl.compare ? theme.warn : (c === 0 ? theme.invariant : (theme.panel_2 || theme.panel)));
      ctx.fillStyle = afill; ctx.fillRect(x + 1, ay, cw - 2, arrayH * 0.6);
      ctx.fillStyle = (c === hl.node || c === hl.compare || c === 0) ? theme.bg : theme.muted;
      ctx.fillText(String(heap[c]), x + cw / 2, ay + arrayH * 0.3 + 0.5);
    }
    // output (sorted, green) below
    if (snap.output.length) {
      ctx.fillStyle = theme.invariant; ctx.textAlign = 'left';
      ctx.font = Math.max(10, cw * 0.4) + 'px ' + (theme.mono || 'monospace');
      ctx.fillText('out → ' + snap.output.join('  '), pad, ay + arrayH * 0.6 + 16);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
