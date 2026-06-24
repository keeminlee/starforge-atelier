/* =====================================================================
 * skip-list / algo.js  —  The Atlas of Algorithms (Randomized & Probabilistic)
 * ---------------------------------------------------------------------
 * A skip list (Pugh, 1990): a sorted linked list with stacked "express
 * lanes." Each element is promoted to the next level with probability ½, so
 * higher lanes are exponentially sparser. Search rides the top lane, moving
 * right while the next key is smaller and dropping a level when it would
 * overshoot — expected O(log n), no rotations. One source of truth (ADR-0001).
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Skip List',
    slug: 'skip-list',
    family: 'randomized',
    oneLiner: 'Balanced search without the balancing — random express lanes give expected O(log n) with a coin flip.',
    invariant: 'Search is exact (finds every present key, rejects absent ones); the random levels give expected O(log n) height and search.',
    cost: { time: 'O(log n) expected', space: 'O(n) expected' },
    controls: [
      { key: 'n', type: 'slider', label: 'Keys', min: 8, max: 18, step: 1, value: 13 },
      { key: 'target', type: 'slider', label: 'Search for', min: 1, max: 99, step: 1, value: 50 },
      { key: 'shuffle', type: 'button', label: 'New levels',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var n = Math.max(4, params.n || 13);
    var target = params.target != null ? params.target : 50;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    // distinct sorted keys
    var set = {}, keys = [];
    while (keys.length < n) { var v = 2 + Math.floor(rng() * 96); if (!set[v]) { set[v] = 1; keys.push(v); } }
    keys.sort(function (a, b) { return a - b; });

    // random tower heights: level 0 always; promote with prob 1/2 (capped)
    var cap = Math.ceil(Math.log2(n + 1)) + 1;
    var level = keys.map(function () { var l = 0; while (rng() < 0.5 && l < cap - 1) l++; return l; });
    var H = 1; for (var i = 0; i < n; i++) H = Math.max(H, level[i] + 1);

    function snap(visited, cur, status, annotation, foundIdx) {
      return {
        keys: keys, level: level, n: n, H: H, target: target,
        visited: visited ? visited.slice() : [], cur: cur || null, foundIdx: foundIdx == null ? -1 : foundIdx,
        status: status,
        readout: [
          { label: 'keys', value: n },
          { label: 'height', value: H + ' lane' + (H === 1 ? '' : 's') },
          { label: status === 'done' ? 'result' : 'searching', value: status === 'done' ? (foundIdx >= 0 ? 'found ' + target : target + ' absent') : 'for ' + target }
        ],
        annotation: annotation
      };
    }

    yield snap([], null, 'start', 'Built from ' + n + ' keys; each was promoted upward on coin-flips, so taller towers are rarer (≈ ' + H + ' lanes for ' + n + ' keys). Search for ' + target + ': start top-left and ride the express lanes.', -1);

    // search: from sentinel (idx -1), top lane down
    var idx = -1, lvl = H - 1, visited = [{ col: 0, level: lvl }];
    function nextInLane(fromIdx, L) { for (var j = fromIdx + 1; j < n; j++) if (level[j] >= L) return j; return -1; }
    yield snap(visited, { col: 0, level: lvl }, 'search', 'Start at the sentinel on the top lane (level ' + lvl + ').', -1);

    while (lvl >= 0) {
      var nx = nextInLane(idx, lvl);
      if (nx >= 0 && keys[nx] < target) {
        idx = nx; visited.push({ col: idx + 1, level: lvl });
        yield snap(visited, { col: idx + 1, level: lvl }, 'search', keys[idx] + ' < ' + target + ' → move right to ' + keys[idx] + ' on lane ' + lvl + '.', -1);
      } else if (lvl === 0) {
        break;
      } else {
        lvl--; visited.push({ col: idx + 1, level: lvl });
        yield snap(visited, { col: idx + 1, level: lvl }, 'search', (nx >= 0 ? keys[nx] + ' ≥ ' + target : 'no node ahead') + ' → drop down to lane ' + lvl + '.', -1);
      }
    }
    var cand = nextInLane(idx, 0);
    var found = cand >= 0 && keys[cand] === target;
    var foundIdx = found ? cand : -1;
    var done = snap(visited, { col: (found ? cand : idx) + 1, level: 0 }, 'done',
      found ? 'Found ' + target + ' at level 0 — the search took ' + visited.length + ' steps, about log₂(' + n + ') ≈ ' + Math.round(Math.log2(n)) + '.'
        : target + ' is not present: the search lands between ' + (idx >= 0 ? keys[idx] : '−∞') + ' and ' + (cand >= 0 ? keys[cand] : '+∞') + ', where it would be inserted.',
      foundIdx);
    done.report = { keys: keys, level: level, n: n, H: H, target: target, found: found, foundIdx: foundIdx, steps: visited.length };
    yield done;
  }

  function draw(ctx, snap, w, h, theme) {
    var n = snap.n, H = snap.H, keys = snap.keys, level = snap.level;
    var padX = 40, padY = 36, plotW = w - 2 * padX, plotH = h - 2 * padY;
    var laneGap = Math.min(58, plotH / Math.max(1, H));
    function XC(col) { return padX + col * (plotW / (n + 1)); }     // col 0 = sentinel
    function YL(L) { return padY + (H - 1 - L) * laneGap + 20; }
    var box = Math.min(30, plotW / (n + 1) * 0.6);

    var visKey = {}; for (var v = 0; v < snap.visited.length; v++) visKey[snap.visited[v].col + ':' + snap.visited[v].level] = true;

    // lane links
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1.5;
    for (var L = 0; L < H; L++) {
      var prevX = XC(0), y = YL(L);
      for (var j = 0; j < n; j++) if (level[j] >= L) { ctx.beginPath(); ctx.moveTo(prevX, y); ctx.lineTo(XC(j + 1), y); ctx.stroke(); prevX = XC(j + 1); }
    }
    // sentinel tower
    for (var L2 = 0; L2 < H; L2++) {
      var on = visKey['0:' + L2];
      ctx.fillStyle = on ? theme.accent : (theme.panel_2 || theme.panel); ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.5;
      ctx.fillRect(XC(0) - box / 2, YL(L2) - box / 2, box, box); ctx.strokeRect(XC(0) - box / 2, YL(L2) - box / 2, box, box);
      ctx.fillStyle = on ? theme.bg : theme.muted; ctx.font = '11px ' + (theme.mono || 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (L2 === 0) ctx.fillText('−∞', XC(0), YL(0));
    }
    // nodes
    for (var j2 = 0; j2 < n; j2++) {
      for (var L3 = 0; L3 <= level[j2]; L3++) {
        var key = (j2 + 1) + ':' + L3, onPath = visKey[key];
        var isFound = snap.foundIdx === j2;
        var fill = theme.panel_2 || theme.panel, ink = theme.ink;
        if (onPath) { fill = theme.accent; ink = theme.bg; }
        if (isFound && snap.status === 'done') { fill = theme.invariant; ink = theme.bg; }
        var cx = XC(j2 + 1), cy = YL(L3);
        ctx.fillStyle = fill; ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.5;
        ctx.fillRect(cx - box / 2, cy - box / 2, box, box); ctx.strokeRect(cx - box / 2, cy - box / 2, box, box);
        ctx.fillStyle = ink; ctx.font = '600 ' + Math.min(13, box * 0.5) + 'px ' + (theme.mono || 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (L3 === 0) ctx.fillText(String(keys[j2]), cx, cy);
      }
    }
    // current pointer
    if (snap.cur) {
      ctx.strokeStyle = theme.warn; ctx.lineWidth = 2.5;
      ctx.strokeRect(XC(snap.cur.col) - box / 2 - 3, YL(snap.cur.level) - box / 2 - 3, box + 6, box + 6);
    }
    // lane labels
    ctx.fillStyle = theme.faint || theme.muted; ctx.font = '10px ' + (theme.mono || 'monospace'); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var L4 = 0; L4 < H; L4++) ctx.fillText('L' + L4, padX - 10, YL(L4));
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
