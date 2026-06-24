/* =====================================================================
 * union-find / algo.js  —  The Atlas of Algorithms (Trees & Structures)
 * ---------------------------------------------------------------------
 * Disjoint-set union (union–find). Each element points to a parent; the
 * root identifies its set. union-by-rank attaches the shorter tree under
 * the taller; path compression re-points every node on a find straight to
 * the root, keeping trees almost flat — so operations are near-constant
 * (inverse-Ackermann) amortized. One source of truth (ADR-0001); reg. 0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Union–Find',
    slug: 'union-find',
    family: 'structures',
    oneLiner: 'Track a growing collection of disjoint sets and merge them in nearly constant time — the backbone of connectivity.',
    invariant: 'Two elements are in the same set if and only if a find from each reaches the same root.',
    cost: { time: 'O(α(n)) amortized', space: 'O(n)' },
    controls: [
      { key: 'n', type: 'slider', label: 'Elements', min: 6, max: 14, step: 1, value: 10 },
      { key: 'shuffle', type: 'button', label: 'New unions',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(3, params.n || 10);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var parent = []; var rank = [];
    for (var i = 0; i < n; i++) { parent.push(i); rank.push(0); }
    var unions = [];   // successful union pairs, for the oracle

    function rootOf(x) { while (parent[x] !== x) x = parent[x]; return x; }
    function setsCount() { var c = 0; for (var i = 0; i < n; i++) if (parent[i] === i) c++; return c; }

    function snap(hl, annotation, status) {
      return {
        n: n, parent: parent.slice(), highlight: hl || {},
        readout: [
          { label: 'elements', value: n },
          { label: 'sets', value: setsCount() },
          { label: hl.op || 'op', value: hl.opText || '' }
        ],
        annotation: annotation, status: status
      };
    }

    yield snap({ op: 'start', opText: 'all singletons' }, 'Every element starts in its own set, pointing to itself (green = a root). Union merges two sets; find walks to the root and compresses the path.', 'start');

    var attempts = n + 2;
    for (var t = 0; t < attempts; t++) {
      var a = Math.floor(rng() * n), b = Math.floor(rng() * n);
      if (a === b) { b = (b + 1) % n; }
      // find a with path compression
      var ra = a, pa = []; while (parent[ra] !== ra) { pa.push(ra); ra = parent[ra]; }
      var rb = b, pb = []; while (parent[rb] !== rb) { pb.push(rb); rb = parent[rb]; }
      yield snap({ op: 'find', opText: 'find(' + a + '), find(' + b + ')', path: pa.concat(pb), nodesAB: [a, b], roots: [ra, rb] },
        'Union(' + a + ', ' + b + '): find each one\'s root (' + a + '→' + ra + ', ' + b + '→' + rb + '), compressing the paths.', 'find');
      for (var c = 0; c < pa.length; c++) parent[pa[c]] = ra;     // path compression
      for (var d = 0; d < pb.length; d++) parent[pb[d]] = rb;
      if (ra === rb) {
        yield snap({ op: 'union', opText: a + ' ~ ' + b + ' (already)', nodesAB: [a, b], roots: [ra, rb], same: true },
          a + ' and ' + b + ' are already in the same set (same root ' + ra + ') — nothing to merge.', 'noop');
        continue;
      }
      // union by rank
      var winner, loser;
      if (rank[ra] < rank[rb]) { parent[ra] = rb; winner = rb; loser = ra; }
      else if (rank[ra] > rank[rb]) { parent[rb] = ra; winner = ra; loser = rb; }
      else { parent[rb] = ra; rank[ra]++; winner = ra; loser = rb; }
      unions.push([a, b]);
      yield snap({ op: 'union', opText: 'union(' + a + ', ' + b + ')', nodesAB: [a, b], roots: [winner, loser], unionEdge: [loser, winner] },
        'Different roots → attach the shorter tree (root ' + loser + ') under the taller (root ' + winner + '). One fewer set.', 'union');
    }

    var rootArr = []; for (var z = 0; z < n; z++) rootArr.push(rootOf(z));
    var fin = snap({ op: 'done', opText: setsCount() + ' sets' }, 'Done. After ' + unions.length + ' merges there are ' + setsCount() + ' sets; path compression has flattened the trees so future finds are nearly O(1).', 'done');
    fin.report = { n: n, parent: parent.slice(), unions: unions, rootOf: rootArr };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var n = snap.n, parent = snap.parent, hl = snap.highlight || {};
    var pad = 40, y = h * 0.66;
    var gapX = (w - 2 * pad) / Math.max(1, n - 1);
    function X(i) { return pad + i * gapX; }
    var pathSet = {}; if (hl.path) for (var p = 0; p < hl.path.length; p++) pathSet[hl.path[p]] = true;
    var abSet = {}; if (hl.nodesAB) for (var q = 0; q < hl.nodesAB.length; q++) abSet[hl.nodesAB[q]] = true;
    var rad = Math.max(10, Math.min(20, gapX * 0.32));

    // parent arcs (curve up from child to parent)
    ctx.save();
    for (var i = 0; i < n; i++) {
      if (parent[i] === i) continue;
      var x1 = X(i), x2 = X(parent[i]);
      var lift = Math.min(90, 26 + Math.abs(parent[i] - i) * 10);
      var midx = (x1 + x2) / 2, midy = y - lift;
      var isUnion = hl.unionEdge && hl.unionEdge[0] === i;
      ctx.strokeStyle = isUnion ? theme.warn : (pathSet[i] ? theme.accent : (theme.line || theme.grid));
      ctx.globalAlpha = isUnion || pathSet[i] ? 1 : 0.55; ctx.lineWidth = isUnion ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y - rad); ctx.quadraticCurveTo(midx, midy, x2, y - rad); ctx.stroke();
      // arrowhead near parent
      var ang = Math.atan2((y - rad) - midy, x2 - midx);
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath();
      ctx.moveTo(x2, y - rad);
      ctx.lineTo(x2 - 8 * Math.cos(ang - 0.4), (y - rad) - 8 * Math.sin(ang - 0.4));
      ctx.lineTo(x2 - 8 * Math.cos(ang + 0.4), (y - rad) - 8 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // nodes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var k = 0; k < n; k++) {
      var isRoot = parent[k] === k;
      var fill = isRoot ? theme.invariant : (theme.panel_2 || theme.panel);
      if (abSet[k]) fill = theme.warn;
      else if (pathSet[k]) fill = theme.accent;
      ctx.fillStyle = fill; ctx.strokeStyle = isRoot ? theme.invariant : (theme.line || theme.grid); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(k), y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = (isRoot || abSet[k] || pathSet[k]) ? theme.bg : theme.ink; ctx.font = '600 ' + Math.max(10, rad * 0.7) + 'px ' + (theme.mono || 'monospace');
      ctx.fillText(String(k), X(k), y + 0.5);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
