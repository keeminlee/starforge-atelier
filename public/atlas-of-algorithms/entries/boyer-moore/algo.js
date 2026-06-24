/* =====================================================================
 * boyer-moore / algo.js  —  The Atlas of Algorithms (Strings & Text)
 * ---------------------------------------------------------------------
 * Boyer–Moore substring search (bad-character rule). Align the pattern and
 * compare RIGHT-TO-LEFT. On a mismatch at text char c, shift the pattern so
 * c lines up with its last occurrence in the pattern (if c isn't in the
 * pattern, skip past it entirely) — often jumping many positions at once,
 * so search can be sub-linear. One source of truth (ADR-0001); reg. 0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Boyer–Moore',
    slug: 'boyer-moore',
    family: 'strings',
    oneLiner: 'Search by comparing the pattern back-to-front and skipping ahead — often examining only a fraction of the text.',
    invariant: 'A bad-character shift never moves the pattern past a real occurrence: every match is still found.',
    cost: { time: 'O(n/m) best, O(nm) worst', space: 'O(alphabet)' },
    controls: [
      { key: 'm', type: 'slider', label: 'Pattern length', min: 2, max: 5, step: 1, value: 3 },
      { key: 'shuffle', type: 'button', label: 'New text',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var m = Math.max(2, Math.min(5, params.m || 3));
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;
    var ALPHA = 'ABCD'.split('');
    var nLen = 28;

    var text = []; for (var i = 0; i < nLen; i++) text.push(ALPHA[Math.floor(rng() * ALPHA.length)]);
    var pattern = []; for (var p = 0; p < m; p++) pattern.push(ALPHA[Math.floor(rng() * ALPHA.length)]);
    // plant 2 occurrences so there's something to find
    for (var plant = 0; plant < 2; plant++) {
      var at = Math.floor(rng() * (nLen - m));
      for (var q = 0; q < m; q++) text[at + q] = pattern[q];
    }

    var last = {}; for (var c = 0; c < ALPHA.length; c++) last[ALPHA[c]] = -1;
    for (var li = 0; li < m; li++) last[pattern[li]] = li;

    var matches = [], comparisons = 0;

    function snap(s, j, st, annotation, extra) {
      var base = {
        text: text.slice(), pattern: pattern.slice(), m: m, s: s, j: j, matches: matches.slice(),
        status: st, comparisons: comparisons,
        readout: [
          { label: 'text len', value: nLen },
          { label: 'matches', value: matches.length },
          { label: 'comparisons', value: comparisons }
        ],
        annotation: annotation
      };
      if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) base[k] = extra[k];
      return base;
    }

    yield snap(0, m - 1, 'start', 'Search right-to-left from each alignment. The bad-character table records each letter\'s last position in the pattern "' + pattern.join('') + '": ' + ALPHA.map(function (ch) { return ch + '=' + last[ch]; }).join(', ') + '.');

    var s = 0;
    while (s <= nLen - m) {
      var j = m - 1;
      while (j >= 0) {
        comparisons++;
        var match = text[s + j] === pattern[j];
        yield snap(s, j, match ? 'match-char' : 'mismatch',
          'Compare text[' + (s + j) + ']=' + text[s + j] + ' with pattern[' + j + ']=' + pattern[j] + (match ? ' → equal, keep checking left.' : ' → mismatch.'),
          match ? null : { badChar: text[s + j] });
        if (!match) break;
        j--;
      }
      if (j < 0) {
        matches.push(s);
        yield snap(s, 0, 'found', 'Whole pattern matched at position ' + s + '! Shift by 1 to look for overlapping occurrences.', { foundAt: s });
        s += 1;
      } else {
        var bc = text[s + j];
        var shift = Math.max(1, j - last[bc]);
        yield snap(s, j, 'shift', 'Bad character "' + bc + '" — its last position in the pattern is ' + last[bc] + ', so shift by max(1, ' + j + '−' + last[bc] + ') = ' + shift + '. Skip ' + (shift - 1) + ' alignment' + (shift - 1 === 1 ? '' : 's') + '.', { shift: shift });
        s += shift;
      }
    }

    yield snap(-1, -1, 'done', 'Done. Found ' + matches.length + ' occurrence' + (matches.length === 1 ? '' : 's') + ' of "' + pattern.join('') + '" in ' + comparisons + ' comparisons — skipping let us avoid scanning much of the text.', { finalMatches: matches.slice() });
  }

  function draw(ctx, snap, w, h, theme) {
    var text = snap.text, pattern = snap.pattern, n = text.length, m = snap.m, s = snap.s, j = snap.j;
    var pad = 24, cw = Math.min(46, (w - 2 * pad) / n), gap = 3;
    var totalW = n * cw, ox = (w - totalW) / 2;
    var yText = h * 0.30, yPat = h * 0.56, ch = Math.min(40, cw - gap);
    var matchSet = {}; for (var mm = 0; mm < snap.matches.length; mm++) for (var t = 0; t < m; t++) matchSet[snap.matches[mm] + t] = true;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 ' + Math.min(20, ch * 0.5) + 'px ' + (theme.mono || 'monospace');

    // text row
    for (var i = 0; i < n; i++) {
      var x = ox + i * cw;
      var inWindow = s >= 0 && i >= s && i < s + m;
      var fill = theme.panel, ink = theme.muted;
      if (matchSet[i]) { fill = theme.invariant; ink = theme.bg; }
      if (inWindow) { ink = theme.ink; }
      if (snap.status !== 'done' && i === s + j && s >= 0) {
        fill = (snap.status === 'mismatch' || snap.status === 'shift') ? theme.warn : (snap.status === 'found' ? theme.invariant : theme.accent); ink = theme.bg;
      }
      ctx.fillStyle = fill; ctx.fillRect(x, yText, ch, ch);
      ctx.fillStyle = ink; ctx.fillText(text[i], x + ch / 2, yText + ch / 2 + 1);
    }
    // index ticks
    ctx.fillStyle = theme.faint || theme.muted; ctx.font = '10px ' + (theme.mono || 'monospace');
    for (var ti = 0; ti < n; ti += 4) ctx.fillText(String(ti), ox + ti * cw + ch / 2, yText - 12);

    // pattern row (aligned at s)
    if (s >= 0) {
      ctx.font = '600 ' + Math.min(20, ch * 0.5) + 'px ' + (theme.mono || 'monospace');
      for (var pj = 0; pj < m; pj++) {
        var px = ox + (s + pj) * cw;
        var pfill = theme.panel_2 || theme.panel, pink = theme.muted;
        if (pj > j) { pfill = theme.invariant; pink = theme.bg; }        // matched suffix
        if (pj === j) { pfill = (snap.status === 'mismatch' || snap.status === 'shift') ? theme.warn : theme.accent; pink = theme.bg; }
        if (snap.status === 'found') { pfill = theme.invariant; pink = theme.bg; }
        ctx.fillStyle = pfill; ctx.strokeStyle = theme.line || theme.grid; ctx.lineWidth = 1.5;
        ctx.fillRect(px, yPat, ch, ch); ctx.strokeRect(px, yPat, ch, ch);
        ctx.fillStyle = pink; ctx.fillText(pattern[pj], px + ch / 2, yPat + ch / 2 + 1);
      }
    }
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
