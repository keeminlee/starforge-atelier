/* =====================================================================
 * lz77 / algo.js  —  The Atlas of Algorithms (Compression & Coding)
 * ---------------------------------------------------------------------
 * LZ77 (Lempel–Ziv, 1977) — dictionary compression by back-references.
 * Scan the text with a sliding WINDOW of already-seen characters plus a
 * LOOKAHEAD; find the longest lookahead prefix that already appears in the
 * window and emit a (offset, length, next-char) token that copies it.
 * Repeats collapse into tiny pointers — and it's perfectly lossless.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'LZ77',
    slug: 'lz77',
    family: 'compression',
    oneLiner: 'Compress by pointing back at what you have already seen — the sliding-window idea behind gzip and PNG.',
    invariant: 'Lossless: decoding the (offset, length, next-char) tokens reproduces the input exactly.',
    cost: { time: 'O(n · window)', space: 'O(window)' },
    controls: [
      { key: 'window', type: 'slider', label: 'Window size', min: 6, max: 24, step: 2, value: 16 },
      { key: 'shuffle', type: 'button', label: 'New text',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  var MAX_LEN = 9;   // lookahead buffer cap

  function* run(input, params) {
    params = params || {};
    var W = Math.max(4, params.window || 16);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    // build a repetitive text from a few short motifs (so back-references exist)
    var ALPHA = 'abcdr'.split('');
    var motifs = []; for (var m = 0; m < 3; m++) { var len = 2 + Math.floor(rng() * 2), s = ''; for (var c = 0; c < len; c++) s += ALPHA[Math.floor(rng() * ALPHA.length)]; motifs.push(s); }
    var text = ''; while (text.length < 32) text += motifs[Math.floor(rng() * motifs.length)];
    text = text.slice(0, 32);
    var n = text.length;

    var tokens = [];
    function snap(i, match, tok, status, annotation) {
      return {
        text: text, n: n, cursor: i, window: W, match: match || null, token: tok || null,
        tokens: tokens.slice(), status: status,
        readout: [
          { label: 'position', value: i + ' / ' + n },
          { label: 'tokens', value: tokens.length },
          { label: 'tokens vs chars', value: tokens.length + ' / ' + i + (i > 0 ? ' (' + (tokens.length / i).toFixed(2) + '×)' : '') }
        ],
        annotation: annotation
      };
    }

    yield snap(0, null, null, 'start', 'Slide a window of the last ' + W + ' characters across the text. At each position, find the longest upcoming run that already appeared in the window, and emit a pointer to it instead of the raw characters.');

    var i = 0;
    while (i < n) {
      var start = Math.max(0, i - W), bestLen = 0, bestOff = 0;
      for (var j = start; j < i; j++) {
        var l = 0;
        while (i + l < n && l < MAX_LEN && text[j + l] === text[i + l]) l++;   // overlap allowed
        if (l > bestLen) { bestLen = l; bestOff = i - j; }
      }
      var nextChar = (i + bestLen < n) ? text[i + bestLen] : '';
      var tok = { offset: bestLen > 0 ? bestOff : 0, length: bestLen, next: nextChar };
      tokens.push(tok);
      var match = bestLen > 0 ? { srcStart: i - bestOff, len: bestLen, tgtStart: i } : null;
      yield snap(i, match, tok, 'emit', bestLen > 0
        ? 'Longest match: copy ' + bestLen + ' char' + (bestLen === 1 ? '' : 's') + ' from ' + bestOff + ' back, then the literal "' + nextChar + '". Token (' + bestOff + ', ' + bestLen + ', ' + nextChar + ').'
        : 'No match in the window — emit the literal "' + nextChar + '" as token (0, 0, ' + nextChar + ').');
      i += bestLen + 1;
    }

    var raw = n, coded = tokens.length;
    var fin = snap(n, null, null, 'done', 'Done. ' + n + ' characters became ' + coded + ' tokens — each repeated run collapsed into a back-pointer. Decoding the tokens reproduces the text exactly (lossless). In DEFLATE, these tokens are then Huffman-coded for the final squeeze.');
    fin.report = { text: text, window: W, tokens: tokens.slice(), n: n };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var text = snap.text, n = snap.n;
    var pad = 24, cw = Math.min(42, (w - 2 * pad) / n), ch = Math.min(40, cw - 3);
    var totalW = n * cw, ox = (w - totalW) / 2, y = h * 0.40;
    var cursor = snap.cursor, W = snap.window;
    var match = snap.match;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 ' + Math.min(20, ch * 0.5) + 'px ' + (theme.mono || 'monospace');

    for (var i = 0; i < n; i++) {
      var x = ox + i * cw;
      var inWindow = i >= Math.max(0, cursor - W) && i < cursor;
      var fill = theme.panel, ink = theme.muted;
      if (i < cursor) { fill = theme.panel_2 || theme.panel; ink = theme.ink; }    // emitted
      if (inWindow) { ink = theme.ink; }
      // match source (in window) and target (lookahead)
      if (match) {
        if (i >= match.srcStart && i < match.srcStart + match.len) { fill = theme.accent; ink = theme.bg; }
        if (i >= match.tgtStart && i < match.tgtStart + match.len) { fill = theme.invariant; ink = theme.bg; }
      }
      if (snap.status === 'emit' && snap.token && i === cursor + (snap.token.length || 0)) { fill = theme.warn; ink = theme.bg; }   // next literal
      ctx.fillStyle = fill; ctx.fillRect(x, y, ch, ch);
      if (i === cursor && snap.status !== 'done') { ctx.strokeStyle = theme.warn; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, ch + 2, ch + 2); }
      ctx.fillStyle = ink; ctx.fillText(text[i], x + ch / 2, y + ch / 2 + 1);
    }

    // window underline bracket
    if (cursor > 0 && snap.status !== 'done') {
      var ws = Math.max(0, cursor - W);
      ctx.strokeStyle = theme.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox + ws * cw, y + ch + 8); ctx.lineTo(ox + cursor * cw - 3, y + ch + 8); ctx.stroke();
      ctx.fillStyle = theme.muted; ctx.font = '11px ' + (theme.mono || 'monospace'); ctx.textAlign = 'center';
      ctx.fillText('window', ox + (ws + cursor) / 2 * cw, y + ch + 22);
    }

    // emitted tokens, wrapped
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '12px ' + (theme.mono || 'monospace');
    var tx = pad, ty = y + ch + 48, lineH = 18, colW = 92;
    ctx.fillStyle = theme.muted; ctx.fillText('tokens (offset, length, next):', tx, ty); ty += lineH + 2;
    var perRow = Math.max(1, Math.floor((w - 2 * pad) / colW));
    for (var t = 0; t < snap.tokens.length; t++) {
      var tk = snap.tokens[t], col = t % perRow, rowi = Math.floor(t / perRow);
      ctx.fillStyle = tk.length > 0 ? theme.accent : theme.faint || theme.muted;
      ctx.fillText('(' + tk.offset + ',' + tk.length + ',' + tk.next + ')', tx + col * colW, ty + rowi * lineH);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
