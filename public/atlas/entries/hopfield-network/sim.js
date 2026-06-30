/* The Hopfield Network — associative memory as relaxation to an energy minimum.
 *
 * A grid of N = W×H McCulloch–Pitts neurons, each s_i ∈ {+1, −1}, drawn as a
 * bitmap (+1 = bright teal, −1 = dark). A handful of binary patterns ξ^p are
 * stored Hebbian-style as a symmetric weight matrix
 *
 *     W_ij = (1/N) Σ_p ξ^p_i ξ^p_j ,   W_ii = 0.
 *
 * Asynchronous dynamics: pick neurons (here in a randomly-shuffled sweep order)
 * and set s_i = sign(h_i) where the local field is h_i = Σ_j W_ij s_j (ties →
 * +1). Under this single-spin update the energy
 *
 *     E = −½ Σ_ij W_ij s_i s_j
 *
 * is non-increasing, so the state slides downhill to a fixed point — a stored
 * pattern (the emergent content-addressable memory) or, near/over capacity, a
 * spurious mixture. Show the net a corrupted cue and watch the noise melt away.
 *
 * IMPLEMENTATION CHOICE — field-from-patterns, NOT the full matrix.
 * We never materialise the N×N matrix. With s·ξ^p precomputed per loaded
 * pattern, the field is
 *     h_i = (1/N) Σ_p ξ^p_i (ξ^p · s)  −  (K/N) s_i        (the −W_ii s_i term)
 * i.e. O(K) per neuron, O(K·N) per sweep, with the W_ii=0 self-term subtracted
 * explicitly. This is mathematically identical to s_i·(Ws)_i with a zero
 * diagonal and is what the tests verify. */
(function () {
  'use strict';
  const { Sim } = Atlas;

  const CELL = 14;          // logical px per neuron (grid ≈ W*CELL wide)
  const GW = 24, GH = 24;   // 24×24 = 576 neurons
  const KMAX = 6;           // how many patterns are defined

  // +1 → bright teal; −1 → near-black. A neuron that just flipped is tinted.
  const ON = [120, 226, 209], OFF = [10, 14, 18];
  const FLIP_ON = [196, 247, 238], FLIP_OFF = [44, 70, 64];

  class Hopfield extends Sim {
    constructor(mount) {
      super(mount, { aspect: GH / GW });
      this.GW = GW; this.GH = GH;
      this.N = GW * GH;
      this.K = KMAX;                       // patterns defined
      this.loaded = 4;                     // patterns currently stored in W
      this.s = new Int8Array(this.N);      // current state, ±1
      this._flip = new Uint8Array(this.N); // 1 if neuron changed since last draw
      this.patterns = [];                  // Int8Array[K], each ±1
      this.patNames = [];
      this.recall = 0;                     // index of pattern used for the cue
      this._dot = null;                    // s·ξ^p cache, length = loaded
      this._order = null;                  // shuffled sweep order
      this._oi = 0;                        // cursor within the sweep
      this._rng = mulberry32(0xA5F0C3);    // deterministic by default
    }

    setup() {
      this.buildPatterns();
      if (this.params) {
        if (this.params.stored != null) this.loaded = this.params.stored | 0;
        if (this.params.recall != null) this.recall = this.params.recall | 0;
      }
      this.loaded = clampInt(this.loaded, 1, this.K);
      this.recall = clampInt(this.recall, 0, this.K - 1);
      // Present a corrupted cue of the current recall target.
      this.presentCue();
    }

    // ---- pattern bank: 6 bold, visually distinct glyphs on the 24×24 grid ----
    buildPatterns() {
      if (this.patterns.length) return;     // build once
      const N = this.N;
      const make = (fn) => {
        const p = new Int8Array(N);
        for (let y = 0; y < GH; y++)
          for (let x = 0; x < GW; x++)
            p[y * GW + x] = fn(x, y) ? 1 : -1;
        return p;
      };
      const cx = (GW - 1) / 2, cy = (GH - 1) / 2;
      // Six bold, recognizable glyphs chosen to be roughly balanced (~half +1)
      // AND mutually near-orthogonal (max pairwise |overlap| ≈ 0.16). Low
      // correlation is what keeps each one a clean attractor under Hebbian
      // storage — correlated patterns produce crosstalk that destabilizes recall.
      const defs = [
        ['heart', (x, y) => {            // filled heart  (~40% on)
          const X = (x - cx) / 11, Y = -(y - cy + 1.5) / 11;
          const v = (X * X + Y * Y - 0.5);
          return v * v * v - X * X * Y * Y * Y < 0;
        }],
        ['ring', (x, y) => {             // bold annulus / O  (~41% on)
          const r = Math.hypot(x - cx, y - cy);
          return r >= 5 && r <= 10;
        }],
        ['checker', (x, y) => {          // 4×4 checkerboard  (50% on)
          return ((x >> 2) + (y >> 2)) % 2 === 0;
        }],
        ['v-bars', (x, y) => {           // vertical stripes  (50% on)
          return ((x >> 2) & 1) === 0;
        }],
        ['h-bars', (x, y) => {           // horizontal stripes  (50% on)
          return ((y >> 2) & 1) === 0;
        }],
        ['pinwheel', (x, y) => {         // two opposite quadrants  (50% on)
          return (x < cx) !== (y < cy);
        }],
      ];
      this.patterns = defs.map(d => make(d[1]));
      this.patNames = defs.map(d => d[0]);
      this.K = this.patterns.length;
    }

    onResize() { /* fixed-size grid; layout handled in draw() */ }

    // deterministic RNG control (tests + reproducible cues)
    seedRng(seed) { this._rng = mulberry32(seed >>> 0); }

    // ---- cue / state setup ----
    // Set state to pattern p exactly.
    loadState(p) {
      const pat = this.patterns[p];
      for (let i = 0; i < this.N; i++) this.s[i] = pat[i];
      this._flip.fill(0);
      this._afterStateChange();
    }

    // Set state to a corrupted copy of the recall target: flip a fraction of
    // pixels chosen uniformly at random.
    presentCue() {
      const p = this.recall;
      const pat = this.patterns[p];
      const corr = this.params ? (this.params.corruption ?? 0.25) : 0.25;
      for (let i = 0; i < this.N; i++) {
        this.s[i] = (this._rng() < corr) ? -pat[i] : pat[i];
      }
      this._flip.fill(0);
      this._newSweep();
      this._afterStateChange();
    }

    // Present pure random noise (the "randomize" button).
    presentNoise() {
      for (let i = 0; i < this.N; i++) this.s[i] = this._rng() < 0.5 ? 1 : -1;
      this._flip.fill(0);
      this._newSweep();
      this._afterStateChange();
    }

    // Recompute the per-pattern dot products s·ξ^p for the loaded patterns.
    _afterStateChange() {
      const L = this.loaded;
      this._dot = new Float64Array(L);
      for (let p = 0; p < L; p++) {
        const pat = this.patterns[p];
        let d = 0;
        for (let i = 0; i < this.N; i++) d += pat[i] * this.s[i];
        this._dot[p] = d;
      }
      if (!this.running && this._setupDone) this._renderOnce();
    }

    setLoaded(k) {
      this.loaded = clampInt(k | 0, 1, this.K);
      this._afterStateChange();           // dot cache depends on #loaded
    }

    setRecall(p) {
      this.recall = clampInt(p | 0, 0, this.K - 1);
      this.presentCue();
    }

    // ---- dynamics ----
    // Local field h_i = (1/N) Σ_p ξ^p_i (ξ^p·s) − (K/N) s_i   (W_ii = 0).
    field(i) {
      const L = this.loaded, N = this.N;
      let h = 0;
      for (let p = 0; p < L; p++) h += this.patterns[p][i] * this._dot[p];
      h -= L * this.s[i];                  // remove self-coupling (diagonal)
      return h / N;
    }

    // Update one neuron asynchronously; returns true if it flipped. Keeps the
    // s·ξ^p dot cache consistent so the next field is correct.
    updateNeuron(i) {
      const h = this.field(i);
      const ns = h >= 0 ? 1 : -1;          // ties (h==0) → +1
      const old = this.s[i];
      if (ns !== old) {
        const delta = ns - old;            // ±2
        for (let p = 0; p < this.loaded; p++) this._dot[p] += this.patterns[p][i] * delta;
        this.s[i] = ns;
        this._flip[i] = 1;
        return true;
      }
      this._flip[i] = 0;
      return false;
    }

    // Build a fresh shuffled order for asynchronous sweeps.
    _newSweep() {
      if (!this._order || this._order.length !== this.N) this._order = new Int32Array(this.N);
      for (let i = 0; i < this.N; i++) this._order[i] = i;
      // Fisher–Yates with the sim RNG (deterministic when seeded).
      for (let i = this.N - 1; i > 0; i--) {
        const j = (this._rng() * (i + 1)) | 0;
        const t = this._order[i]; this._order[i] = this._order[j]; this._order[j] = t;
      }
      this._oi = 0;
    }

    // Perform `count` asynchronous neuron updates, in shuffled-sweep order,
    // reshuffling at the end of each pass. Returns #flips.
    updateMany(count) {
      let flips = 0;
      for (let c = 0; c < count; c++) {
        if (!this._order || this._oi >= this._order.length) this._newSweep();
        const i = this._order[this._oi++];
        if (this.updateNeuron(i)) flips++;
      }
      return flips;
    }

    step() {
      // clear last frame's flip flags, then update a batch of neurons
      this._flip.fill(0);
      const speed = this.params ? (this.params.speed | 0) : 24;
      this.updateMany(Math.max(1, speed));
    }

    // ---- observables ----
    // Energy E = −½ Σ_ij W_ij s_i s_j, computed without the matrix:
    //   Σ_ij W_ij s_i s_j = (1/N) Σ_p (ξ^p·s)² − (K/N) Σ_i s_i²
    //                     = (1/N) Σ_p (ξ^p·s)² − K   (since s_i² = 1)
    energy() {
      const L = this.loaded, N = this.N;
      let q = 0;
      for (let p = 0; p < L; p++) { const d = this._dot[p]; q += d * d; }
      const sum = (q / N) - L;             // Σ_ij W_ij s_i s_j (diagonal removed)
      return -0.5 * sum;
    }

    // Overlap m_p = (1/N) s·ξ^p with a given (or best-matching) stored pattern.
    overlap(p) {
      if (p == null) return this.bestOverlap().m;
      let d = 0; const pat = this.patterns[p];
      for (let i = 0; i < this.N; i++) d += pat[i] * this.s[i];
      return d / this.N;
    }

    // Best-matching loaded pattern and its overlap.
    bestOverlap() {
      let best = 0, bm = -2;
      for (let p = 0; p < this.loaded; p++) {
        const m = this.overlap(p);
        if (m > bm) { bm = m; best = p; }
      }
      return { p: best, m: bm };
    }

    // ---- pointer: flip neurons by drawing ----
    paintAt(pt, value) {
      const geo = this._geo;
      if (!geo) return;
      const x = Math.floor((pt.x - geo.ox) / geo.cell);
      const y = Math.floor((pt.y - geo.oy) / geo.cell);
      if (x < 0 || x >= GW || y < 0 || y >= GH) return;
      const i = y * GW + x;
      if (this.s[i] !== value) {
        const delta = value - this.s[i];
        for (let p = 0; p < this.loaded; p++) this._dot[p] += this.patterns[p][i] * delta;
        this.s[i] = value;
        this._flip[i] = 1;
      }
      if (!this.running) this._renderOnce();
    }

    // ---- render: crisp bitmap, centered ----
    draw(ctx, w, h) {
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, w, h);
      const cell = Math.max(1, Math.floor(Math.min(w / GW, h / GH)));
      const gw = cell * GW, gh = cell * GH;
      const ox = Math.floor((w - gw) / 2), oy = Math.floor((h - gh) / 2);
      this._geo = { cell, ox, oy };

      if (!this._img || this._img.width !== GW || this._img.height !== GH) {
        this._img = ctx.createImageData ? ctx.createImageData(GW, GH) : null;
      }
      if (!this._img || !this._img.data) return;   // headless stub
      const d = this._img.data;
      for (let i = 0, q = 0; i < this.N; i++, q += 4) {
        let c;
        if (this.s[i] > 0) c = this._flip[i] ? FLIP_ON : ON;
        else               c = this._flip[i] ? FLIP_OFF : OFF;
        d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
      }
      const off = this._scratch || (this._scratch = makeScratch());
      off.canvas.width = GW; off.canvas.height = GH;
      off.ctx.putImageData(this._img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      // source is the GW×GH offscreen bitmap; dest is the centered, upscaled grid
      ctx.drawImage(off.canvas, 0, 0, GW, GH, ox, oy, gw, gh);

      // subtle frame
      ctx.strokeStyle = 'rgba(120,226,209,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, gw - 1, gh - 1);
    }
  }

  function makeScratch() {
    const c = (typeof document !== 'undefined' && document.createElement)
      ? document.createElement('canvas') : { getContext: () => null, width: 0, height: 0 };
    return { canvas: c, ctx: c.getContext ? c.getContext('2d') : null };
  }

  function clampInt(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // small deterministic PRNG so cues + tests are reproducible
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- mount + controls ----
  const sim = new Hopfield('#stage');
  sim.start();
  sim.stepsPerFrame = 1;

  // randomize → fresh corrupted cue of the current recall target
  sim.standardRail({
    randomize: () => { sim.seedRng((Math.random() * 2 ** 32) >>> 0); sim.presentCue(); },
  });

  // extra button: pure noise, to watch which memory it falls into
  sim.button('▦ noise', () => { sim.presentNoise(); });

  // which stored pattern to cue
  sim.select('recall', sim.patNames.map((n, i) => ({ value: String(i), label: n })), {
    value: '0', onChange: v => sim.setRecall(parseInt(v, 10)),
  });

  // fraction of pixels flipped when presenting a cue
  sim.slider('corruption', {
    min: 0, max: 0.5, step: 0.01, value: 0.25,
    fmt: v => Math.round(v * 100) + '%',
    onInput: () => sim.presentCue(),
  });

  // how many of the K patterns are loaded into W (raise past capacity to spoil)
  sim.slider('stored', {
    min: 1, max: sim.K, step: 1, value: 4,
    fmt: v => (v | 0) + ' / ' + sim.K,
    onInput: v => sim.setLoaded(v | 0),
  });

  // neuron updates per frame
  sim.slider('speed', {
    min: 1, max: 96, step: 1, value: 24,
    fmt: v => (v | 0) + ' updates/frame',
  });

  // draw to flip neurons: pen lays +1, but flip the bit you touch first so a
  // single click toggles. We keep it simple: drag paints +1, shift not needed —
  // pointer-down on an ON cell erases (−1), on an OFF cell fills (+1).
  let penValue = 1;
  sim.onPointer((type, p) => {
    if (type === 'down') {
      const geo = sim._geo;
      if (geo) {
        const x = Math.floor((p.x - geo.ox) / geo.cell);
        const y = Math.floor((p.y - geo.oy) / geo.cell);
        if (x >= 0 && x < GW && y >= 0 && y < GH) penValue = sim.s[y * GW + x] > 0 ? -1 : 1;
      }
      sim.paintAt(p, penValue);
    } else if (type === 'drag') {
      sim.paintAt(p, penValue);
    }
  });

  sim.readout(s => {
    const b = s.bestOverlap();
    return `E ${s.energy().toFixed(3)}  ·  m ${b.m.toFixed(3)} (→ ${s.patNames[b.p]})` +
      `  ·  ${s.loaded}/${s.K} stored  ·  N=${s.N}`;
  });
})();
