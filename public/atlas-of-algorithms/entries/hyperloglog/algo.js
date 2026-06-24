/* =====================================================================
 * hyperloglog / algo.js  —  The Atlas of Algorithms (Sketching & Streaming)
 * ---------------------------------------------------------------------
 * HyperLogLog (Flajolet et al., 2007) — estimate the number of DISTINCT
 * items in a stream using a few KB, never storing the items. Hash each item;
 * the first p bits pick one of m = 2^p registers; record the largest run of
 * leading zeros seen in the rest. A long run is rare, so the max run in a
 * register reveals how many distinct items landed there. The harmonic mean
 * across registers gives the count, with error ≈ 1.04/√m. ADR-0005.
 * ===================================================================== */
(function (root) {
  'use strict';

  var metadata = {
    title: 'HyperLogLog',
    slug: 'hyperloglog',
    family: 'streaming',
    oneLiner: 'Count distinct items in a massive stream using a few kilobytes — by watching the rarest hash patterns.',
    invariant: 'The estimate is unbiased with relative error ≈ 1.04/√m: more registers (m) means proportionally tighter estimates.',
    cost: { time: 'O(1) per item', space: 'O(m) registers' },
    controls: [
      { key: 'p', type: 'slider', label: 'Precision p (m = 2^p)', min: 4, max: 7, step: 1, value: 6 },
      { key: 'n', type: 'slider', label: 'Distinct items', min: 200, max: 2000, step: 200, value: 1200 },
      { key: 'shuffle', type: 'button', label: 'New stream',
        onClick: function (api) { api.setParam('nonce', (api.getParams().nonce || 0) + 1); } }
    ]
  };

  function alphaM(m) { return m === 16 ? 0.673 : m === 32 ? 0.697 : m === 64 ? 0.709 : 0.7213 / (1 + 1.079 / m); }

  function* run(input, params) {
    params = params || {};
    var p = Math.max(4, Math.min(7, params.p || 6));
    var m = 1 << p;
    var N = Math.max(50, params.n || 1200);
    var seed = ((params.nonce || 0) * 2654435761 + 1013904223) >>> 0;

    function hash(x) {
      var z = (x * 2654435761 + seed) >>> 0;
      z = Math.imul(z ^ (z >>> 16), 0x45d9f3b) >>> 0;
      z = Math.imul(z ^ (z >>> 16), 0x45d9f3b) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    }

    var reg = new Array(m).fill(0);
    var a = alphaM(m);
    function estimate() {
      var sum = 0, V = 0;
      for (var j = 0; j < m; j++) { sum += Math.pow(2, -reg[j]); if (reg[j] === 0) V++; }
      var E = a * m * m / sum;
      if (E <= 2.5 * m && V > 0) E = m * Math.log(m / V);    // small-range: linear counting
      return E;
    }

    function snap(seen, status, annotation) {
      var est = estimate();
      return {
        reg: reg.slice(), m: m, p: p, seen: seen, est: est, N: N,
        relErr: seen > 0 ? Math.abs(est - seen) / seen : 0, status: status,
        readout: [
          { label: 'registers m', value: m },
          { label: 'true / est', value: seen + ' / ' + Math.round(est) },
          { label: 'error', value: seen > 0 ? (Math.abs(est - seen) / seen * 100).toFixed(1) + '% (≈ ' + (1.04 / Math.sqrt(m) * 100).toFixed(0) + '% typical)' : '—' }
        ],
        annotation: annotation
      };
    }

    yield snap(0, 'start', m + ' registers, each tracking the longest run of leading zeros seen among the hashes routed to it. Stream in ' + N + ' distinct items and read off the count — without storing a single one.');

    var STEPS = 40, stride = Math.max(1, Math.floor(N / STEPS));
    for (var i = 1; i <= N; i++) {
      var h = hash(i);
      var j = h >>> (32 - p);                    // first p bits → register index
      var bits = 32 - p;
      var w = (h & (((1 << bits) >>> 0) - 1)) >>> 0;                 // remaining `bits` low bits
      var rho = (w === 0) ? (bits + 1) : (Math.clz32(w) - p + 1);    // leading zeros + 1
      if (rho > reg[j]) reg[j] = rho;
      if (i % stride === 0 || i === N) yield snap(i, 'stream', 'After ' + i + ' distinct items: estimate ' + Math.round(estimate()) + ' (true ' + i + '). The harmonic mean of m·2^register over the registers ≈ the count.');
    }

    var fin = snap(N, 'done', 'Done. Estimate ' + Math.round(estimate()) + ' vs true ' + N + ' — within the ≈ ' + (1.04 / Math.sqrt(m) * 100).toFixed(0) + '% typical error of m = ' + m + ' registers, using ~' + m + ' small counters instead of storing ' + N + ' items. More registers ⇒ tighter (error ∝ 1/√m).');
    fin.report = { m: m, p: p, reg: reg.slice(), est: estimate(), seen: N, relErr: Math.abs(estimate() - N) / N };
    yield fin;
  }

  function draw(ctx, snap, w, h, theme) {
    var maxR = Math.max(4, Math.max.apply(null, snap.reg));
    root.Algo.bars(ctx, {
      values: snap.reg, w: w, h: h, theme: theme, maxVal: maxR,
      colorFor: function (idx) { return snap.reg[idx] === 0 ? theme.panel : theme.accent; }
    });
  }

  var entry = { metadata: metadata, run: run, draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = entry;
  if (typeof root !== 'undefined') root.__ATLAS_ENTRY__ = entry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
