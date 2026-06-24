/* =====================================================================
 * consistent-hashing / algo.js  —  The Atlas of Algorithms (Hashing Schemes)
 * ---------------------------------------------------------------------
 * Consistent hashing (Karger et al., 1997). Hash both keys and servers onto
 * a ring; a key is owned by the first server clockwise. Adding or removing a
 * server only reassigns the keys in its arc — about K/n of them — instead of
 * the near-total reshuffle that `hash(key) mod n` forces. Virtual nodes even
 * out the load. One source of truth (ADR-0001); registration per ADR-0007.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'Consistent Hashing',
    slug: 'consistent-hashing',
    family: 'hashing',
    oneLiner: 'Spread keys over a ring of servers so that adding or removing one moves almost nothing.',
    invariant: 'Adding or removing a node remaps only the keys in its arc — about K/n — not the whole table.',
    cost: { time: 'O(log n) lookup', space: 'O(n · vnodes)' },
    controls: [
      { key: 'nodes', type: 'slider', label: 'Servers', min: 2, max: 7, step: 1, value: 5 },
      { key: 'vnodes', type: 'slider', label: 'Virtual nodes each', min: 1, max: 16, step: 1, value: 8 },
      { key: 'shuffle', type: 'button', label: 'New ring',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function* run(input, params) {
    params = params || {};
    var P = Math.max(2, params.nodes || 5);
    var R = Math.max(1, params.vnodes || 8);
    var K = 40;
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;
    var rng = (root.Algo && root.Algo.rng) ? root.Algo.rng(seed) : Math.random;

    var keyHash = []; for (var i = 0; i < K; i++) keyHash.push(rng());
    // vnodes: R hashes per physical node
    var vnodes = []; for (var p = 0; p < P; p++) for (var r = 0; r < R; r++) vnodes.push({ hash: rng(), node: p });

    function ownersFor(activeCount) {
      var vs = vnodes.filter(function (vn) { return vn.node < activeCount; }).slice().sort(function (a, b) { return a.hash - b.hash; });
      var owner = [];
      for (var k = 0; k < K; k++) {
        var hh = keyHash[k], chosen = vs[0];               // wrap-around default
        for (var j = 0; j < vs.length; j++) if (vs[j].hash >= hh) { chosen = vs[j]; break; }
        owner.push(chosen.node);
      }
      return { owner: owner, vs: vs };
    }

    function load(owner, count) { var c = []; for (var i = 0; i < count; i++) c.push(0); for (var k = 0; k < owner.length; k++) c[owner[k]]++; return c; }

    function snap(active, owner, vs, moved, annotation, status) {
      return {
        K: K, P: P, R: R, active: active, keyHash: keyHash, owner: owner.slice(),
        vnodes: vs.map(function (v) { return { hash: v.hash, node: v.node }; }), moved: moved ? moved.slice() : [],
        load: load(owner, active), status: status,
        readout: [
          { label: 'servers', value: active + ' / ' + P },
          { label: 'keys', value: K },
          { label: status === 'add' ? 'keys moved' : 'phase', value: status === 'add' ? moved.length + ' (exp K/n=' + Math.round(K / active) + ')' : 'ring' }
        ],
        annotation: annotation
      };
    }

    var first = ownersFor(1);
    yield snap(1, first.owner, first.vs, [], 'One server owns the whole ring: every key maps clockwise to its only node. Now add servers one at a time and watch how few keys move.', 'start');

    var prevOwner = first.owner;
    for (var a = 2; a <= P; a++) {
      var res = ownersFor(a);
      var moved = []; for (var k = 0; k < K; k++) if (res.owner[k] !== prevOwner[k]) moved.push(k);
      yield snap(a, res.owner, res.vs, moved, 'Add server ' + (a - 1) + ' (' + R + ' virtual node' + (R === 1 ? '' : 's') + '): ' + moved.length + ' of ' + K + ' keys move to it — the expected share is K/' + a + ' ≈ ' + Math.round(K / a) + ', and more virtual nodes pull every server closer to it. With `mod n`, almost all ' + K + ' keys would move.', 'add');
      prevOwner = res.owner;
    }

    var fin = ownersFor(P);
    var ld = load(fin.owner, P);
    var fr = snap(P, fin.owner, fin.vs, [], 'All ' + P + ' servers on the ring. Each owns roughly K/' + P + ' ≈ ' + Math.round(K / P) + ' keys (virtual nodes smooth the spread); load ' + ld.join(', ') + '. Removing any server reassigns only its arc to neighbors.', 'done');
    fr.report = { K: K, P: P, R: R, keyHash: keyHash, vnodes: vnodes.map(function (v) { return { hash: v.hash, node: v.node }; }), owner: fin.owner, load: ld };
    yield fr;
  }

  function nodeColor(i) { return 'hsl(' + ((i * 53 + 8) % 360) + ', 62%, 60%)'; }

  function draw(ctx, snap, w, h, theme) {
    var cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 56;
    function ang(hsh) { return 2 * Math.PI * hsh - Math.PI / 2; }
    function PX(hsh, rad) { return cx + Math.cos(ang(hsh)) * rad; }
    function PY(hsh, rad) { return cy + Math.sin(ang(hsh)) * rad; }

    // ring
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // vnode ticks
    for (var v = 0; v < snap.vnodes.length; v++) {
      var vn = snap.vnodes[v], col = nodeColor(vn.node);
      ctx.strokeStyle = col; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(PX(vn.hash, R - 10), PY(vn.hash, R - 10)); ctx.lineTo(PX(vn.hash, R + 10), PY(vn.hash, R + 10)); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(PX(vn.hash, R + 18), PY(vn.hash, R + 18), 4, 0, Math.PI * 2); ctx.fill();
    }

    // keys (dots inside the ring, colored by owner)
    var movedSet = {}; for (var m = 0; m < snap.moved.length; m++) movedSet[snap.moved[m]] = true;
    for (var k = 0; k < snap.K; k++) {
      var owner = snap.owner[k], moved = movedSet[k];
      ctx.fillStyle = nodeColor(owner);
      ctx.beginPath(); ctx.arc(PX(snap.keyHash[k], R * 0.82), PY(snap.keyHash[k], R * 0.82), moved ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      if (moved) { ctx.strokeStyle = theme.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PX(snap.keyHash[k], R * 0.82), PY(snap.keyHash[k], R * 0.82), 8, 0, Math.PI * 2); ctx.stroke(); }
    }

    // legend (server swatches + load)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '12px ' + (theme.mono || 'monospace');
    var lx = 16, ly = 20;
    for (var s = 0; s < snap.active; s++) {
      ctx.fillStyle = nodeColor(s); ctx.fillRect(lx, ly - 6, 12, 12);
      ctx.fillStyle = theme.muted; ctx.fillText('srv ' + s + (snap.load && snap.load[s] != null ? '  (' + snap.load[s] + ')' : ''), lx + 18, ly);
      ly += 18;
    }
    // clockwise hint
    ctx.fillStyle = theme.faint || theme.muted; ctx.textAlign = 'center';
    ctx.fillText('↻ clockwise → next server owns the key', cx, cy);
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
