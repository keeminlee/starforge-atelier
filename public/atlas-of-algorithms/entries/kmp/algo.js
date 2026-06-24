/* =====================================================================
 * kmp / algo.js  —  The Atlas of Algorithms (Strings)
 * ---------------------------------------------------------------------
 * Knuth–Morris–Pratt string matching. Precompute a failure function (for
 * each prefix, the length of its longest proper prefix that is also a
 * suffix); then scan the text with two pointers, NEVER backing up the text
 * pointer — on a mismatch, the pattern jumps forward via the failure table.
 * One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var ALPHA = ['A', 'B'];   // 2 letters ⇒ frequent partial matches (KMP shines)

  var metadata = {
    title: 'Knuth–Morris–Pratt',
    slug: 'kmp',
    family: 'strings',
    oneLiner: 'Find a pattern in text in linear time by never re-reading a character — a precomputed failure table says how far to jump.',
    invariant: 'The text pointer never moves backward; each text character is examined O(1) times amortized.',
    cost: { time: 'O(n + m)', space: 'O(m)' },
    controls: [
      { key: 'textLen', type: 'slider', label: 'Text length', min: 16, max: 44, step: 2, value: 32 },
      { key: 'patLen', type: 'slider', label: 'Pattern length', min: 2, max: 6, step: 1, value: 4 },
      { key: 'shuffle', type: 'button', label: 'New text',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(8, params.textLen || 32);
    var m = Math.max(2, Math.min(n - 1, params.patLen || 4));
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    function rch() { return ALPHA[Math.floor(rng() * ALPHA.length)]; }

    var pat = ''; for (var pi = 0; pi < m; pi++) pat += rch();
    var arr = []; for (var ti = 0; ti < n; ti++) arr.push(rch());
    var embedAt = Math.floor(rng() * (n - m + 1));            // guarantee ≥1 occurrence
    for (var e = 0; e < m; e++) arr[embedAt + e] = pat[e];
    var text = arr.join('');

    // failure function (lps)
    var fail = new Array(m).fill(0);
    var k = 0;
    for (var fi = 1; fi < m; fi++) {
      while (k > 0 && pat[fi] !== pat[k]) k = fail[k - 1];
      if (pat[fi] === pat[k]) k++;
      fail[fi] = k;
    }

    var compares = 0, matches = [];
    function snap(i, j, status, annotation) {
      return {
        text: text, pat: pat, fail: fail, i: i, j: j, offset: i - j, matches: matches.slice(),
        n: n, m: m, compares: compares,
        readout: [
          { label: 'comparisons', value: compares },
          { label: 'matches', value: matches.length },
          { label: 'text pos', value: i + ' / ' + n }
        ],
        annotation: annotation, status: status
      };
    }

    yield snap(0, 0, 'start', 'Failure table built for "' + pat + '": [' + fail.join(',') + ']. Now slide the pattern through the text — but the text pointer only ever moves forward.');

    var j = 0;
    for (var i = 0; i < n; i++) {
      while (j > 0 && text[i] !== pat[j]) {
        compares++;
        yield snap(i, j, 'mismatch', 'text[' + i + ']="' + text[i] + '" ≠ pat[' + j + ']="' + pat[j] + '" → jump the pattern: j = failure[' + (j - 1) + '] = ' + fail[j - 1] + '. (text pointer stays at ' + i + '.)');
        j = fail[j - 1];
      }
      compares++;
      if (text[i] === pat[j]) {
        yield snap(i, j, 'match', 'text[' + i + ']="' + text[i] + '" = pat[' + j + '] → extend the match to length ' + (j + 1) + '.');
        j++;
      } else {
        yield snap(i, j, 'mismatch0', 'No match at the pattern start; advance the text pointer.');
      }
      if (j === m) {
        matches.push(i - m + 1);
        yield snap(i, m, 'found', 'Full pattern matched at position ' + (i - m + 1) + '! Jump via failure[' + (m - 1) + '] = ' + fail[m - 1] + ' to keep scanning (overlaps allowed).');
        j = fail[m - 1];
      }
    }
    yield snap(n, j, 'done', 'Done — scanned the whole text in one forward pass. Found ' + matches.length + ' occurrence' + (matches.length === 1 ? '' : 's') + ' of "' + pat + '" in ' + compares + ' comparisons.');
  }

  function draw(ctx, snap, w, h, theme) {
    var text = snap.text, pat = snap.pat; if (!text) return;
    var n = snap.n, m = snap.m, i = snap.i, j = snap.j, offset = snap.offset;
    var pad = 22;
    var cw = (w - 2 * pad) / n;
    var cellH = Math.min(cw, 54);
    var textY = h * 0.30, patY = textY + cellH + 26;

    // which text indices are inside a found match
    var matched = {};
    for (var mm = 0; mm < snap.matches.length; mm++) for (var d = 0; d < m; d++) matched[snap.matches[mm] + d] = true;

    var fontPx = Math.max(9, Math.min(22, cw * 0.5));
    ctx.font = '600 ' + fontPx + 'px ' + (theme.mono || 'monospace');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // text row
    for (var t = 0; t < n; t++) {
      var x = pad + t * cw;
      var fill = theme.panel, ink = theme.ink;
      if (matched[t]) { fill = theme.invariant; ink = theme.bg; }
      if (t === i && snap.status !== 'done') { fill = (snap.status === 'match' || snap.status === 'found') ? theme.accent : theme.warn; ink = theme.bg; }
      ctx.fillStyle = fill; ctx.fillRect(x + 1, textY, cw - 2, cellH);
      ctx.fillStyle = ink; ctx.fillText(text[t], x + cw / 2, textY + cellH / 2 + 1);
    }
    // pattern row, aligned at offset
    for (var p = 0; p < m; p++) {
      var col = offset + p;
      if (col < 0 || col >= n) continue;
      var px = pad + col * cw;
      var pfill = theme.panel_2 || theme.panel, pink = theme.muted;
      if (p < j) { pfill = theme.invariant; pink = theme.bg; }                 // matched prefix
      else if (p === j && snap.status !== 'done') { pfill = (snap.status === 'match' || snap.status === 'found') ? theme.accent : theme.warn; pink = theme.bg; } // current compare
      ctx.fillStyle = pfill; ctx.fillRect(px + 1, patY, cw - 2, cellH);
      ctx.fillStyle = pink; ctx.fillText(pat[p], px + cw / 2, patY + cellH / 2 + 1);
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
