/* =====================================================================
 * huffman / algo.js  —  The Atlas of Algorithms (Compression & Coding)
 * ---------------------------------------------------------------------
 * Huffman coding. Treat each symbol as a leaf weighted by its frequency;
 * repeatedly merge the two least-frequent trees into one (summed weight)
 * until a single tree remains. Left/right edges = bits 0/1 give every
 * symbol a prefix-free code, and the greedy "merge the two smallest" rule
 * yields the optimal (shortest expected length) prefix code.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Huffman Coding',
    slug: 'huffman',
    family: 'compression',
    oneLiner: 'Give frequent symbols short codes and rare ones long codes — the optimal prefix-free code, built by merging the two rarest.',
    invariant: 'Merging the two least-frequent nodes is always safe: it builds an optimal prefix-free code (shortest expected length).',
    cost: { time: 'O(n log n)', space: 'O(n)' },
    controls: [
      { key: 'symbols', type: 'slider', label: 'Symbols', min: 3, max: 8, step: 1, value: 6 },
      { key: 'shuffle', type: 'button', label: 'New frequencies',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var k = Math.max(2, Math.min(8, params.symbols || 6));
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var alphabet = 'abcdefgh'.slice(0, k).split('');

    // skewed weights → a text; every symbol appears at least once.
    var weights = alphabet.map(function (_, i) { return Math.pow(0.62, i) * (0.7 + rng() * 0.6); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var textLen = 10 * k;
    var text = alphabet.slice();   // seed one of each
    for (var t = 0; t < textLen - k; t++) { var r = rng() * total, acc = 0, pick = 0; for (var wi = 0; wi < k; wi++) { acc += weights[wi]; if (r <= acc) { pick = wi; break; } } text.push(alphabet[pick]); }
    text = text.join('');
    var freq = {}; for (var c = 0; c < text.length; c++) freq[text[c]] = (freq[text[c]] || 0) + 1;
    var present = alphabet.filter(function (s) { return freq[s] > 0; });

    var nid = 0;
    function leaf(s) { return { syms: s, freq: freq[s], id: nid++, leaf: true }; }
    var forest = present.map(leaf);
    var N = present.length;

    function forestView(hl) {
      var sorted = forest.slice().sort(function (a, b) { return a.freq - b.freq || a.id - b.id; });
      return sorted.map(function (nd, i) { return { syms: nd.syms, freq: nd.freq, leaf: nd.leaf, merging: hl && i < 2 }; });
    }
    function snap(phase, annotation, status, extra) {
      var base = {
        phase: phase, N: N, symbols: present.length,
        readout: [
          { label: 'symbols', value: present.length },
          { label: phase === 'build' ? 'trees in forest' : 'codes', value: phase === 'build' ? forest.length : present.length },
          { label: 'total bits', value: extra && extra.totalBits != null ? extra.totalBits : '…' }
        ],
        annotation: annotation, status: status
      };
      if (extra) for (var key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) base[key] = extra[key];
      return base;
    }

    yield snap('build', 'Each symbol is a tree weighted by its frequency. Repeatedly merge the two lightest trees — that greedy choice builds the optimal code.', 'start', { forest: forestView(false) });

    while (forest.length > 1) {
      forest.sort(function (a, b) { return a.freq - b.freq || a.id - b.id; });
      var a = forest[0], b = forest[1];
      yield snap('build', 'Merge the two lightest: "' + a.syms + '" (' + a.freq + ') + "' + b.syms + '" (' + b.freq + ') → ' + (a.freq + b.freq) + '.', 'merge', { forest: forestView(true) });
      forest = forest.slice(2);
      forest.push({ syms: a.syms + b.syms, freq: a.freq + b.freq, id: nid++, leaf: false, left: a, right: b });
    }
    var rootNode = forest[0];

    // codes + tree layout
    var codes = {};
    (function rec(nd, code) { if (nd.leaf) { codes[nd.syms] = code || '0'; } else { rec(nd.left, code + '0'); rec(nd.right, code + '1'); } })(rootNode, '');
    var nodes = [], edges = [], leafX = 0, maxDepth = 0;
    (function layout(nd, depth) {
      maxDepth = Math.max(maxDepth, depth);
      if (nd.leaf) { nd._x = leafX++; } else { layout(nd.left, depth + 1); layout(nd.right, depth + 1); nd._x = (nd.left._x + nd.right._x) / 2; }
      nodes.push({ x: nd._x, depth: depth, leaf: nd.leaf, sym: nd.leaf ? nd.syms : '', freq: nd.freq });
      if (!nd.leaf) { edges.push({ x1: nd._x, d1: depth, x2: nd.left._x, d2: depth + 1, bit: '0' }); edges.push({ x1: nd._x, d1: depth, x2: nd.right._x, d2: depth + 1, bit: '1' }); }
    })(rootNode, 0);

    var totalBits = present.reduce(function (s, sym) { return s + codes[sym].length * freq[sym]; }, 0);
    var entropy = present.reduce(function (s, sym) { var p = freq[sym] / text.length; return s - p * Math.log2(p); }, 0);
    var fixedW = Math.ceil(Math.log2(present.length)) * text.length;

    yield snap('done', 'Done. The tree gives a prefix-free code; total ' + totalBits + ' bits vs ' + fixedW + ' fixed-width — averaging ' + (totalBits / text.length).toFixed(2) + ' bits/symbol (entropy ' + entropy.toFixed(2) + '). Frequent symbols got the shortest codes.', 'done',
      { tree: { nodes: nodes, edges: edges, maxLeaf: leafX - 1, maxDepth: maxDepth }, codes: codes, freq: freq, present: present, totalBits: totalBits, entropy: entropy, fixedW: fixedW, text: text });
  }

  function drawForest(ctx, snap, w, h, theme) {
    var f = snap.forest; if (!f) return;
    var pad = 20, cardW = Math.min(120, (w - 2 * pad) / Math.max(1, f.length) - 10), cardH = 54, gap = 10;
    var totalW = f.length * (cardW + gap) - gap, ox = (w - totalW) / 2, oy = h * 0.42;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < f.length; i++) {
      var x = ox + i * (cardW + gap);
      ctx.fillStyle = f[i].merging ? theme.accent : (theme.panel_2 || theme.panel);
      ctx.strokeStyle = f[i].merging ? theme.accent : (theme.line || theme.grid); ctx.lineWidth = 2;
      ctx.fillRect(x, oy, cardW, cardH); ctx.strokeRect(x, oy, cardW, cardH);
      ctx.fillStyle = f[i].merging ? theme.bg : theme.ink; ctx.font = '600 ' + Math.min(18, cardW * 0.3) + 'px ' + (theme.mono || 'monospace');
      ctx.fillText(f[i].syms.length > 5 ? f[i].syms.slice(0, 4) + '…' : f[i].syms, x + cardW / 2, oy + cardH * 0.36);
      ctx.fillStyle = f[i].merging ? theme.bg : theme.cost; ctx.font = Math.min(15, cardW * 0.26) + 'px ' + (theme.mono || 'monospace');
      ctx.fillText('freq ' + f[i].freq, x + cardW / 2, oy + cardH * 0.72);
    }
  }

  function drawTree(ctx, snap, w, h, theme) {
    var T = snap.tree; if (!T) return;
    var padL = 30, padR = 230, padT = 24, padB = 30;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    function X(x) { return padL + (T.maxLeaf > 0 ? x / T.maxLeaf : 0.5) * plotW; }
    function Y(d) { return padT + (T.maxDepth > 0 ? d / T.maxDepth : 0) * plotH; }
    ctx.save(); ctx.strokeStyle = theme.line || theme.grid; ctx.lineWidth = 1.5;
    ctx.font = '600 13px ' + (theme.mono || 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var e = 0; e < T.edges.length; e++) {
      var ed = T.edges[e];
      ctx.beginPath(); ctx.moveTo(X(ed.x1), Y(ed.d1)); ctx.lineTo(X(ed.x2), Y(ed.d2)); ctx.stroke();
      ctx.fillStyle = theme.muted; ctx.fillText(ed.bit, (X(ed.x1) + X(ed.x2)) / 2 + (ed.bit === '0' ? -9 : 9), (Y(ed.d1) + Y(ed.d2)) / 2);
    }
    ctx.restore();
    for (var n = 0; n < T.nodes.length; n++) {
      var nd = T.nodes[n], cx = X(nd.x), cy = Y(nd.depth);
      ctx.fillStyle = nd.leaf ? theme.invariant : (theme.panel_2 || theme.panel);
      ctx.strokeStyle = nd.leaf ? theme.invariant : (theme.line || theme.grid); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, nd.leaf ? 13 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (nd.leaf) { ctx.fillStyle = theme.bg; ctx.font = '600 13px ' + (theme.mono || 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(nd.sym, cx, cy + 0.5); }
    }
    // code table
    var tx = w - padR + 16, ty = padT + 6;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '13px ' + (theme.mono || 'monospace');
    ctx.fillStyle = theme.muted; ctx.fillText('symbol  freq  code', tx, ty); ty += 22;
    var syms = snap.present.slice().sort(function (a, b) { return snap.freq[b] - snap.freq[a]; });
    for (var s = 0; s < syms.length; s++) {
      ctx.fillStyle = theme.invariant; ctx.fillText(syms[s], tx, ty);
      ctx.fillStyle = theme.cost; ctx.fillText(String(snap.freq[syms[s]]), tx + 64, ty);
      ctx.fillStyle = theme.ink; ctx.fillText(snap.codes[syms[s]], tx + 120, ty);
      ty += 20;
    }
  }

  function draw(ctx, snap, w, h, theme) {
    if (snap.phase === 'done') drawTree(ctx, snap, w, h, theme); else drawForest(ctx, snap, w, h, theme);
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
