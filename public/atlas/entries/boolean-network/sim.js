/* Random Boolean Networks — Kauffman's NK model, and the order→chaos transition.
 *
 * N nodes ("genes"), each ON/OFF (1/0). At construction every node is wired to
 * K randomly chosen input nodes and given a RANDOM Boolean function — a lookup
 * table of 2^K outputs, each 0/1 drawn with bias p (P(out=1)=p). The whole net
 * updates SYNCHRONOUSLY: every node's next state is its function applied to its
 * K inputs' current states. Being deterministic, the net eventually falls into a
 * repeating attractor (a state cycle).
 *
 * The star is the connectivity-K transition:
 *   K=1  ordered  — almost everything freezes; tiny attractors; damage dies.
 *   K=2  critical — a frozen core plus a thin twinkle; the "edge of chaos".
 *                   (critical connectivity Kc = 1/(2p(1-p)); = 2 at p=0.5.)
 *   K>=3 chaotic  — almost everything twinkles; long attractors; damage explodes.
 *
 * DAMAGE SPREADING (the showpiece + the rigorous order parameter): we run TWO
 * copies of the SAME network (identical wiring + functions) from initial states
 * that differ in just ONE node, and track the Hamming distance — the number of
 * nodes that differ — over time. In the ordered regime the damage heals to 0; in
 * the chaotic regime it spreads to a finite fraction of the net; at criticality
 * it is marginal. This is the cleanest signature of the edge of chaos.
 *
 * STORAGE (all typed arrays, precomputed once per network):
 *   wiring[i*K + j]  -> the j-th input node index of node i
 *   table[i*M + idx] -> Boolean function of node i (M = 2^K rows), idx is the
 *                       packed K-bit address of its inputs' states (bit j = input j)
 *   stateA, stateB   -> the two copies' current states (Uint8Array, 0/1)
 * One synchronous step is O(N*K): for each node, pack its K inputs into idx, read
 * table[i*M+idx]. Two copies share wiring+table.
 *
 * VISUALIZATION — a space-time raster with a damage overlay. Node index on x,
 * time scrolling top→bottom on y; each pixel = copy-A's state (dark/bright). Where
 * the two copies DIFFER, the pixel is painted a hot accent so you literally watch
 * damage heal (a few hot streaks that vanish) or flood (hot static filling in).
 * Ordered regime ⇒ mostly frozen vertical streaks; chaos ⇒ TV static. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  // ON bright teal, OFF near-black; damaged (differing) nodes in a hot accent.
  const ON = [120, 226, 209], OFF = [10, 14, 18];
  const DMG = [255, 96, 84], DMG_OFF = [150, 40, 36];
  const BG = [8, 10, 13];

  class BooleanNetwork extends Sim {
    constructor(mount) {
      super(mount, { aspect: 0.62 });
      this.N = 1024;
      this.K = 2;
      this.p = 0.5;
      this.stateA = null;       // Uint8Array(N), 0/1 — the reference copy
      this.stateB = null;       // Uint8Array(N), 0/1 — the perturbed copy
      this._nextA = null;
      this._nextB = null;
      this.wiring = null;       // Int32Array(N*K)
      this.table = null;        // Uint8Array(N*(2^K))
      this._M = 0;              // 2^K, rows per truth table
      this._diff = null;        // Uint8Array(N), 1 where copies differ (for draw)
      this._recent = null;      // ring buffer of recent stateA snapshots (frozen frac)
      this._recentLen = 12;
      this._recentFill = 0;
      this._hamHist = [];       // recent Hamming distances (for the trend sparkline)
      this._rng = mulberry32(0xB001E5);
      this._img = null;
      this._stRows = 0;
      this._stFilled = 0;
    }

    setup() {
      if (this.params) {
        if (this.params.N != null) this.N = this.params.N | 0;
        if (this.params.K != null) this.K = this.params.K | 0;
        if (this.params.p != null) this.p = +this.params.p;
      }
      this.N = clampInt(this.N, 16, 4096);
      this.K = clampInt(this.K, 1, 5);
      this.build();
      this._initRaster();
    }

    onResize() { this._initRaster(); }

    // deterministic RNG control for tests / reproducible networks
    seedRng(s) { this._rng = mulberry32(s >>> 0); }

    // ---- network construction ----
    // Build fresh random wiring + random Boolean functions + a random initial
    // state, then make copy B identical to A except for ONE flipped node.
    build() {
      const N = this.N, K = this.K;
      const M = this._M = 1 << K;                 // 2^K rows per truth table
      this.wiring = new Int32Array(N * K);
      this.table = new Uint8Array(N * M);
      this.stateA = new Uint8Array(N);
      this.stateB = new Uint8Array(N);
      this._nextA = new Uint8Array(N);
      this._nextB = new Uint8Array(N);
      this._diff = new Uint8Array(N);
      this._recent = new Uint8Array(N * this._recentLen);
      this._recentFill = 0;
      this._hamHist = [];

      // Random wiring: each node draws K input nodes (self allowed; duplicates
      // allowed — the standard NK construction). Random truth tables with bias p.
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < K; j++) this.wiring[i * K + j] = (this._rng() * N) | 0;
        const base = i * M;
        for (let r = 0; r < M; r++) this.table[base + r] = this._rng() < this.p ? 1 : 0;
      }

      // Random initial state for copy A; copy B is identical but for one node.
      for (let i = 0; i < N; i++) this.stateA[i] = this._rng() < 0.5 ? 1 : 0;
      this.stateB.set(this.stateA);
      this._perturbOne();
      this._computeDiff();
    }

    // Flip exactly one node in copy B relative to A (the "damage").
    _perturbOne() {
      const i = (this._rng() * this.N) | 0;
      this.stateB[i] = this.stateB[i] ? 0 : 1;
    }

    // Re-perturb from a fresh identical pair (button / regime change without a
    // whole new network).
    reseed() {
      for (let i = 0; i < this.N; i++) this.stateA[i] = this._rng() < 0.5 ? 1 : 0;
      this.stateB.set(this.stateA);
      this._perturbOne();
      this._recentFill = 0;
      this._hamHist = [];
      this._computeDiff();
      this._initRaster();
      if (!this.running && this._setupDone) this._renderOnce();
    }

    // Change K (or N, or p) and rebuild a brand-new network from scratch.
    setK(k) { this.K = clampInt(k | 0, 1, 5); this.build(); this._initRaster();
      if (!this.running && this._setupDone) this._renderOnce(); }
    setN(n) { this.N = clampInt(n | 0, 16, 4096); this.build(); this._initRaster();
      if (!this.running && this._setupDone) this._renderOnce(); }
    setP(p) { this.p = clamp(+p, 0.01, 0.99); this.build(); this._initRaster();
      if (!this.running && this._setupDone) this._renderOnce(); }

    // ---- dynamics: synchronous deterministic update of one copy ----
    // For node i, pack its K inputs' current states into a K-bit address (bit j =
    // input j), then look up its truth table. dst[i] = table[i*M + idx].
    _stepCopy(src, dst) {
      const N = this.N, K = this.K, M = this._M, wiring = this.wiring, table = this.table;
      for (let i = 0; i < N; i++) {
        let idx = 0;
        const wbase = i * K;
        for (let j = 0; j < K; j++) idx |= src[wiring[wbase + j]] << j;
        dst[i] = table[i * M + idx];
      }
    }

    // Advance both copies one synchronous tick. Deterministic.
    stepOnce() {
      this._stepCopy(this.stateA, this._nextA);
      this._stepCopy(this.stateB, this._nextB);
      let t;
      t = this.stateA; this.stateA = this._nextA; this._nextA = t;
      t = this.stateB; this.stateB = this._nextB; this._nextB = t;
      this._recordRecent();
      this._computeDiff();
    }

    step() {
      this.stepOnce();
      this._pushRasterRow();
    }

    // ---- observables ----
    // Hamming distance between the two copies = number of differing nodes.
    hamming() {
      const a = this.stateA, b = this.stateB, N = this.N;
      let d = 0;
      for (let i = 0; i < N; i++) if (a[i] !== b[i]) d++;
      return d;
    }

    // Fraction of nodes whose state has NOT changed over the recent window
    // (copy A). 1.0 = fully frozen; near 0 = everything twinkling.
    frozenFraction() {
      const N = this.N, L = this.recentDepth();
      if (L < 2) return 1;
      const buf = this._recent;
      let frozen = 0;
      for (let i = 0; i < N; i++) {
        let same = true;
        const v0 = buf[i * this._recentLen];
        for (let k = 1; k < L; k++) {
          if (buf[i * this._recentLen + k] !== v0) { same = false; break; }
        }
        if (same) frozen++;
      }
      return frozen / N;
    }

    recentDepth() { return Math.min(this._recentFill, this._recentLen); }

    // Push the current stateA into the recent ring (newest at slot 0..L-1).
    _recordRecent() {
      const N = this.N, L = this._recentLen, buf = this._recent, a = this.stateA;
      // shift each node's history by one and write newest at the end
      const k = this._recentFill % L;
      for (let i = 0; i < N; i++) buf[i * L + k] = a[i];
      this._recentFill++;
    }

    _computeDiff() {
      const a = this.stateA, b = this.stateB, N = this.N, diff = this._diff;
      let d = 0;
      for (let i = 0; i < N; i++) { const x = a[i] !== b[i] ? 1 : 0; diff[i] = x; d += x; }
      this._hamHist.push(d);
      if (this._hamHist.length > 256) this._hamHist.shift();
      return d;
    }

    // Critical connectivity Kc = 1/(2 p (1-p))  (Derrida–Pomeau annealed result).
    criticalK() { return 1 / (2 * this.p * (1 - this.p)); }

    // Regime label inferred from K vs Kc (with measured damage as a tie-breaker).
    regime() {
      const Kc = this.criticalK();
      const ham = this.hamming();
      // very close to the critical line → "critical"
      if (Math.abs(this.K - Kc) < 0.4) return 'critical';
      if (this.K < Kc) return 'ordered';
      // K > Kc: chaotic, but call it ordered if damage has actually healed away
      if (ham === 0 && this._hamHist.length > 8) return 'ordered*';
      return 'chaotic';
    }

    // ---- raster (scrolling ImageData: N columns × time rows) ----
    _initRaster() {
      const N = this.N;
      // one column per node, capped so very large N still maps to canvas width
      const cols = Math.min(N, 1024);
      this._cols = cols;
      const rows = Math.max(16, Math.round(this.height / (this.width / cols)));
      this._stRows = rows;
      this._stFilled = 0;
      if (this.ctx && this.ctx.createImageData) {
        try { this._img = this.ctx.createImageData(cols, rows); }
        catch (e) { this._img = null; }
      } else this._img = null;
      if (this._img) {
        const d = this._img.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = BG[0]; d[i + 1] = BG[1]; d[i + 2] = BG[2]; d[i + 3] = 255;
        }
        this._paintRowAt(0);
        this._stFilled = 1;
      }
    }

    // Paint the current state (A, with damage overlay) into raster row `rowIndex`.
    _paintRowAt(rowIndex) {
      const img = this._img;
      if (!img) return;
      const w = img.width, d = img.data, N = this.N;
      const a = this.stateA, diff = this._diff;
      const base = rowIndex * w * 4;
      for (let x = 0; x < w; x++) {
        // map raster column → node index (nearest), so cols<N still samples evenly
        const i = w === N ? x : ((x * N / w) | 0);
        const on = a[i];
        const dmg = diff[i];
        const c = dmg ? (on ? DMG : DMG_OFF) : (on ? ON : OFF);
        const o = base + x * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }

    _pushRasterRow() {
      const img = this._img;
      if (!img) return;
      const w = img.width, h = img.height, d = img.data;
      const rowBytes = w * 4;
      if (this._stFilled < h) {
        this._paintRowAt(this._stFilled);
        this._stFilled++;
      } else {
        d.copyWithin(0, rowBytes, h * rowBytes);
        this._paintRowAt(h - 1);
      }
    }

    draw(ctx, w, h) {
      ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
      ctx.fillRect(0, 0, w, h);
      if (this._img) {
        const off = this._offscreen();
        if (off.ctx.putImageData) off.ctx.putImageData(this._img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off.canvas, 0, 0, this._img.width, this._img.height, 0, 0, w, h);
      }
      this._drawHamTrend(ctx, w, h);
    }

    // A small Hamming-distance trend strip along the bottom: damage as a fraction
    // of N over recent steps. Heals to the floor (order) or rises to a plateau
    // (chaos).
    _drawHamTrend(ctx, w, h) {
      const hist = this._hamHist;
      if (!hist || hist.length < 2 || !ctx.beginPath) return;
      const N = this.N;
      const sw = w, sh = Math.max(28, Math.round(h * 0.12));
      const y0 = h - sh;
      ctx.fillStyle = 'rgba(8,10,13,0.66)';
      ctx.fillRect(0, y0, sw, sh);
      ctx.strokeStyle = 'rgba(255,96,84,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const n = hist.length;
      for (let k = 0; k < n; k++) {
        const frac = hist[k] / N;                       // 0..1
        const x = (k / (n - 1)) * sw;
        const y = h - 2 - frac * (sh - 4);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // label
      ctx.fillStyle = 'rgba(230,238,240,0.85)';
      ctx.font = '11px ui-monospace, monospace';
      if (ctx.fillText) ctx.fillText('Hamming damage / N', 8, y0 + 13);
    }

    _offscreen() {
      if (!this._off || !this._img ||
          this._off.canvas.width !== this._img.width ||
          this._off.canvas.height !== this._img.height) {
        const canvas = (typeof document !== 'undefined' && document.createElement)
          ? document.createElement('canvas') : null;
        if (canvas && this._img) {
          canvas.width = this._img.width; canvas.height = this._img.height;
          this._off = { canvas, ctx: canvas.getContext('2d') };
        } else {
          this._off = { canvas: { width: 1, height: 1 }, ctx: { putImageData() {} } };
        }
      }
      return this._off;
    }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clampInt(v, lo, hi) { v = v | 0; return v < lo ? lo : v > hi ? hi : v; }

  // small deterministic PRNG so networks + tests are reproducible
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- mount + controls ----
  const sim = new BooleanNetwork('#stage');
  sim.start();
  sim.stepsPerFrame = 1;

  // randomize → a fresh random network: new wiring + functions + initial state
  sim.standardRail({
    randomize: () => { sim.seedRng((Math.random() * 2 ** 32) >>> 0); sim.build(); sim._initRaster();
      if (!sim.running) sim._renderOnce(); },
  });

  // re-perturb the SAME network from a fresh identical pair (watch damage again)
  sim.button('✦ re-damage', () => { sim.reseed(); });

  // THE knob: connectivity K (integer 1..5). Rebuilds a new network.
  sim.slider('K', {
    min: 1, max: 5, step: 1, value: 2,
    fmt: v => (v | 0) + ' inputs/node',
    onInput: v => sim.setK(v | 0),
  });

  // number of genes
  sim.slider('N', {
    min: 256, max: 2048, step: 64, value: 1024,
    fmt: v => (v | 0) + ' genes',
    onInput: v => sim.setN(v | 0),
  });

  // output bias p — shifts the critical connectivity Kc = 1/(2p(1-p))
  sim.slider('bias p', {
    min: 0.1, max: 0.9, step: 0.05, value: 0.5,
    fmt: v => v.toFixed(2),
    onInput: v => sim.setP(v),
  });

  // sim ticks per rendered frame
  sim.slider('speed', {
    min: 1, max: 8, step: 1, value: 2, fmt: v => v + ' steps/frame',
    onInput: v => { sim.stepsPerFrame = v | 0; },
  });
  sim.stepsPerFrame = 2;

  sim.readout(s => {
    const Kc = s.criticalK();
    const reg = s.regime();
    const ham = s.hamming();
    const frz = (s.frozenFraction() * 100).toFixed(0);
    return `K=${s.K} (Kc≈${Kc.toFixed(2)})  ·  ${reg}  ·  frozen ${frz}%  ·  ` +
      `damage ${ham}/${s.N} (${((ham / s.N) * 100).toFixed(1)}%)`;
  });
})();
